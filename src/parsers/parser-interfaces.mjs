/**
 * Standardized Parser Interfaces and Data Formats
 * Defines the contracts and data structures for restaurant parsers
 */

/**
 * Standard lunch object interface
 * All parsers must return lunch objects that conform to this structure
 */
export const LunchObjectSchema = {
  // Required fields
  name: {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 200,
    description: "Name of the lunch dish"
  },
  price: {
    type: "number",
    required: true,
    minimum: 0,
    maximum: 1000,
    description: "Price in SEK"
  },
  weekday: {
    type: "string",
    required: true,
    enum: ["måndag", "tisdag", "onsdag", "torsdag", "fredag"],
    description: "Swedish weekday name"
  },
  week: {
    type: "number",
    required: true,
    minimum: 1,
    maximum: 53,
    description: "ISO week number"
  },
  place: {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 100,
    description: "Restaurant name"
  },

  // Optional fields
  description: {
    type: "string",
    required: false,
    maxLength: 500,
    description: "Detailed description of the lunch dish"
  },
  allergens: {
    type: "array",
    required: false,
    items: { type: "string" },
    description: "List of allergens"
  },
  dietary: {
    type: "array",
    required: false,
    items: {
      type: "string",
      enum: ["vegetarian", "vegan", "gluten-free", "lactose-free", "halal", "kosher"]
    },
    description: "Dietary restrictions and options"
  },
  category: {
    type: "string",
    required: false,
    enum: ["meat", "fish", "vegetarian", "vegan", "soup", "salad", "pasta"],
    description: "Food category"
  },
  image: {
    type: "string",
    required: false,
    format: "url",
    description: "URL to dish image"
  }
};

/**
 * Standard parser response format
 * All parser execute() methods must return this structure
 */
export const ParserResponseSchema = {
  success: {
    type: "boolean",
    required: true,
    description: "Whether the parsing was successful"
  },
  restaurant: {
    type: "string",
    required: true,
    description: "Restaurant name"
  },
  url: {
    type: "string",
    required: true,
    format: "url",
    description: "Source URL"
  },
  lunches: {
    type: "array",
    required: true,
    items: { $ref: "#/LunchObjectSchema" },
    description: "Array of parsed lunch objects"
  },
  metadata: {
    type: "object",
    required: true,
    properties: {
      totalExtracted: { type: "number", description: "Total items extracted before validation" },
      validCount: { type: "number", description: "Number of valid lunch items" },
      invalidCount: { type: "number", description: "Number of invalid lunch items" },
      validationErrors: { type: "array", description: "Validation error details" },
      duration: { type: "number", description: "Parsing duration in milliseconds" },
      timestamp: { type: "string", format: "date-time", description: "Parsing timestamp" },
      parser: { type: "string", description: "Parser class name" },
      parserVersion: { type: "string", description: "Parser version" }
    }
  },
  error: {
    type: "object",
    required: false,
    properties: {
      message: { type: "string", description: "Error message" },
      code: { type: "string", description: "Error code" },
      timestamp: { type: "string", format: "date-time", description: "Error timestamp" },
      consecutiveFailures: { type: "number", description: "Number of consecutive failures" }
    },
    description: "Error information (only present when success=false)"
  }
};

/**
 * Restaurant configuration interface
 * Defines how restaurants should be configured for parsers
 */
export const RestaurantConfigSchema = {
  name: {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 100,
    description: "Restaurant display name"
  },
  id: {
    type: "string",
    required: true,
    pattern: "^[a-z0-9-]+$",
    description: "Unique restaurant identifier (lowercase, hyphen-separated)"
  },
  url: {
    type: "string",
    required: true,
    format: "url",
    description: "Restaurant lunch menu URL"
  },
  parser: {
    type: "string",
    required: true,
    description: "Parser class name to use"
  },
  active: {
    type: "boolean",
    required: false,
    default: true,
    description: "Whether this restaurant is active"
  },
  schedule: {
    type: "object",
    required: false,
    properties: {
      enabled: { type: "boolean", default: true },
      days: {
        type: "array",
        items: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
        default: ["monday"]
      },
      time: { type: "string", pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", default: "10:00" }
    },
    description: "Data collection schedule"
  },
  timeout: {
    type: "number",
    required: false,
    minimum: 5000,
    maximum: 120000,
    default: 30000,
    description: "Request timeout in milliseconds"
  },
  retries: {
    type: "number",
    required: false,
    minimum: 0,
    maximum: 10,
    default: 3,
    description: "Number of retry attempts"
  },
  retryDelay: {
    type: "number",
    required: false,
    minimum: 100,
    maximum: 10000,
    default: 1000,
    description: "Delay between retries in milliseconds"
  },
  headers: {
    type: "object",
    required: false,
    description: "Custom HTTP headers for requests"
  },
  selectors: {
    type: "object",
    required: false,
    description: "Custom CSS selectors for parsing"
  },
  metadata: {
    type: "object",
    required: false,
    properties: {
      address: { type: "string", description: "Restaurant address" },
      phone: { type: "string", description: "Restaurant phone number" },
      email: { type: "string", format: "email", description: "Restaurant email" },
      website: { type: "string", format: "url", description: "Restaurant main website" },
      cuisine: { type: "string", description: "Type of cuisine" },
      priceRange: {
        type: "string",
        enum: ["budget", "moderate", "expensive"],
        description: "Price range category"
      },
      rating: { type: "number", minimum: 1, maximum: 5, description: "Restaurant rating" },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Restaurant tags/categories"
      }
    },
    description: "Additional restaurant metadata"
  }
};

/**
 * Parser factory configuration interface
 * Defines how the parser factory should be configured
 */
export const ParserFactoryConfigSchema = {
  restaurants: {
    type: "array",
    required: true,
    items: { $ref: "#/RestaurantConfigSchema" },
    description: "List of restaurant configurations"
  },
  defaultTimeout: {
    type: "number",
    required: false,
    default: 30000,
    description: "Default timeout for all parsers"
  },
  defaultRetries: {
    type: "number",
    required: false,
    default: 3,
    description: "Default retry count for all parsers"
  },
  circuitBreaker: {
    type: "object",
    required: false,
    properties: {
      enabled: { type: "boolean", default: true },
      failureThreshold: { type: "number", default: 5 },
      timeout: { type: "number", default: 60000 },
      monitoringPeriod: { type: "number", default: 300000 }
    },
    description: "Circuit breaker configuration"
  },
  healthCheck: {
    type: "object",
    required: false,
    properties: {
      enabled: { type: "boolean", default: true },
      interval: { type: "number", default: 300000 },
      timeout: { type: "number", default: 10000 }
    },
    description: "Health check configuration"
  }
};

/**
 * Parser health status interface
 * Standard format for parser health information
 */
export const HealthStatusSchema = {
  isHealthy: {
    type: "boolean",
    required: true,
    description: "Overall health status"
  },
  restaurant: {
    type: "string",
    required: true,
    description: "Restaurant name"
  },
  parser: {
    type: "string",
    required: true,
    description: "Parser class name"
  },
  status: {
    type: "string",
    required: true,
    enum: ["healthy", "unhealthy", "degraded", "unknown"],
    description: "Status classification"
  },
  consecutiveFailures: {
    type: "number",
    required: true,
    description: "Number of consecutive failures"
  },
  totalRequests: {
    type: "number",
    required: true,
    description: "Total number of requests made"
  },
  successfulRequests: {
    type: "number",
    required: true,
    description: "Number of successful requests"
  },
  successRate: {
    type: "string",
    required: true,
    pattern: "^\\d+\\.\\d%$",
    description: "Success rate as percentage"
  },
  lastSuccessful: {
    type: "string",
    required: false,
    format: "date-time",
    description: "Timestamp of last successful parse"
  },
  lastError: {
    type: "object",
    required: false,
    properties: {
      message: { type: "string" },
      timestamp: { type: "string", format: "date-time" }
    },
    description: "Last error information"
  },
  responseTime: {
    type: "object",
    required: false,
    properties: {
      average: { type: "number", description: "Average response time in ms" },
      last: { type: "number", description: "Last response time in ms" },
      min: { type: "number", description: "Minimum response time in ms" },
      max: { type: "number", description: "Maximum response time in ms" }
    },
    description: "Response time statistics"
  }
};

/**
 * Validation error interface
 * Standard format for validation errors
 */
export const ValidationErrorSchema = {
  field: {
    type: "string",
    required: true,
    description: "Field name that failed validation"
  },
  value: {
    type: "any",
    required: true,
    description: "Value that failed validation"
  },
  message: {
    type: "string",
    required: true,
    description: "Human-readable error message"
  },
  code: {
    type: "string",
    required: false,
    description: "Machine-readable error code"
  },
  path: {
    type: "string",
    required: false,
    description: "JSON path to the field"
  }
};

/**
 * Circuit breaker state interface
 * Defines circuit breaker states and transitions
 */
export const CircuitBreakerStateSchema = {
  state: {
    type: "string",
    required: true,
    enum: ["closed", "open", "half-open"],
    description: "Current circuit breaker state"
  },
  failureCount: {
    type: "number",
    required: true,
    description: "Current failure count"
  },
  failureThreshold: {
    type: "number",
    required: true,
    description: "Failure threshold to open circuit"
  },
  lastFailureTime: {
    type: "string",
    required: false,
    format: "date-time",
    description: "Timestamp of last failure"
  },
  nextAttemptTime: {
    type: "string",
    required: false,
    format: "date-time",
    description: "Next attempt time for half-open state"
  },
  totalRequests: {
    type: "number",
    required: true,
    description: "Total requests through circuit breaker"
  },
  successfulRequests: {
    type: "number",
    required: true,
    description: "Successful requests through circuit breaker"
  }
};

/**
 * Create a standardized lunch object
 * @param {Object} data - Raw lunch data
 * @returns {Object} Standardized lunch object
 */
export function createLunchObject(data = {}) {
  return {
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    price: Number(data.price) || 0,
    weekday: String(data.weekday || "").toLowerCase().trim(),
    week: Number(data.week) || getCurrentWeek(),
    place: String(data.place || "").trim(),
    allergens: Array.isArray(data.allergens) ? data.allergens : [],
    dietary: Array.isArray(data.dietary) ? data.dietary : [],
    category: data.category ? String(data.category).trim() : undefined,
    image: data.image ? String(data.image).trim() : undefined,
  };
}

/**
 * Create a standardized parser response
 * @param {boolean} success - Whether parsing was successful
 * @param {string} restaurant - Restaurant name
 * @param {string} url - Source URL
 * @param {Array} lunches - Array of lunch objects
 * @param {Object} metadata - Parsing metadata
 * @param {Object} error - Error information (if success=false)
 * @returns {Object} Standardized parser response
 */
export function createParserResponse(success, restaurant, url, lunches = [], metadata = {}, error = null) {
  const response = {
    success: Boolean(success),
    restaurant: String(restaurant),
    url: String(url),
    lunches: Array.isArray(lunches) ? lunches : [],
    metadata: {
      totalExtracted: Number(metadata.totalExtracted) || 0,
      validCount: Number(metadata.validCount) || 0,
      invalidCount: Number(metadata.invalidCount) || 0,
      validationErrors: Array.isArray(metadata.validationErrors) ? metadata.validationErrors : [],
      duration: Number(metadata.duration) || 0,
      timestamp: metadata.timestamp || new Date().toISOString(),
      parser: String(metadata.parser || ""),
      parserVersion: String(metadata.parserVersion || "1.0.0"),
      ...metadata
    }
  };

  if (!success && error) {
    response.error = {
      message: String(error.message || "Unknown error"),
      code: String(error.code || "PARSE_ERROR"),
      timestamp: error.timestamp || new Date().toISOString(),
      consecutiveFailures: Number(error.consecutiveFailures) || 0,
      ...error
    };
  }

  return response;
}

/**
 * Create a standardized health status object
 * @param {Object} data - Health status data
 * @returns {Object} Standardized health status
 */
export function createHealthStatus(data = {}) {
  const totalRequests = Number(data.totalRequests) || 0;
  const successfulRequests = Number(data.successfulRequests) || 0;
  const successRate = totalRequests > 0
    ? `${((successfulRequests / totalRequests) * 100).toFixed(1)}%`
    : "0.0%";

  return {
    isHealthy: Boolean(data.isHealthy),
    restaurant: String(data.restaurant || ""),
    parser: String(data.parser || ""),
    status: data.status || (data.isHealthy ? "healthy" : "unhealthy"),
    consecutiveFailures: Number(data.consecutiveFailures) || 0,
    totalRequests,
    successfulRequests,
    successRate,
    lastSuccessful: data.lastSuccessful || null,
    lastError: data.lastError || null,
    responseTime: data.responseTime || null
  };
}

/**
 * Create a standardized validation error
 * @param {string} field - Field name
 * @param {any} value - Field value
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @returns {Object} Standardized validation error
 */
export function createValidationError(field, value, message, code = "VALIDATION_ERROR") {
  return {
    field: String(field),
    value,
    message: String(message),
    code: String(code),
    path: field
  };
}

/**
 * Get current ISO week number
 * @returns {number} Current week number (1-53)
 */
function getCurrentWeek() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Swedish weekdays for validation
 */
export const SWEDISH_WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

/**
 * Valid dietary options
 */
export const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten-free", "lactose-free", "halal", "kosher"];

/**
 * Valid food categories
 */
export const FOOD_CATEGORIES = ["meat", "fish", "vegetarian", "vegan", "soup", "salad", "pasta"];

/**
 * Default parser configuration
 */
export const DEFAULT_PARSER_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  headers: {
    "User-Agent": "Enhanced-Lunch-Table/1.0 (https://github.com/enhanced-lunch-table)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  }
};

export default {
  LunchObjectSchema,
  ParserResponseSchema,
  RestaurantConfigSchema,
  ParserFactoryConfigSchema,
  HealthStatusSchema,
  ValidationErrorSchema,
  CircuitBreakerStateSchema,
  createLunchObject,
  createParserResponse,
  createHealthStatus,
  createValidationError,
  SWEDISH_WEEKDAYS,
  DIETARY_OPTIONS,
  FOOD_CATEGORIES,
  DEFAULT_PARSER_CONFIG
};
