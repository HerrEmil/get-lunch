import { extractWeekNumber, testWeekExtraction } from './week-extractor.mjs';

console.log('Testing Week Extraction Logic');
console.log('==============================\n');

// Test cases for different week formats
const testCases = [
  'Vecka 20250714',  // New format from current website
  'Vecka 25',        // Old format
  'Vecka 1',         // Old format, single digit
  'Vecka 52',        // Old format, end of year
  'Vecka 20241225',  // New format, Christmas week
  'Vecka 20240101',  // New format, New Year
];

console.log('1. Testing Week Text Parsing:');
console.log('-----------------------------');
testCases.forEach(testCase => {
  const result = testWeekExtraction(testCase);
  console.log(`Input: "${result.input}"`);
  console.log(`  - New format match: ${result.newFormat || 'none'}`);
  console.log(`  - Old format match: ${result.oldFormat || 'none'}`);
  console.log(`  - Extracted week: ${result.extracted}`);
  console.log('');
});

console.log('2. Testing with Mock DOM Elements:');
console.log('----------------------------------');

// Mock DOM element for testing
class MockElement {
  constructor(textContent) {
    this.textContent = textContent;
  }

  querySelector(selector) {
    // Simulate finding the week element
    if (selector.includes('h3') || selector.includes('h2')) {
      return this;
    }
    return null;
  }
}

const mockContainers = [
  new MockElement('Vecka 20250714'),
  new MockElement('Vecka 25'),
  new MockElement('Vår lunchmeny Vecka 30'),
  new MockElement(''), // Empty content
];

mockContainers.forEach((container, index) => {
  console.log(`Mock Container ${index + 1}:`);
  console.log(`  Content: "${container.textContent}"`);

  try {
    const week = extractWeekNumber(container);
    console.log(`  Extracted Week: ${week}`);
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  console.log('');
});

console.log('3. Current Date Fallback Test:');
console.log('-----------------------------');
const emptyContainer = {
  querySelector: () => null
};

try {
  const currentWeek = extractWeekNumber(emptyContainer);
  console.log(`Current week fallback: ${currentWeek}`);
} catch (error) {
  console.log(`Fallback error: ${error.message}`);
}

console.log('\n4. Date Calculation Validation:');
console.log('-------------------------------');

// Test specific date calculations
const testDates = [
  '20250714', // July 14, 2025
  '20250101', // January 1, 2025
  '20251231', // December 31, 2025
];

testDates.forEach(dateStr => {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month, day);

  console.log(`Date: ${dateStr} (${date.toDateString()})`);

  // Calculate week number
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startDate.getDay() + 1) / 7);

  console.log(`  Calculated week: ${week}`);
  console.log('');
});

console.log('Test completed!');
