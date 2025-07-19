/**
 * Parser Factory for Managing Multiple Restaurant Parsers
 * Provides centralized parser management, registration, and health monitoring
 */

import { createRestaurantLogger } from "../../enhanced-logger.mjs";
import { NiagaraParser } from "./niagara-parser.mjs";
import { DEFAULT_PARSER_CONFIG } from "./parser-interfaces.mjs";

/**
 * Circuit breaker states
 */
const CIRCUIT_BREAKER_STATES = {
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half-open",
};

/**
 * Parser Factory class for managing restaurant parsers
 */
export class ParserFactory {
  constructor(config = {}) {
    this.config = {
      defaultTimeout: 30000,
      defaultRetries: 3,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        timeout: 60000,
        monitoringPeriod: 300000,
      },
      healthCheck: {
        enabled: true,
        interval: 300000,
        timeout: 10000,
      },
      ...config,
    };

    // Parser registry
    this.parsers = new Map();
    this.parserClasses = new Map();
    this.circuitBreakers = new Map();

    // Health monitoring
    this.healthCheckInterval = null;
    this.lastHealthCheck = null;

    // Logger
    this.logger = createRestaurantLogger("ParserFactory", {
      component: "factory",
    });

    // Register built-in parsers
    this.registerParserClass("niagara", NiagaraParser);

    // Initialize circuit breakers
    this.initializeCircuitBreakers();

    // Start health monitoring if enabled
    if (this.config.healthCheck.enabled) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Register a parser class
   * @param {string} name - Parser name identifier
   * @param {Class} ParserClass - Parser class that extends BaseParser
   */
  registerParserClass(name, ParserClass) {
    try {
      if (!name || typeof name !== "string") {
        throw new Error("Parser name must be a non-empty string");
      }

      if (!ParserClass || typeof ParserClass !== "function") {
        throw new Error("Parser class must be a constructor function");
      }

      this.parserClasses.set(name.toLowerCase(), ParserClass);

      this.logger.info(`Registered parser class: ${name}`, {
        parserClass: ParserClass.name,
        totalRegistered: this.parserClasses.size,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to register parser class: ${name}`, {}, error);
      return false;
    }
  }

  /**
   * Create and register a parser instance
   * @param {Object} restaurantConfig - Restaurant configuration
   * @returns {Object} Parser instance or null if failed
   */
  createParser(restaurantConfig = {}) {
    try {
      const {
        id,
        name,
        parser: parserType,
        url,
        ...otherConfig
      } = restaurantConfig;

      if (!id || !name || !parserType) {
        throw new Error(
          "Restaurant config must include id, name, and parser type",
        );
      }

      const ParserClass = this.parserClasses.get(parserType.toLowerCase());
      if (!ParserClass) {
        throw new Error(`Unknown parser type: ${parserType}`);
      }

      // Merge with default configuration
      const parserConfig = {
        ...DEFAULT_PARSER_CONFIG,
        ...this.config,
        name,
        url,
        ...otherConfig,
      };

      // Create parser instance
      const parser = new ParserClass(parserConfig);

      // Store parser
      this.parsers.set(id, {
        parser,
        config: restaurantConfig,
        created: new Date().toISOString(),
        lastUsed: null,
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
        },
      });

      // Initialize circuit breaker for this parser
      this.initializeCircuitBreaker(id);

      this.logger.info(`Created parser instance: ${id}`, {
        parserType,
        restaurantName: name,
        url,
        totalParsers: this.parsers.size,
      });

      return parser;
    } catch (error) {
      this.logger.error(
        `Failed to create parser for ${restaurantConfig.id || "unknown"}`,
        {},
        error,
      );
      return null;
    }
  }

  /**
   * Get parser instance by restaurant ID
   * @param {string} restaurantId - Restaurant identifier
   * @returns {Object|null} Parser instance
   */
  getParser(restaurantId) {
    if (!restaurantId) {
      this.logger.warn("Parser ID is required");
      return null;
    }

    const parserData = this.parsers.get(restaurantId);
    if (!parserData) {
      this.logger.warn(`Parser not found: ${restaurantId}`);
      return null;
    }

    // Update last used timestamp
    parserData.lastUsed = new Date().toISOString();

    return parserData.parser;
  }

  /**
   * Execute parser with circuit breaker protection
   * @param {string} restaurantId - Restaurant identifier
   * @returns {Promise<Object>} Parser result
   */
  async executeParser(restaurantId) {
    const startTime = Date.now();

    try {
      const parser = this.getParser(restaurantId);
      if (!parser) {
        throw new Error(`Parser not found: ${restaurantId}`);
      }

      // Check circuit breaker
      if (!this.canExecute(restaurantId)) {
        throw new Error(`Circuit breaker is open for ${restaurantId}`);
      }

      this.logger.info(`Executing parser: ${restaurantId}`);

      // Execute parser
      const result = await parser.execute();

      // Update statistics based on result
      this.updateStats(restaurantId, result.success, Date.now() - startTime);

      // Record success/failure in circuit breaker
      if (result.success) {
        this.recordSuccess(restaurantId);
      } else {
        this.recordFailure(restaurantId);
      }

      this.logger.info(`Parser execution completed: ${restaurantId}`, {
        success: result.success,
        lunchCount: result.lunches.length,
        duration: `${Date.now() - startTime}ms`,
      });

      return result;
    } catch (error) {
      // Update statistics
      this.updateStats(restaurantId, false, Date.now() - startTime);

      // Record failure in circuit breaker
      this.recordFailure(restaurantId);

      this.logger.error(`Parser execution failed: ${restaurantId}`, {}, error);

      // Return standardized error response
      return {
        success: false,
        restaurant: restaurantId,
        url: "",
        lunches: [],
        error: {
          message: error.message,
          code: "EXECUTION_ERROR",
          timestamp: new Date().toISOString(),
        },
        metadata: {
          totalExtracted: 0,
          validCount: 0,
          invalidCount: 0,
          validationErrors: [],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          parser: "unknown",
          parserVersion: "1.0.0",
        },
      };
    }
  }

  /**
   * Execute all registered parsers
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Array of parser results
   */
  async executeAllParsers(options = {}) {
    const {
      parallel = true,
      maxConcurrency = 5,
      continueOnError = true,
    } = options;

    const restaurantIds = Array.from(this.parsers.keys());

    this.logger.info(`Executing all parsers`, {
      totalParsers: restaurantIds.length,
      parallel,
      maxConcurrency,
    });

    if (parallel) {
      // Execute in parallel with concurrency limit
      const results = [];
      const chunks = [];

      // Split into chunks based on maxConcurrency
      for (let i = 0; i < restaurantIds.length; i += maxConcurrency) {
        chunks.push(restaurantIds.slice(i, i + maxConcurrency));
      }

      for (const chunk of chunks) {
        const chunkPromises = chunk.map((id) => this.executeParser(id));

        if (continueOnError) {
          const chunkResults = await Promise.allSettled(chunkPromises);
          results.push(
            ...chunkResults.map((result) =>
              result.status === "fulfilled"
                ? result.value
                : {
                    success: false,
                    error: { message: result.reason.message },
                  },
            ),
          );
        } else {
          const chunkResults = await Promise.all(chunkPromises);
          results.push(...chunkResults);
        }
      }

      return results;
    } else {
      // Execute sequentially
      const results = [];

      for (const restaurantId of restaurantIds) {
        try {
          const result = await this.executeParser(restaurantId);
          results.push(result);
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          results.push({
            success: false,
            restaurant: restaurantId,
            error: { message: error.message },
          });
        }
      }

      return results;
    }
  }

  /**
   * Get all available parsers
   * @returns {Array} Array of parser information
   */
  getAllParsers() {
    const parsers = [];

    for (const [id, parserData] of this.parsers.entries()) {
      parsers.push({
        id,
        name: parserData.config.name,
        type: parserData.config.parser,
        url: parserData.config.url,
        active: parserData.config.active !== false,
        created: parserData.created,
        lastUsed: parserData.lastUsed,
        stats: parserData.stats,
        health: this.getParserHealth(id),
      });
    }

    return parsers;
  }

  /**
   * Get parser health status
   * @param {string} restaurantId - Restaurant identifier
   * @returns {Object} Health status
   */
  getParserHealth(restaurantId) {
    const parser = this.getParser(restaurantId);
    if (!parser) {
      return {
        isHealthy: false,
        status: "not_found",
        message: "Parser not found",
      };
    }

    const baseHealth = parser.getHealthStatus();
    const circuitBreaker = this.circuitBreakers.get(restaurantId);

    return {
      ...baseHealth,
      circuitBreaker: circuitBreaker
        ? {
            state: circuitBreaker.state,
            failureCount: circuitBreaker.failureCount,
            lastFailureTime: circuitBreaker.lastFailureTime,
          }
        : null,
    };
  }

  /**
   * Validate parser configuration
   * @param {Object} config - Parser configuration
   * @returns {Object} Validation result
   */
  validateParserConfig(config) {
    const errors = [];

    if (!config.id || typeof config.id !== "string") {
      errors.push("ID is required and must be a string");
    }

    if (!config.name || typeof config.name !== "string") {
      errors.push("Name is required and must be a string");
    }

    if (!config.parser || typeof config.parser !== "string") {
      errors.push("Parser type is required and must be a string");
    }

    if (!config.url || typeof config.url !== "string") {
      errors.push("URL is required and must be a string");
    }

    if (config.parser && !this.parserClasses.has(config.parser.toLowerCase())) {
      errors.push(`Unknown parser type: ${config.parser}`);
    }

    try {
      if (config.url) new URL(config.url);
    } catch {
      errors.push("URL must be a valid URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Remove parser
   * @param {string} restaurantId - Restaurant identifier
   * @returns {boolean} Success status
   */
  removeParser(restaurantId) {
    try {
      const removed = this.parsers.delete(restaurantId);
      this.circuitBreakers.delete(restaurantId);

      if (removed) {
        this.logger.info(`Removed parser: ${restaurantId}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove parser: ${restaurantId}`, {}, error);
      return false;
    }
  }

  /**
   * Initialize circuit breakers
   */
  initializeCircuitBreakers() {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    this.logger.info("Initializing circuit breakers", {
      failureThreshold: this.config.circuitBreaker.failureThreshold,
      timeout: this.config.circuitBreaker.timeout,
    });
  }

  /**
   * Initialize circuit breaker for specific parser
   * @param {string} restaurantId - Restaurant identifier
   */
  initializeCircuitBreaker(restaurantId) {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    this.circuitBreakers.set(restaurantId, {
      state: CIRCUIT_BREAKER_STATES.CLOSED,
      failureCount: 0,
      failureThreshold: this.config.circuitBreaker.failureThreshold,
      timeout: this.config.circuitBreaker.timeout,
      lastFailureTime: null,
      nextAttemptTime: null,
      totalRequests: 0,
      successfulRequests: 0,
    });
  }

  /**
   * Check if parser can be executed (circuit breaker check)
   * @param {string} restaurantId - Restaurant identifier
   * @returns {boolean} Can execute
   */
  canExecute(restaurantId) {
    if (!this.config.circuitBreaker.enabled) {
      return true;
    }

    const breaker = this.circuitBreakers.get(restaurantId);
    if (!breaker) {
      return true;
    }

    const now = Date.now();

    switch (breaker.state) {
      case CIRCUIT_BREAKER_STATES.CLOSED:
        return true;

      case CIRCUIT_BREAKER_STATES.OPEN:
        if (now >= breaker.nextAttemptTime) {
          breaker.state = CIRCUIT_BREAKER_STATES.HALF_OPEN;
          this.logger.info(
            `Circuit breaker transitioning to half-open: ${restaurantId}`,
          );
          return true;
        }
        return false;

      case CIRCUIT_BREAKER_STATES.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful execution
   * @param {string} restaurantId - Restaurant identifier
   */
  recordSuccess(restaurantId) {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    const breaker = this.circuitBreakers.get(restaurantId);
    if (!breaker) {
      return;
    }

    breaker.successfulRequests++;
    breaker.totalRequests++;

    if (breaker.state === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
      breaker.state = CIRCUIT_BREAKER_STATES.CLOSED;
      breaker.failureCount = 0;
      this.logger.info(`Circuit breaker closed: ${restaurantId}`);
    }
  }

  /**
   * Record failed execution
   * @param {string} restaurantId - Restaurant identifier
   */
  recordFailure(restaurantId) {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    const breaker = this.circuitBreakers.get(restaurantId);
    if (!breaker) {
      return;
    }

    breaker.failureCount++;
    breaker.totalRequests++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = CIRCUIT_BREAKER_STATES.OPEN;
      breaker.nextAttemptTime = Date.now() + breaker.timeout;

      this.logger.warn(`Circuit breaker opened: ${restaurantId}`, {
        failureCount: breaker.failureCount,
        threshold: breaker.failureThreshold,
        nextAttempt: new Date(breaker.nextAttemptTime).toISOString(),
      });
    }
  }

  /**
   * Update parser statistics
   * @param {string} restaurantId - Restaurant identifier
   * @param {boolean} success - Whether execution was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  updateStats(restaurantId, success, responseTime) {
    const parserData = this.parsers.get(restaurantId);
    if (!parserData) {
      return;
    }

    const stats = parserData.stats;
    stats.totalRequests++;

    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }

    // Update average response time
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) /
      stats.totalRequests;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      return;
    }

    this.logger.info("Starting health monitoring", {
      interval: this.config.healthCheck.interval,
    });

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info("Stopped health monitoring");
    }
  }

  /**
   * Perform health checks on all parsers
   */
  async performHealthChecks() {
    const startTime = Date.now();
    this.logger.debug("Performing health checks on all parsers");

    const healthResults = [];

    for (const [restaurantId] of this.parsers.entries()) {
      try {
        const health = this.getParserHealth(restaurantId);
        healthResults.push({
          restaurantId,
          ...health,
        });
      } catch (error) {
        this.logger.warn(`Health check failed for ${restaurantId}`, {}, error);
        healthResults.push({
          restaurantId,
          isHealthy: false,
          status: "error",
          message: error.message,
        });
      }
    }

    this.lastHealthCheck = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      results: healthResults,
      summary: {
        total: healthResults.length,
        healthy: healthResults.filter((r) => r.isHealthy).length,
        unhealthy: healthResults.filter((r) => !r.isHealthy).length,
      },
    };

    this.logger.info("Health check completed", {
      duration: `${this.lastHealthCheck.duration}ms`,
      summary: this.lastHealthCheck.summary,
    });
  }

  /**
   * Get factory statistics
   * @returns {Object} Factory statistics
   */
  getFactoryStats() {
    const parsers = this.getAllParsers();
    const totalRequests = parsers.reduce(
      (sum, p) => sum + p.stats.totalRequests,
      0,
    );
    const successfulRequests = parsers.reduce(
      (sum, p) => sum + p.stats.successfulRequests,
      0,
    );

    return {
      totalParsers: parsers.length,
      activeParsers: parsers.filter((p) => p.active).length,
      healthyParsers: parsers.filter((p) => p.health.isHealthy).length,
      totalRequests,
      successfulRequests,
      successRate:
        totalRequests > 0
          ? `${((successfulRequests / totalRequests) * 100).toFixed(1)}%`
          : "0%",
      lastHealthCheck: this.lastHealthCheck,
      registeredParserTypes: Array.from(this.parserClasses.keys()),
      circuitBreakerStats: this.getCircuitBreakerStats(),
    };
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} Circuit breaker statistics
   */
  getCircuitBreakerStats() {
    if (!this.config.circuitBreaker.enabled) {
      return { enabled: false };
    }

    const breakers = Array.from(this.circuitBreakers.entries()).map(
      ([id, breaker]) => ({
        restaurantId: id,
        state: breaker.state,
        failureCount: breaker.failureCount,
        totalRequests: breaker.totalRequests,
        successfulRequests: breaker.successfulRequests,
      }),
    );

    return {
      enabled: true,
      totalBreakers: breakers.length,
      openBreakers: breakers.filter(
        (b) => b.state === CIRCUIT_BREAKER_STATES.OPEN,
      ).length,
      halfOpenBreakers: breakers.filter(
        (b) => b.state === CIRCUIT_BREAKER_STATES.HALF_OPEN,
      ).length,
      closedBreakers: breakers.filter(
        (b) => b.state === CIRCUIT_BREAKER_STATES.CLOSED,
      ).length,
      breakers,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopHealthMonitoring();
    this.parsers.clear();
    this.parserClasses.clear();
    this.circuitBreakers.clear();

    this.logger.info("Parser factory destroyed");
  }
}

export default ParserFactory;
