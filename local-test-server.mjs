/**
 * Local Development Server for Enhanced Lunch Table
 * Works with the new Lambda architecture using cache manager and API server
 */

import http from "http";
import { URL } from "url";
import { handler as apiHandler } from "./src/lambdas/api-server.mjs";
import { handler as dataCollectorHandler } from "./src/lambdas/data-collector.mjs";

// Mock DynamoDB data for local development
const mockCachedData = {
  "niagara-week-47": [
    {
      week: 47,
      weekday: "måndag",
      name: "Grillad kyckling",
      description: "Med potatis och sallad",
      price: 125,
      restaurant: "niagara",
      lastUpdated: new Date().toISOString(),
    },
    {
      week: 47,
      weekday: "tisdag",
      name: "Fish and chips",
      description: "Med remouladsås",
      price: 130,
      restaurant: "niagara",
      lastUpdated: new Date().toISOString(),
    },
    {
      week: 47,
      weekday: "onsdag",
      name: "Vegetarisk lasagne",
      description: "Med sallad",
      price: 120,
      restaurant: "niagara",
      lastUpdated: new Date().toISOString(),
    },
    {
      week: 47,
      weekday: "torsdag",
      name: "Korv stroganoff",
      description: "Med ris och pickles",
      price: 115,
      restaurant: "niagara",
      lastUpdated: new Date().toISOString(),
    },
    {
      week: 47,
      weekday: "fredag",
      name: "Friterad torsk",
      description: "Med pommes och remoulad",
      price: 135,
      restaurant: "niagara",
      lastUpdated: new Date().toISOString(),
    },
  ],
};

// Mock cache manager functions
const originalCacheManager = await import("./cache-manager.mjs");

// Override cache functions for local development
global.mockMode = true;

// Mock getCachedLunchData function
const originalGetCachedLunchData = originalCacheManager.getCachedLunchData;
originalCacheManager.getCachedLunchData = async function(restaurantId, week) {
  console.log(`📦 [MOCK] Getting cached data for ${restaurantId}, week ${week}`);

  const key = `${restaurantId}-week-${week}`;
  const data = mockCachedData[key] || [];

  if (data.length === 0) {
    console.log(`⚠️  [MOCK] No data found for ${key}, trying previous week`);
    const previousWeekKey = `${restaurantId}-week-${week - 1}`;
    const fallbackData = mockCachedData[previousWeekKey] || [];

    if (fallbackData.length > 0) {
      console.log(`✅ [MOCK] Found fallback data for week ${week - 1}`);
      return fallbackData;
    }
  }

  console.log(`✅ [MOCK] Returning ${data.length} items for ${key}`);
  return data;
};

// Mock cacheLunchData function
originalCacheManager.cacheLunchData = async function(restaurantId, week, lunches, metadata) {
  console.log(`💾 [MOCK] Caching ${lunches.length} items for ${restaurantId}, week ${week}`);
  const key = `${restaurantId}-week-${week}`;
  mockCachedData[key] = lunches.map(lunch => ({
    ...lunch,
    restaurant: restaurantId,
    lastUpdated: new Date().toISOString(),
  }));
  return { success: true, itemCount: lunches.length };
};

// Development configuration
const DEV_CONFIG = {
  port: 3000,
  enableDataCollection: true,
  mockData: true,
  logRequests: true,
};

// Development mode switches
const scenarios = {
  normal: "Normal operation with mock data",
  empty: "Empty cache scenario",
  error: "Error handling scenario",
  stale: "Stale data scenario",
};

console.log("🚀 Enhanced Lunch Table - Local Development Server");
console.log("================================================");
console.log(`Port: ${DEV_CONFIG.port}`);
console.log(`Mock Data: ${DEV_CONFIG.mockData ? "Enabled" : "Disabled"}`);
console.log(`Data Collection: ${DEV_CONFIG.enableDataCollection ? "Enabled" : "Disabled"}`);
console.log("\n📋 Available test scenarios:");
Object.entries(scenarios).forEach(([key, desc]) => {
  console.log(`  - /?scenario=${key} - ${desc}`);
});
console.log("  - /data-collection - Trigger data collection manually");
console.log("  - /?day=måndag - Filter by specific day");
console.log("  - /?week=46 - Use specific week");
console.log("\n");

const server = http.createServer(async (request, response) => {
  const startTime = Date.now();
  const url = new URL(request.url, `http://localhost:${DEV_CONFIG.port}`);

  if (DEV_CONFIG.logRequests) {
    console.log(`\n🌐 ${request.method} ${url.pathname}${url.search}`);
  }

  try {
    // Handle data collection endpoint
    if (url.pathname === "/data-collection") {
      console.log("🔄 Triggering data collection...");

      const mockContext = {
        awsRequestId: `local-${Date.now()}`,
      };

      const result = await dataCollectorHandler({}, mockContext);

      response.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      response.write(JSON.stringify(result, null, 2));
      response.end();
      return;
    }

    // Handle test scenarios
    const scenario = url.searchParams.get("scenario");
    if (scenario) {
      setupTestScenario(scenario);
    }

    // Create Lambda event object
    const event = {
      httpMethod: request.method,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: {
        "User-Agent": request.headers["user-agent"],
        "Accept": request.headers.accept,
      },
    };

    const mockContext = {
      awsRequestId: `local-${Date.now()}`,
    };

    // Call the API server Lambda
    const result = await apiHandler(event, mockContext);

    // Set response headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...result.headers,
    };

    response.writeHead(result.statusCode, headers);
    response.write(result.body);
    response.end();

    const duration = Date.now() - startTime;
    if (DEV_CONFIG.logRequests) {
      console.log(`✅ Response: ${result.statusCode} (${duration}ms)`);
      if (result.headers["X-Data-Points"]) {
        console.log(`📊 Data points: ${result.headers["X-Data-Points"]}`);
      }
    }

  } catch (error) {
    console.error("❌ Server error:", error);

    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Local Server Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .error { background: #ffebee; padding: 20px; border-radius: 8px; color: #d32f2f; }
        .stack { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px; overflow-x: auto; font-family: monospace; }
    </style>
</head>
<body>
    <h1>Local Development Server Error</h1>
    <div class="error">
        <h3>${error.message}</h3>
        <div class="stack">${error.stack}</div>
    </div>
    <p><a href="/">← Back to lunch table</a></p>
</body>
</html>`;

    response.writeHead(500, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    response.write(errorHtml);
    response.end();
  }
});

// Setup test scenarios
function setupTestScenario(scenario) {
  console.log(`🎭 Setting up test scenario: ${scenario}`);

  switch (scenario) {
    case "empty":
      // Clear all mock data
      Object.keys(mockCachedData).forEach(key => {
        mockCachedData[key] = [];
      });
      console.log("   📭 Cache cleared - empty data scenario");
      break;

    case "error":
      // Mock an error in cache retrieval
      originalCacheManager.getCachedLunchData = async function() {
        throw new Error("Mock DynamoDB connection failed");
      };
      console.log("   💥 Cache error scenario activated");
      break;

    case "stale":
      // Set old timestamps
      Object.keys(mockCachedData).forEach(key => {
        mockCachedData[key] = mockCachedData[key].map(lunch => ({
          ...lunch,
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        }));
      });
      console.log("   🕒 Stale data scenario activated");
      break;

    default:
      console.log("   ✨ Normal scenario (default)");
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down local development server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

// Start server
server.listen(DEV_CONFIG.port, () => {
  console.log(`🎯 Server running at http://localhost:${DEV_CONFIG.port}`);
  console.log("   Press Ctrl+C to stop");
});

export { server, DEV_CONFIG };
