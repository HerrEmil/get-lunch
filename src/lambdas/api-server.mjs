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

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache the HTML template in memory for performance
let htmlTemplate = null;

// Restaurant configurations (should match data-collector.mjs)
const RESTAURANT_CONFIGS = [
  {
    id: "niagara",
    name: "Restaurang Niagara",
    active: true,
  },
  // Additional restaurants can be added here
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
    const selectedDay = queryParams.day || getCurrentSwedishWeekday();
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
    try {
      // Load HTML template from project root
      const htmlPath = join(__dirname, "..", "..", "index.html");
      htmlTemplate = readFileSync(htmlPath, "utf-8");
    } catch (error) {
      throw new Error(`Failed to load HTML template: ${error.message}`);
    }
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

      // Try current week first
      let restaurantData = await getCachedLunchData(config.id, week);

      // Fallback to previous week if current week is empty
      if (!restaurantData || restaurantData.length === 0) {
        const previousWeek = week - 1;
        await logger.debug(`Trying fallback to previous week`, {
          restaurant: config.id,
          previousWeek,
        });

        restaurantData = await getCachedLunchData(config.id, previousWeek);

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
