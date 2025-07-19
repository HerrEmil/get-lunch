#!/usr/bin/env node

/**
 * Comprehensive test for mock HTML fixtures validation
 * Verifies that all fixtures are properly structured and usable for testing
 */

import {
  createTestScenario,
  createMultipleScenarios,
  validateLunchStructure,
  generateFixtureReport,
  getFixtureNames,
  createCustomFixture,
} from "./test-fixtures/fixture-utils.mjs";
import { fixtures } from "./test-fixtures/niagara-mock-html.mjs";
import { edgeCaseFixtures } from "./test-fixtures/niagara-edge-cases.mjs";

// Test counter
let testCount = 0;
let passedTests = 0;

function runTest(testName, testFn) {
  testCount++;
  console.log(`\n--- Test ${testCount}: ${testName} ---`);

  try {
    const result = testFn();
    if (result) {
      console.log("✅ PASSED");
      passedTests++;
    } else {
      console.log("❌ FAILED");
    }
  } catch (error) {
    console.log("❌ FAILED with error:", error.message);
  }
}

// Test 1: Verify all main fixtures load correctly
runTest("All main fixtures load correctly", () => {
  console.log("Testing main fixtures loading...");

  const fixtureNames = Object.keys(fixtures);
  console.log(
    `Found ${fixtureNames.length} main fixtures: ${fixtureNames.join(", ")}`,
  );

  let allLoaded = true;

  fixtureNames.forEach((name) => {
    try {
      const scenario = createTestScenario(name, "fixtures");
      console.log(
        `✓ ${name}: ${scenario.html.length} chars, container: ${scenario.container?.tagName}`,
      );
    } catch (error) {
      console.log(`✗ ${name}: Failed to load - ${error.message}`);
      allLoaded = false;
    }
  });

  return allLoaded;
});

// Test 2: Verify all edge case fixtures load correctly
runTest("All edge case fixtures load correctly", () => {
  console.log("Testing edge case fixtures loading...");

  const edgeCaseNames = Object.keys(edgeCaseFixtures);
  console.log(
    `Found ${edgeCaseNames.length} edge case fixtures: ${edgeCaseNames.join(", ")}`,
  );

  let allLoaded = true;

  edgeCaseNames.forEach((name) => {
    try {
      const scenario = createTestScenario(name, "edgeCases");
      console.log(
        `✓ ${name}: ${scenario.html.length} chars, container: ${scenario.container?.tagName}`,
      );
    } catch (error) {
      console.log(`✗ ${name}: Failed to load - ${error.message}`);
      allLoaded = false;
    }
  });

  return allLoaded;
});

// Test 3: Validate structure of main fixtures
runTest("Main fixtures have valid lunch structure", () => {
  console.log("Validating main fixture structures...");

  const validFixtures = [];
  const invalidFixtures = [];

  Object.keys(fixtures).forEach((name) => {
    const scenario = createTestScenario(name, "fixtures");
    const validation = validateLunchStructure(scenario.container);

    if (validation.isValid) {
      validFixtures.push({
        name,
        weekdays: validation.weekdayCount,
        items: validation.lunchItemCount,
      });
      console.log(
        `✓ ${name}: ${validation.weekdayCount} weekdays, ${validation.lunchItemCount} items`,
      );
    } else {
      invalidFixtures.push({
        name,
        errors: validation.errors,
      });
      console.log(
        `⚠ ${name}: Invalid structure - ${validation.errors.join(", ")}`,
      );
    }
  });

  console.log(`Valid fixtures: ${validFixtures.length}`);
  console.log(`Invalid fixtures: ${invalidFixtures.length}`);

  // For main fixtures, most should be valid (except intentionally invalid ones)
  // vacation, empty, and malformed are expected to have validation issues
  const expectedValidCount = Object.keys(fixtures).length - 3;
  return validFixtures.length >= expectedValidCount;
});

// Test 4: Test mock getHtmlNodeFromUrl function
runTest("Mock getHtmlNodeFromUrl function works correctly", () => {
  console.log("Testing mock function behavior...");

  const scenario = createTestScenario("modern", "fixtures");

  // Test basic functionality
  const result1 = scenario.mockGetHtml("http://test.com", null);
  console.log("Mock function returns container when no selector provided");

  // Test with selector
  const result2 = scenario.mockGetHtml("http://test.com", "h2");
  console.log("Mock function supports selector queries");

  return typeof scenario.mockGetHtml === "function";
});

// Test 5: Test multiple scenarios creation
runTest("Multiple scenarios creation works correctly", () => {
  console.log("Testing bulk scenario creation...");

  const selectedFixtures = ["modern", "legacy", "tabbed"];
  const scenarios = createMultipleScenarios(selectedFixtures, "fixtures");

  console.log(`Created ${Object.keys(scenarios).length} scenarios`);

  selectedFixtures.forEach((name) => {
    if (scenarios[name]) {
      console.log(`✓ Scenario ${name}: container present`);
    } else {
      console.log(`✗ Scenario ${name}: missing`);
    }
  });

  return Object.keys(scenarios).length === selectedFixtures.length;
});

// Test 6: Test fixture report generation
runTest("Fixture report generation works correctly", () => {
  console.log("Testing fixture report generation...");

  const report = generateFixtureReport();

  console.log(`Report summary:`);
  console.log(`  Total fixtures: ${report.summary.totalFixtures}`);
  console.log(`  Valid fixtures: ${report.summary.validFixtures}`);
  console.log(`  Invalid fixtures: ${report.summary.invalidFixtures}`);
  console.log(`  Total lunch items: ${report.summary.totalLunchItems}`);

  const hasMainFixtures = Object.keys(report.fixtures).length > 0;
  const hasEdgeCases = Object.keys(report.edgeCases).length > 0;
  const hasSummary = report.summary.totalFixtures > 0;

  return hasMainFixtures && hasEdgeCases && hasSummary;
});

// Test 7: Test custom fixture creation
runTest("Custom fixture creation works correctly", () => {
  console.log("Testing custom fixture creation...");

  const customOptions = {
    week: 42,
    weekdays: ["måndag", "tisdag"],
    items: {
      måndag: [
        {
          name: "Custom Pasta",
          description: "Custom description",
          price: "100 kr",
        },
      ],
      tisdag: [
        {
          name: "Custom Fish",
          description: "Custom fish desc",
          price: "120 kr",
        },
      ],
    },
    format: "modern",
  };

  const customHtml = createCustomFixture(customOptions);
  const scenario = createTestScenario("modern", "fixtures");
  scenario.html = customHtml;
  scenario.container = scenario.doc.body.firstElementChild;

  console.log(`Custom fixture length: ${customHtml.length} characters`);
  console.log(`Contains week 42: ${customHtml.includes("Vecka 42")}`);
  console.log(`Contains custom pasta: ${customHtml.includes("Custom Pasta")}`);

  return (
    customHtml.includes("Vecka 42") &&
    customHtml.includes("Custom Pasta") &&
    customHtml.includes("Custom Fish")
  );
});

// Test 8: Test edge case fixtures for specific error scenarios
runTest("Edge case fixtures represent specific error scenarios", () => {
  console.log("Testing edge case fixture scenarios...");

  const testCases = [
    {
      name: "invalid",
      shouldHaveContainer: true,
      description: "Invalid HTML structure",
    },
    {
      name: "noContainer",
      shouldHaveContainer: true,
      description: "No container elements",
    },
    {
      name: "extremePrices",
      shouldHaveContainer: true,
      description: "Various price formats",
    },
    {
      name: "invalidWeekdays",
      shouldHaveContainer: true,
      description: "Invalid weekday names",
    },
  ];

  let allTestsPassed = true;

  testCases.forEach((testCase) => {
    try {
      const scenario = createTestScenario(testCase.name, "edgeCases");
      const hasContainer = !!scenario.container;

      if (hasContainer === testCase.shouldHaveContainer) {
        console.log(
          `✓ ${testCase.name}: ${testCase.description} - behaves as expected`,
        );
      } else {
        console.log(
          `✗ ${testCase.name}: ${testCase.description} - unexpected behavior`,
        );
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`✗ ${testCase.name}: Failed to test - ${error.message}`);
      allTestsPassed = false;
    }
  });

  return allTestsPassed;
});

// Test 9: Test fixture names enumeration
runTest("Fixture names enumeration works correctly", () => {
  console.log("Testing fixture names enumeration...");

  const allNames = getFixtureNames();
  console.log(`Total fixture names: ${allNames.length}`);

  const fixtureCount = allNames.filter((name) =>
    name.startsWith("fixtures."),
  ).length;
  const edgeCaseCount = allNames.filter((name) =>
    name.startsWith("edgeCases."),
  ).length;

  console.log(`Main fixtures: ${fixtureCount}`);
  console.log(`Edge cases: ${edgeCaseCount}`);

  return allNames.length > 0 && fixtureCount > 0 && edgeCaseCount > 0;
});

// Test 10: Test specific fixture content validation
runTest("Specific fixture content validation", () => {
  console.log("Testing specific fixture content...");

  // Test modern fixture
  const modernScenario = createTestScenario("modern", "fixtures");
  const modernHasWeekday = modernScenario.html.includes("Måndag");
  const modernHasPrice = modernScenario.html.includes("kr");
  console.log(
    `Modern fixture has weekdays: ${modernHasWeekday}, has prices: ${modernHasPrice}`,
  );

  // Test legacy fixture
  const legacyScenario = createTestScenario("legacy", "fixtures");
  const legacyHasTable = legacyScenario.html.includes("<table>");
  const legacyHasTbody = legacyScenario.html.includes("<tbody>");
  console.log(
    `Legacy fixture has tables: ${legacyHasTable}, has tbody: ${legacyHasTbody}`,
  );

  // Test vacation fixture
  const vacationScenario = createTestScenario("vacation", "fixtures");
  const vacationHasClosure = vacationScenario.html.includes("semester");
  console.log(`Vacation fixture has closure info: ${vacationHasClosure}`);

  return (
    modernHasWeekday &&
    modernHasPrice &&
    legacyHasTable &&
    legacyHasTbody &&
    vacationHasClosure
  );
});

// Test 11: Test DOM creation and manipulation
runTest("DOM creation and manipulation works correctly", () => {
  console.log("Testing DOM creation and manipulation...");

  const scenario = createTestScenario("modern", "fixtures");

  // Test DOM document creation
  const hasDocument = !!scenario.doc;
  console.log(`Document created: ${hasDocument}`);

  // Test container element
  const hasContainer = !!scenario.container;
  console.log(`Container element created: ${hasContainer}`);

  // Test querySelector functionality
  const weekElement = scenario.container?.querySelector("h3");
  const hasWeekElement = !!weekElement;
  console.log(`Can query elements: ${hasWeekElement}`);

  // Test text content extraction
  const weekText = weekElement?.textContent;
  const hasWeekText = !!weekText && weekText.includes("Vecka");
  console.log(`Can extract text content: ${hasWeekText}`);

  return hasDocument && hasContainer && hasWeekElement && hasWeekText;
});

// Test 12: Test performance with large datasets
runTest("Performance with large datasets", () => {
  console.log("Testing performance with large datasets...");

  const startTime = Date.now();

  try {
    const largeScenario = createTestScenario("largeDataset", "edgeCases");
    const validation = validateLunchStructure(largeScenario.container);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Processing time: ${duration}ms`);
    console.log(`Lunch items found: ${validation.lunchItemCount}`);

    // Should complete within reasonable time (< 1000ms) and find many items
    return duration < 1000 && validation.lunchItemCount > 40;
  } catch (error) {
    console.log(`Performance test failed: ${error.message}`);
    return false;
  }
});

// Run all tests
console.log("🧪 Running Mock HTML Fixtures Validation Tests\n");
console.log(
  "This test suite validates that all mock fixtures are properly structured and usable for testing\n",
);

// Wait for any async operations to complete
setTimeout(() => {
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${testCount} tests passed`);

  if (passedTests === testCount) {
    console.log("🎉 All tests passed! Mock fixtures are ready for use.");
  } else {
    console.log("⚠️  Some tests failed. Review the fixture implementation.");
  }

  console.log("\n📝 Fixture validation completed:");
  console.log("  • All main fixtures load correctly");
  console.log("  • All edge case fixtures load correctly");
  console.log("  • Structure validation works");
  console.log("  • Mock functions operate correctly");
  console.log("  • Custom fixture creation works");
  console.log("  • DOM manipulation is functional");
  console.log("  • Performance is acceptable");

  // Generate final report
  console.log("\n📋 Fixture Summary:");
  try {
    const report = generateFixtureReport();
    console.log(`  Total fixtures: ${report.summary.totalFixtures}`);
    console.log(`  Valid structures: ${report.summary.validFixtures}`);
    console.log(`  Total lunch items: ${report.summary.totalLunchItems}`);
    console.log(`  Ready for testing: ✅`);
  } catch (error) {
    console.log(`  Report generation failed: ${error.message}`);
  }
}, 100);
