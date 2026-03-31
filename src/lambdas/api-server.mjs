/**
 * API Server Lambda Function
 * Serves HTML with cached lunch data injected from DynamoDB
 */

import {
  getCachedLunchData,
  getRestaurantCache,
} from "../../cache-manager.mjs";
import { createRestaurantLogger } from "../../enhanced-logger.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// __dirname polyfill for ESM (in CJS/esbuild output, the global is used instead)
const __mod_dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

// Cache the HTML template in memory for performance
let htmlTemplate = null;

// Restaurant configurations (should match data-collector.mjs)
const RESTAURANT_CONFIGS = [
  { id: "niagara", name: "Niagara", url: "https://restaurangniagara.se/lunch/#lunch", active: true },
  { id: "spill", name: "Spill", url: "https://www.restaurangspill.se/", active: true },
  { id: "kontrast", name: "Kontrast", url: "https://www.kontrastrestaurang.se/menu/vastra-hamnen?tab=lunch", active: true },
  { id: "p2", name: "P2", url: "https://restaurangp2.se/#lunch", active: true },
  { id: "taste", name: "Taste", url: "https://www.tastebynordrest.se/17/6/taste-malmo/", active: true },
  { id: "varv", name: "Varv", url: "https://varvmalmo.com/menu", active: true },
  { id: "fonderie", name: "La Fonderie", url: "https://www.lafonderie.se/lelunch", active: true },
  { id: "laziza", name: "Laziza", url: "https://www.laziza.se/lunch/", active: true },
  { id: "kockum", name: "Kockum Fritid", url: "https://freda49.se/lunch-malmo.html", active: true },
  { id: "ubåtshallen", name: "Ubåtshallen", url: "https://www.ubatshallen.se/", active: true },
  { id: "miamarias", name: "MiaMarias", url: "https://miamarias.nu/lunch/", active: true },
  { id: "ica", name: "ICA Maxi Västra Hamnen", url: "https://www.ica.se/butiker/maxi/malmo/maxi-ica-stormarknad-vastra-hamnen-1003569/tjanster/dagens-lunch/", active: true },
];

// Swedish weekday mapping
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

/**
 * Main Lambda handler for API server
 */
export async function handler(event, context) {
  const logger = createRestaurantLogger("ApiServer", {
    component: "lambda",
    requestId: context.awsRequestId,
  });

  const startTime = Date.now();

  try {
    await logger.info("Processing HTML request", {
      httpMethod: event.httpMethod || "GET",
      path: event.path || "/",
      queryParams: event.queryStringParameters || {},
    });

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const selectedDay = queryParams.day || "all";
    const week = queryParams.week
      ? parseInt(queryParams.week)
      : getCurrentWeek();

    await logger.debug("Request parameters", {
      selectedDay,
      week,
      rawDay: queryParams.day,
    });

    // Load HTML template
    const html = getHtmlTemplate();

    // Fetch cached data
    const lunchData = await fetchCachedData(week, logger);

    // Filter data by selected day if specified
    const filteredData = filterDataByDay(lunchData, selectedDay, logger);

    // Add cache metadata
    const dataWithMetadata = addCacheMetadata(filteredData, week);

    // Inject data into HTML
    const responseHtml = injectDataIntoHtml(html, dataWithMetadata);

    const duration = Date.now() - startTime;
    await logger.info("Request completed successfully", {
      duration: `${duration}ms`,
      dataPoints: filteredData.length,
      selectedDay,
      week,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300", // 5 minute cache
        "X-Response-Time": `${duration}ms`,
        "X-Data-Points": filteredData.length.toString(),
        "X-Cache-Week": week.toString(),
      },
      body: responseHtml,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.error(
      "Request failed",
      {
        duration: `${duration}ms`,
        httpMethod: event.httpMethod,
        path: event.path,
      },
      error,
    );

    // Return error page
    const errorHtml = getErrorHtml(error.message);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Response-Time": `${duration}ms`,
      },
      body: errorHtml,
    };
  }
}

/**
 * Load and cache HTML template
 */
function getHtmlTemplate() {
  if (!htmlTemplate) {
    // Try bundled location first (same dir), then original source layout
    const candidates = [
      join(__mod_dirname, "index.html"),
      join(__mod_dirname, "..", "..", "index.html"),
    ];
    for (const htmlPath of candidates) {
      try {
        htmlTemplate = readFileSync(htmlPath, "utf-8");
        return htmlTemplate;
      } catch {
        // try next
      }
    }
    throw new Error("Failed to load HTML template from any candidate path");
  }
  return htmlTemplate;
}

/**
 * Fetch cached data from all restaurants
 */
async function fetchCachedData(week, logger) {
  const allData = [];
  const cacheStats = {
    successful: 0,
    failed: 0,
    fallbacks: 0,
  };

  for (const config of RESTAURANT_CONFIGS) {
    if (!config.active) continue;

    try {
      await logger.debug(`Fetching cache for ${config.id}`, { week });

      // Try current week first (cache key uses display name from parser)
      let cacheItem = await getCachedLunchData(config.name, week);
      let restaurantData = cacheItem?.lunches;

      // Fallback to previous week if current week is empty
      if (!restaurantData || restaurantData.length === 0) {
        const previousWeek = week - 1;
        await logger.debug(`Trying fallback to previous week`, {
          restaurant: config.id,
          previousWeek,
        });

        cacheItem = await getCachedLunchData(config.name, previousWeek);
        restaurantData = cacheItem?.lunches;

        if (restaurantData && restaurantData.length > 0) {
          cacheStats.fallbacks++;
          await logger.info(`Using fallback data`, {
            restaurant: config.id,
            week: previousWeek,
            items: restaurantData.length,
          });
        }
      }

      if (restaurantData && restaurantData.length > 0) {
        // Add restaurant metadata to each lunch item
        const dataWithMeta = restaurantData.map((lunch) => ({
          ...lunch,
          place: config.name,
          placeUrl: config.url,
          restaurant: config.id,
        }));

        allData.push(...dataWithMeta);
        cacheStats.successful++;
      } else {
        await logger.warn(`No data found for ${config.id}`, { week });
        cacheStats.failed++;
      }
    } catch (error) {
      await logger.error(
        `Failed to fetch cache for ${config.id}`,
        { week },
        error,
      );
      cacheStats.failed++;
    }
  }

  await logger.info("Cache fetch completed", {
    totalItems: allData.length,
    stats: cacheStats,
  });

  return allData;
}

/**
 * Filter lunch data by selected day
 */
function filterDataByDay(data, selectedDay, logger) {
  if (!selectedDay || selectedDay === "all") {
    return data;
  }

  // Normalize the day name to lowercase
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

  logger.debug("Day filtering completed", {
    selectedDay,
    originalCount: data.length,
    filteredCount: filtered.length,
    availableDays: [...new Set(data.map((l) => l.weekday))],
  });

  return filtered;
}

/**
 * Add cache metadata to the data
 */
function addCacheMetadata(data, week) {
  const metadata = {
    lastUpdated: new Date().toISOString(),
    cacheWeek: week,
    dataFreshness: calculateDataFreshness(data),
    totalItems: data.length,
    restaurants: [...new Set(data.map((d) => d.restaurant))],
    availableDays: [...new Set(data.map((d) => d.weekday))],
  };

  return {
    lunches: data,
    metadata: metadata,
  };
}

/**
 * Calculate data freshness indicators
 */
function calculateDataFreshness(data) {
  const now = new Date();
  const freshness = {
    veryFresh: 0, // < 2 hours
    fresh: 0, // < 24 hours
    stale: 0, // < 7 days
    veryStale: 0, // > 7 days
  };

  data.forEach((lunch) => {
    if (!lunch.lastUpdated) {
      freshness.veryStale++;
      return;
    }

    const updated = new Date(lunch.lastUpdated);
    const ageHours = (now - updated) / (1000 * 60 * 60);

    if (ageHours < 2) freshness.veryFresh++;
    else if (ageHours < 24) freshness.fresh++;
    else if (ageHours < 168) freshness.stale++;
    else freshness.veryStale++;
  });

  return freshness;
}

/**
 * Inject lunch data into HTML template
 */
function injectDataIntoHtml(html, dataWithMetadata) {
  // Replace the empty lunches array with actual data
  const lunchesJson = JSON.stringify(dataWithMetadata.lunches, null, 2);

  // Replace the line "const lunches = [];" with actual data
  const updatedHtml = html.replace(
    /const lunches = \[\];/,
    `const lunches = ${lunchesJson};

    // Cache metadata
    const cacheMetadata = ${JSON.stringify(dataWithMetadata.metadata, null, 2)};

    // Add cache info to console for debugging
    console.log("Cache metadata:", cacheMetadata);`,
  );

  return updatedHtml;
}

/**
 * Generate error HTML page
 */
function getErrorHtml(errorMessage) {
  return `
<!doctype html>
<html>
<head>
    <title>Lunch Table - Error</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            text-align: center;
        }
        .error {
            color: #d32f2f;
            background: #ffebee;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .retry {
            margin-top: 20px;
        }
        .retry a {
            color: #1976d2;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <h1>Lunch Table</h1>
    <div class="error">
        <h2>Något gick fel</h2>
        <p>Det gick inte att ladda lunchdata just nu.</p>
        <details>
            <summary>Teknisk information</summary>
            <p><code>${errorMessage}</code></p>
        </details>
    </div>
    <div class="retry">
        <a href="javascript:window.location.reload()">Försök igen</a>
    </div>
</body>
</html>`;
}

/**
 * Get current Swedish weekday name
 */
function getCurrentSwedishWeekday() {
  const now = new Date();
  const englishDay = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  return ENGLISH_WEEKDAYS[englishDay] || "måndag";
}

/**
 * Get current ISO week number
 */
function getCurrentWeek() {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
