/**
 * Fixture utilities for Niagara parser testing
 * Provides easy-to-use helpers for creating DOM elements and test scenarios
 */

import { JSDOM } from 'jsdom';
import { fixtures } from './niagara-mock-html.mjs';
import { edgeCaseFixtures } from './niagara-edge-cases.mjs';

/**
 * Create a DOM document from HTML string
 * @param {string} htmlString - HTML content
 * @returns {Document} - DOM document
 */
export function createDOM(htmlString) {
  const dom = new JSDOM(htmlString);
  return dom.window.document;
}

/**
 * Create a container element from HTML string
 * @param {string} htmlString - HTML content
 * @returns {Element} - Container element
 */
export function createContainer(htmlString) {
  const doc = createDOM(htmlString);
  return doc.body.firstElementChild;
}

/**
 * Create a mock getHtmlNodeFromUrl function for testing
 * @param {string} htmlString - HTML content to return
 * @returns {Function} - Mock function
 */
export function createMockGetHtmlNodeFromUrl(htmlString) {
  return async (url, selector) => {
    const container = createContainer(htmlString);
    if (!selector) return container;
    return container.querySelector(selector);
  };
}

/**
 * Get all available fixture names
 * @returns {string[]} - Array of fixture names
 */
export function getFixtureNames() {
  return [
    ...Object.keys(fixtures).map(key => `fixtures.${key}`),
    ...Object.keys(edgeCaseFixtures).map(key => `edgeCases.${key}`)
  ];
}

/**
 * Get a specific fixture by name
 * @param {string} fixtureName - Name of the fixture (e.g., 'modern', 'legacy')
 * @param {string} category - Category: 'fixtures' or 'edgeCases'
 * @returns {string} - HTML string
 */
export function getFixture(fixtureName, category = 'fixtures') {
  const fixtureCollection = category === 'edgeCases' ? edgeCaseFixtures : fixtures;

  if (!fixtureCollection[fixtureName]) {
    throw new Error(`Fixture '${fixtureName}' not found in category '${category}'`);
  }

  return fixtureCollection[fixtureName];
}

/**
 * Create a test scenario with container and mock function
 * @param {string} fixtureName - Name of the fixture
 * @param {string} category - Category: 'fixtures' or 'edgeCases'
 * @returns {Object} - Test scenario with container and mockGetHtml
 */
export function createTestScenario(fixtureName, category = 'fixtures') {
  const htmlString = getFixture(fixtureName, category);
  const container = createContainer(htmlString);
  const mockGetHtml = createMockGetHtmlNodeFromUrl(htmlString);

  return {
    html: htmlString,
    container,
    mockGetHtml,
    doc: createDOM(htmlString)
  };
}

/**
 * Create multiple test scenarios for bulk testing
 * @param {string[]} fixtureNames - Array of fixture names
 * @param {string} category - Category: 'fixtures' or 'edgeCases'
 * @returns {Object} - Map of scenario name to test scenario
 */
export function createMultipleScenarios(fixtureNames, category = 'fixtures') {
  const scenarios = {};

  fixtureNames.forEach(name => {
    scenarios[name] = createTestScenario(name, category);
  });

  return scenarios;
}

/**
 * Validate that a container has expected lunch structure
 * @param {Element} container - Container element
 * @returns {Object} - Validation result
 */
export function validateLunchStructure(container) {
  const result = {
    isValid: true,
    hasContainer: !!container,
    hasWeekInfo: false,
    hasWeekdays: false,
    weekdayCount: 0,
    lunchItemCount: 0,
    errors: []
  };

  if (!container) {
    result.isValid = false;
    result.errors.push('No container element provided');
    return result;
  }

  // Check for week information
  const weekElements = container.querySelectorAll('h2, h3');
  const weekElement = Array.from(weekElements).find(el =>
    el.textContent && (el.textContent.includes('Vecka') || el.textContent.includes('Week'))
  );
  result.hasWeekInfo = !!weekElement;

  if (!result.hasWeekInfo) {
    result.errors.push('No week information found');
  }

  // Check for weekday content
  const swedishWeekdays = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'];
  const foundWeekdays = [];

  swedishWeekdays.forEach(weekday => {
    const weekdayElements = Array.from(container.querySelectorAll('h3, h4, h5'))
      .filter(el => el.textContent && el.textContent.toLowerCase().includes(weekday));

    if (weekdayElements.length > 0) {
      foundWeekdays.push(weekday);
    }
  });

  result.hasWeekdays = foundWeekdays.length > 0;
  result.weekdayCount = foundWeekdays.length;

  if (!result.hasWeekdays) {
    result.errors.push('No Swedish weekdays found');
  }

  // Count lunch items
  const lunchSelectors = [
    '.lunch-item',
    '.meal',
    '.menu-item',
    '.food-item',
    'table tbody tr'
  ];

  lunchSelectors.forEach(selector => {
    const items = container.querySelectorAll(selector);
    result.lunchItemCount += items.length;
  });

  if (result.lunchItemCount === 0) {
    result.errors.push('No lunch items found using common selectors');
  }

  // Overall validation
  result.isValid = result.hasContainer && result.errors.length === 0;

  return result;
}

/**
 * Extract basic info from a fixture for test reporting
 * @param {string} fixtureName - Name of the fixture
 * @param {string} category - Category: 'fixtures' or 'edgeCases'
 * @returns {Object} - Basic fixture information
 */
export function getFixtureInfo(fixtureName, category = 'fixtures') {
  const scenario = createTestScenario(fixtureName, category);
  const validation = validateLunchStructure(scenario.container);

  return {
    name: fixtureName,
    category,
    htmlLength: scenario.html.length,
    validation,
    hasContainer: !!scenario.container,
    containerTagName: scenario.container?.tagName?.toLowerCase(),
    summary: `${fixtureName} (${category}): ${validation.weekdayCount} weekdays, ${validation.lunchItemCount} items`
  };
}

/**
 * Generate a test report for all fixtures
 * @returns {Object} - Comprehensive fixture report
 */
export function generateFixtureReport() {
  const report = {
    fixtures: {},
    edgeCases: {},
    summary: {
      totalFixtures: 0,
      validFixtures: 0,
      invalidFixtures: 0,
      totalLunchItems: 0
    }
  };

  // Process main fixtures
  Object.keys(fixtures).forEach(name => {
    const info = getFixtureInfo(name, 'fixtures');
    report.fixtures[name] = info;
    report.summary.totalFixtures++;
    report.summary.totalLunchItems += info.validation.lunchItemCount;

    if (info.validation.isValid) {
      report.summary.validFixtures++;
    } else {
      report.summary.invalidFixtures++;
    }
  });

  // Process edge case fixtures
  Object.keys(edgeCaseFixtures).forEach(name => {
    const info = getFixtureInfo(name, 'edgeCases');
    report.edgeCases[name] = info;
    report.summary.totalFixtures++;
    report.summary.totalLunchItems += info.validation.lunchItemCount;

    if (info.validation.isValid) {
      report.summary.validFixtures++;
    } else {
      report.summary.invalidFixtures++;
    }
  });

  return report;
}

/**
 * Helper to create a minimal lunch item element for testing
 * @param {string} name - Lunch name
 * @param {string} description - Lunch description
 * @param {string} price - Lunch price
 * @param {string} format - Element format: 'modern', 'table', 'list'
 * @returns {string} - HTML string
 */
export function createMinimalLunchItem(name, description, price, format = 'modern') {
  switch (format) {
    case 'table':
      return `<tr><td>${name}</td><td>${description}</td><td>${price}</td></tr>`;

    case 'list':
      return `
        <li class="meal">
          <strong class="meal-title">${name}</strong>
          <p class="details">${description}</p>
          <span class="cost">${price}</span>
        </li>
      `;

    case 'modern':
    default:
      return `
        <div class="lunch-item">
          <h4 class="lunch-name">${name}</h4>
          <p class="lunch-description">${description}</p>
          <span class="lunch-price">${price}</span>
        </div>
      `;
  }
}

/**
 * Create a custom fixture with specific parameters
 * @param {Object} options - Fixture options
 * @param {number} options.week - Week number
 * @param {string[]} options.weekdays - Array of weekdays to include
 * @param {Object[]} options.items - Array of lunch items per weekday
 * @param {string} options.format - Structure format: 'modern', 'table', 'tabbed'
 * @returns {string} - Custom HTML fixture
 */
export function createCustomFixture(options = {}) {
  const {
    week = 45,
    weekdays = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'],
    items = {},
    format = 'modern'
  } = options;

  const defaultItems = [
    { name: 'Default Item 1', description: 'Default description', price: '95 kr' },
    { name: 'Default Item 2', description: 'Another description', price: '85 kr' }
  ];

  let html = '';

  if (format === 'table') {
    html = `
      <div class="lunch">
        <h2>Vecka ${week}</h2>
        ${weekdays.map((weekday, index) => {
          const weekdayItems = items[weekday] || defaultItems;
          return `
            <table>
              <tbody>
                ${weekdayItems.map(item =>
                  createMinimalLunchItem(item.name, item.description, item.price, 'table')
                ).join('')}
              </tbody>
            </table>
          `;
        }).join('')}
      </div>
    `;
  } else if (format === 'tabbed') {
    html = `
      <main>
        <section class="lunch-menu">
          <h2>Vår lunchmeny</h2>
          <h3>Vecka ${week}</h3>
          <div class="tabs">
            ${weekdays.map(weekday => {
              const weekdayItems = items[weekday] || defaultItems;
              return `
                <div class="tab-content" data-day="${weekday}" data-weekday="${weekday}">
                  <h4>${weekday.charAt(0).toUpperCase() + weekday.slice(1)}</h4>
                  <ul class="menu-items">
                    ${weekdayItems.map(item =>
                      createMinimalLunchItem(item.name, item.description, item.price, 'list')
                    ).join('')}
                  </ul>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </main>
    `;
  } else {
    // Modern format
    html = `
      <main>
        <section class="lunch-section">
          <h2>Vår lunchmeny</h2>
          <h3>Vecka ${week}</h3>
          <div class="weekday-content">
            ${weekdays.map(weekday => {
              const weekdayItems = items[weekday] || defaultItems;
              return `
                <h3>${weekday.charAt(0).toUpperCase() + weekday.slice(1)}</h3>
                <div class="day-content">
                  ${weekdayItems.map(item =>
                    createMinimalLunchItem(item.name, item.description, item.price, 'modern')
                  ).join('')}
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </main>
    `;
  }

  return html;
}

// Export all utilities
export default {
  createDOM,
  createContainer,
  createMockGetHtmlNodeFromUrl,
  getFixtureNames,
  getFixture,
  createTestScenario,
  createMultipleScenarios,
  validateLunchStructure,
  getFixtureInfo,
  generateFixtureReport,
  createMinimalLunchItem,
  createCustomFixture,
  fixtures,
  edgeCaseFixtures
};
