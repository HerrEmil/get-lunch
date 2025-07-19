/**
 * Edge case mock HTML fixtures for comprehensive Niagara parser testing
 * These fixtures test error handling, validation, and unusual scenarios
 */

// Completely invalid HTML structure
export const invalidHTMLStructure = `
<div>
  <p>This is not a lunch menu at all</p>
  <span>Random content</span>
  <img src="image.jpg" alt="Not relevant">
</div>
`;

// HTML with no container elements
export const noContainerStructure = `
<p>Just some text</p>
<span>No container elements</span>
`;

// HTML with container but no lunch content
export const containerWithoutLunchData = `
<main>
  <section class="lunch-section">
    <h2>Some other content</h2>
    <p>This section exists but has no lunch data</p>
    <div class="other-content">
      <span>Not lunch related</span>
    </div>
  </section>
</main>
`;

// Week number edge cases
export const invalidWeekNumbers = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka ABC</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Test Item</h4>
          <p class="lunch-description">Test description</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

export const missingWeekNumber = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <!-- No week number heading -->
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Test Item</h4>
          <p class="lunch-description">Test description</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

export const extremeWeekNumbers = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 0</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Week 0 Test</h4>
          <p class="lunch-description">Zero week test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

export const weekNumber54 = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 54</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Week 54 Test</h4>
          <p class="lunch-description">Invalid week 54 test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Invalid weekday names
export const invalidWeekdayNames = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Monday</h3> <!-- English instead of Swedish -->
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">English Monday</h4>
          <p class="lunch-description">English weekday test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>

      <h3>Söndag</h3> <!-- Weekend day -->
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Sunday Item</h4>
          <p class="lunch-description">Weekend day test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>

      <h3>InvalidDay</h3> <!-- Completely invalid -->
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Invalid Day Item</h4>
          <p class="lunch-description">Invalid day test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Price validation edge cases
export const extremePrices = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Free Item</h4>
          <p class="lunch-description">Zero price test</p>
          <span class="lunch-price">0 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Expensive Item</h4>
          <p class="lunch-description">Very high price test</p>
          <span class="lunch-price">9999 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Decimal Price</h4>
          <p class="lunch-description">Decimal price test</p>
          <span class="lunch-price">95.50 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Negative Price</h4>
          <p class="lunch-description">Negative price test</p>
          <span class="lunch-price">-50 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Name validation edge cases
export const extremeNames = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">A</h4> <!-- Very short name -->
          <p class="lunch-description">Single character name</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">This is an extremely long lunch item name that goes on and on and might cause issues with display or processing because it's unusually verbose and detailed beyond normal expectations</h4>
          <p class="lunch-description">Very long name test</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">   Whitespace Name   </h4> <!-- Name with extra whitespace -->
          <p class="lunch-description">Whitespace test</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Name with 123 numbers</h4>
          <p class="lunch-description">Numbers in name test</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Special!@#$%^&*()Characters</h4>
          <p class="lunch-description">Special characters test</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Description edge cases
export const extremeDescriptions = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">No Description Item</h4>
          <!-- No description element -->
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Empty Description Item</h4>
          <p class="lunch-description"></p> <!-- Empty description -->
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Very Long Description Item</h4>
          <p class="lunch-description">This is an extremely long description that goes into excessive detail about every single ingredient, cooking method, presentation style, nutritional information, allergen warnings, chef recommendations, wine pairings, and historical background of this particular lunch item which might cause issues with processing or display due to its unusual verbosity and comprehensive nature that far exceeds normal expectations for a simple lunch description.</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Multiline Description Item</h4>
          <p class="lunch-description">Line 1
Line 2
Line 3</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Nested and complex HTML structures
export const deeplyNestedStructure = `
<main>
  <section class="lunch-section">
    <div class="wrapper">
      <div class="inner-wrapper">
        <div class="content-container">
          <h2>Vår lunchmeny</h2>
          <h3>Vecka 45</h3>
          <div class="weekday-content">
            <div class="day-wrapper">
              <div class="day-header">
                <h3>Måndag</h3>
              </div>
              <div class="day-content">
                <div class="items-container">
                  <div class="item-wrapper">
                    <div class="lunch-item">
                      <div class="name-container">
                        <h4 class="lunch-name">Deeply Nested Item</h4>
                      </div>
                      <div class="description-container">
                        <p class="lunch-description">Nested structure test</p>
                      </div>
                      <div class="price-container">
                        <span class="lunch-price">95 kr</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// HTML with mixed text nodes and elements
export const mixedTextNodesStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        Random text node before item
        <div class="lunch-item">
          <h4 class="lunch-name">Mixed Text Item</h4>
          Some text between elements
          <p class="lunch-description">Description with text nodes</p>
          More random text
          <span class="lunch-price">95 kr</span>
          Final text node
        </div>
        Text after item
      </div>
    </div>
  </section>
</main>
`;

// Duplicate lunch items
export const duplicateItemsStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Pasta Carbonara</h4>
          <p class="lunch-description">Krämig pasta med bacon</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Pasta Carbonara</h4> <!-- Exact duplicate -->
          <p class="lunch-description">Krämig pasta med bacon</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Pasta Carbonara</h4> <!-- Same name, different price -->
          <p class="lunch-description">Krämig pasta med bacon</p>
          <span class="lunch-price">89 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Structure with broken/incomplete elements
export const brokenElementsStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <!-- Unclosed element -->
          <h4 class="lunch-name">Broken Item
          <p class="lunch-description">Description after unclosed h4</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Valid Item</h4>
          <p class="lunch-description">Valid item after broken one</p>
          <span class="lunch-price">85 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Structure with unusual element types
export const unusualElementsStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <article class="lunch-item">
          <header>
            <h4 class="lunch-name">Article Item</h4>
          </header>
          <main>
            <p class="lunch-description">Using semantic HTML5 elements</p>
          </main>
          <footer>
            <span class="lunch-price">95 kr</span>
          </footer>
        </article>
        <details class="lunch-item">
          <summary class="lunch-name">Details Item</summary>
          <p class="lunch-description">Description in details element</p>
          <span class="lunch-price">85 kr</span>
        </details>
      </div>
    </div>
  </section>
</main>
`;

// Structure with internationalization challenges
export const internationalCharactersStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Crème brûlée special</h4>
          <p class="lunch-description">Med château cheese & naïve garnish</p>
          <span class="lunch-price">125 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Köttbullar á la française</h4>
          <p class="lunch-description">Traditionell rätt med ø-sauce</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Sushi 寿司</h4>
          <p class="lunch-description">Japanese-Swedish fusion</p>
          <span class="lunch-price">150 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Performance testing structure (many items)
export const largeDatasetStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        ${Array.from({length: 50}, (_, i) => `
        <div class="lunch-item">
          <h4 class="lunch-name">Large Dataset Item ${i + 1}</h4>
          <p class="lunch-description">Performance test description ${i + 1}</p>
          <span class="lunch-price">${85 + (i % 50)} kr</span>
        </div>
        `).join('')}
      </div>
    </div>
  </section>
</main>
`;

// Export all edge case fixtures
export const edgeCaseFixtures = {
  invalid: invalidHTMLStructure,
  noContainer: noContainerStructure,
  containerWithoutLunch: containerWithoutLunchData,
  invalidWeek: invalidWeekNumbers,
  missingWeek: missingWeekNumber,
  extremeWeeks: extremeWeekNumbers,
  week54: weekNumber54,
  invalidWeekdays: invalidWeekdayNames,
  extremePrices: extremePrices,
  extremeNames: extremeNames,
  extremeDescriptions: extremeDescriptions,
  deeplyNested: deeplyNestedStructure,
  mixedTextNodes: mixedTextNodesStructure,
  duplicates: duplicateItemsStructure,
  brokenElements: brokenElementsStructure,
  unusualElements: unusualElementsStructure,
  international: internationalCharactersStructure,
  largeDataset: largeDatasetStructure
};

export default edgeCaseFixtures;
