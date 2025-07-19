/**
 * Enhanced debug logger utility for lunch data extraction
 * Provides structured logging with context, timing, and correlation tracking
 */

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Current log level (can be set via environment variable)
const CURRENT_LOG_LEVEL = process.env.DEBUG_LEVEL ?
  parseInt(process.env.DEBUG_LEVEL) : LOG_LEVELS.INFO;

// Color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Generate a unique correlation ID for tracking operations
 */
function generateCorrelationId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Format timestamp for logging
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Enhanced debug logger class
 */
class DebugLogger {
  constructor(context = {}) {
    this.context = {
      correlationId: generateCorrelationId(),
      startTime: Date.now(),
      ...context
    };
    this.timers = new Map();
    this.metrics = {
      errors: 0,
      warnings: 0,
      operations: 0
    };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext = {}) {
    return new DebugLogger({
      ...this.context,
      ...additionalContext,
      parentCorrelationId: this.context.correlationId,
      correlationId: generateCorrelationId()
    });
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(name) {
    this.timers.set(name, Date.now());
    this.trace(`Timer started: ${name}`);
  }

  /**
   * End a timer and log the duration
   */
  endTimer(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(name);
      this.debug(`Timer ended: ${name} took ${duration}ms`);
      return duration;
    }
    this.warn(`Timer not found: ${name}`);
    return null;
  }

  /**
   * Log with structured format
   */
  _log(level, message, data = {}, error = null) {
    if (level > CURRENT_LOG_LEVEL) return;

    const logEntry = {
      timestamp: formatTimestamp(),
      level: Object.keys(LOG_LEVELS)[level],
      correlationId: this.context.correlationId,
      context: this.context,
      message,
      data,
      metrics: this.metrics
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    // Update metrics
    if (level === LOG_LEVELS.ERROR) this.metrics.errors++;
    if (level === LOG_LEVELS.WARN) this.metrics.warnings++;
    this.metrics.operations++;

    // Console output with colors
    const levelName = Object.keys(LOG_LEVELS)[level];
    const color = this._getLevelColor(level);
    const contextStr = this._formatContext();

    console.log(
      `${color}[${levelName}]${COLORS.reset} ` +
      `${COLORS.gray}${formatTimestamp()}${COLORS.reset} ` +
      `${COLORS.cyan}${this.context.correlationId?.substring(0, 8)}${COLORS.reset} ` +
      `${contextStr} ${message}`
    );

    // Log additional data if present
    if (Object.keys(data).length > 0) {
      console.log(`${COLORS.gray}  Data:${COLORS.reset}`, data);
    }

    // Log error details
    if (error) {
      console.log(`${COLORS.red}  Error:${COLORS.reset}`, error.message);
      if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
        console.log(`${COLORS.gray}  Stack:${COLORS.reset}`, error.stack);
      }
    }
  }

  /**
   * Get color for log level
   */
  _getLevelColor(level) {
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
   * Format context for display
   */
  _formatContext() {
    const parts = [];
    if (this.context.restaurant) parts.push(`restaurant:${this.context.restaurant}`);
    if (this.context.weekday) parts.push(`weekday:${this.context.weekday}`);
    if (this.context.operation) parts.push(`op:${this.context.operation}`);
    if (this.context.selector) parts.push(`selector:${this.context.selector}`);

    return parts.length > 0 ? `[${parts.join('|')}]` : '';
  }

  /**
   * Error level logging
   */
  error(message, data = {}, error = null) {
    this._log(LOG_LEVELS.ERROR, message, data, error);
  }

  /**
   * Warning level logging
   */
  warn(message, data = {}) {
    this._log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Info level logging
   */
  info(message, data = {}) {
    this._log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Debug level logging
   */
  debug(message, data = {}) {
    this._log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Trace level logging
   */
  trace(message, data = {}) {
    this._log(LOG_LEVELS.TRACE, message, data);
  }

  /**
   * Log element inspection details
   */
  inspectElement(element, description = 'Element inspection') {
    if (!element) {
      this.warn(`${description}: Element is null or undefined`);
      return;
    }

    const elementInfo = {
      tagName: element.tagName,
      hasTextContent: !!(element.textContent && element.textContent.trim()),
      textLength: element.textContent ? element.textContent.trim().length : 0,
      childrenCount: element.children ? element.children.length : 0,
      classList: element.className ? element.className.split(' ').filter(Boolean) : [],
      id: element.id || null,
      outerHTMLPreview: element.outerHTML ? element.outerHTML.substring(0, 100) + '...' : null
    };

    this.debug(description, { elementInfo });
  }

  /**
   * Log validation results with detailed breakdown
   */
  logValidationResult(result, context = '') {
    const prefix = context ? `${context}: ` : '';

    if (result.isValid) {
      this.info(`${prefix}Validation passed`);
    } else {
      this.warn(`${prefix}Validation failed`, {
        errors: result.errors,
        errorCount: result.errors ? result.errors.length : 0
      });
    }
  }

  /**
   * Log extraction attempt with details
   */
  logExtractionAttempt(selectors, found = false, elementCount = 0) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];

    if (found) {
      this.info('Extraction successful', {
        selectors: selectorList,
        elementsFound: elementCount
      });
    } else {
      this.warn('Extraction failed', {
        attemptedSelectors: selectorList,
        selectorCount: selectorList.length
      });
    }
  }

  /**
   * Log performance metrics summary
   */
  logMetrics() {
    const totalTime = Date.now() - this.context.startTime;
    const activeTimers = Array.from(this.timers.keys());

    this.info('Performance metrics', {
      totalExecutionTime: `${totalTime}ms`,
      errors: this.metrics.errors,
      warnings: this.metrics.warnings,
      operations: this.metrics.operations,
      activeTimers: activeTimers,
      errorRate: this.metrics.operations > 0 ?
        (this.metrics.errors / this.metrics.operations * 100).toFixed(2) + '%' : '0%'
    });
  }

  /**
   * Log network/fetch operation
   */
  logNetworkOperation(url, method = 'GET', status = null, error = null) {
    const data = { url, method };

    if (status) {
      data.status = status;
      if (status >= 200 && status < 300) {
        this.info('Network request successful', data);
      } else {
        this.warn('Network request returned error status', data);
      }
    }

    if (error) {
      this.error('Network request failed', data, error);
    }
  }

  /**
   * Log data extraction summary
   */
  logExtractionSummary(results) {
    const summary = {
      totalItems: results.length,
      validItems: results.filter(item => item && typeof item === 'object').length,
      nullItems: results.filter(item => item === null).length,
      undefinedItems: results.filter(item => item === undefined).length
    };

    summary.successRate = summary.totalItems > 0 ?
      (summary.validItems / summary.totalItems * 100).toFixed(2) + '%' : '0%';

    if (summary.validItems === summary.totalItems && summary.totalItems > 0) {
      this.info('Data extraction completed successfully', summary);
    } else if (summary.validItems > 0) {
      this.warn('Data extraction completed with some issues', summary);
    } else {
      this.error('Data extraction failed - no valid items extracted', summary);
    }
  }

  /**
   * Log parsing attempt for specific field
   */
  logFieldParsing(fieldName, rawValue, parsedValue, success = true) {
    const data = {
      field: fieldName,
      rawValue: rawValue,
      parsedValue: parsedValue,
      rawType: typeof rawValue,
      parsedType: typeof parsedValue
    };

    if (success) {
      this.debug(`Successfully parsed ${fieldName}`, data);
    } else {
      this.warn(`Failed to parse ${fieldName}`, data);
    }
  }

  /**
   * Create operation context for tracking related logs
   */
  withOperation(operationName, fn) {
    const operationLogger = this.child({ operation: operationName });
    operationLogger.startTimer(operationName);
    operationLogger.info(`Starting operation: ${operationName}`);

    try {
      const result = fn(operationLogger);
      operationLogger.info(`Operation completed: ${operationName}`);
      operationLogger.endTimer(operationName);
      return result;
    } catch (error) {
      operationLogger.error(`Operation failed: ${operationName}`, {}, error);
      operationLogger.endTimer(operationName);
      throw error;
    }
  }
}

/**
 * Create a root logger for the application
 */
export function createLogger(context = {}) {
  return new DebugLogger(context);
}

/**
 * Create a logger for restaurant operations
 */
export function createRestaurantLogger(restaurantName, additionalContext = {}) {
  return createLogger({
    restaurant: restaurantName,
    ...additionalContext
  });
}

/**
 * Create a logger for weekday operations
 */
export function createWeekdayLogger(restaurantName, weekday, additionalContext = {}) {
  return createLogger({
    restaurant: restaurantName,
    weekday: weekday,
    ...additionalContext
  });
}

/**
 * Helper function to measure async operation performance
 */
export async function measureAsync(logger, operationName, asyncFn) {
  return logger.withOperation(operationName, async (opLogger) => {
    return await asyncFn(opLogger);
  });
}

export default {
  createLogger,
  createRestaurantLogger,
  createWeekdayLogger,
  measureAsync,
  LOG_LEVELS
};
