/**
 * DynamoDB Cache Manager for Lunch Data
 * Handles storage, retrieval, and management of cached lunch data from restaurants
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// Configuration
const DEFAULT_REGION = process.env.AWS_REGION || "eu-west-1";
const TABLE_NAME = process.env.LUNCH_CACHE_TABLE || "lunch-cache";
const TTL_DAYS = parseInt(process.env.CACHE_TTL_DAYS || "14");

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY = 100; // Base delay in milliseconds
const MAX_DELAY = 5000; // Maximum delay in milliseconds
const RETRY_JITTER = 0.1; // Add 10% jitter to prevent thundering herd

// Initialize DynamoDB client
let dynamoClient;
let docClient;

/**
 * Initialize DynamoDB clients
 * @param {Object} config - Optional configuration override
 */
export function initializeDynamoClient(config = {}) {
  const clientConfig = {
    region: config.region || DEFAULT_REGION,
    ...config,
  };

  dynamoClient = new DynamoDBClient(clientConfig);
  docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
      convertEmptyValues: false,
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  console.log(`DynamoDB client initialized for region: ${clientConfig.region}`);
}

/**
 * Get current TTL timestamp (current time + TTL_DAYS)
 * @returns {number} - Unix timestamp for TTL
 */
function getTtlTimestamp() {
  const now = new Date();
  const ttlDate = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);
  return Math.floor(ttlDate.getTime() / 1000);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Attempt number (0-based)
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt) {
  const exponentialDelay = Math.min(
    BASE_DELAY * Math.pow(2, attempt),
    MAX_DELAY,
  );
  const jitter = exponentialDelay * RETRY_JITTER * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
function isRetryableError(error) {
  if (!error) return false;

  // AWS SDK error codes that should be retried
  const retryableErrorCodes = [
    "ProvisionedThroughputExceededException",
    "ThrottlingException",
    "RequestLimitExceeded",
    "InternalServerError",
    "ServiceUnavailable",
    "UnknownError",
    "NetworkingError",
    "TimeoutError",
  ];

  // Check error code
  if (error.name && retryableErrorCodes.includes(error.name)) {
    return true;
  }

  // Check for network errors
  if (error.code && retryableErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for HTTP status codes that should be retried
  if (error.$metadata && error.$metadata.httpStatusCode) {
    const statusCode = error.$metadata.httpStatusCode;
    return statusCode >= 500 || statusCode === 429;
  }

  return false;
}

/**
 * Execute a DynamoDB operation with retry logic
 * @param {Function} operation - The operation to execute
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise} - The result of the operation
 */
async function executeWithRetry(operation, operationName) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await operation();

      // Log successful retry if this wasn't the first attempt
      if (attempt > 0) {
        console.log(`${operationName} succeeded after ${attempt + 1} attempts`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === MAX_RETRIES) {
        break;
      }

      // Check if the error is retryable
      if (!isRetryableError(error)) {
        console.warn(
          `${operationName} failed with non-retryable error:`,
          error.message,
        );
        throw error;
      }

      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempt);
      console.warn(
        `${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms:`,
        error.message,
      );

      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(
    `${operationName} failed after ${MAX_RETRIES + 1} attempts:`,
    lastError.message,
  );
  throw new Error(
    `${operationName} failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`,
  );
}

/**
 * Create cache key for restaurant and week
 * @param {string} restaurant - Restaurant name
 * @param {number} week - Week number
 * @param {number} year - Year (optional, defaults to current year)
 * @returns {string} - Cache key
 */
export function createCacheKey(
  restaurant,
  week,
  year = new Date().getFullYear(),
) {
  if (!restaurant || !week) {
    throw new Error(
      "Restaurant name and week number are required for cache key",
    );
  }
  return `${restaurant.toLowerCase()}-${year}-${String(week).padStart(2, "0")}`;
}

/**
 * Store lunch data in cache
 * @param {string} restaurant - Restaurant name
 * @param {number} week - Week number
 * @param {Array} lunches - Array of lunch objects
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<boolean>} - Success status
 */
export async function cacheLunchData(restaurant, week, lunches, metadata = {}) {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    if (!restaurant || !week || !Array.isArray(lunches)) {
      throw new Error(
        "Invalid parameters: restaurant, week, and lunches array are required",
      );
    }

    const cacheKey = createCacheKey(restaurant, week);
    const timestamp = new Date().toISOString();
    const ttl = getTtlTimestamp();

    const item = {
      pk: cacheKey,
      restaurant: restaurant.toLowerCase(),
      week: Number(week),
      year: new Date().getFullYear(),
      lunches: lunches,
      lunchCount: lunches.length,
      cachedAt: timestamp,
      ttl: ttl,
      metadata: {
        version: "1.0",
        source: "niagara-parser",
        ...metadata,
      },
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    });

    await executeWithRetry(
      () => docClient.send(command),
      `cacheLunchData(${restaurant}, week ${week})`,
    );

    console.log(
      `Successfully cached ${lunches.length} lunches for ${restaurant} week ${week}`,
    );
    return true;
  } catch (error) {
    console.error("Error caching lunch data:", error);
    throw new Error(`Failed to cache lunch data: ${error.message}`);
  }
}

/**
 * Retrieve lunch data from cache
 * @param {string} restaurant - Restaurant name
 * @param {number} week - Week number
 * @param {number} year - Year (optional, defaults to current year)
 * @returns {Promise<Object|null>} - Cached data or null if not found
 */
export async function getCachedLunchData(
  restaurant,
  week,
  year = new Date().getFullYear(),
) {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    if (!restaurant || !week) {
      throw new Error("Restaurant name and week number are required");
    }

    const cacheKey = createCacheKey(restaurant, week, year);

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: cacheKey,
      },
    });

    const response = await executeWithRetry(
      () => docClient.send(command),
      `getCachedLunchData(${restaurant}, week ${week})`,
    );

    if (!response.Item) {
      console.log(`No cached data found for ${restaurant} week ${week}`);
      return null;
    }

    console.log(
      `Retrieved cached data for ${restaurant} week ${week} (${response.Item.lunchCount} lunches)`,
    );
    return response.Item;
  } catch (error) {
    console.error("Error retrieving cached lunch data:", error);
    throw new Error(`Failed to retrieve cached data: ${error.message}`);
  }
}

/**
 * Get all cached data for a restaurant
 * @param {string} restaurant - Restaurant name
 * @param {number} limit - Maximum number of items to return (default: 10)
 * @returns {Promise<Array>} - Array of cached lunch data
 */
export async function getRestaurantCache(restaurant, limit = 10) {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    if (!restaurant) {
      throw new Error("Restaurant name is required");
    }

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "RestaurantIndex", // GSI on restaurant field
      KeyConditionExpression: "restaurant = :restaurant",
      ExpressionAttributeValues: {
        ":restaurant": restaurant.toLowerCase(),
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });

    const response = await executeWithRetry(
      () => docClient.send(command),
      `getRestaurantCache(${restaurant})`,
    );
    console.log(
      `Retrieved ${response.Items.length} cached entries for ${restaurant}`,
    );
    return response.Items || [];
  } catch (error) {
    console.error("Error retrieving restaurant cache:", error);
    // If GSI doesn't exist, fall back to scan (less efficient)
    return await scanForRestaurant(restaurant, limit);
  }
}

/**
 * Fallback method to scan for restaurant data when GSI is not available
 * @param {string} restaurant - Restaurant name
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of cached lunch data
 */
async function scanForRestaurant(restaurant, limit) {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "restaurant = :restaurant",
      ExpressionAttributeValues: {
        ":restaurant": restaurant.toLowerCase(),
      },
      Limit: limit,
    });

    const scanResponse = await executeWithRetry(
      () => docClient.send(command),
      `scanForRestaurant(${restaurant})`,
    );
    console.log(
      `Scanned and found ${scanResponse.Items.length} cached entries for ${restaurant}`,
    );
    return scanResponse.Items || [];
  } catch (error) {
    console.error("Error scanning for restaurant data:", error);
    return [];
  }
}

/**
 * Delete cached data for a specific restaurant and week
 * @param {string} restaurant - Restaurant name
 * @param {number} week - Week number
 * @param {number} year - Year (optional, defaults to current year)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCachedData(
  restaurant,
  week,
  year = new Date().getFullYear(),
) {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    if (!restaurant || !week) {
      throw new Error("Restaurant name and week number are required");
    }

    const cacheKey = createCacheKey(restaurant, week, year);

    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: cacheKey,
      },
    });

    await executeWithRetry(
      () => docClient.send(command),
      `deleteCachedData(${restaurant}, week ${week})`,
    );

    console.log(
      `Successfully deleted cached data for ${restaurant} week ${week}`,
    );
    return true;
  } catch (error) {
    console.error("Error deleting cached data:", error);
    throw new Error(`Failed to delete cached data: ${error.message}`);
  }
}

/**
 * Batch write multiple lunch data entries
 * @param {Array} entries - Array of {restaurant, week, lunches, metadata} objects
 * @returns {Promise<Object>} - Result with success/failure counts
 */
export async function batchCacheLunchData(entries) {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Entries must be a non-empty array");
    }

    const timestamp = new Date().toISOString();
    const ttl = getTtlTimestamp();
    const writeRequests = [];

    for (const entry of entries) {
      const { restaurant, week, lunches, metadata = {} } = entry;

      if (!restaurant || !week || !Array.isArray(lunches)) {
        console.warn(`Skipping invalid entry: ${JSON.stringify(entry)}`);
        continue;
      }

      const cacheKey = createCacheKey(restaurant, week);
      const item = {
        pk: cacheKey,
        restaurant: restaurant.toLowerCase(),
        week: Number(week),
        year: new Date().getFullYear(),
        lunches: lunches,
        lunchCount: lunches.length,
        cachedAt: timestamp,
        ttl: ttl,
        metadata: {
          version: "1.0",
          source: "batch-operation",
          ...metadata,
        },
      };

      writeRequests.push({
        PutRequest: {
          Item: item,
        },
      });
    }

    if (writeRequests.length === 0) {
      throw new Error("No valid entries to write");
    }

    // DynamoDB batch write supports up to 25 items
    const batches = [];
    for (let i = 0; i < writeRequests.length; i += 25) {
      batches.push(writeRequests.slice(i, i + 25));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      try {
        const command = new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        });

        const response = await executeWithRetry(
          () => docClient.send(command),
          `batchCacheLunchData(batch ${Math.floor(index / 25) + 1})`,
        );
        successCount +=
          batch.length - (response.UnprocessedItems?.[TABLE_NAME]?.length || 0);
        failureCount += response.UnprocessedItems?.[TABLE_NAME]?.length || 0;

        // Handle unprocessed items
        if (response.UnprocessedItems?.[TABLE_NAME]?.length > 0) {
          console.warn(
            `${response.UnprocessedItems[TABLE_NAME].length} items were not processed in batch`,
          );
        }
      } catch (batchError) {
        console.error("Error in batch write:", batchError);
        failureCount += batch.length;
      }
    }

    console.log(
      `Batch operation completed: ${successCount} success, ${failureCount} failures`,
    );
    return {
      success: true,
      successCount,
      failureCount,
      totalCount: writeRequests.length,
    };
  } catch (error) {
    console.error("Error in batch cache operation:", error);
    throw new Error(`Batch cache operation failed: ${error.message}`);
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} - Cache statistics
 */
export async function getCacheStats() {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      Select: "COUNT",
    });

    const response = await executeWithRetry(
      () => docClient.send(command),
      "getCacheStats",
    );

    return {
      totalEntries: response.Count || 0,
      scannedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting cache statistics:", error);
    return {
      totalEntries: 0,
      error: error.message,
      scannedAt: new Date().toISOString(),
    };
  }
}

/**
 * Clean up expired cache entries (manual cleanup, TTL should handle this automatically)
 * @returns {Promise<number>} - Number of items deleted
 */
export async function cleanupExpiredCache() {
  if (!docClient) {
    initializeDynamoClient();
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    let deletedCount = 0;
    let lastEvaluatedKey = null;

    do {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "attribute_exists(ttl) AND ttl < :now",
        ExpressionAttributeValues: {
          ":now": now,
        },
        ProjectionExpression: "pk",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const scanResponse = await executeWithRetry(
        () => docClient.send(scanCommand),
        "cleanupExpiredCache(scan)",
      );

      if (scanResponse.Items && scanResponse.Items.length > 0) {
        // Delete expired items
        for (const item of scanResponse.Items) {
          try {
            const deleteCommand = new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { pk: item.pk },
            });

            await executeWithRetry(
              () => docClient.send(deleteCommand),
              `cleanupExpiredCache(delete ${item.pk})`,
            );

            deletedCount++;
          } catch (deleteError) {
            console.warn(
              `Failed to delete expired item ${item.pk}:`,
              deleteError.message,
            );
          }
        }
      }

      lastEvaluatedKey = scanResponse.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Cleaned up ${deletedCount} expired cache entries`);
    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up expired cache:", error);
    throw new Error(`Cache cleanup failed: ${error.message}`);
  }
}

/**
 * Health check for cache manager
 * @returns {Promise<Object>} - Health status
 */
export async function healthCheck() {
  try {
    if (!docClient) {
      initializeDynamoClient();
    }

    // Simple operation to test connectivity
    const testKey = `health-check-${Date.now()}`;

    // Write test item
    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: testKey,
        healthCheck: true,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 60, // Expire in 1 minute
      },
    });

    await executeWithRetry(
      () => docClient.send(putCommand),
      "healthCheck(put)",
    );

    // Read test item
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: testKey },
    });

    const getResponse = await executeWithRetry(
      () => docClient.send(getCommand),
      "healthCheck(get)",
    );

    if (!getResponse.Item) {
      throw new Error("Health check failed: test item not found after write");
    }

    // Delete test item
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: testKey },
    });

    await executeWithRetry(
      () => docClient.send(deleteCommand),
      "healthCheck(delete)",
    );

    return {
      status: "healthy",
      table: TABLE_NAME,
      region: DEFAULT_REGION,
      testSuccessful: !!response.Item,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Cache manager health check failed:", error);
    return {
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export configuration for external use
export const config = {
  tableName: TABLE_NAME,
  region: DEFAULT_REGION,
  ttlDays: TTL_DAYS,
};

// Initialize client on module load if running in AWS environment
if (process.env.AWS_REGION || process.env.AWS_EXECUTION_ENV) {
  initializeDynamoClient();
}

export default {
  initializeDynamoClient,
  createCacheKey,
  cacheLunchData,
  getCachedLunchData,
  getRestaurantCache,
  deleteCachedData,
  batchCacheLunchData,
  getCacheStats,
  cleanupExpiredCache,
  healthCheck,
  config,
};
