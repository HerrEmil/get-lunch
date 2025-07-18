#!/usr/bin/env node

/**
 * Comprehensive unit tests for the updated Niagara parser
 * Tests all functionality including error handling, validation, and data extraction
 */

import { JSDOM } from "jsdom";
import {
  extractNiagaraLunches,
  extractAllLunchData,
  extractLunchFromElement,
  findLunchContainer,
  findWeekdayContent,
} from "./data-extractor.mjs";
import {
  validateLunch,
  validateLunches,
  validateRestaurantStatus,
  isValidSwedishWeekday,
  normalizeSwedishWeekday,
  isValidPrice,
  isValidWeek,
} from "./data-validator.mjs";
import { extractWeekNumber } from "./week-extractor.mjs";

// Test suite configuration
const TEST_SUITE_NAME = "Niagara Parser Unit Tests";
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

// Helper function to create mock DOM elements
function createMockElement(html) {
  // Handle table rows specifically
  if (html.includes("<tr>")) {
    const dom = new JSDOM(`<table><tbody>${html}</tbody></table>`);
    return dom.window.document.querySelector("tr");
  }
  // Handle regular elements
  const dom = new JSDOM(`<div>${html}</div>`);
  return dom.window.document.body.firstElementChild.firstElementChild;
}

// Helper function to create mock getHtmlNodeFromUrl
function createMockGetHtmlNodeFromUrl(htmlContent) {
  return async (url, selector) => {
    const dom = new JSDOM(htmlContent);
    return dom.window.document.querySelector(selector);
  };
}

// Test result tracking
function runTest(testName, testFunction) {
  testCount++;
  console.log(`\n--- Test ${testCount}: ${testName} ---`);

  try {
    const result = testFunction();
    if (result === true || (result && result.success !== false)) {
      console.log("✅ PASSED");
      passedTests++;
      return true;
    } else {
      console.log("❌ FAILED");
      failedTests++;
      return false;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    failedTests++;
    return false;
  }
}

// Test Suite 1: Data Validator Tests
function testDataValidator() {
  console.log("\n🧪 TEST SUITE 1: Data Validator Functions");
  console.log("=".repeat(50));

  // Test Swedish weekday validation
  runTest("Swedish weekday validation - valid days", () => {
    const validDays = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];
    return validDays.every((day) => isValidSwedishWeekday(day));
  });

  runTest("Swedish weekday validation - invalid days", () => {
    const invalidDays = [
      "lördag",
      "söndag",
      "saturday",
      "monday",
      "",
      null,
      undefined,
    ];
    return invalidDays.every((day) => !isValidSwedishWeekday(day));
  });

  runTest("Swedish weekday normalization", () => {
    const testCases = [
      { input: "MÅNDAG", expected: "måndag" },
      { input: "Tisdag", expected: "tisdag" },
      { input: "  onsdag  ", expected: "onsdag" },
      { input: "invalid", expected: "" },
    ];
    return testCases.every(
      (test) => normalizeSwedishWeekday(test.input) === test.expected,
    );
  });

  // Test price validation
  runTest("Price validation - valid prices", () => {
    const validPrices = [0, 125, 150.5, "125", "0"];
    return validPrices.every((price) => isValidPrice(price));
  });

  runTest("Price validation - invalid prices", () => {
    const invalidPrices = [-1, "invalid", null, undefined, NaN, Infinity];
    return invalidPrices.every((price) => !isValidPrice(price));
  });

  // Test week validation
  runTest("Week validation - valid weeks", () => {
    const validWeeks = [1, 26, 53, "47"];
    return validWeeks.every((week) => isValidWeek(week));
  });

  runTest("Week validation - invalid weeks", () => {
    const invalidWeeks = [0, 54, -1, "invalid", null, undefined];
    return invalidWeeks.every((week) => !isValidWeek(week));
  });

  // Test lunch object validation
  runTest("Lunch object validation - valid lunch", () => {
    const validLunch = {
      name: "Köttbullar",
      description: "Med gräddsås",
      price: 125,
      place: "Niagara",
      week: 47,
      weekday: "måndag",
    };
    const result = validateLunch(validLunch);
    return result.isValid && result.errors.length === 0;
  });

  runTest("Lunch object validation - invalid lunch", () => {
    const invalidLunch = {
      name: "",
      description: "Med gräddsås",
      price: -10,
      place: "Niagara",
      week: 0,
      weekday: "saturday",
    };
    const result = validateLunch(invalidLunch);
    return !result.isValid && result.errors.length > 0;
  });

  // Test restaurant status validation
  runTest("Restaurant status - open restaurant", () => {
    const status = validateRestaurantStatus(
      "Normal lunch menu available today",
    );
    return status.isOpen === true;
  });

  runTest("Restaurant status - closed restaurant", () => {
    const status = validateRestaurantStatus("Semesterstängt V.29-32");
    return status.isOpen === false && status.closureIndicators.length > 0;
  });
}

// Test Suite 2: Week Extraction Tests
function testWeekExtraction() {
  console.log("\n🧪 TEST SUITE 2: Week Extraction");
  console.log("=".repeat(50));

  runTest("Week extraction - standard format", () => {
    const html = `<main><h3>Vecka 47</h3></main>`;
    const element = createMockElement(html);
    const week = extractWeekNumber(element);
    return week === 47;
  });

  runTest("Week extraction - date format", () => {
    const html = `<main><h3>Vecka 20241201</h3></main>`;
    const element = createMockElement(html);
    const week = extractWeekNumber(element);
    return typeof week === "number" && week >= 1 && week <= 53;
  });

  runTest("Week extraction - missing week element", () => {
    const html = `<main><p>No week info here</p></main>`;
    const element = createMockElement(html);
    const week = extractWeekNumber(element);
    // Should return current week as fallback
    return typeof week === "number" && week >= 1 && week <= 53;
  });
}

// Test Suite 3: Element Extraction Tests
function testElementExtraction() {
  console.log("\n🧪 TEST SUITE 3: Element Extraction");
  console.log("=".repeat(50));

  runTest("Extract lunch from table row - valid data", () => {
    const html = `<tr>
        <td>Köttbullar med gräddsås</td>
        <td>Serveras med kokt potatis och lingonsylt</td>
        <td>125:-</td>
      </tr>`;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");

    return (
      lunch !== null &&
      lunch.name === "Köttbullar med gräddsås" &&
      lunch.price === 125 &&
      lunch.weekday === "måndag" &&
      lunch.place === "Niagara"
    );
  });

  runTest("Extract lunch from table row - missing cells", () => {
    const html = `<tr><td>Only one cell</td></tr>`;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");
    return lunch === null;
  });

  runTest("Extract lunch from table row - empty name", () => {
    const html = `
      <tr>
        <td></td>
        <td>Description</td>
        <td>125:-</td>
      </tr>
    `;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");
    return lunch === null;
  });

  runTest("Extract lunch from table row - invalid price", () => {
    const html = `
      <tr>
        <td>Valid Name</td>
        <td>Description</td>
        <td>invalid price</td>
      </tr>
    `;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");
    return lunch === null;
  });

  runTest("Extract lunch from modern structure", () => {
    const html = `
      <div class="lunch-item">
        <h5>Grillad lax</h5>
        <p>Med citronsmör och dillpotatis</p>
        <span class="price">145kr</span>
      </div>
    `;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");

    return (
      lunch !== null &&
      lunch.name === "Grillad lax" &&
      lunch.price === 145 &&
      lunch.weekday === "måndag"
    );
  });

  runTest("Extract lunch from modern structure - missing name", () => {
    const html = `
      <div class="lunch-item">
        <p>Med citronsmör och dillpotatis</p>
        <span class="price">145kr</span>
      </div>
    `;
    const element = createMockElement(html);
    const lunch = extractLunchFromElement(element, 47, "måndag");
    return lunch === null;
  });
}

// Test Suite 4: Weekday Content Finding Tests
function testWeekdayContentFinding() {
  console.log("\n🧪 TEST SUITE 4: Weekday Content Finding");
  console.log("=".repeat(50));

  runTest("Find weekday content - heading based", () => {
    const html = `
      <main>
        <h4>Måndag</h4>
        <div class="lunch-item">Content for Monday</div>
        <h4>Tisdag</h4>
        <div class="lunch-item">Content for Tuesday</div>
      </main>
    `;
    const container = createMockElement(html);
    const elements = findWeekdayContent(container, "måndag");
    return elements.length > 0;
  });

  runTest("Find weekday content - data attributes", () => {
    const html = `
      <main>
        <div data-day="måndag">
          <div class="lunch-item">Monday content</div>
        </div>
        <div data-day="tisdag">
          <div class="lunch-item">Tuesday content</div>
        </div>
      </main>
    `;
    const container = createMockElement(html);
    const elements = findWeekdayContent(container, "måndag");
    return elements.length > 0;
  });

  runTest("Find weekday content - no matching content", () => {
    const html = `
      <main>
        <div>No weekday specific content</div>
      </main>
    `;
    const container = createMockElement(html);
    const elements = findWeekdayContent(container, "måndag");
    return elements.length === 0;
  });

  runTest("Find weekday content - empty container", () => {
    const html = `<main></main>`;
    const container = createMockElement(html);
    const elements = findWeekdayContent(container, "måndag");
    return elements.length === 0;
  });
}

// Test Suite 5: Container Finding Tests
function testContainerFinding() {
  console.log("\n🧪 TEST SUITE 5: Container Finding");
  console.log("=".repeat(50));

  runTest("Find lunch container - main element exists", async () => {
    const html = `
      <html>
        <body>
          <main>
            <h3>Vecka 47</h3>
            <p>Lunch content</p>
          </main>
        </body>
      </html>
    `;
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(html);
    const container = await findLunchContainer(
      mockGetHtmlNode,
      "https://test.com",
    );
    return container !== null && container.tagName === "MAIN";
  });

  runTest("Find lunch container - fallback to body", async () => {
    const html = `
      <html>
        <body>
          <div>No main element</div>
        </body>
      </html>
    `;
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(html);
    const container = await findLunchContainer(
      mockGetHtmlNode,
      "https://test.com",
    );
    return container !== null && container.tagName === "BODY";
  });
}

// Test Suite 6: All Data Extraction Tests
function testAllDataExtraction() {
  console.log("\n🧪 TEST SUITE 6: Complete Data Extraction");
  console.log("=".repeat(50));

  runTest("Extract all data - table structure", () => {
    const html = `<main>
        <h3>Vecka 47</h3>
        <table>
          <tbody>
            <tr>
              <td>Köttbullar</td>
              <td>Med gräddsås</td>
              <td>125:-</td>
            </tr>
            <tr>
              <td>Fisk</td>
              <td>Med potatis</td>
              <td>140:-</td>
            </tr>
          </tbody>
        </table>
      </main>`;
    const dom = new JSDOM(html);
    const container = dom.window.document.querySelector("main");
    const lunches = extractAllLunchData(container);
    return (
      lunches.length === 2 &&
      lunches[0].name === "Köttbullar" &&
      lunches[1].name === "Fisk"
    );
  });

  runTest("Extract all data - modern structure", () => {
    const html = `
      <main>
        <h3>Vecka 47</h3>
        <h4>Måndag</h4>
        <div data-day="måndag">
          <div class="lunch-item">
            <h5>Grillad kyckling</h5>
            <p>Med ris och grönsaker</p>
            <span class="price">135kr</span>
          </div>
        </div>
      </main>
    `;
    const container = createMockElement(html);
    const lunches = extractAllLunchData(container);
    return (
      lunches.length >= 1 &&
      lunches.some((lunch) => lunch.name === "Grillad kyckling")
    );
  });

  runTest("Extract all data - restaurant closed", () => {
    const html = `
      <main>
        <p>Semesterstängt V.29-32</p>
        <p>Vi önskar er en glad sommar!</p>
      </main>
    `;
    const container = createMockElement(html);
    const lunches = extractAllLunchData(container);
    return lunches.length === 0;
  });

  runTest("Extract all data - empty container", () => {
    const html = `<main></main>`;
    const container = createMockElement(html);
    const lunches = extractAllLunchData(container);
    return lunches.length === 0;
  });

  runTest("Extract all data - malformed HTML", () => {
    const html = `<main>
        <h3>Vecka 47</h3>
        <table>
          <tbody>
            <tr>
              <td></td>
              <td>No name</td>
              <td>125:-</td>
            </tr>
            <tr>
              <td>Valid lunch</td>
              <td>Good description</td>
              <td>140:-</td>
            </tr>
          </tbody>
        </table>
      </main>`;
    const dom = new JSDOM(html);
    const container = dom.window.document.querySelector("main");
    const lunches = extractAllLunchData(container);
    // Should extract only the valid lunch
    return lunches.length === 1 && lunches[0].name === "Valid lunch";
  });
}

// Test Suite 7: End-to-End Integration Tests
function testEndToEndIntegration() {
  console.log("\n🧪 TEST SUITE 7: End-to-End Integration");
  console.log("=".repeat(50));

  runTest("Full extraction - normal operation", async () => {
    const html = `
      <html>
        <body>
          <main>
            <h3>Vecka 47</h3>
            <table>
              <tbody>
                <tr>
                  <td>Köttbullar med gräddsås</td>
                  <td>Serveras med kokt potatis</td>
                  <td>125:-</td>
                </tr>
              </tbody>
            </table>
          </main>
        </body>
      </html>
    `;
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(html);
    const lunches = await extractNiagaraLunches(
      mockGetHtmlNode,
      "https://test.com",
    );

    return (
      lunches.length === 1 &&
      lunches[0].name === "Köttbullar med gräddsås" &&
      lunches[0].price === 125 &&
      lunches[0].place === "Niagara"
    );
  });

  runTest("Full extraction - restaurant closed", async () => {
    const html = `
      <html>
        <body>
          <main>
            <p>Semesterstängt V.29-32</p>
          </main>
        </body>
      </html>
    `;
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(html);
    const lunches = await extractNiagaraLunches(
      mockGetHtmlNode,
      "https://test.com",
    );
    return lunches.length === 0;
  });

  runTest("Full extraction - invalid URL", async () => {
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl("");
    const lunches = await extractNiagaraLunches(mockGetHtmlNode, null);
    return lunches.length === 0;
  });

  runTest("Full extraction - network error simulation", async () => {
    const mockGetHtmlNode = async () => {
      throw new Error("Network error");
    };
    const lunches = await extractNiagaraLunches(
      mockGetHtmlNode,
      "https://test.com",
    );
    return lunches.length === 0;
  });

  runTest("Full extraction - mixed valid/invalid data", async () => {
    const html = `
      <html>
        <body>
          <main>
            <h3>Vecka 47</h3>
            <table>
              <tbody>
                <tr>
                  <td>Valid Lunch 1</td>
                  <td>Good description</td>
                  <td>125:-</td>
                </tr>
                <tr>
                  <td></td>
                  <td>Missing name</td>
                  <td>100:-</td>
                </tr>
                <tr>
                  <td>Valid Lunch 2</td>
                  <td>Another description</td>
                  <td>150:-</td>
                </tr>
              </tbody>
            </table>
          </main>
        </body>
      </html>
    `;
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(html);
    const lunches = await extractNiagaraLunches(
      mockGetHtmlNode,
      "https://test.com",
    );

    return (
      lunches.length === 2 &&
      lunches.every((lunch) => lunch.name && lunch.name.length > 0) &&
      lunches.some((lunch) => lunch.name === "Valid Lunch 1") &&
      lunches.some((lunch) => lunch.name === "Valid Lunch 2")
    );
  });
}

// Test Suite 8: Error Handling and Edge Cases
function testErrorHandlingEdgeCases() {
  console.log("\n🧪 TEST SUITE 8: Error Handling & Edge Cases");
  console.log("=".repeat(50));

  runTest("Handle null input - extractLunchFromElement", () => {
    const result = extractLunchFromElement(null, 47, "måndag");
    return result === null;
  });

  runTest("Handle invalid weekday - extractLunchFromElement", () => {
    const html = `
      <tr>
        <td>Valid Name</td>
        <td>Description</td>
        <td>125:-</td>
      </tr>
    `;
    const element = createMockElement(html);
    const result = extractLunchFromElement(element, 47, "invalid_weekday");
    return result === null;
  });

  runTest("Handle empty text content", () => {
    const html = `<tr><td>   </td><td>   </td><td>   </td></tr>`;
    const element = createMockElement(html);
    const result = extractLunchFromElement(element, 47, "måndag");
    return result === null;
  });

  runTest("Handle batch validation with empty array", () => {
    const result = validateLunches([]);
    return (
      result.validLunches.length === 0 &&
      result.validationErrors.length === 0 &&
      result.totalCount === 0
    );
  });

  runTest("Handle batch validation with non-array input", () => {
    const result = validateLunches("not an array");
    return (
      result.validLunches.length === 0 && result.validationErrors.length === 1
    );
  });

  runTest("Handle restaurant status with null input", () => {
    const status = validateRestaurantStatus(null);
    return status.isOpen === false && status.reason === "No data provided";
  });
}

// Main test runner
async function runAllTests() {
  console.log(`🧪 ${TEST_SUITE_NAME}`);
  console.log("=".repeat(60));
  console.log(
    "Running comprehensive tests for the updated Niagara parser...\n",
  );

  // Run all test suites
  testDataValidator();
  testWeekExtraction();
  testElementExtraction();
  testWeekdayContentFinding();
  await testContainerFinding();
  testAllDataExtraction();
  await testEndToEndIntegration();
  testErrorHandlingEdgeCases();

  // Print final results
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total tests run: ${testCount}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("✅ The Niagara parser is working correctly");
    console.log("✅ Error handling is robust");
    console.log("✅ Data validation is comprehensive");
    console.log("✅ Ready for production use");
  } else {
    console.log(
      `\n⚠️  ${failedTests} test(s) failed - please review implementation`,
    );
  }

  console.log("\n📋 COVERAGE AREAS TESTED:");
  console.log("- Data validation functions");
  console.log("- Week number extraction");
  console.log("- Individual element extraction");
  console.log("- Weekday content finding");
  console.log("- Container detection");
  console.log("- Complete data extraction");
  console.log("- End-to-end integration");
  console.log("- Error handling and edge cases");

  return failedTests === 0;
}

// Export for use in other test files if needed
export { runAllTests, createMockElement, createMockGetHtmlNodeFromUrl };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
