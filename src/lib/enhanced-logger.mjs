/**
 * Enhanced Logger
 * Provides structured logging with local development features and comprehensive
 * error tracking for the Enhanced Lunch Table application. In Lambda, all console
 * output is shipped to CloudWatch Logs automatically by the runtime.
 */

// Log levels with numeric values for filtering
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

// Environment configuration
const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const IS_LOCAL = process.env.NODE_ENV === "development" || !IS_LAMBDA;
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_LOCAL ? "DEBUG" : "INFO");
const CURRENT_LOG_LEVEL = LOG_LEVELS[LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO;

// Service identity (included in structured log entries)
const SERVICE_NAME = process.env.SERVICE_NAME || "enhanced-lunch-table";
const STAGE = process.env.STAGE || "dev";

// Console logging configuration
const ENABLE_COLORS = process.env.ENABLE_COLORS !== "false" && IS_LOCAL;

// Colors for local console output
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Get current timestamp in ISO format
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Enhanced Logger class with CloudWatch integration
 */
class EnhancedLogger {
  constructor(context = {}) {
    this.context = {
      correlationId: generateCorrelationId(),
      service: SERVICE_NAME,
      stage: STAGE,
      requestId: process.env.AWS_REQUEST_ID || null,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || null,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION || null,
      timestamp: getCurrentTimestamp(),
      ...context,
    };

    this.timers = new Map();
    this.metrics = {
      errors: 0,
      warnings: 0,
      operations: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext = {}) {
    return new EnhancedLogger({
      ...this.context,
      ...additionalContext,
      parentCorrelationId: this.context.correlationId,
      correlationId: generateCorrelationId(),
    });
  }

  /**
   * Start a performance timer
   */
  startTimer(name) {
    this.timers.set(name, Date.now());
    this.trace(`Timer started: ${name}`);
  }

  /**
   * End a performance timer and return duration
   */
  endTimer(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(name);
      this.debug(`Timer ended: ${name}`, { duration: `${duration}ms` });
      return duration;
    }
    this.warn(`Timer not found: ${name}`);
    return null;
  }

  /**
   * Core logging method
   */
  async _log(level, message, data = {}, error = null) {
    if (level > CURRENT_LOG_LEVEL) return;

    const timestamp = getCurrentTimestamp();
    const levelName = Object.keys(LOG_LEVELS)[level];

    // Update metrics
    if (level === LOG_LEVELS.ERROR) this.metrics.errors++;
    if (level === LOG_LEVELS.WARN) this.metrics.warnings++;
    this.metrics.operations++;

    // Create structured log entry
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      correlationId: this.context.correlationId,
      context: this.context,
      data,
      metrics: this.metrics,
    };

    // Add error details if present
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
      };
    }

    // Console logging. In Lambda this is captured by the runtime and shipped
    // to CloudWatch Logs automatically.
    this._logToConsole(level, message, logEntry, error);
  }

  /**
   * Log to local console with colors and formatting
   */
  _logToConsole(level, message, logEntry, error) {
    const levelName = Object.keys(LOG_LEVELS)[level];
    const color = this._getLevelColor(level);
    const resetColor = ENABLE_COLORS ? COLORS.reset : "";
    const contextStr = this._formatContextForConsole();

    const prefix = ENABLE_COLORS
      ? `${color}[${levelName}]${resetColor} ${COLORS.gray}${logEntry.timestamp}${resetColor} ${COLORS.cyan}${this.context.correlationId?.substring(0, 8)}${resetColor}`
      : `[${levelName}] ${logEntry.timestamp} ${this.context.correlationId?.substring(0, 8)}`;

    console.log(`${prefix} ${contextStr} ${message}`);

    // Log additional data
    if (Object.keys(logEntry.data).length > 0) {
      const dataPrefix = ENABLE_COLORS ? `${COLORS.gray}  Data:${resetColor}` : "  Data:";
      console.log(dataPrefix, JSON.stringify(logEntry.data, null, 2));
    }

    // Log error details
    if (error) {
      const errorPrefix = ENABLE_COLORS ? `${COLORS.red}  Error:${resetColor}` : "  Error:";
      console.log(errorPrefix, error.message);

      if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG && error.stack) {
        const stackPrefix = ENABLE_COLORS ? `${COLORS.gray}  Stack:${resetColor}` : "  Stack:";
        console.log(stackPrefix, error.stack);
      }
    }
  }

  /**
   * Get color for log level
   */
  _getLevelColor(level) {
    if (!ENABLE_COLORS) return "";

    switch (level) {
      case LOG_LEVELS.ERROR: return COLORS.red;
      case LOG_LEVELS.WARN: return COLORS.yellow;
      case LOG_LEVELS.INFO: return COLORS.blue;
      case LOG_LEVELS.DEBUG: return COLORS.green;
      case LOG_LEVELS.TRACE: return COLORS.gray;
      default: return COLORS.reset;
    }
  }

  /**
   * Format context for console display
   */
  _formatContextForConsole() {
    const parts = [];
    if (this.context.restaurant) parts.push(`restaurant:${this.context.restaurant}`);
    if (this.context.weekday) parts.push(`weekday:${this.context.weekday}`);
    if (this.context.operation) parts.push(`op:${this.context.operation}`);
    if (this.context.week) parts.push(`week:${this.context.week}`);

    const contextStr = parts.length > 0 ? `[${parts.join("|")}]` : "";
    return ENABLE_COLORS ? `${COLORS.magenta}${contextStr}${COLORS.reset}` : contextStr;
  }

  /**
   * Error level logging
   */
  async error(message, data = {}, error = null) {
    await this._log(LOG_LEVELS.ERROR, message, data, error);
  }

  /**
   * Warning level logging
   */
  async warn(message, data = {}) {
    await this._log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Info level logging
   */
  async info(message, data = {}) {
    await this._log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Debug level logging
   */
  async debug(message, data = {}) {
    await this._log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Trace level logging
   */
  async trace(message, data = {}) {
    await this._log(LOG_LEVELS.TRACE, message, data);
  }

  /**
   * Log HTTP request/response
   */
  async logRequest(method, url, statusCode, duration, data = {}) {
    const isError = statusCode >= 400;
    const level = isError ? "error" : "info";

    await this[level](`${method} ${url}`, {
      http: {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
      },
      ...data,
    });
  }

  /**
   * Log Lambda function invocation
   */
  async logInvocation(event, context) {
    await this.info("Lambda invocation started", {
      lambda: {
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        requestId: context.awsRequestId,
        remainingTimeMs: context.getRemainingTimeInMillis(),
      },
      event: {
        source: event.source,
        httpMethod: event.httpMethod,
        path: event.path,
        queryStringParameters: event.queryStringParameters,
      },
    });
  }

  /**
   * Log database operation
   */
  async logDatabase(operation, table, key, duration, error = null) {
    const data = {
      database: {
        operation,
        table,
        key,
        duration: `${duration}ms`,
      },
    };

    if (error) {
      await this.error(`Database ${operation} failed`, data, error);
    } else {
      await this.info(`Database ${operation} successful`, data);
    }
  }

  /**
   * Log business metrics
   */
  async logMetrics(metricName, value, unit = "Count", dimensions = {}) {
    await this.info("Business metric", {
      metric: {
        name: metricName,
        value,
        unit,
        dimensions,
      },
    });
  }

  /**
   * Log performance summary
   */
  async logPerformanceSummary() {
    const totalTime = Date.now() - this.metrics.startTime;
    const activeTimers = Array.from(this.timers.keys());

    await this.info("Performance summary", {
      performance: {
        totalExecutionTime: `${totalTime}ms`,
        errors: this.metrics.errors,
        warnings: this.metrics.warnings,
        operations: this.metrics.operations,
        activeTimers,
        errorRate: this.metrics.operations > 0
          ? `${(this.metrics.errors / this.metrics.operations * 100).toFixed(2)}%`
          : "0%",
      },
    });
  }

  /**
   * Create operation context with automatic cleanup
   */
  async withOperation(operationName, asyncFn) {
    const operationLogger = this.child({ operation: operationName });
    operationLogger.startTimer(operationName);

    try {
      await operationLogger.info(`Starting operation: ${operationName}`);
      const result = await asyncFn(operationLogger);
      await operationLogger.info(`Operation completed: ${operationName}`);
      operationLogger.endTimer(operationName);
      return result;
    } catch (error) {
      await operationLogger.error(`Operation failed: ${operationName}`, {}, error);
      operationLogger.endTimer(operationName);
      throw error;
    }
  }

  /**
   * Log structured validation results
   */
  async logValidation(isValid, errors = [], context = "") {
    const prefix = context ? `${context}: ` : "";

    if (isValid) {
      await this.info(`${prefix}Validation passed`);
    } else {
      await this.warn(`${prefix}Validation failed`, {
        validation: {
          errors,
          errorCount: errors.length,
        },
      });
    }
  }

  /**
   * Log network operations with retry information
   */
  async logNetwork(url, method, attempt, maxAttempts, statusCode, duration, error = null) {
    const data = {
      network: {
        url,
        method,
        attempt,
        maxAttempts,
        statusCode,
        duration: `${duration}ms`,
      },
    };

    if (error) {
      await this.error(`Network request failed (${attempt}/${maxAttempts})`, data, error);
    } else {
      const level = statusCode >= 400 ? "warn" : "info";
      await this[level](`Network request ${statusCode >= 400 ? "error" : "success"} (${attempt}/${maxAttempts})`, data);
    }
  }
}

/**
 * Create root logger instance
 */
export function createLogger(context = {}) {
  return new EnhancedLogger(context);
}

/**
 * Create restaurant-specific logger
 */
export function createRestaurantLogger(restaurantName, additionalContext = {}) {
  return createLogger({
    restaurant: restaurantName,
    ...additionalContext,
  });
}

// Export configuration for testing and debugging
export const config = {
  LOG_LEVELS,
  CURRENT_LOG_LEVEL,
  LOG_LEVEL,
  IS_LAMBDA,
  IS_LOCAL,
  ENABLE_COLORS,
  SERVICE_NAME,
  STAGE,
};

export default {
  createLogger,
  createRestaurantLogger,
  LOG_LEVELS,
  config,
};
