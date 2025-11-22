/**
 * Data Collection Lambda Function
 * Collects lunch data from all registered restaurants and caches it in DynamoDB
 */

import { ParserFactory } from "../parsers/parser-factory.mjs";
import { cacheLunchData, createCacheKey } from "../../cache-manager.mjs";
import { createRestaurantLogger } from "../../enhanced-logger.mjs";

// Restaurant configurations
const RESTAURANT_CONFIGS = [
  {
    id: "niagara",
    name: "Restaurang Niagara",
    parser: "niagara",
    url: "https://restaurangniagara.se/lunch/",
    active: true,
  },
  // Additional restaurants can be added here
];

/**
 * Main Lambda handler for data collection
 */
export async function handler(event, context) {
  const logger = createRestaurantLogger("DataCollector", {
    component: "lambda",
    requestId: context.awsRequestId,
  });

  const startTime = Date.now();
  let results = [];

  try {
    await logger.info("Starting data collection", {
      trigger: detectEventSource(event),
      restaurantCount: RESTAURANT_CONFIGS.length,
      activeRestaurants: RESTAURANT_CONFIGS.filter((r) => r.active).length,
    });

    // Initialize parser factory
    const factory = new ParserFactory({
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        timeout: 300000, // 5 minutes
        monitoringPeriod: 900000, // 15 minutes
      },
      healthCheck: {
        enabled: false, // Disable for Lambda
        interval: 300000,
        timeout: 10000,
      },
    });

    // Cache configuration
    const cacheConfig = resolveCacheConfig();

    // Register and create parsers for active restaurants
    const activeParsers = await setupParsers(factory, logger);

    if (activeParsers.length === 0) {
      throw new Error("No active parsers available");
    }

    // Execute all parsers
    results = await executeAllParsers(factory, activeParsers, logger);

    // Process and cache results
    const cacheResults = await cacheData(results, logger);

    // Calculate final statistics
    const stats = calculateStats(results, cacheResults);

    const duration = Date.now() - startTime;
    await logger.info("Data collection completed", {
      duration: `${duration}ms`,
      stats,
    });

    // Clean up
    factory.destroy();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        duration: duration,
        stats: stats,
        results: results.map((r) => ({
          restaurant: r.restaurant,
          success: r.success,
          lunchCount: r.lunches.length,
          error: r.error?.message,
        })),
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.error(
      "Data collection failed",
      {
        duration: `${duration}ms`,
        partialResults: results.length,
      },
      error,
    );

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        duration: duration,
        partialResults: results.length,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

/**
 * Detect the event source (EventBridge, manual, etc.)
 */
function detectEventSource(event) {
  if (event.source === "aws.events") {
    return "scheduled";
  }
  if (event.source === "serverless-plugin-warmup") {
    return "warmup";
  }
  if (event.httpMethod) {
    return "manual-http";
  }
  if (event.Records) {
    return "sqs";
  }
  return "manual";
}

/**
 * Setup parsers for active restaurants
 */
async function setupParsers(factory, logger) {
  const activeParsers = [];

  for (const config of RESTAURANT_CONFIGS) {
    if (!config.active) {
      await logger.debug(`Skipping inactive restaurant: ${config.id}`);
      continue;
    }

    try {
      // Validate configuration
      const validation = factory.validateParserConfig(config);
      if (!validation.isValid) {
        await logger.warn(`Invalid configuration for ${config.id}`, {
          errors: validation.errors,
        });
        continue;
      }

      // Create parser
      const parser = factory.createParser(config);
      if (parser) {
        activeParsers.push(config.id);
        await logger.info(`Registered parser: ${config.id}`, {
          name: config.name,
          url: config.url,
        });
      } else {
        await logger.warn(`Failed to create parser: ${config.id}`);
      }
    } catch (error) {
      await logger.error(`Error setting up parser: ${config.id}`, {}, error);
    }
  }

  return activeParsers;
}

/**
 * Execute all parsers with parallel processing
 */
async function executeAllParsers(factory, activeParsers, logger) {
  const options = {
    parallel: true,
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || "3"),
    continueOnError: true,
  };

  await logger.info("Starting parser execution", {
    parserCount: activeParsers.length,
    options,
  });

  try {
    const results = await factory.executeAllParsers(options);

    // Log execution summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    await logger.info("Parser execution completed", {
      successful,
      failed,
      total: results.length,
      successRate: `${((successful / results.length) * 100).toFixed(1)}%`,
    });

    return results;
  } catch (error) {
    await logger.error("Parser execution failed", {}, error);
    throw error;
  }
}

/**
 * Cache data in DynamoDB
 */
async function cacheData(results, logger) {
  const cacheResults = {
    successful: 0,
    failed: 0,
    totalItems: 0,
    errors: [],
  };

  for (const result of results) {
    if (!result.success || result.lunches.length === 0) {
      cacheResults.failed++;
      if (result.error) {
        cacheResults.errors.push({
          restaurant: result.restaurant,
          error: result.error.message,
        });
      }
      continue;
    }

    try {
      await logger.debug(`Caching data for ${result.restaurant}`, {
        itemCount: result.lunches.length,
      });

      // Group lunches by week for caching
      const weekGroups = groupLunchesByWeek(result.lunches);

      for (const [week, lunches] of Object.entries(weekGroups)) {
        const cacheKey = `${result.restaurant}-week-${week}`;
        const cacheData = {
          restaurant: result.restaurant,
          week: parseInt(week),
          lunches: lunches,
          lastUpdated: new Date().toISOString(),
          metadata: result.metadata,
        };

        await cacheLunchData(
          result.restaurant,
          parseInt(week),
          lunches,
          result.metadata,
        );
        cacheResults.totalItems += lunches.length;
      }

      cacheResults.successful++;
      await logger.info(`Successfully cached data for ${result.restaurant}`, {
        weeks: Object.keys(weekGroups).length,
        totalLunches: result.lunches.length,
      });
    } catch (error) {
      cacheResults.failed++;
      cacheResults.errors.push({
        restaurant: result.restaurant,
        error: error.message,
      });
      await logger.error(
        `Failed to cache data for ${result.restaurant}`,
        {},
        error,
      );
    }
  }

  return cacheResults;
}

/**
 * Group lunches by week number
 */
function groupLunchesByWeek(lunches) {
  const groups = {};

  for (const lunch of lunches) {
    const week = lunch.week || getCurrentWeek();
    if (!groups[week]) {
      groups[week] = [];
    }
    groups[week].push(lunch);
  }

  return groups;
}

/**
 * Calculate final statistics
 */
function calculateStats(results, cacheResults) {
  const totalRestaurants = results.length;
  const successfulParsing = results.filter((r) => r.success).length;
  const failedParsing = results.filter((r) => !r.success).length;
  const totalLunches = results.reduce((sum, r) => sum + r.lunches.length, 0);

  return {
    parsing: {
      total: totalRestaurants,
      successful: successfulParsing,
      failed: failedParsing,
      successRate:
        totalRestaurants > 0
          ? `${((successfulParsing / totalRestaurants) * 100).toFixed(1)}%`
          : "0%",
    },
    lunches: {
      total: totalLunches,
      cached: cacheResults.totalItems,
      averagePerRestaurant:
        successfulParsing > 0
          ? Math.round(totalLunches / successfulParsing)
          : 0,
    },
    caching: {
      successful: cacheResults.successful,
      failed: cacheResults.failed,
      errors: cacheResults.errors,
    },
  };
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

/**
 * Resolve cache configuration from environment variables
 * Ensures the Lambda uses the same table name as the deployed stack
 */
export function resolveCacheConfig() {
  return {
    tableName:
      process.env.LUNCH_CACHE_TABLE ||
      process.env.LUNCH_TABLE_NAME ||
      "lunch-data",
    ttlHours: 168, // 1 week
  };
}
