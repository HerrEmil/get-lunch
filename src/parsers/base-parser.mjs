/**
 * Abstract Base Parser for Restaurant Menu Extraction
 * Provides common functionality and defines interface for all restaurant parsers
 */

import { createRestaurantLogger } from "../../enhanced-logger.mjs";
import { validateLunches } from "../../data-validator.mjs";
import { JSDOM } from "jsdom";

// HTTP request timeout configuration
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Abstract base class for restaurant parsers
 * All restaurant-specific parsers should extend this class
 */
export class BaseParser {
  constructor(config = {}) {
    if (this.constructor === BaseParser) {
      throw new Error(
        "BaseParser is abstract and cannot be instantiated directly",
      );
    }

    // Validate required abstract methods
    this._validateAbstractMethods();

    // Parser configuration
    this.config = {
      name: config.name || "Unknown Restaurant",
      url: config.url || "",
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      headers: config.headers || {
        "User-Agent":
          "Enhanced-Lunch-Table/1.0 (https://github.com/enhanced-lunch-table)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      ...config,
    };

    // Initialize logger
    this.logger = createRestaurantLogger(this.config.name, {
      parser: this.constructor.name,
      url: this.config.url,
    });

    // Parser state
    this.state = {
      lastSuccessful: null,
      lastError: null,
      consecutiveFailures: 0,
      isHealthy: true,
      totalRequests: 0,
      successfulRequests: 0,
    };
  }

  /**
   * Validate that all abstract methods are implemented
   * @private
   */
  _validateAbstractMethods() {
    const abstractMethods = ["parseMenu", "getName", "getUrl"];

    for (const method of abstractMethods) {
      if (typeof this[method] !== "function") {
        throw new Error(
          `Abstract method '${method}' must be implemented by ${this.constructor.name}`,
        );
      }
    }
  }

  /**
   * Abstract method: Parse restaurant menu
   * Must be implemented by subclasses
   * @returns {Promise<Array>} Array of lunch objects
   */
  async parseMenu() {
    throw new Error("parseMenu() method must be implemented by subclasses");
  }

  /**
   * Abstract method: Get restaurant name
   * Must be implemented by subclasses
   * @returns {string} Restaurant name
   */
  getName() {
    throw new Error("getName() method must be implemented by subclasses");
  }

  /**
   * Abstract method: Get restaurant URL
   * Must be implemented by subclasses
   * @returns {string} Restaurant URL
   */
  getUrl() {
    throw new Error("getUrl() method must be implemented by subclasses");
  }

  /**
   * Execute the menu parsing with full error handling and logging
   * @returns {Promise<Object>} Standardized parser response
   */
  async execute() {
    const startTime = Date.now();
    this.logger.startTimer("parseExecution");

    try {
      await this.logger.info("Starting menu parsing", {
        restaurant: this.getName(),
        url: this.getUrl(),
        attempt: this.state.totalRequests + 1,
      });

      this.state.totalRequests++;

      // Execute the parsing
      const lunches = await this.parseMenu();

      // Validate the results
      const validation = validateLunches(lunches || []);

      if (validation.validCount === 0 && lunches.length > 0) {
        throw new Error(`All ${lunches.length} lunch items failed validation`);
      }

      // Update success state
      this.state.lastSuccessful = new Date().toISOString();
      this.state.consecutiveFailures = 0;
      this.state.successfulRequests++;
      this.state.isHealthy = true;

      const duration = Date.now() - startTime;
      this.logger.endTimer("parseExecution");

      await this.logger.info("Menu parsing completed successfully", {
        totalItems: lunches.length,
        validItems: validation.validCount,
        invalidItems: validation.invalidCount,
        duration: `${duration}ms`,
        successRate: `${((this.state.successfulRequests / this.state.totalRequests) * 100).toFixed(1)}%`,
      });

      return {
        success: true,
        restaurant: this.getName(),
        url: this.getUrl(),
        lunches: validation.validLunches,
        metadata: {
          totalExtracted: lunches.length,
          validCount: validation.validCount,
          invalidCount: validation.invalidCount,
          validationErrors: validation.validationErrors,
          duration: duration,
          timestamp: new Date().toISOString(),
          parser: this.constructor.name,
          parserVersion: "1.0.0",
        },
      };
    } catch (error) {
      // Update failure state
      this.state.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };
      this.state.consecutiveFailures++;
      this.state.isHealthy = this.state.consecutiveFailures < 3;

      const duration = Date.now() - startTime;
      this.logger.endTimer("parseExecution");

      await this.logger.error(
        "Menu parsing failed",
        {
          error: error.message,
          consecutiveFailures: this.state.consecutiveFailures,
          duration: `${duration}ms`,
          isHealthy: this.state.isHealthy,
        },
        error,
      );

      return {
        success: false,
        restaurant: this.getName(),
        url: this.getUrl(),
        lunches: [],
        error: {
          message: error.message,
          code: error.code || "PARSE_ERROR",
          timestamp: new Date().toISOString(),
          consecutiveFailures: this.state.consecutiveFailures,
        },
        metadata: {
          totalExtracted: 0,
          validCount: 0,
          invalidCount: 0,
          validationErrors: [],
          duration: duration,
          timestamp: new Date().toISOString(),
          parser: this.constructor.name,
          parserVersion: "1.0.0",
        },
      };
    }
  }

  /**
   * Get parser health status
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const totalRequests = this.state.totalRequests;
    const successRate =
      totalRequests > 0
        ? ((this.state.successfulRequests / totalRequests) * 100).toFixed(1)
        : "0.0";

    return {
      isHealthy: this.state.isHealthy,
      restaurant: this.getName(),
      parser: this.constructor.name,
      consecutiveFailures: this.state.consecutiveFailures,
      totalRequests: totalRequests,
      successfulRequests: this.state.successfulRequests,
      successRate: `${successRate}%`,
      lastSuccessful: this.state.lastSuccessful,
      lastError: this.state.lastError,
      status: this.state.isHealthy ? "healthy" : "unhealthy",
    };
  }

  /**
   * Reset parser state (useful for testing or recovery)
   */
  resetState() {
    this.state = {
      lastSuccessful: null,
      lastError: null,
      consecutiveFailures: 0,
      isHealthy: true,
      totalRequests: 0,
      successfulRequests: 0,
    };

    this.logger.info("Parser state reset");
  }

  /**
   * Get parser configuration
   * @returns {Object} Parser configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update parser configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info("Parser configuration updated", { newConfig });
  }

  /**
   * Create a standardized lunch object
   * @param {Object} lunchData - Raw lunch data
   * @returns {Object} Standardized lunch object
   */
  createLunchObject(lunchData = {}) {
    return {
      name: lunchData.name || "",
      description: lunchData.description || "",
      price: lunchData.price || 0,
      weekday: lunchData.weekday || "",
      week: lunchData.week || this._getCurrentWeek(),
      place: this.getName(),
      ...lunchData,
    };
  }

  /**
   * Get current ISO week number
   * @private
   * @returns {number} Current week number
   */
  _getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  /**
   * Utility method to safely extract text content from DOM elements
   * @param {Element} element - DOM element
   * @param {string} defaultValue - Default value if extraction fails
   * @returns {string} Extracted text content
   */
  extractText(element, defaultValue = "") {
    try {
      if (!element) return defaultValue;

      const text = element.textContent || element.innerText || "";
      return text.trim();
    } catch (error) {
      this.logger.warn("Failed to extract text from element", {
        error: error.message,
      });
      return defaultValue;
    }
  }

  /**
   * Utility method to safely extract numeric values (prices, etc.)
   * @param {string} text - Text containing numeric value
   * @param {number} defaultValue - Default value if extraction fails
   * @returns {number} Extracted numeric value
   */
  extractNumber(text, defaultValue = 0) {
    try {
      if (!text || typeof text !== "string") return defaultValue;

      // Remove common non-numeric characters
      const cleaned = text.replace(/[^\d.,]/g, "");

      // Handle Swedish number format (comma as decimal separator)
      const normalized = cleaned.replace(",", ".");

      const number = parseFloat(normalized);
      return isNaN(number) ? defaultValue : number;
    } catch (error) {
      this.logger.warn("Failed to extract number from text", {
        text,
        error: error.message,
      });
      return defaultValue;
    }
  }

  /**
   * Utility method to safely query DOM elements
   * @param {Element} container - Container element
   * @param {string} selector - CSS selector
   * @param {boolean} all - Whether to return all matches
   * @returns {Element|NodeList|null} Selected element(s)
   */
  safeQuery(container, selector, all = false) {
    try {
      if (!container || !selector) return null;

      if (all) {
        const elements = container.querySelectorAll(selector);
        return elements.length > 0 ? elements : null;
      } else {
        return container.querySelector(selector);
      }
    } catch (error) {
      this.logger.warn("Failed to query DOM element", {
        selector,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * String representation of the parser
   * @returns {string} Parser description
   */
  toString() {
    return `${this.constructor.name}(${this.getName()})`;
  }

  /**
   * Make HTTP request with retry logic and error handling
   * @param {string} url - URL to fetch
   * @param {Object} options - Request options
   * @returns {Promise<Response>} HTTP response
   */
  async makeRequest(url, options = {}) {
    const requestOptions = {
      method: "GET",
      headers: this.config.headers,
      timeout: this.config.timeout,
      ...options,
    };

    let lastError = null;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        await this.logger.debug(
          `HTTP request attempt ${attempt}/${this.config.retries}`,
          {
            url,
            method: requestOptions.method,
            timeout: requestOptions.timeout,
          },
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          requestOptions.timeout,
        );

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await this.logger.info("HTTP request successful", {
          url,
          status: response.status,
          attempt,
          contentType: response.headers.get("content-type"),
        });

        return response;
      } catch (error) {
        lastError = error;

        await this.logger.warn(
          `HTTP request failed (attempt ${attempt}/${this.config.retries})`,
          {
            url,
            error: error.message,
            attempt,
          },
        );

        // Don't retry on the last attempt
        if (attempt === this.config.retries) {
          break;
        }

        // Wait before retrying
        await this.sleep(this.config.retryDelay * attempt);
      }
    }

    throw new Error(
      `HTTP request failed after ${this.config.retries} attempts: ${lastError.message}`,
    );
  }

  /**
   * Fetch and parse HTML document
   * @param {string} url - URL to fetch
   * @returns {Promise<Document>} Parsed DOM document
   */
  async fetchDocument(url = null) {
    const targetUrl = url || this.getUrl();

    try {
      const response = await this.makeRequest(targetUrl);
      const html = await response.text();

      if (!html || html.trim().length === 0) {
        throw new Error("Received empty HTML response");
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;

      await this.logger.debug("HTML document parsed successfully", {
        url: targetUrl,
        documentTitle: document.title,
        bodyLength: document.body ? document.body.innerHTML.length : 0,
      });

      return document;
    } catch (error) {
      await this.logger.error(
        "Failed to fetch and parse document",
        {
          url: targetUrl,
          error: error.message,
        },
        error,
      );
      throw error;
    }
  }

  /**
   * Get HTML element from URL using CSS selector
   * @param {string} url - URL to fetch
   * @param {string} selector - CSS selector
   * @returns {Promise<Element|null>} Selected element
   */
  async getHtmlNodeFromUrl(url, selector) {
    try {
      const document = await this.fetchDocument(url);
      const element = this.safeQuery(document, selector);

      if (!element) {
        await this.logger.warn("Element not found with selector", {
          url,
          selector,
        });
        return null;
      }

      await this.logger.debug("Element found with selector", {
        url,
        selector,
        elementTag: element.tagName,
      });

      return element;
    } catch (error) {
      await this.logger.error(
        "Failed to get HTML node from URL",
        {
          url,
          selector,
          error: error.message,
        },
        error,
      );
      return null;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle network-related errors with specific error types
   * @param {Error} error - Original error
   * @returns {Error} Enhanced error with specific type
   */
  handleNetworkError(error) {
    if (error.name === "AbortError") {
      return new Error(`Request timeout after ${this.config.timeout}ms`);
    }

    if (error.message.includes("fetch")) {
      return new Error(`Network error: ${error.message}`);
    }

    if (error.message.includes("ENOTFOUND")) {
      return new Error(`DNS resolution failed: ${error.message}`);
    }

    if (error.message.includes("ECONNREFUSED")) {
      return new Error(`Connection refused: ${error.message}`);
    }

    return error;
  }

  /**
   * Check if parser can handle a given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if parser can handle the URL
   */
  canHandle(url) {
    if (!this.isValidUrl(url)) {
      return false;
    }

    const parserUrl = this.getUrl();
    if (!parserUrl) {
      return false;
    }

    try {
      const urlObj = new URL(url);
      const parserUrlObj = new URL(parserUrl);

      return urlObj.hostname === parserUrlObj.hostname;
    } catch {
      return false;
    }
  }
}

export default BaseParser;
