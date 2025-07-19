#!/usr/bin/env node

/**
 * Debug test for failing mixed structure extraction
 * Focuses on understanding why mixed structure and custom fixture tests are failing
 */

import {
  extractAllLunchData,
} from "./data-extractor.mjs";
import {
  createTestScenario,
  createCustomFixture,
  createContainer,
} from "./test-fixtures/fixture-utils.mjs";

console.log("🔍 Debugging Failing Tests\n");

// Debug Test 1: Mixed structure handling
console.log("--- Debug Test 1: Mixed structure handling ---");
try {
  const scenario = createTestScenario("mixed", "fixtures");
  console.log("Mixed fixture HTML preview:", scenario.html.substring(0, 200) + "...");

  const lunches = extractAllLunchData(scenario.container);
  console.log(`Mixed structure extracted ${lunches.length} items`);

  if (lunches.length > 0) {
    lunches.forEach((lunch, index) => {
      console.log(`  ${index + 1}. ${lunch.name} (${lunch.weekday}): ${lunch.price}kr`);
    });
  } else {
    console.log("  No lunches extracted from mixed structure");
  }

  // Check what the mixed fixture actually contains
  console.log("\nMixed fixture structure analysis:");
  console.log("Container tag:", scenario.container?.tagName);
  console.log("Container children:", scenario.container?.children?.length);

  // Check for headings
  const headings = scenario.container?.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log("Headings found:", headings?.length);
  if (headings) {
    Array.from(headings).forEach((h, i) => {
      console.log(`  H${h.tagName.charAt(1)}: "${h.textContent?.trim()}"`);
    });
  }

  // Check for tables
  const tables = scenario.container?.querySelectorAll('table');
  console.log("Tables found:", tables?.length);

  // Check for modern structure elements
  const lunchItems = scenario.container?.querySelectorAll('.lunch-item');
  console.log("Lunch items found:", lunchItems?.length);

} catch (error) {
  console.log("Mixed structure test error:", error.message);
}

console.log("\n" + "=".repeat(50));

// Debug Test 2: Custom fixture extraction
console.log("--- Debug Test 2: Custom fixture extraction ---");
try {
  const customHtml = createCustomFixture({
    week: 42,
    weekdays: ["måndag", "tisdag"],
    items: {
      måndag: [
        {
          name: "Test Pasta",
          description: "Test description",
          price: "100 kr",
        },
        {
          name: "Test Pizza",
          description: "Another test",
          price: "85 kr",
        },
      ],
      tisdag: [
        {
          name: "Test Fish",
          description: "Fish description",
          price: "120 kr",
        },
      ],
    },
    format: "modern",
  });

  console.log("Custom fixture HTML preview:", customHtml.substring(0, 300) + "...");

  const container = createContainer(customHtml);
  console.log("Custom container created:", !!container);
  console.log("Custom container tag:", container?.tagName);

  const lunches = extractAllLunchData(container);
  console.log(`Custom fixture extracted ${lunches.length} items`);

  if (lunches.length > 0) {
    lunches.forEach((lunch, index) => {
      console.log(`  ${index + 1}. ${lunch.name} (${lunch.weekday}): ${lunch.price}kr, week: ${lunch.week}`);
    });
  } else {
    console.log("  No lunches extracted from custom fixture");
  }

  // Check expected vs actual
  console.log("\nCustom fixture analysis:");
  console.log("Expected week: 42");
  console.log("Expected items: 3 (2 måndag + 1 tisdag)");
  console.log("Expected names: Test Pasta, Test Pizza, Test Fish");

  // Check if week is in HTML
  console.log("HTML contains 'Vecka 42':", customHtml.includes('Vecka 42'));
  console.log("HTML contains 'Test Pasta':", customHtml.includes('Test Pasta'));

} catch (error) {
  console.log("Custom fixture test error:", error.message);
}

console.log("\n" + "=".repeat(50));

// Debug Test 3: Simplified custom fixture
console.log("--- Debug Test 3: Simplified custom fixture ---");
try {
  // Create a very simple custom fixture
  const simpleCustomHtml = `
    <main>
      <section class="lunch-section">
        <h2>Vår lunchmeny</h2>
        <h3>Vecka 42</h3>
        <div class="weekday-content">
          <h3>Måndag</h3>
          <div class="day-content">
            <div class="lunch-item">
              <h4 class="lunch-name">Simple Test Item</h4>
              <p class="lunch-description">Simple test description</p>
              <span class="lunch-price">95 kr</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  console.log("Simple custom HTML preview:", simpleCustomHtml.substring(0, 200) + "...");

  const simpleContainer = createContainer(simpleCustomHtml);
  const simpleLunches = extractAllLunchData(simpleContainer);

  console.log(`Simple custom extracted ${simpleLunches.length} items`);

  if (simpleLunches.length > 0) {
    simpleLunches.forEach((lunch, index) => {
      console.log(`  ${index + 1}. ${lunch.name} (${lunch.weekday}): ${lunch.price}kr, week: ${lunch.week}`);
    });
  }

} catch (error) {
  console.log("Simple custom test error:", error.message);
}

console.log("\n📋 Debug Summary:");
console.log("This debug session helps identify specific issues with:");
console.log("  • Mixed structure extraction logic");
console.log("  • Custom fixture generation and parsing");
console.log("  • Week number extraction from different formats");
console.log("  • Element selector matching in various structures");
