/**
 * Standardized Parser Interfaces and Data Formats
 * Defines the contracts and data structures for restaurant parsers
 */

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
  createLunchObject,
  SWEDISH_WEEKDAYS,
  DEFAULT_PARSER_CONFIG
};
