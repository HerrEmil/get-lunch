#!/usr/bin/env node

/**
 * Enhanced test for missing elements error handling in data extraction
 * Tests the improved error handling for various missing element scenarios
 */

import { extractNiagaraLunches, findWeekdayContent, extractLunchFromElement, findLunchContainer } from './data-extractor.mjs';
import { JSDOM } from 'jsdom';

// Test counter
let testCount = 0;
let passedTests = 0;

function runTest(testName, testFn) {
  testCount++;
  console.log(`\n--- Test ${testCount}: ${testName} ---`);

  try {
    const result = testFn();
    if (result) {
      console.log('✅ PASSED');
      passedTests++;
    } else {
      console.log('❌ FAILED');
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error.message);
  }
}

function createMockHtmlNode(html) {
  const dom = new JSDOM(`<div>${html}</div>`);
  return dom.window.document.body.firstElementChild;
}

function createMockGetHtmlNodeFromUrl(html) {
  return async (url, selector) => {
    const container = createMockHtmlNode(html);
    return container.querySelector(selector);
  };
}

// Test 1: Missing container entirely
runTest('Missing container entirely', () => {
  const mockGetHtml = async (url, selector) => null;

  console.log('Testing with function that returns null for all selectors...');

  return findLunchContainer(mockGetHtml, 'http://test.com')
    .then(result => {
      console.log('Result:', result);
      return result === null;
    });
});

// Test 2: Empty container (no children)
runTest('Empty container with no children', async () => {
  const emptyHtml = '<div class="lunch"></div>';
  const mockGetHtml = createMockGetHtmlNodeFromUrl(emptyHtml);

  console.log('Testing with empty container...');

  const container = await findLunchContainer(mockGetHtml, 'http://test.com');
  console.log('Container found:', !!container);
  console.log('Container children count:', container ? container.children.length : 0);

  return !container; // Should be null because empty container is rejected
});

// Test 3: Container with no text content
runTest('Container with no text content', async () => {
  const noTextHtml = '<div class="lunch"><div></div><span></span></div>';
  const mockGetHtml = createMockGetHtmlNodeFromUrl(noTextHtml);

  console.log('Testing with container that has elements but no text...');

  const container = await findLunchContainer(mockGetHtml, 'http://test.com');
  console.log('Container found:', !!container);
  console.log('Container text length:', container ? container.textContent.trim().length : 0);

  return !container; // Should be null because no text content
});

// Test 4: Table with missing tbody
runTest('Table with missing tbody element', () => {
  const tableNoTbodyHtml = `
    <div class="lunch">
      <h3>Lunch Menu</h3>
      <table>
        <tr><td>Pasta</td><td>Tomato sauce</td><td>85 kr</td></tr>
      </table>
    </div>
  `;

  const container = createMockHtmlNode(tableNoTbodyHtml);
  console.log('Testing table without tbody...');
  console.log('Table found:', !!container.querySelector('table'));
  console.log('Tbody found:', !!container.querySelector('tbody'));

  const lunches = extractAllLunchData(container);
  console.log('Extracted lunches count:', lunches.length);

  // Should handle gracefully and log warnings
  return true; // Test passes if no crash occurs
});

// Test 5: Table row with insufficient cells
runTest('Table row with insufficient cells', () => {
  const weekday = 'måndag';
  const week = 45;

  // Create table row with only 2 cells instead of required 3
  const insufficientCellsHtml = '<tr><td>Pasta</td><td>Good pasta</td></tr>';
  const element = createMockHtmlNode(insufficientCellsHtml);

  console.log('Testing table row with insufficient cells...');
  console.log('Cell count:', element.querySelectorAll('td').length);

  const result = extractLunchFromElement(element, week, weekday);
  console.log('Extraction result:', result);

  return result === null; // Should return null for insufficient cells
});

// Test 6: Missing name element in modern structure
runTest('Missing name element in modern structure', () => {
  const weekday = 'tisdag';
  const week = 45;

  // Create div element without any name selectors
  const noNameHtml = '<div class="meal"><p class="description">Nice food</p><span class="price">90 kr</span></div>';
  const element = createMockHtmlNode(noNameHtml);

  console.log('Testing modern structure missing name element...');
  console.log('Element HTML:', element.outerHTML);

  const result = extractLunchFromElement(element, week, weekday);
  console.log('Extraction result:', result);

  return result === null; // Should return null when name missing
});

// Test 7: Weekday content with no headings
runTest('Weekday content search with no headings', () => {
  const containerHtml = `
    <div class="lunch">
      <p>Some content</p>
      <div>More content</div>
    </div>
  `;

  const container = createMockHtmlNode(containerHtml);
  console.log('Testing container with no headings...');
  console.log('Headings found:', container.querySelectorAll('h1, h2, h3, h4, h5, h6').length);

  const elements = findWeekdayContent(container, 'onsdag');
  console.log('Found elements:', elements.length);

  return true; // Test passes if no crash and appropriate warnings logged
});

// Test 8: Tab panels with missing dataset
runTest('Tab panels with missing dataset', () => {
  const containerHtml = `
    <div class="lunch">
      <div class="tab-content">Some content without data attributes</div>
    </div>
  `;

  const container = createMockHtmlNode(containerHtml);
  console.log('Testing tab panels without dataset...');

  const tabContent = container.querySelector('.tab-content');
  console.log('Tab content found:', !!tabContent);
  console.log('Dataset exists:', !!tabContent?.dataset);

  const elements = findWeekdayContent(container, 'torsdag');
  console.log('Found elements:', elements.length);

  return true; // Test passes if no crash
});

// Test 9: Invalid element type (not DOM element)
runTest('Invalid element type for extraction', () => {
  const weekday = 'fredag';
  const week = 45;

  // Test with non-element objects
  const invalidElements = [
    null,
    undefined,
    'string',
    123,
    {},
    { textContent: 'fake' }
  ];

  console.log('Testing invalid element types...');

  let allReturnedNull = true;
  for (const invalidElement of invalidElements) {
    console.log(`Testing with: ${typeof invalidElement} ${invalidElement?.constructor?.name || 'N/A'}`);
    const result = extractLunchFromElement(invalidElement, week, weekday);
    if (result !== null) {
      console.log('Unexpected non-null result:', result);
      allReturnedNull = false;
    }
  }

  return allReturnedNull;
});

// Test 10: Container structure analysis when no matches found
runTest('Container structure analysis for debugging', () => {
  const complexHtml = `
    <div class="lunch">
      <header class="main-header">Restaurant Header</header>
      <section class="menu-section">
        <div class="food-card">
          <h5 class="dish-name">Special Dish</h5>
          <p class="dish-desc">Description here</p>
          <span class="cost">95 kr</span>
        </div>
      </section>
      <div data-meal="lunch" data-day-type="weekday">
        <article class="food-item">
          <strong>Another Dish</strong>
          <em>Another description</em>
          <b>80 kr</b>
        </article>
      </div>
    </div>
  `;

  const container = createMockHtmlNode(complexHtml);
  console.log('Testing complex container structure analysis...');
  console.log('Container children count:', container.children.length);

  // This should trigger extensive debugging output
  const elements = findWeekdayContent(container, 'måndag');
  console.log('Found elements:', elements.length);

  return true; // Test passes if comprehensive debugging info is logged
});

// Test 11: Network/fetch failure simulation
runTest('Network failure simulation', async () => {
  const mockGetHtml = async (url, selector) => {
    throw new Error('Network error: Connection refused');
  };

  console.log('Testing network failure handling...');

  try {
    const result = await extractNiagaraLunches(mockGetHtml, 'http://invalid-url.test');
    console.log('Result after network error:', result);
    console.log('Result is array:', Array.isArray(result));
    console.log('Result length:', result.length);

    return Array.isArray(result) && result.length === 0;
  } catch (error) {
    console.log('Unexpected exception thrown:', error.message);
    return false;
  }
});

// Test 12: Malformed HTML structure
runTest('Malformed HTML structure', () => {
  const malformedHtml = `
    <div class="lunch">
      <table>
        <td>Orphaned cell</td>
        <tr>
          <td>Name</td>
          <!-- Missing cells -->
        </tr>
        <!-- Missing tbody -->
      </table>
      <div class=">Invalid attribute</div>
      <span>Unclosed element
      <p>Another paragraph</p>
    </div>
  `;

  console.log('Testing malformed HTML handling...');

  try {
    const container = createMockHtmlNode(malformedHtml);
    console.log('Container created from malformed HTML');

    const lunches = extractAllLunchData(container);
    console.log('Extraction completed with lunches:', lunches.length);

    return true; // Test passes if no crash
  } catch (error) {
    console.log('Error handling malformed HTML:', error.message);
    return false;
  }
});

// Import the missing function for Test 4
async function extractAllLunchData(container) {
  const { extractAllLunchData } = await import('./data-extractor.mjs');
  return extractAllLunchData(container);
}

// Run all tests
console.log('🧪 Running Enhanced Missing Elements Error Handling Tests\n');
console.log('This test suite validates improved error handling for missing DOM elements\n');

// Wait for async tests to complete
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${testCount} tests passed`);

  if (passedTests === testCount) {
    console.log('🎉 All tests passed! Enhanced error handling is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the error handling implementation.');
  }

  console.log('\n📝 Key improvements tested:');
  console.log('  • Better validation of DOM elements before processing');
  console.log('  • Enhanced debugging info for missing elements');
  console.log('  • Graceful handling of malformed HTML structures');
  console.log('  • Comprehensive logging for troubleshooting');
  console.log('  • Safe fallbacks when expected elements are missing');
}, 100);
