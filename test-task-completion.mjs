#!/usr/bin/env node

/**
 * Test to verify completion of remaining error handling tasks from the task list
 * Validates that tasks 1.4.2, 1.4.3, and 1.4.4 have been implemented correctly
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
} from "./data-validator.mjs";

// Mock function to simulate getHtmlNodeFromUrl
function createMockGetHtmlNodeFromUrl(htmlContent) {
  return async (url, selector) => {
    const dom = new JSDOM(htmlContent);
    return dom.window.document.querySelector(selector);
  };
}

/**
 * Task 1.4.2: Handle cases where expected elements are missing
 */
async function testTask_1_4_2_MissingElements() {
  console.log(
    "\n=== Task 1.4.2: Handle cases where expected elements are missing ===",
  );

  const testCases = [
    {
      name: "Missing main container",
      html: `<div>No main element here</div>`,
      expectedBehavior: "Should gracefully handle missing container",
    },
    {
      name: "Missing tables in container",
      html: `<main><h3>Vecka 47</h3><p>No tables here</p></main>`,
      expectedBehavior: "Should try modern structure when no tables found",
    },
    {
      name: "Missing table cells",
      html: `<main><h3>Vecka 47</h3><table><tbody><tr><td>Only one cell</td></tr></tbody></table></main>`,
      expectedBehavior: "Should skip rows with insufficient cells",
    },
    {
      name: "Missing week element",
      html: `<main><p>No week information</p><table><tbody><tr><td>Name</td><td>Desc</td><td>125:-</td></tr></tbody></table></main>`,
      expectedBehavior: "Should use fallback week calculation",
    },
    {
      name: "Empty elements",
      html: `<main><h3></h3><table><tbody><tr><td></td><td></td><td></td></tr></tbody></table></main>`,
      expectedBehavior: "Should skip empty elements",
    },
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    console.log(`Expected: ${testCase.expectedBehavior}`);

    try {
      const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(testCase.html);
      const results = await extractNiagaraLunches(
        mockGetHtmlNode,
        "https://test.com",
      );

      console.log(
        `✅ Handled gracefully - extracted ${results.length} lunches`,
      );
      console.log("✅ No errors thrown - robust error handling confirmed");
      passedTests++;
    } catch (error) {
      console.log(`❌ Failed with error: ${error.message}`);
    }
  }

  console.log(
    `\n📊 Task 1.4.2 Results: ${passedTests}/${totalTests} tests passed`,
  );
  return passedTests === totalTests;
}

/**
 * Task 1.4.3: Add validation for extracted data before adding to lunches array
 */
async function testTask_1_4_3_DataValidation() {
  console.log(
    "\n=== Task 1.4.3: Add validation for extracted data before adding to lunches array ===",
  );

  const testCases = [
    {
      name: "Valid lunch data",
      html: `<main><h3>Vecka 47</h3><table><tbody><tr><td>Köttbullar</td><td>Med gräddsås</td><td>125:-</td></tr></tbody></table></main>`,
      expectedValid: true,
    },
    {
      name: "Invalid price data",
      html: `<main><h3>Vecka 47</h3><table><tbody><tr><td>Köttbullar</td><td>Med gräddsås</td><td>invalid price</td></tr></tbody></table></main>`,
      expectedValid: false,
    },
    {
      name: "Missing name",
      html: `<main><h3>Vecka 47</h3><table><tbody><tr><td></td><td>Med gräddsås</td><td>125:-</td></tr></tbody></table></main>`,
      expectedValid: false,
    },
    {
      name: "Mixed valid and invalid data",
      html: `<main><h3>Vecka 47</h3><table><tbody>
        <tr><td>Valid Lunch</td><td>Good description</td><td>125:-</td></tr>
        <tr><td></td><td>No name</td><td>100:-</td></tr>
        <tr><td>Another Valid</td><td>Another description</td><td>150:-</td></tr>
      </tbody></table></main>`,
      expectedValid: true, // Should extract only valid ones
    },
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);

    try {
      const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(testCase.html);
      const results = await extractNiagaraLunches(
        mockGetHtmlNode,
        "https://test.com",
      );

      if (testCase.expectedValid && results.length > 0) {
        console.log(`✅ Valid data extracted: ${results.length} lunches`);

        // Verify all returned lunches are valid
        const validation = validateLunches(results);
        if (validation.invalidCount === 0) {
          console.log("✅ All returned lunches passed validation");
          passedTests++;
        } else {
          console.log(`❌ ${validation.invalidCount} invalid lunches returned`);
        }
      } else if (!testCase.expectedValid && results.length === 0) {
        console.log("✅ Invalid data correctly filtered out");
        passedTests++;
      } else if (
        testCase.name === "Mixed valid and invalid data" &&
        results.length > 0
      ) {
        // Special case: should extract only valid lunches
        const validation = validateLunches(results);
        if (validation.invalidCount === 0 && validation.validCount > 0) {
          console.log(
            `✅ Mixed data handled correctly: extracted ${validation.validCount} valid lunches, filtered out invalid ones`,
          );
          passedTests++;
        } else {
          console.log("❌ Mixed data not handled correctly");
        }
      } else {
        console.log(
          `❌ Unexpected result: expected valid=${testCase.expectedValid}, got ${results.length} lunches`,
        );
      }
    } catch (error) {
      console.log(`❌ Failed with error: ${error.message}`);
    }
  }

  console.log(
    `\n📊 Task 1.4.3 Results: ${passedTests}/${totalTests} tests passed`,
  );
  return passedTests === totalTests;
}

/**
 * Task 1.4.4: Log meaningful error messages for debugging
 */
async function testTask_1_4_4_ErrorLogging() {
  console.log(
    "\n=== Task 1.4.4: Log meaningful error messages for debugging ===",
  );

  // Capture console output
  let logMessages = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    logMessages.push({ level: "log", message: args.join(" ") });
    originalLog(...args);
  };
  console.warn = (...args) => {
    logMessages.push({ level: "warn", message: args.join(" ") });
    originalWarn(...args);
  };
  console.error = (...args) => {
    logMessages.push({ level: "error", message: args.join(" ") });
    originalError(...args);
  };

  const testCases = [
    {
      name: "Restaurant closure scenario",
      html: `<main><p>Semesterstängt V.29-32</p></main>`,
      checkFunction: (logs) => {
        // Check for restaurant status and closure detection logs
        const hasStatusCheck = logs.some((log) =>
          log.message.includes("Restaurant status check"),
        );
        const hasClosure = logs.some(
          (log) =>
            log.message.includes("appears closed") ||
            log.message.includes("vacation") ||
            log.message.includes("maintenance"),
        );
        return hasStatusCheck && hasClosure;
      },
    },
    {
      name: "Missing elements scenario",
      html: `<main><h3>Vecka 47</h3></main>`,
      checkFunction: (logs) => {
        // Check for table detection and modern structure fallback logs
        const hasTableCheck = logs.some((log) =>
          log.message.includes("No tables found in container"),
        );
        const hasModernStructure = logs.some((log) =>
          log.message.includes("modern structure extraction"),
        );
        const hasElementSearch = logs.some((log) =>
          log.message.includes("No content elements found"),
        );
        return hasTableCheck && hasModernStructure && hasElementSearch;
      },
    },
    {
      name: "Invalid data scenario",
      html: `<main><h3>Vecka 47</h3><table><tbody><tr><td></td><td>desc</td><td>price</td></tr></tbody></table></main>`,
      checkFunction: (logs) => {
        // Check for extraction failure and result logging
        const hasExtractionFailure = logs.some((log) =>
          log.message.includes("Failed to extract valid lunch"),
        );
        const hasResultLog = logs.some((log) =>
          log.message.includes("No lunch data extracted"),
        );
        return hasExtractionFailure && hasResultLog;
      },
    },
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    logMessages = []; // Reset log capture

    try {
      const mockGetHtmlNode = createMockGetHtmlNodeFromUrl(testCase.html);
      await extractNiagaraLunches(mockGetHtmlNode, "https://test.com");

      // Use custom check function for this test case
      const hasExpectedLogs = testCase.checkFunction(logMessages);

      if (hasExpectedLogs) {
        console.log("✅ Found expected meaningful log messages for debugging");
        passedTests++;
      } else {
        console.log("❌ Missing some expected debug information");
      }

      // Check for meaningful context in logs
      const contextualLogs = logMessages.filter(
        (log) =>
          log.message.includes("Niagara") ||
          log.message.includes("weekday") ||
          log.message.includes("container") ||
          log.message.includes("validation") ||
          log.message.includes("extraction") ||
          log.message.includes("status") ||
          log.message.includes("restaurant"),
      );

      if (contextualLogs.length > 0) {
        console.log(
          `✅ Found ${contextualLogs.length} contextual log messages with debugging info`,
        );
      } else {
        console.log("⚠️  No contextual information in log messages");
      }
    } catch (error) {
      console.log(`❌ Failed with error: ${error.message}`);
    }
  }

  // Restore original console functions
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;

  console.log(
    `\n📊 Task 1.4.4 Results: ${passedTests}/${totalTests} tests passed`,
  );
  return passedTests === totalTests;
}

/**
 * Overall task completion verification
 */
async function verifyTaskCompletion() {
  console.log("🧪 Task Completion Verification");
  console.log("=".repeat(60));
  console.log("Verifying implementation of remaining error handling tasks:");
  console.log("- Task 1.4.2: Handle cases where expected elements are missing");
  console.log(
    "- Task 1.4.3: Add validation for extracted data before adding to lunches array",
  );
  console.log("- Task 1.4.4: Log meaningful error messages for debugging");
  console.log("=".repeat(60));

  const results = {
    task_1_4_2: await testTask_1_4_2_MissingElements(),
    task_1_4_3: await testTask_1_4_3_DataValidation(),
    task_1_4_4: await testTask_1_4_4_ErrorLogging(),
  };

  console.log("\n" + "=".repeat(60));
  console.log("📋 TASK COMPLETION SUMMARY");
  console.log("=".repeat(60));

  console.log(
    `Task 1.4.2 (Missing Elements): ${results.task_1_4_2 ? "✅ COMPLETE" : "❌ INCOMPLETE"}`,
  );
  console.log(
    `Task 1.4.3 (Data Validation): ${results.task_1_4_3 ? "✅ COMPLETE" : "❌ INCOMPLETE"}`,
  );
  console.log(
    `Task 1.4.4 (Error Logging): ${results.task_1_4_4 ? "✅ COMPLETE" : "❌ INCOMPLETE"}`,
  );

  const completedTasks = Object.values(results).filter(Boolean).length;
  const totalTasks = Object.keys(results).length;

  console.log(
    `\nOverall Progress: ${completedTasks}/${totalTasks} tasks completed`,
  );

  if (completedTasks === totalTasks) {
    console.log("\n🎉 ALL ERROR HANDLING TASKS COMPLETED SUCCESSFULLY!");
    console.log("✅ The Niagara parser now has comprehensive error handling");
    console.log("✅ Missing elements are handled gracefully");
    console.log("✅ Data validation filters out invalid entries");
    console.log("✅ Meaningful error messages aid debugging");
    console.log("\n📋 READY TO PROCEED TO NEXT PHASE:");
    console.log("- Task 1.5: Create unit tests for updated Niagara parser");
    console.log("- Task 2.0: Implement Core Infrastructure and Architecture");
  } else {
    console.log("\n⚠️  Some tasks still need attention - see details above");
  }

  return completedTasks === totalTasks;
}

// Run the verification
verifyTaskCompletion().catch(console.error);
