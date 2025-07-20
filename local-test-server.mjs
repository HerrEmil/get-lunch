/**
 * Local Development Server for Enhanced Lunch Table
 * Uses real restaurant data instead of mock data
 */

import http from "http";
import { URL } from "url";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the existing parser system
import { extractNiagaraLunches } from "./data-extractor.mjs";
import { JSDOM } from "jsdom";

// Swedish weekday mappings
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

// Restaurant configuration
const RESTAURANTS = [
  {
    id: "niagara",
    name: "Restaurang Niagara",
    url: "https://restaurangniagara.se/lunch/",
    active: true,
  },
];

// Simple API handler that fetches real data
const realDataApiHandler = async (event, context) => {
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

    // Fetch real lunch data
    const lunchData = await fetchRealLunchData();

    // Filter data by selected day
    const filteredData = filterDataByDay(lunchData, selectedDay);

    // Add metadata
    const dataWithMetadata = addDataMetadata(filteredData, week);

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
        "Cache-Control": "no-cache",
        "X-Response-Time": `${duration}ms`,
        "X-Data-Points": filteredData.length.toString(),
        "X-Data-Source": "real",
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
        "X-Data-Source": "real",
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

async function fetchRealLunchData() {
  const allData = [];

  for (const restaurant of RESTAURANTS) {
    if (!restaurant.active) continue;

    try {
      console.log(`🍽️  Fetching data from ${restaurant.name}...`);

      // Create the HTML fetcher function that the parser expects
      function getHtmlNodeFromUrl(url, selector) {
        return fetch(url).then(async (response) => {
          const html = await response.text();
          const document = new JSDOM(html).window.document;
          return document.body.querySelector(selector);
        });
      }

      // Use the existing parser system
      let restaurantData = [];

      if (restaurant.id === "niagara") {
        restaurantData = await extractNiagaraLunches(getHtmlNodeFromUrl);
      }

      if (restaurantData && restaurantData.length > 0) {
        // Add restaurant metadata to each lunch item
        const dataWithMeta = restaurantData.map((lunch) => ({
          ...lunch,
          place: restaurant.name,
          restaurant: restaurant.id,
        }));

        allData.push(...dataWithMeta);
        console.log(
          `✅ Found ${restaurantData.length} lunch items from ${restaurant.name}`,
        );
      } else {
        console.log(`⚠️  No lunch data found for ${restaurant.name}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to fetch data from ${restaurant.name}:`,
        error.message,
      );
    }
  }

  console.log(`📊 Total lunch items collected: ${allData.length}`);
  return allData;
}

function filterDataByDay(data, selectedDay) {
  if (!selectedDay || selectedDay === "all") {
    return data;
  }

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

function addDataMetadata(data, week) {
  return {
    lunches: data,
    metadata: {
      lastUpdated: new Date().toISOString(),
      requestedWeek: week,
      totalItems: data.length,
      restaurants: [...new Set(data.map((d) => d.restaurant))],
      availableDays: [...new Set(data.map((d) => d.weekday))],
      dataSource: "real",
      developmentMode: true,
    },
  };
}

function injectDataIntoHtml(html, dataWithMetadata) {
  const lunchesJson = JSON.stringify(dataWithMetadata.lunches, null, 2);

  const updatedHtml = html.replace(
    /const lunches = \[\];/,
    `const lunches = ${lunchesJson};

    // Data metadata (development mode)
    const dataMetadata = ${JSON.stringify(dataWithMetadata.metadata, null, 2)};

    // Add development info to console
    console.log("🏠 Development Mode - Real data loaded:", dataMetadata);`,
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
            margin: 0 5px;
        }
    </style>
</head>
<body>
    <h1>🏠 Lunch Table - Development Mode</h1>
    <div class="error">
        <h2>Något gick fel</h2>
        <p>Det gick inte att hämta lunchdata från restaurangerna.</p>
        <details>
            <summary>Teknisk information</summary>
            <p><code>${errorMessage}</code></p>
        </details>
    </div>
    <div class="dev-info">
        <h3>🔧 Utvecklingsläge</h3>
        <p>Du kör den lokala utvecklingsservern med riktig data från restaurangernas webbsidor.</p>
        <p>Kontrollera konsolen för mer information om datahämtningen.</p>
    </div>
    <div class="retry">
        <a href="javascript:window.location.reload()">🔄 Försök igen</a>
        <a href="/">🏠 Startsida</a>
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
  const yearStart = new Date(Date
.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Create HTTP server
const PORT = 3000;

console.log("🚀 Enhanced Lunch Table - Local Development Server");
console.log("Data Source: Real restaurant websites");
console.log(`Port: ${PORT}`);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  
  if (url.pathname === "/favicon.ico") {
    response.writeHead(404);
    response.end();
    return;
  }
  
  console.log(`🌐 ${request.method} ${url.pathname}${url.search}`);

  try {
    const event = {
      httpMethod: request.method,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: request.headers,
    };

    const context = { awsRequestId: `local-${Date.now()}` };
    const result = await realDataApiHandler(event, context);

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
  console.log("   ⚡ Fresh data fetched on every request!");
});
