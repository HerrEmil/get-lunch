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
 * Create cache key for restaurant and week
 * @param {string} restaurant - Restaurant name
 * @param {number} week - Week number
 * @param {number} year - Year (optional, defaults to current year)
 * @returns {string} - Cache key
 */
export function createCacheKey(restaurant, week, year = new Date().getFullYear()) {
  if (!restaurant || !week) {
    throw new Error("Restaurant name and week number are required for cache key");
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
      throw new Error("Invalid parameters: restaurant, week, and lunches array are required");
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

    await docClient.send(command);
    console.log(`Successfully cached ${lunches.length} lunches for ${restaurant} week ${week}`);
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
export async function getCachedLunchData(restaurant, week, year = new Date().getFullYear()) {
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

    const response = await docClient.send(command);

    if (!response.Item) {
      console.log(`No cached data found for ${restaurant} week ${week}`);
      return null;
    }

    console.log(`Retrieved cached data for ${restaurant} week ${week} (${response.Item.lunchCount} lunches)`);
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

    const response = await docClient.send(command);
    console.log(`Retrieved ${response.Items.length} cached entries for ${restaurant}`);
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

    const response = await docClient.send(command);
    console.log(`Scanned and found ${response.Items.length} cached entries for ${restaurant}`);
    return response.Items || [];
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
export async function deleteCachedData(restaurant, week, year = new Date().getFullYear()) {
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

    await docClient.send(command);
    console.log(`Deleted cached data for ${restaurant} week ${week}`);
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

        const response = await docClient.send(command);
        successCount += batch.length - (response.UnprocessedItems?.[TABLE_NAME]?.length || 0);
        failureCount += response.UnprocessedItems?.[TABLE_NAME]?.length || 0;

        // Handle unprocessed items
        if (response.UnprocessedItems?.[TABLE_NAME]?.length > 0) {
          console.warn(`${response.UnprocessedItems[TABLE_NAME].length} items were not processed in batch`);
        }
      } catch (batchError) {
        console.error("Error in batch write:", batchError);
        failureCount += batch.length;
      }
    }

    console.log(`Batch operation completed: ${successCount} success, ${failureCount} failures`);
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

    const response = await docClient.send(command);

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

      const scanResponse = await docClient.send(scanCommand);

      if (scanResponse.Items && scanResponse.Items.length > 0) {
        // Delete expired items
        for (const item of scanResponse.Items) {
          try {
            const deleteCommand = new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { pk: item.pk },
            });
            await docClient.send(deleteCommand);
            deletedCount++;
          } catch (deleteError) {
            console.warn(`Failed to delete expired item ${item.pk}:`, deleteError.message);
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

    await docClient.send(putCommand);

    // Read test item
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: testKey },
    });

    const response = await docClient.send(getCommand);

    // Clean up test item
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: testKey },
    });

    await docClient.send(deleteCommand);

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
