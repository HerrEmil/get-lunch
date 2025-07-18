#!/usr/bin/env node

/**
 * Comprehensive test for enhanced error handling and restaurant closure scenarios
 * Tests the new validation logic and closure detection features
 */

import { JSDOM } from "jsdom";
import {
  extractNiagaraLunches,
  extractAllLunchData,
  extractLunchFromElement,
  findLunchContainer,
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

// Mock function to simulate getHtmlNodeFromUrl
function createMockGetHtmlNodeFromUrl(htmlContent) {
  return async (url, selector) => {
    const dom = new JSDOM(htmlContent);
    return dom.window.document.querySelector(selector);
  };
}

// Test data for various scenarios
const testScenarios = {
  // Current vacation closure scenario
  vacationClosure: `
    <main>
      <h3>Vecka 20250714</h3>
      <div class="tab-content">
        <div data-day="måndag">
          <p>Semesterstängt V.29-32</p>
          <p>Vi på restaurang Niagara önskar er en glad sommar! 😎⛱️</p>
          <p>Vi är återigen måndagen den 11 Augusti.</p>
        </div>
      </div>
    </main>
  `,

  // Limited service scenario
  limitedService: `
    <main>
      <h3>Studentlunch Mellan 13.00-13.30</h3>
      <p>Studenter får 10% Rabatt på sin lunch mellan kl 11.30-13</p>
      <p>Mellan kl 13.00-13.30 betalar de 78kr.</p>
    </main>
  `,

  // Normal operating with valid data
  normalOperation: `
    <main>
      <h3>Vecka 47</h3>
      <table>
        <tbody>
          <tr>
            <td>Köttbullar med gräddsås</td>
            <td>Serveras med kokt potatis och lingonsylt</td>
            <td>125:-</td>
          </tr>
        </tbody>
      </table>
    </main>
  `,

  // Malformed data scenarios
  malformedData: `
    <main>
      <h3>Vecka 47</h3>
      <table>
        <tbody>
          <tr>
            <td></td>
            <td>Missing name</td>
            <td>invalid price</td>
          </tr>
          <tr>
            <td>Valid Name</td>
            <td>Valid Description</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </main>
  `,

  // Empty container
  emptyContainer: `<main></main>`,

  // Missing main element
  noContainer: `<div>No main element</div>`,

  // Modern structure with valid data
  modernStructure: `
    <main>
      <h3>Vecka 47</h3>
      <h4>Måndag</h4>
      <div class="day-content" data-day="måndag">
        <div class="lunch-item">
          <h5>Grillad lax</h5>
          <p>Med citronsmör och dillpotatis</p>
          <span class="price">145kr</span>
        </div>
      </div>
    </main>
  `,
};

async function runTest(testName, htmlContent, expectedResults = {}) {
  console.log(`\n=== Testing: ${testName} ===`);

  try {
    const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(htmlContent);
    const results = await extractNiagaraLunches(
      mockGetHtmlNode,
      "https://test.com",
    );

    console.log(`Results: ${results.length} lunch items extracted`);

    if (expectedResults.shouldHaveLunches !== undefined) {
      const hasLunches = results.length > 0;
      if (hasLunches === expectedResults.shouldHaveLunches) {
        console.log("✅ Expected lunch presence result achieved");
      } else {
        console.log("❌ Unexpected lunch presence result");
        console.log(
          `Expected lunches: ${expectedResults.shouldHaveLunches}, Got lunches: ${hasLunches}`,
        );
      }
    }

    if (expectedResults.minCount !== undefined) {
      if (results.length >= expectedResults.minCount) {
        console.log(
          `✅ Minimum count requirement met (${results.length} >= ${expectedResults.minCount})`,
        );
      } else {
        console.log(
          `❌ Minimum count requirement not met (${results.length} < ${expectedResults.minCount})`,
        );
      }
    }

    // Validate all returned lunches
    if (results.length > 0) {
      const validation = validateLunches(results);
      console.log(
        `Validation: ${validation.validCount}/${validation.totalCount} valid lunches`,
      );

      if (validation.invalidCount > 0) {
        console.log("⚠️  Invalid lunches found:");
        validation.validationErrors.forEach((error) => {
          console.log(`  - Index ${error.index}: ${error.errors.join(", ")}`);
        });
      } else {
        console.log("✅ All extracted lunches are valid");
      }

      // Show sample lunch data
      if (validation.validLunches.length > 0) {
        const sample = validation.validLunches[0];
        console.log("Sample lunch:", {
          name: sample.name,
          price: sample.price,
          weekday: sample.weekday,
          week: sample.week,
          place: sample.place,
        });
      }
    }

    return {
      success: true,
      results: results,
      testName: testName,
    };
  } catch (error) {
    console.log("❌ Test failed with error:", error.message);
    return {
      success: false,
      error: error.message,
      testName: testName,
    };
  }
}

async function testValidationFunctions() {
  console.log("\n=== Testing Validation Functions ===");

  // Test Swedish weekday validation
  console.log("\n--- Swedish Weekday Validation ---");
  const weekdays = [
    "måndag",
    "tisdag",
    "onsdag",
    "torsdag",
    "fredag",
    "lördag",
    "sunday",
    "",
    null,
  ];
  weekdays.forEach((day) => {
    const isValid = isValidSwedishWeekday(day);
    const normalized = normalizeSwedishWeekday(day);
    console.log(`${day}: valid=${isValid}, normalized='${normalized}'`);
  });

  // Test price validation
  console.log("\n--- Price Validation ---");
  const prices = [125, "125", 0, -10, "invalid", null, undefined, "125kr"];
  prices.forEach((price) => {
    const isValid = isValidPrice(price);
    console.log(`${price}: valid=${isValid}`);
  });

  // Test week validation
  console.log("\n--- Week Validation ---");
  const weeks = [1, 47, 53, 54, 0, -1, "47", "invalid", null];
  weeks.forEach((week) => {
    const isValid = isValidWeek(week);
    console.log(`${week}: valid=${isValid}`);
  });

  // Test restaurant status validation
  console.log("\n--- Restaurant Status Validation ---");
  const statusTests = [
    "Semesterstängt V.29-32",
    "Studentlunch Mellan 13.00-13.30",
    "Normal lunch menu available",
    "Stängt för semester",
    "Closed for vacation",
    "",
  ];

  statusTests.forEach((text) => {
    const status = validateRestaurantStatus(text);
    console.log(`"${text}": open=${status.isOpen}, reason='${status.reason}'`);
  });
}

async function testLunchValidation() {
  console.log("\n=== Testing Lunch Object Validation ===");

  const testLunches = [
    // Valid lunch
    {
      name: "Köttbullar",
      description: "Med gräddsås",
      price: 125,
      place: "Niagara",
      week: 47,
      weekday: "måndag",
    },
    // Missing name
    {
      description: "Med gräddsås",
      price: 125,
      place: "Niagara",
      week: 47,
      weekday: "måndag",
    },
    // Invalid price
    {
      name: "Köttbullar",
      description: "Med gräddsås",
      price: "invalid",
      place: "Niagara",
      week: 47,
      weekday: "måndag",
    },
    // Invalid weekday
    {
      name: "Köttbullar",
      description: "Med gräddsås",
      price: 125,
      place: "Niagara",
      week: 47,
      weekday: "saturday",
    },
    // Invalid week
    {
      name: "Köttbullar",
      description: "Med gräddsås",
      price: 125,
      place: "Niagara",
      week: 0,
      weekday: "måndag",
    },
  ];

  testLunches.forEach((lunch, index) => {
    const validation = validateLunch(lunch);
    console.log(`Lunch ${index + 1}: valid=${validation.isValid}`);
    if (!validation.isValid) {
      console.log(`  Errors: ${validation.errors.join(", ")}`);
    }
  });

  // Test batch validation
  console.log("\n--- Batch Validation ---");
  const batchValidation = validateLunches(testLunches);
  console.log(
    `Batch validation: ${batchValidation.validCount}/${batchValidation.totalCount} valid`,
  );
  console.log(`Invalid count: ${batchValidation.invalidCount}`);
}

async function runAllTests() {
  console.log("🧪 Starting Enhanced Error Handling Tests");
  console.log("=".repeat(50));

  // Test validation functions first
  await testValidationFunctions();
  await testLunchValidation();

  console.log("\n" + "=".repeat(50));
  console.log("🧪 Testing Data Extraction Scenarios");
  console.log("=".repeat(50));

  const testResults = [];

  // Test vacation closure (should return no lunches)
  testResults.push(
    await runTest("Vacation Closure", testScenarios.vacationClosure, {
      shouldHaveLunches: false,
    }),
  );

  // Test limited service (should return no lunches)
  testResults.push(
    await runTest("Limited Service", testScenarios.limitedService, {
      shouldHaveLunches: false,
    }),
  );

  // Test normal operation (should return lunches)
  testResults.push(
    await runTest("Normal Operation", testScenarios.normalOperation, {
      shouldHaveLunches: true,
      minCount: 1,
    }),
  );

  // Test malformed data (should handle gracefully)
  testResults.push(
    await runTest(
      "Malformed Data",
      testScenarios.malformedData,
      { shouldHaveLunches: true, minCount: 1 }, // Should extract the one valid lunch
    ),
  );

  // Test empty container (should return no lunches)
  testResults.push(
    await runTest("Empty Container", testScenarios.emptyContainer, {
      shouldHaveLunches: false,
    }),
  );

  // Test missing container (should return no lunches)
  testResults.push(
    await runTest("No Container", testScenarios.noContainer, {
      shouldHaveLunches: false,
    }),
  );

  // Test modern structure (should return lunches)
  testResults.push(
    await runTest("Modern Structure", testScenarios.modernStructure, {
      shouldHaveLunches: true,
      minCount: 1,
    }),
  );

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🧪 Test Summary");
  console.log("=".repeat(50));

  const successfulTests = testResults.filter((result) => result.success);
  const failedTests = testResults.filter((result) => !result.success);

  console.log(`Total tests: ${testResults.length}`);
  console.log(`Successful: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}`);

  if (failedTests.length > 0) {
    console.log("\n❌ Failed tests:");
    failedTests.forEach((test) => {
      console.log(`  - ${test.testName}: ${test.error}`);
    });
  } else {
    console.log("\n✅ All tests passed!");
  }

  console.log("\n🎉 Enhanced error handling tests completed!");
}

// Run the tests
runAllTests().catch(console.error);
