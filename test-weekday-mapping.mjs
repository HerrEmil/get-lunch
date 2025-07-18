import {
  SWEDISH_WEEKDAYS,
  getCurrentSwedishWeekday,
  isValidSwedishWeekday,
  normalizeSwedishWeekday,
  extractWeekdayFromText,
  dayIndexToSwedishWeekday,
  swedishWeekdayToDayIndex,
  getNextSwedishWeekday,
  getPreviousSwedishWeekday,
  isToday,
  getAllSwedishWeekdays,
  validateWeekdayArray,
  testSwedishWeekdayMapping
} from './weekday-mapper.mjs';

console.log('Testing Swedish Weekday Mapping');
console.log('===============================\n');

// Test 1: Basic weekday constants
console.log('1. Testing Basic Weekday Constants:');
console.log('-----------------------------------');
console.log('Swedish weekdays:', SWEDISH_WEEKDAYS);
console.log('Total weekdays:', SWEDISH_WEEKDAYS.length);
console.log('First weekday:', SWEDISH_WEEKDAYS[0]);
console.log('Last weekday:', SWEDISH_WEEKDAYS[4]);
console.log('');

// Test 2: Current weekday detection
console.log('2. Testing Current Weekday Detection:');
console.log('------------------------------------');
const currentWeekday = getCurrentSwedishWeekday();
console.log('Current Swedish weekday:', currentWeekday);
console.log('Is current day valid Swedish weekday:', isValidSwedishWeekday(currentWeekday));
console.log('');

// Test 3: Weekday validation
console.log('3. Testing Weekday Validation:');
console.log('------------------------------');
const validationTests = [
  'måndag',    // valid
  'tisdag',    // valid
  'onsdag',    // valid
  'torsdag',   // valid
  'fredag',    // valid
  'lördag',    // invalid (weekend)
  'söndag',    // invalid (weekend)
  'monday',    // invalid (English)
  'MÅNDAG',    // should be case-insensitive
  '',          // invalid (empty)
  null,        // invalid (null)
  undefined,   // invalid (undefined)
  123          // invalid (number)
];

validationTests.forEach((test, index) => {
  const result = isValidSwedishWeekday(test);
  console.log(`  ${index + 1}. "${test}" -> ${result}`);
});
console.log('');

// Test 4: Weekday normalization
console.log('4. Testing Weekday Normalization:');
console.log('---------------------------------');
const normalizationTests = [
  'MÅNDAG',       // uppercase
  'Tisdag',       // mixed case
  '  onsdag  ',   // with spaces
  'mån',          // abbreviation
  'tis',          // abbreviation
  'tor',          // abbreviation
  'invalid',      // invalid input
  'monday',       // English
  'Fredag!',      // with punctuation
];

normalizationTests.forEach((test, index) => {
  const result = normalizeSwedishWeekday(test);
  console.log(`  ${index + 1}. "${test}" -> "${result}"`);
});
console.log('');

// Test 5: Weekday extraction from text
console.log('5. Testing Weekday Extraction from Text:');
console.log('---------------------------------------');
const extractionTests = [
  'Idag är det måndag',
  'Vecka 25 - Tisdag lunch',
  'Ons specialmeny',
  'Torsdagsmys på restaurangen',
  'Fredagslunch 95:-',
  'Helgmeny lördag-söndag',
  'No weekday here',
  'mån-fre öppet',
  'Lunch serveras tisdag till fredag'
];

extractionTests.forEach((test, index) => {
  const result = extractWeekdayFromText(test);
  console.log(`  ${index + 1}. "${test}" -> "${result}"`);
});
console.log('');

// Test 6: Day index conversion
console.log('6. Testing Day Index Conversion:');
console.log('--------------------------------');
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

for (let i = 0; i <= 6; i++) {
  const swedishDay = dayIndexToSwedishWeekday(i);
  console.log(`  ${dayNames[i]} (${i}) -> "${swedishDay}"`);
}
console.log('');

// Test 7: Swedish weekday to day index
console.log('7. Testing Swedish Weekday to Day Index:');
console.log('---------------------------------------');
SWEDISH_WEEKDAYS.forEach((weekday, index) => {
  const dayIndex = swedishWeekdayToDayIndex(weekday);
  console.log(`  "${weekday}" -> ${dayIndex}`);
});
console.log('');

// Test 8: Next/Previous weekday navigation
console.log('8. Testing Weekday Navigation:');
console.log('-----------------------------');
SWEDISH_WEEKDAYS.forEach((weekday, index) => {
  const next = getNextSwedishWeekday(weekday);
  const previous = getPreviousSwedishWeekday(weekday);
  console.log(`  ${weekday}: previous="${previous}", next="${next}"`);
});
console.log('');

// Test 9: Today checking
console.log('9. Testing Today Checking:');
console.log('-------------------------');
SWEDISH_WEEKDAYS.forEach(weekday => {
  const isTodayResult = isToday(weekday);
  console.log(`  "${weekday}" is today: ${isTodayResult}`);
});
console.log('');

// Test 10: Weekday array validation
console.log('10. Testing Weekday Array Validation:');
console.log('------------------------------------');
const arrayTests = [
  ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'], // complete
  ['måndag', 'tisdag', 'onsdag'], // missing days
  ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'], // extra day
  ['MÅNDAG', 'TISdag', 'onsdag', 'torsdag', 'fredag'], // case variations
  ['mån', 'tis', 'ons', 'tor', 'fre'], // abbreviations
  [], // empty array
];

arrayTests.forEach((testArray, index) => {
  const result = validateWeekdayArray(testArray);
  console.log(`  Test ${index + 1}: [${testArray.join(', ')}]`);
  console.log(`    Valid: ${result.isValid}`);
  console.log(`    Missing: [${result.missing.join(', ')}]`);
  console.log(`    Invalid: [${result.invalid.join(', ')}]`);
  console.log(`    Normalized: [${result.normalized.join(', ')}]`);
  console.log('');
});

// Test 11: Integration test with current parser logic
console.log('11. Testing Integration with Parser Logic:');
console.log('-----------------------------------------');

// Simulate the weekday loop from the parser
const weekdays = getAllSwedishWeekdays();
console.log('Parser weekday loop:');
weekdays.forEach((weekday, index) => {
  console.log(`  ${index}: Processing "${weekday}"`);

  // Test that each weekday is valid
  const isValid = isValidSwedishWeekday(weekday);
  console.log(`    Valid: ${isValid}`);

  // Test normalization (should return same value)
  const normalized = normalizeSwedishWeekday(weekday);
  console.log(`    Normalized: "${normalized}"`);

  // Test today check
  const todayCheck = isToday(weekday);
  console.log(`    Is today: ${todayCheck}`);

  console.log('');
});

// Test 12: Edge cases and error handling
console.log('12. Testing Edge Cases and Error Handling:');
console.log('-----------------------------------------');
const edgeCases = [
  null,
  undefined,
  '',
  '   ',
  123,
  [],
  {},
  'måndag tisdag', // multiple weekdays
  'måndag123',     // weekday with numbers
  'xmåndagx',      // weekday in middle
];

edgeCases.forEach((testCase, index) => {
  console.log(`  Edge case ${index + 1}: ${typeof testCase} "${testCase}"`);

  try {
    const isValid = isValidSwedishWeekday(testCase);
    const normalized = normalizeSwedishWeekday(testCase);
    const extracted = extractWeekdayFromText(String(testCase));

    console.log(`    Valid: ${isValid}`);
    console.log(`    Normalized: "${normalized}"`);
    console.log(`    Extracted: "${extracted}"`);
  } catch (error) {
    console.log(`    Error: ${error.message}`);
  }
  console.log('');
});

// Test 13: Comprehensive test function
console.log('13. Running Comprehensive Test Function:');
console.log('---------------------------------------');
const comprehensiveResults = testSwedishWeekdayMapping();

console.log('Current weekday:', comprehensiveResults.currentWeekday);
console.log('');

console.log('Validation tests:');
comprehensiveResults.validationTests.forEach((test, index) => {
  console.log(`  ${index + 1}. "${test.input}" -> ${test.isValid}`);
});
console.log('');

console.log('Normalization tests:');
comprehensiveResults.normalizationTests.forEach((test, index) => {
  console.log(`  ${index + 1}. "${test.input}" -> "${test.normalized}"`);
});
console.log('');

console.log('Extraction tests:');
comprehensiveResults.extractionTests.forEach((test, index) => {
  console.log(`  ${index + 1}. "${test.input}" -> "${test.extracted}"`);
});
console.log('');

console.log('Index conversion tests:');
comprehensiveResults.indexTests.forEach((test, index) => {
  console.log(`  ${index + 1}. Day ${test.dayIndex} -> "${test.swedishWeekday}"`);
});
console.log('');

console.log('All Swedish weekday mapping tests completed successfully!');
