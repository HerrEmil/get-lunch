/**
 * Swedish weekday mapping and validation module
 * Handles conversion between Swedish weekday names and various formats
 */

/**
 * Swedish weekday names in order (Monday to Friday)
 */
export const SWEDISH_WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

/**
 * English to Swedish weekday mapping
 */
export const EN_TO_SV_WEEKDAYS = {
  monday: "måndag",
  tuesday: "tisdag",
  wednesday: "onsdag",
  thursday: "torsdag",
  friday: "fredag"
};

/**
 * Swedish to English weekday mapping
 */
export const SV_TO_EN_WEEKDAYS = {
  måndag: "monday",
  tisdag: "tuesday",
  onsdag: "wednesday",
  torsdag: "thursday",
  fredag: "friday"
};

/**
 * Weekday abbreviations in Swedish
 */
export const SWEDISH_WEEKDAY_ABBREVIATIONS = {
  mån: "måndag",
  tis: "tisdag",
  ons: "onsdag",
  tor: "torsdag",
  fre: "fredag"
};

/**
 * Get current weekday in Swedish
 * @returns {string} - Swedish weekday name
 */
export function getCurrentSwedishWeekday() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", { weekday: "long" });
  return formatter.format(now);
}

/**
 * Validate if a string is a valid Swedish weekday
 * @param {string} weekday - Weekday to validate
 * @returns {boolean} - True if valid Swedish weekday
 */
export function isValidSwedishWeekday(weekday) {
  if (!weekday || typeof weekday !== 'string') {
    return false;
  }
  return SWEDISH_WEEKDAYS.includes(weekday.toLowerCase());
}

/**
 * Normalize Swedish weekday name (handle case variations)
 * @param {string} weekday - Input weekday
 * @returns {string|null} - Normalized weekday or null if invalid
 */
export function normalizeSwedishWeekday(weekday) {
  if (!weekday || typeof weekday !== 'string') {
    return null;
  }

  const normalized = weekday.toLowerCase().trim();

  // Check if it's already a valid weekday
  if (SWEDISH_WEEKDAYS.includes(normalized)) {
    return normalized;
  }

  // Check abbreviations
  if (SWEDISH_WEEKDAY_ABBREVIATIONS[normalized]) {
    return SWEDISH_WEEKDAY_ABBREVIATIONS[normalized];
  }

  // Try partial matching for common variations
  for (const weekdayName of SWEDISH_WEEKDAYS) {
    if (normalized.includes(weekdayName) || weekdayName.includes(normalized)) {
      return weekdayName;
    }
  }

  return null;
}

/**
 * Extract weekday from text content
 * @param {string} text - Text that might contain a weekday
 * @returns {string|null} - Extracted Swedish weekday or null
 */
export function extractWeekdayFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const lowercaseText = text.toLowerCase();

  // Look for full weekday names
  for (const weekday of SWEDISH_WEEKDAYS) {
    if (lowercaseText.includes(weekday)) {
      return weekday;
    }
  }

  // Look for abbreviations
  for (const [abbrev, fullName] of Object.entries(SWEDISH_WEEKDAY_ABBREVIATIONS)) {
    if (lowercaseText.includes(abbrev)) {
      return fullName;
    }
  }

  return null;
}

/**
 * Convert weekday index (0-6) to Swedish weekday name
 * @param {number} dayIndex - Day index (0 = Sunday, 1 = Monday, etc.)
 * @returns {string|null} - Swedish weekday or null if not a weekday (weekend)
 */
export function dayIndexToSwedishWeekday(dayIndex) {
  // Convert Sunday-based index to Monday-based (0 = Monday)
  const mondayBasedIndex = dayIndex === 0 ? 6 : dayIndex - 1;

  // Only return weekdays (Monday-Friday, indices 0-4)
  if (mondayBasedIndex >= 0 && mondayBasedIndex <= 4) {
    return SWEDISH_WEEKDAYS[mondayBasedIndex];
  }

  return null; // Weekend day
}

/**
 * Convert Swedish weekday to day index
 * @param {string} weekday - Swedish weekday name
 * @returns {number|null} - Day index (1 = Monday, 2 = Tuesday, etc.) or null if invalid
 */
export function swedishWeekdayToDayIndex(weekday) {
  const normalized = normalizeSwedishWeekday(weekday);
  if (!normalized) {
    return null;
  }

  const index = SWEDISH_WEEKDAYS.indexOf(normalized);
  return index !== -1 ? index + 1 : null; // 1-based index (1 = Monday)
}

/**
 * Get next Swedish weekday
 * @param {string} weekday - Current Swedish weekday
 * @returns {string|null} - Next weekday or null if invalid/Friday
 */
export function getNextSwedishWeekday(weekday) {
  const normalized = normalizeSwedishWeekday(weekday);
  if (!normalized) {
    return null;
  }

  const index = SWEDISH_WEEKDAYS.indexOf(normalized);
  if (index === -1 || index === 4) { // Invalid or Friday
    return null;
  }

  return SWEDISH_WEEKDAYS[index + 1];
}

/**
 * Get previous Swedish weekday
 * @param {string} weekday - Current Swedish weekday
 * @returns {string|null} - Previous weekday or null if invalid/Monday
 */
export function getPreviousSwedishWeekday(weekday) {
  const normalized = normalizeSwedishWeekday(weekday);
  if (!normalized) {
    return null;
  }

  const index = SWEDISH_WEEKDAYS.indexOf(normalized);
  if (index === -1 || index === 0) { // Invalid or Monday
    return null;
  }

  return SWEDISH_WEEKDAYS[index - 1];
}

/**
 * Check if given weekday is today
 * @param {string} weekday - Swedish weekday to check
 * @returns {boolean} - True if the weekday is today
 */
export function isToday(weekday) {
  const today = getCurrentSwedishWeekday();
  const normalized = normalizeSwedishWeekday(weekday);
  return normalized === today;
}

/**
 * Get all Swedish weekdays for iteration
 * @returns {Array<string>} - Array of Swedish weekday names
 */
export function getAllSwedishWeekdays() {
  return [...SWEDISH_WEEKDAYS]; // Return a copy
}

/**
 * Validate weekday array contains all required Swedish weekdays
 * @param {Array<string>} weekdays - Array of weekdays to validate
 * @returns {object} - Validation result with missing and invalid weekdays
 */
export function validateWeekdayArray(weekdays) {
  const result = {
    isValid: true,
    missing: [],
    invalid: [],
    normalized: []
  };

  // Check for missing weekdays
  for (const requiredDay of SWEDISH_WEEKDAYS) {
    const found = weekdays.some(day => normalizeSwedishWeekday(day) === requiredDay);
    if (!found) {
      result.missing.push(requiredDay);
      result.isValid = false;
    }
  }

  // Check for invalid weekdays and normalize valid ones
  for (const day of weekdays) {
    const normalized = normalizeSwedishWeekday(day);
    if (normalized) {
      if (!result.normalized.includes(normalized)) {
        result.normalized.push(normalized);
      }
    } else {
      result.invalid.push(day);
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Test function to validate Swedish weekday functionality
 * @returns {object} - Test results
 */
export function testSwedishWeekdayMapping() {
  const results = {
    currentWeekday: getCurrentSwedishWeekday(),
    validationTests: [],
    normalizationTests: [],
    extractionTests: [],
    indexTests: []
  };

  // Test validation
  const validationTestCases = [
    "måndag", "tisdag", "onsdag", "torsdag", "fredag", // valid
    "lördag", "söndag", "monday", "invalid", null, "" // invalid
  ];

  validationTestCases.forEach(testCase => {
    results.validationTests.push({
      input: testCase,
      isValid: isValidSwedishWeekday(testCase)
    });
  });

  // Test normalization
  const normalizationTestCases = [
    "MÅNDAG", "Tisdag", "onsdag", "mån", "tis", "invalid"
  ];

  normalizationTestCases.forEach(testCase => {
    results.normalizationTests.push({
      input: testCase,
      normalized: normalizeSwedishWeekday(testCase)
    });
  });

  // Test extraction from text
  const extractionTestCases = [
    "Idag är det måndag", "Vecka 25 - Tisdag", "Ons lunch", "Weekend"
  ];

  extractionTestCases.forEach(testCase => {
    results.extractionTests.push({
      input: testCase,
      extracted: extractWeekdayFromText(testCase)
    });
  });

  // Test index conversion
  for (let i = 0; i <= 6; i++) {
    results.indexTests.push({
      dayIndex: i,
      swedishWeekday: dayIndexToSwedishWeekday(i)
    });
  }

  return results;
}
