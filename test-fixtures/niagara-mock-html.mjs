/**
 * Mock HTML fixtures for Niagara restaurant website
 * Represents different website structures for comprehensive testing
 */

// Modern website structure with lunch data (current expected format)
export const modernLunchStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 20240345</h3>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Pasta Carbonara</h4>
          <p class="lunch-description">Krämig pasta med bacon och ägg</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Vegetarisk lasagne</h4>
          <p class="lunch-description">Lasagne med grönsaker och ricotta</p>
          <span class="lunch-price">89 kr</span>
        </div>
      </div>

      <h3>Tisdag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Grillad lax</h4>
          <p class="lunch-description">Serveras med potatis och dillsås</p>
          <span class="lunch-price">125 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Kycklingwok</h4>
          <p class="lunch-description">Wok med kyckling och grönsaker</p>
          <span class="lunch-price">98 kr</span>
        </div>
      </div>

      <h3>Onsdag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Köttbullar</h4>
          <p class="lunch-description">Klassiska köttbullar med gräddsås</p>
          <span class="lunch-price">85 kr</span>
        </div>
      </div>

      <h3>Torsdag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Pizza Margherita</h4>
          <p class="lunch-description">Klassisk pizza med tomatsås och mozzarella</p>
          <span class="lunch-price">78 kr</span>
        </div>
      </div>

      <h3>Fredag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Fish & Chips</h4>
          <p class="lunch-description">Friterad fisk med pommes frites</p>
          <span class="lunch-price">110 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Caesar sallad</h4>
          <p class="lunch-description">Fräsch sallad med kyckling och krutonger</p>
          <span class="lunch-price">92 kr</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Legacy table-based structure (original format that might still exist)
export const legacyTableStructure = `
<div class="lunch">
  <h2>Vecka 45</h2>

  <table>
    <tbody>
      <tr>
        <td>Pasta Carbonara</td>
        <td>Krämig pasta med bacon och ägg</td>
        <td>95 kr</td>
      </tr>
      <tr>
        <td>Vegetarisk lasagne</td>
        <td>Lasagne med grönsaker och ricotta</td>
        <td>89 kr</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tbody>
      <tr>
        <td>Grillad lax</td>
        <td>Serveras med potatis och dillsås</td>
        <td>125 kr</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tbody>
      <tr>
        <td>Köttbullar</td>
        <td>Klassiska köttbullar med gräddsås</td>
        <td>85 kr</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tbody>
      <tr>
        <td>Pizza Margherita</td>
        <td>Klassisk pizza med tomatsås och mozzarella</td>
        <td>78 kr</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tbody>
      <tr>
        <td>Fish & Chips</td>
        <td>Friterad fisk med pommes frites</td>
        <td>110 kr</td>
      </tr>
      <tr>
        <td>Caesar sallad</td>
        <td>Fräsch sallad med kyckling och krutonger</td>
        <td>92 kr</td>
      </tr>
    </tbody>
  </table>
</div>
`;

// Tabbed interface structure (possible current implementation)
export const tabbedInterfaceStructure = `
<main>
  <section class="lunch-menu">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 20240345</h3>

    <div class="tabs">
      <div class="tab-content" data-day="måndag" data-weekday="måndag">
        <h4>Måndag</h4>
        <ul class="menu-items">
          <li class="meal">
            <strong class="meal-title">Pasta Carbonara</strong>
            <p class="details">Krämig pasta med bacon och ägg</p>
            <span class="cost">95 kr</span>
          </li>
          <li class="meal">
            <strong class="meal-title">Vegetarisk lasagne</strong>
            <p class="details">Lasagne med grönsaker och ricotta</p>
            <span class="cost">89 kr</span>
          </li>
        </ul>
      </div>

      <div class="tab-content" data-day="tisdag" data-weekday="tisdag">
        <h4>Tisdag</h4>
        <ul class="menu-items">
          <li class="meal">
            <strong class="meal-title">Grillad lax</strong>
            <p class="details">Serveras med potatis och dillsås</p>
            <span class="cost">125 kr</span>
          </li>
        </ul>
      </div>

      <div class="tab-content" data-day="onsdag" data-weekday="onsdag">
        <h4>Onsdag</h4>
        <ul class="menu-items">
          <li class="meal">
            <strong class="meal-title">Köttbullar</strong>
            <p class="details">Klassiska köttbullar med gräddsås</p>
            <span class="cost">85 kr</span>
          </li>
        </ul>
      </div>

      <div class="tab-content" data-day="torsdag" data-weekday="torsdag">
        <h4>Torsdag</h4>
        <ul class="menu-items">
          <li class="meal">
            <strong class="meal-title">Pizza Margherita</strong>
            <p class="details">Klassisk pizza med tomatsås och mozzarella</p>
            <span class="cost">78 kr</span>
          </li>
        </ul>
      </div>

      <div class="tab-content" data-day="fredag" data-weekday="fredag">
        <h4>Fredag</h4>
        <ul class="menu-items">
          <li class="meal">
            <strong class="meal-title">Fish & Chips</strong>
            <p class="details">Friterad fisk med pommes frites</p>
            <span class="cost">110 kr</span>
          </li>
          <li class="meal">
            <strong class="meal-title">Caesar sallad</strong>
            <p class="details">Fräsch sallad med kyckling och krutonger</p>
            <span class="cost">92 kr</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</main>
`;

// Restaurant closed for vacation (current actual state)
export const vacationClosureStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 20240729</h3>

    <div class="vacation-notice">
      <h3>Semesterstängt</h3>
      <p>Vi har semester V.29-32 och öppnar igen måndag 5 augusti.</p>
      <p>Välkomna då!</p>
    </div>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <p>Stängt - semester</p>
      </div>

      <h3>Tisdag</h3>
      <div class="day-content">
        <p>Stängt - semester</p>
      </div>

      <h3>Onsdag</h3>
      <div class="day-content">
        <p>Stängt - semester</p>
      </div>

      <h3>Torsdag</h3>
      <div class="day-content">
        <p>Stängt - semester</p>
      </div>

      <h3>Fredag</h3>
      <div class="day-content">
        <p>Stängt - semester</p>
      </div>
    </div>
  </section>
</main>
`;

// Malformed HTML structure (for error testing)
export const malformedStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka InvalidWeek</h3>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <!-- Missing name -->
          <p class="lunch-description">Description without name</p>
          <span class="lunch-price">Invalid price</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name"></h4>  <!-- Empty name -->
          <p class="lunch-description">Empty name test</p>
          <span class="lunch-price">85 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Valid Name</h4>
          <p class="lunch-description">Valid description</p>
          <!-- Missing price -->
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Empty structure (no lunch data)
export const emptyStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <!-- No lunch items -->
      </div>

      <h3>Tisdag</h3>
      <div class="day-content">
        <!-- No lunch items -->
      </div>

      <h3>Onsdag</h3>
      <div class="day-content">
        <!-- No lunch items -->
      </div>

      <h3>Torsdag</h3>
      <div class="day-content">
        <!-- No lunch items -->
      </div>

      <h3>Fredag</h3>
      <div class="day-content">
        <!-- No lunch items -->
      </div>
    </div>
  </section>
</main>
`;

// Mixed structure with both tables and modern elements
export const mixedStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>

    <!-- Monday: Modern structure -->
    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Modern Pasta</h4>
          <p class="lunch-description">Modern format pasta</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>
    </div>

    <!-- Tuesday: Table structure -->
    <table>
      <tbody>
        <tr>
          <td>Table Salmon</td>
          <td>Table format salmon</td>
          <td>125 kr</td>
        </tr>
      </tbody>
    </table>

    <!-- Wednesday: List structure -->
    <ul class="menu-items">
      <li class="meal">
        <strong class="meal-title">List Meatballs</strong>
        <p class="details">List format meatballs</p>
        <span class="cost">85 kr</span>
      </li>
    </ul>
  </section>
</main>
`;

// Alternative selectors structure (for testing fallback selectors)
export const alternativeSelectorStructure = `
<div class="content">
  <div class="menu-section">
    <h1>Lunch Menu</h1>
    <h2>Week 45</h2>

    <div class="days">
      <div class="day-monday">
        <h5>Måndag</h5>
        <div class="food-items">
          <article class="food-item">
            <h6>Alternative Pasta</h6>
            <em>Alternative description</em>
            <b>95:-</b>
          </article>
        </div>
      </div>

      <div class="day-tisdag">
        <h5>Tisdag</h5>
        <div class="food-items">
          <article class="food-item">
            <h6>Alternative Fish</h6>
            <em>Alternative fish description</em>
            <b>125 kronor</b>
          </article>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// Single day structure (partial data)
export const singleDayStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Single Day Pasta</h4>
          <p class="lunch-description">Only Monday has data</p>
          <span class="lunch-price">95 kr</span>
        </div>
      </div>

      <!-- Other days exist but have no content -->
      <h3>Tisdag</h3>
      <div class="day-content"></div>

      <h3>Onsdag</h3>
      <div class="day-content"></div>

      <h3>Torsdag</h3>
      <div class="day-content"></div>

      <h3>Fredag</h3>
      <div class="day-content"></div>
    </div>
  </section>
</main>
`;

// Structure with various price formats (for price parsing testing)
export const variousPriceFormatsStructure = `
<main>
  <section class="lunch-section">
    <h2>Vår lunchmeny</h2>
    <h3>Vecka 45</h3>

    <div class="weekday-content">
      <h3>Måndag</h3>
      <div class="day-content">
        <div class="lunch-item">
          <h4 class="lunch-name">Standard Price</h4>
          <p class="lunch-description">Standard format</p>
          <span class="lunch-price">95 kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Colon Price</h4>
          <p class="lunch-description">Colon format</p>
          <span class="lunch-price">89:-</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Kronor Price</h4>
          <p class="lunch-description">Kronor format</p>
          <span class="lunch-price">125 kronor</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">No Space Price</h4>
          <p class="lunch-description">No space format</p>
          <span class="lunch-price">78kr</span>
        </div>
        <div class="lunch-item">
          <h4 class="lunch-name">Invalid Price</h4>
          <p class="lunch-description">Invalid format</p>
          <span class="lunch-price">free</span>
        </div>
      </div>
    </div>
  </section>
</main>
`;

// Export all fixtures as an object for easy access
export const fixtures = {
  modern: modernLunchStructure,
  legacy: legacyTableStructure,
  tabbed: tabbedInterfaceStructure,
  vacation: vacationClosureStructure,
  malformed: malformedStructure,
  empty: emptyStructure,
  mixed: mixedStructure,
  alternative: alternativeSelectorStructure,
  singleDay: singleDayStructure,
  variousPrices: variousPriceFormatsStructure
};

// Helper function to create DOM elements from HTML strings
export function createMockDOM(htmlString) {
  if (typeof window !== 'undefined' && window.document) {
    // Browser environment
    const parser = new DOMParser();
    return parser.parseFromString(htmlString, 'text/html');
  } else {
    // Node.js environment with JSDOM
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(htmlString);
    return dom.window.document;
  }
}

// Helper function to get container element from HTML string
export function getContainerFromHTML(htmlString) {
  const doc = createMockDOM(htmlString);
  return doc.body.firstElementChild;
}

export default fixtures;
