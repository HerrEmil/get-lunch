/**
 * Data validator for lunch objects with comprehensive validation rules
 */

// Valid Swedish weekdays
const VALID_SWEDISH_WEEKDAYS = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag"
];

/**
 * Validates if a string is a valid Swedish weekday
 * @param {string} weekday - The weekday to validate
 * @returns {boolean} - True if valid Swedish weekday
 */
export function isValidSwedishWeekday(weekday) {
  if (!weekday || typeof weekday !== 'string') {
    return false;
  }

  return VALID_SWEDISH_WEEKDAYS.includes(weekday.toLowerCase().trim());
}

/**
 * Normalizes a Swedish weekday to lowercase
 * @param {string} weekday - The weekday to normalize
 * @returns {string} - Normalized weekday or empty string if invalid
 */
export function normalizeSwedishWeekday(weekday) {
  if (!isValidSwedishWeekday(weekday)) {
    return '';
  }

  return weekday.toLowerCase().trim();
}

/**
 * Validates if a value is a valid price (number >= 0)
 * @param {any} price - The price to validate
 * @returns {boolean} - True if valid price
 */
export function isValidPrice(price) {
  if (price === null || price === undefined) {
    return false;
  }

  const numPrice = Number(price);
  return !isNaN(numPrice) && isFinite(numPrice) && numPrice >= 0;
}

/**
 * Validates if a value is a valid week number (1-53)
 * @param {any} week - The week to validate
 * @returns {boolean} - True if valid week number
 */
export function isValidWeek(week) {
  if (week === null || week === undefined) {
    return false;
  }

  const numWeek = Number(week);
  return !isNaN(numWeek) && isFinite(numWeek) && numWeek >= 1 && numWeek <= 53;
}

/**
 * Validates if a value is a valid string (non-empty after trimming)
 * @param {any} str - The string to validate
 * @returns {boolean} - True if valid string
 */
export function isValidString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Validates if a value is a valid restaurant name
 * @param {any} place - The restaurant name to validate
 * @returns {boolean} - True if valid restaurant name
 */
export function isValidPlace(place) {
  return isValidString(place);
}

/**
 * Validates a complete lunch object
 * @param {object} lunch - The lunch object to validate
 * @returns {object} - Validation result with isValid boolean and errors array
 */
export function validateLunch(lunch) {
  const errors = [];

  if (!lunch || typeof lunch !== 'object') {
    return {
      isValid: false,
      errors: ['Lunch object is null, undefined, or not an object']
    };
  }

  // Validate name (required string)
  if (!isValidString(lunch.name)) {
    errors.push('Name must be a non-empty string');
  }

  // Validate price (required number >= 0)
  if (!isValidPrice(lunch.price)) {
    errors.push('Price must be a valid number >= 0');
  }

  // Validate week (required number 1-53)
  if (!isValidWeek(lunch.week)) {
    errors.push('Week must be a valid number between 1 and 53');
  }

  // Validate weekday (required valid Swedish weekday)
  if (!isValidSwedishWeekday(lunch.weekday)) {
    errors.push('Weekday must be a valid Swedish weekday (måndag, tisdag, onsdag, torsdag, fredag)');
  }

  // Validate place (required string)
  if (!isValidPlace(lunch.place)) {
    errors.push('Place must be a non-empty string');
  }

  // Validate description (optional string, but if present must be string)
  if (lunch.description !== undefined && lunch.description !== null && typeof lunch.description !== 'string') {
    errors.push('Description must be a string if provided');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validates an array of lunch objects
 * @param {array} lunches - Array of lunch objects to validate
 * @returns {object} - Validation result with valid lunches and validation errors
 */
export function validateLunches(lunches) {
  if (!Array.isArray(lunches)) {
    return {
      validLunches: [],
      validationErrors: ['Input is not an array'],
      totalCount: 0,
      validCount: 0,
      invalidCount: 0
    };
  }

  const validLunches = [];
  const validationErrors = [];

  for (let i = 0; i < lunches.length; i++) {
    const lunch = lunches[i];
    const validation = validateLunch(lunch);

    if (validation.isValid) {
      // Normalize the lunch object before adding
      validLunches.push({
        ...lunch,
        name: lunch.name.trim(),
        description: (lunch.description || '').trim(),
        place: lunch.place.trim(),
        weekday: normalizeSwedishWeekday(lunch.weekday),
        price: Number(lunch.price),
        week: Number(lunch.week)
      });
    } else {
      validationErrors.push({
        index: i,
        lunch: lunch,
        errors: validation.errors
      });
    }
  }

  return {
    validLunches: validLunches,
    validationErrors: validationErrors,
    totalCount: lunches.length,
    validCount: validLunches.length,
    invalidCount: validationErrors.length
  };
}

export default {
  isValidSwedishWeekday,
  normalizeSwedishWeekday,
  isValidPrice,
  isValidWeek,
  isValidString,
  isValidPlace,
  validateLunch,
  validateLunches,
};
