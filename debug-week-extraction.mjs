import { extractWeekNumber } from './week-extractor.mjs';
import { JSDOM } from 'jsdom';

console.log('Debug Week Extraction');
console.log('====================\n');

// Helper function to create test containers
function createTestContainer(weekText) {
  const html = `<div><h3>${weekText}</h3><p>Some content</p></div>`;
  return new JSDOM(html).window.document.querySelector('div');
}

// Test the extraction function step by step
console.log('1. Testing extractWeekNumber function directly:');
console.log('----------------------------------------------');

const testCases = [
  'Vecka 25',
  'Vecka 20250714',
  'Vecka 1',
  'Vår lunch Vecka 30'
];

testCases.forEach((weekText, index) => {
  console.log(`\nTest ${index + 1}: "${weekText}"`);

  const container = createTestContainer(weekText);
  console.log('  Container created successfully');

  // Check if we can find the week element
  const weekElement = container.querySelector("h3, h2, .week-header");
  console.log(`  Week element found: ${weekElement ? 'Yes' : 'No'}`);

  if (weekElement) {
    console.log(`  Week element text: "${weekElement.textContent}"`);

    // Test new format match
    const newFormatMatch = weekElement.textContent.match(/Vecka (\d{8})/);
    console.log(`  New format match: ${newFormatMatch ? newFormatMatch[1] : 'None'}`);

    // Test old format match
    const oldFormatMatch = weekElement.textContent.match(/Vecka (\d{1,2})/);
    console.log(`  Old format match: ${oldFormatMatch ? oldFormatMatch[1] : 'None'}`);
  }

  // Call the actual function
  const result = extractWeekNumber(container);
  console.log(`  Final result: Week ${result}`);
});

console.log('\n2. Testing regex patterns directly:');
console.log('----------------------------------');

const regexTests = [
  'Vecka 25',
  'Vecka 20250714',
  'Vecka 1',
  'Vecka 01'
];

regexTests.forEach(text => {
  console.log(`\nTesting: "${text}"`);

  const newMatch = text.match(/Vecka (\d{8})/);
  const oldMatch = text.match(/Vecka (\d{1,2})/);

  console.log(`  New format regex: ${newMatch ? newMatch[1] : 'No match'}`);
  console.log(`  Old format regex: ${oldMatch ? oldMatch[1] : 'No match'}`);

  // Which one would be used?
  if (newMatch) {
    console.log(`  Would use NEW format: ${newMatch[1]}`);
  } else if (oldMatch) {
    console.log(`  Would use OLD format: ${oldMatch[1]}`);
  }
});

console.log('\n3. Testing date calculation:');
console.log('----------------------------');

// Test the date calculation logic directly
const testDates = ['20250714', '20250101'];

testDates.forEach(dateStr => {
  console.log(`\nDate string: ${dateStr}`);

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month, day);

  console.log(`  Parsed: Year=${year}, Month=${month}, Day=${day}`);
  console.log(`  Date object: ${date.toDateString()}`);

  // Calculate week number
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startDate.getDay() + 1) / 7);

  console.log(`  Start of year: ${startDate.toDateString()}`);
  console.log(`  Days from start: ${days}`);
  console.log(`  Start day of week: ${startDate.getDay()}`);
  console.log(`  Calculated week: ${week}`);
});

console.log('\n4. Current week calculation:');
console.log('---------------------------');

const now = new Date();
const startDate = new Date(now.getFullYear(), 0, 1);
const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
const currentWeek = Math.ceil((days + startDate.getDay() + 1) / 7);

console.log(`Current date: ${now.toDateString()}`);
console.log(`Start of year: ${startDate.toDateString()}`);
console.log(`Days elapsed: ${days}`);
console.log(`Current week: ${currentWeek}`);
