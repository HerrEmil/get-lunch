/**
 * Local Development Server for Enhanced Lunch Table
 * Simple approach with inline mocking for development
 */

import http from "http";
import { URL } from "url";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock cached data for local development
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

// Mock logger for development
const mockLogger = {
  info: (message, data) => console.log(`ℹ️  [INFO] ${message}`, data || ""),
  debug: (message, data) => console.log(`🐛 [DEBUG] ${message}`, data || ""),
  warn: (message, data) => console.log(`⚠️  [WARN] ${message}`, data || ""),
  error: (message, data, error) => {
    console.log(`❌ [ERROR] ${message}`, data || "");
    if (error) console.log(error);
  },
};

// Mock cache functions
const mockGetCachedLunchData = async (restaurantId, week) => {
  console.log(
    `📦 [MOCK] Getting cached data for ${restaurantId}, week ${week}`,
  );

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

// Simple API handler that mimics the Lambda structure
const mockApiHandler = async (event, context) => {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const selectedDay = queryParams.day || getCurrentSwedishWeekday();
    const week = queryParams.week
      ? parseInt(queryParams.week)
      : getCurrentWeek();

    console.log(`🔍 Processing request: day=${selectedDay}, week=${week}`);

    // Get HTML template
    const html = getHtmlTemplate();

    // Fetch mock cached data
    const lunchData = await fetchMockCachedData(week);

    // Filter data by selected day
    const filteredData = filterDataByDay(lunchData, selectedDay);

    // Add cache metadata
    const dataWithMetadata = addCacheMetadata(filteredData, week);

    // Inject data into HTML
    const responseHtml = injectDataIntoHtml(html, dataWithMetadata);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Request completed in ${duration}ms with ${filteredData.length} items`,
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Response-Time": `${duration}ms`,
        "X-Data-Points": filteredData.length.toString(),
        "X-Cache-Week": week.toString(),
        "X-Mock-Mode": "true",
      },
      body: responseHtml,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Request failed after ${duration}ms:`, error.message);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Response-Time": `${duration}ms`,
        "X-Mock-Mode": "true",
      },
      body: getErrorHtml(error.message),
    };
  }
};

// Helper functions
function getHtmlTemplate() {
  try {
    const htmlPath = join(__dirname, "index.html");
    return readFileSync(htmlPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load HTML template: ${error.message}`);
  }
}

async function fetchMockCachedData(week) {
  const allData = [];
  const restaurants = [
    { id: "niagara", name: "Restaurang Niagara", active: true },
  ];

  for (const config of restaurants) {
    if (!config.active) continue;

    try {
      const restaurantData = await mockGetCachedLunchData(config.id, week);

      if (restaurantData && restaurantData.length > 0) {
        const dataWithMeta = restaurantData.map((lunch) => ({
          ...lunch,
          place: config.name,
          restaurant: config.id,
        }));
        allData.push(...dataWithMeta);
      }
    } catch (error) {
      console.error(
        `❌ Failed to fetch mock data for ${config.id}:`,
        error.message,
      );
    }
  }

  return allData;
}

function filterDataByDay(data, selectedDay) {
  if (!selectedDay || selectedDay === "all") {
    return data;
  }

  const SWEDISH_WEEKDAYS = {
    måndag: "monday",
    tisdag: "tuesday",
    onsdag: "wednesday",
    torsdag: "thursday",
    fredag: "friday",
    lördag: "saturday",
    söndag: "sunday",
  };

  const ENGLISH_WEEKDAYS = {
    monday: "måndag",
    tuesday: "tisdag",
    wednesday: "onsdag",
    thursday: "torsdag",
    friday: "fredag",
    saturday: "lördag",
    sunday: "söndag",
  };

  const normalizedDay = selectedDay.toLowerCase();

  const filtered = data.filter((lunch) => {
    if (!lunch.weekday) return false;

    const lunchDay = lunch.weekday.toLowerCase();

    // Direct match
    if (lunchDay === normalizedDay) return true;

    // Try Swedish to English conversion
    if (SWEDISH_WEEKDAYS[lunchDay] === normalizedDay) return true;

    // Try English to Swedish conversion
    if (ENGLISH_WEEKDAYS[normalizedDay] === lunchDay) return true;

    return false;
  });

  console.log(
    `🔍 Filtered ${data.length} → ${filtered.length} items for day: ${selectedDay}`,
  );
  return filtered;
}

function addCacheMetadata(data, week) {
  return {
    lunches: data,
    metadata: {
      lastUpdated: new Date().toISOString(),
      cacheWeek: week,
      totalItems: data.length,
      restaurants: [...new Set(data.map((d) => d.restaurant))],
      availableDays: [...new Set(data.map((d) => d.weekday))],
      mockMode: true,
    },
  };
}

function injectDataIntoHtml(html, dataWithMetadata) {
  const lunchesJson = JSON.stringify(dataWithMetadata.lunches, null, 2);

  const updatedHtml = html.replace(
    /const lunches = \[\];/,
    `const lunches = ${lunchesJson};

    // Cache metadata (development mode)
    const cacheMetadata = ${JSON.stringify(dataWithMetadata.metadata, null, 2)};

    // Add development info to console
    console.log("🏠 Development Mode - Cache metadata:", cacheMetadata);`,
  );

  return updatedHtml;
}

function getErrorHtml(errorMessage) {
  return `
<!doctype html>
<html>
<head>
    <title>Lunch Table - Development Error</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            text-align: center;
            background: #f5f5f5;
        }
        .error {
            color: #d32f2f;
            background: #ffebee;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #ffcdd2;
        }
        .dev-info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            color: #1976d2;
            margin: 20px 0;
        }
        .retry {
            margin-top: 20px;
        }
        .retry a {
            color: #1976d2;
            text-decoration: none;
            padding: 10px 20px;
            background: #e3f2fd;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>🏠 Lunch Table - Development Mode</h1>
    <div class="error">
        <h2>Något gick fel</h2>
        <p>Det gick inte att ladda lunchdata i utvecklingsläge.</p>
        <details>
            <summary>Teknisk information</summary>
            <p><code>${errorMessage}</code></p>
        </details>
    </div>
    <div class="dev-info">
        <h3>🔧 Utvecklingsläge</h3>
        <p>Du kör den lokala utvecklingsservern. Kontrollera konsolen för mer information.</p>
    </div>
    <div class="retry">
        <a href="javascript:window.location.reload()">🔄 Försök igen</a>
        <a href="/?scenario=normal">📊 Normal data</a>
        <a href="/?scenario=empty">📭 Tom cache</a>
        <a href="/?scenario=error">💥 Fel scenario</a>
    </div>
</body>
</html>`;
}

function getCurrentSwedishWeekday() {
  const now = new Date();
  const englishDay = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const mapping = {
    monday: "måndag",
    tuesday: "tisdag",
    wednesday: "onsdag",
    thursday: "torsdag",
    friday: "fredag",
    saturday: "lördag",
    sunday: "söndag",
  };
  return mapping[englishDay] || "måndag";
}

function getCurrentWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(
d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Create HTTP server
const PORT = 3000;

console.log("🚀 Enhanced Lunch Table - Local Development Server");
console.log("Port:", PORT);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  console.log(`🌐 ${request.method} ${url.pathname}${url.search}`);

  try {
    const event = {
      httpMethod: request.method,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: request.headers,
    };

    const context = { awsRequestId: `local-${Date.now()}` };
    const result = await mockApiHandler(event, context);

    response.writeHead(result.statusCode, result.headers);
    response.write(result.body);
    response.end();

  } catch (error) {
    console.error("❌ Server error:", error);
    response.writeHead(500, { "Content-Type": "text/html" });
    response.write(getErrorHtml(error.message));
    response.end();
  }
});

server.listen(PORT, () => {
  console.log(`🎯 Server running at http://localhost:${PORT}`);
});
