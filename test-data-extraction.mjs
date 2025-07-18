import {
  extractLunchFromElement,
  findWeekdayContent,
  extractAllLunchData,
  findLunchContainer,
  extractNiagaraLunches,
} from "./data-extractor.mjs";

console.log("Testing Data Extraction Logic");
console.log("=============================\n");

// Mock DOM implementation for testing
class MockElement {
  constructor(tagName = "div", textContent = "", attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.attributes = attributes;
    this.children = [];
    this.dataset = attributes.dataset || {};
    this.nextElementSibling = null;
  }

  querySelector(selector) {
    // Simple mock implementation
    if (selector.includes("td:nth-of-type(1)") && this.tagName === "TR") {
      return new MockElement("td", "Pasta Carbonara");
    }
    if (selector.includes("td:nth-of-type(2)") && this.tagName === "TR") {
      return new MockElement(
        "td",
        "Krämig pasta med bacon och ägg\nAllergener: Gluten, Mjölk",
      );
    }
    if (selector.includes("td:nth-of-type(3)") && this.tagName === "TR") {
      return new MockElement("td", "95:-");
    }
    if (selector.includes(".lunch-name")) {
      return new MockElement("div", "Vegetarisk Curry");
    }
    if (selector.includes(".description")) {
      return new MockElement(
        "div",
        "Kryddig curry med kokosmjölk och grönsaker",
      );
    }
    if (selector.includes(".price")) {
      return new MockElement("div", "89 kr");
    }
    if (selector.includes("h3") && this.textContent.includes("Vecka")) {
      return new MockElement("h3", "Vecka 20250714");
    }
    return null;
  }

  querySelectorAll(selector) {
    // Mock some results based on selector
    if (selector.includes("table:nth-of-type")) {
      return this.tagName === "DIV"
        ? [new MockElement("tr"), new MockElement("tr")]
        : [];
    }
    if (selector.includes("h3") || selector.includes("h4")) {
      return [
        new MockElement("h3", "Måndag"),
        new MockElement("h3", "Tisdag"),
        new MockElement("h3", "Onsdag"),
      ];
    }
    if (selector.includes(".lunch-item")) {
      return [
        new MockElement("div", "Fisk och chips med remouladsås"),
        new MockElement("div", "Vegetarisk lasagne"),
      ];
    }
    return [];
  }
}

// Test 1: Extract lunch from table row (old format)
console.log("1. Testing Table Row Extraction (Old Format):");
console.log("---------------------------------------------");

const mockTableRow = new MockElement("tr");
const tableLunch = extractLunchFromElement(mockTableRow, 25, "måndag");

console.log("Table row extraction result:");
console.log("  Name:", tableLunch?.name || "null");
console.log("  Description:", tableLunch?.description || "null");
console.log("  Price:", tableLunch?.price || "null");
console.log("  Place:", tableLunch?.place || "null");
console.log("  Week:", tableLunch?.week || "null");
console.log("  Weekday:", tableLunch?.weekday || "null");
console.log("");

// Test 2: Extract lunch from modern div structure
console.log("2. Testing Modern Div Extraction (New Format):");
console.log("----------------------------------------------");

const mockDivElement = new MockElement("div");
const divLunch = extractLunchFromElement(mockDivElement, 25, "tisdag");

console.log("Div element extraction result:");
console.log("  Name:", divLunch?.name || "null");
console.log("  Description:", divLunch?.description || "null");
console.log("  Price:", divLunch?.price || "null");
console.log("  Place:", divLunch?.place || "null");
console.log("  Week:", divLunch?.week || "null");
console.log("  Weekday:", divLunch?.weekday || "null");
console.log("");

// Test 3: Find weekday content
console.log("3. Testing Weekday Content Finding:");
console.log("-----------------------------------");

const mockContainer = new MockElement("div");
const mondayContent = findWeekdayContent(mockContainer, "måndag");
console.log(`Found ${mondayContent.length} elements for Monday`);

const tuesdayContent = findWeekdayContent(mockContainer, "tisdag");
console.log(`Found ${tuesdayContent.length} elements for Tuesday`);
console.log("");

// Test 4: Extract all lunch data
console.log("4. Testing Complete Data Extraction:");
console.log("------------------------------------");

const allLunches = extractAllLunchData(mockContainer);
console.log(`Total lunch items extracted: ${allLunches.length}`);
allLunches.forEach((lunch, index) => {
  console.log(
    `  ${index + 1}. ${lunch.name} (${lunch.weekday}) - ${lunch.price}kr`,
  );
});
console.log("");

// Test 5: Container selector testing
console.log("5. Testing Container Selector Logic:");
console.log("-----------------------------------");

// Mock the getHtmlNodeFromUrl function
const mockGetHtmlNodeFromUrl = async (url, selector) => {
  console.log(`  Trying selector: ${selector}`);

  // Simulate different success scenarios
  if (selector === "div.lunch") {
    return null; // Original selector fails
  }
  if (selector === "section") {
    return new MockElement("section", "Lunch content"); // New selector works
  }
  return null;
};

const container = await findLunchContainer(
  mockGetHtmlNodeFromUrl,
  "https://test.com",
);
console.log(`Container found: ${container ? "Yes" : "No"}`);
if (container) {
  console.log(`Container type: ${container.tagName}`);
}
console.log("");

// Test 6: Full extraction flow
console.log("6. Testing Full Extraction Flow:");
console.log("--------------------------------");

const extractedLunches = await extractNiagaraLunches(mockGetHtmlNodeFromUrl);
console.log(`Full extraction result: ${extractedLunches.length} lunches`);
extractedLunches.forEach((lunch, index) => {
  console.log(
    `  ${index + 1}. ${lunch.name} - ${lunch.weekday} - ${lunch.price}kr`,
  );
});
console.log("");

// Test 7: Error handling
console.log("7. Testing Error Handling:");
console.log("-------------------------");

const invalidElement = null;
const errorResult = extractLunchFromElement(invalidElement, 25, "måndag");
console.log(
  `Invalid element handling: ${errorResult === null ? "Passed" : "Failed"}`,
);

const emptyContainer = new MockElement("div", "");
const emptyResult = extractAllLunchData(emptyContainer);
console.log(
  `Empty container handling: ${emptyResult.length === 0 ? "Passed" : "Failed"}`,
);
console.log("");

// Test 8: Price parsing variations
console.log("8. Testing Price Parsing Variations:");
console.log("------------------------------------");

const priceTestElements = [
  new MockElement("div", "95:-"),
  new MockElement("div", "89 kr"),
  new MockElement("div", "120 kronor"),
  new MockElement("div", "Pris: 75kr"),
  new MockElement("div", "No price info"),
];

priceTestElements.forEach((element, index) => {
  // Mock the price selector to return the element itself
  element.querySelector = (selector) => {
    if (selector.includes("price") || selector.includes("cost")) {
      return element;
    }
    if (selector.includes(".lunch-name") || selector.includes(".name")) {
      return new MockElement("div", `Lunch item ${index + 1}`);
    }
    return null;
  };

  const lunch = extractLunchFromElement(element, 25, "onsdag");
  console.log(
    `  Price test ${index + 1}: "${element.textContent}" -> ${lunch?.price || 0}kr`,
  );
});

console.log("\nAll tests completed!");
