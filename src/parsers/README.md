# Restaurant Parser Framework Documentation

## Overview

The Restaurant Parser Framework provides a standardized way to extract lunch menu data from different restaurant websites. Each restaurant has its own parser that extends the `BaseParser` class and implements the required abstract methods.

## Architecture

```
src/parsers/
├── base-parser.mjs           # Abstract base class
├── parser-interfaces.mjs    # Data structures and schemas
├── niagara-parser.mjs       # Niagara restaurant parser
├── parser-factory.mjs       # Factory for managing parsers
└── README.md               # This documentation
```

## Core Concepts

### Base Parser Class

All restaurant parsers must extend the `BaseParser` class and implement three abstract methods:

- `parseMenu()`: Extract lunch data from the restaurant's website
- `getName()`: Return the restaurant's name
- `getUrl()`: Return the restaurant's lunch menu URL

### Standardized Data Format

All parsers must return lunch objects that conform to the standard schema:

```javascript
{
  name: "Köttbullar med gräddsås",           // Required: Dish name
  description: "Serveras med kokt potatis",   // Optional: Description
  price: 125,                                 // Required: Price in SEK
  weekday: "måndag",                         // Required: Swedish weekday
  week: 47,                                  // Required: ISO week number
  place: "Niagara"                           // Required: Restaurant name
}
```

## Creating a New Parser

### Step 1: Extend BaseParser

```javascript
import { BaseParser } from './base-parser.mjs';
import { createLunchObject } from './parser-interfaces.mjs';

export class MyRestaurantParser extends BaseParser {
  constructor(config = {}) {
    super({
      name: "My Restaurant",
      url: "https://myrestaurant.se/lunch/",
      timeout: 30000,
      retries: 3,
      ...config
    });
  }

  getName() {
    return "My Restaurant";
  }

  getUrl() {
    return "https://myrestaurant.se/lunch/";
  }

  async parseMenu() {
    // Implementation goes here
    return [];
  }
}
```

### Step 2: Implement parseMenu()

The `parseMenu()` method should:
1. Fetch the restaurant's webpage
2. Extract lunch data from the HTML
3. Return an array of standardized lunch objects

```javascript
async parseMenu() {
  try {
    // Fetch the webpage
    const document = await this.fetchDocument();
    
    // Find the lunch container
    const container = this.safeQuery(document, '.lunch-menu');
    if (!container) {
      throw new Error('Lunch menu container not found');
    }

    // Extract lunch items
    const lunches = [];
    const items = this.safeQuery(container, '.lunch-item', true);
    
    for (const item of items || []) {
      const lunch = this.extractLunchFromElement(item);
      if (lunch) {
        lunches.push(lunch);
      }
    }

    return lunches;
  } catch (error) {
    await this.logger.error('Failed to parse menu', {}, error);
    throw error;
  }
}
```

### Step 3: Implement Data Extraction

Use the helper methods provided by `BaseParser`:

```javascript
extractLunchFromElement(element) {
  try {
    // Extract text content safely
    const name = this.extractText(
      this.safeQuery(element, '.dish-name')
    );
    
    const description = this.extractText(
      this.safeQuery(element, '.dish-description')
    );
    
    // Extract numeric values
    const priceText = this.extractText(
      this.safeQuery(element, '.price')
    );
    const price = this.extractNumber(priceText);

    // Create standardized lunch object
    return this.createLunchObject({
      name,
      description,
      price,
      weekday: this.getCurrentWeekday(), // You need to implement this
      week: this._getCurrentWeek()
    });
  } catch (error) {
    await this.logger.warn('Failed to extract lunch from element', {}, error);
    return null;
  }
}
```

## Available Helper Methods

### DOM Manipulation

```javascript
// Safe DOM queries that handle errors
const element = this.safeQuery(container, '.selector');
const elements = this.safeQuery(container, '.selector', true);

// Safe text extraction
const text = this.extractText(element, 'default value');

// Safe number extraction (handles Swedish format)
const number = this.extractNumber('125:-', 0);
```

### HTTP Requests

```javascript
// Fetch HTML document with retry logic
const document = await this.fetchDocument();
const document = await this.fetchDocument('https://custom-url.com');

// Get specific element from URL
const element = await this.getHtmlNodeFromUrl(url, '.selector');

// Low-level HTTP request
const response = await this.makeRequest(url, options);
```

### Logging

```javascript
// Context-aware logging
await this.logger.info('Parsing started');
await this.logger.warn('Element not found', { selector: '.missing' });
await this.logger.error('Parsing failed', {}, error);

// Performance timing
this.logger.startTimer('extraction');
// ... do work ...
this.logger.endTimer('extraction');
```

## Common Parsing Patterns

### Pattern 1: Table-Based Menu

```javascript
async parseMenu() {
  const document = await this.fetchDocument();
  const table = this.safeQuery(document, 'table.lunch-menu');
  
  if (!table) {
    throw new Error('Lunch table not found');
  }

  const rows = this.safeQuery(table, 'tbody tr', true);
  const lunches = [];

  for (const row of rows || []) {
    const cells = this.safeQuery(row, 'td', true);
    if (!cells || cells.length < 3) continue;

    const lunch = this.createLunchObject({
      name: this.extractText(cells[0]),
      description: this.extractText(cells[1]),
      price: this.extractNumber(this.extractText(cells[2])),
      weekday: this.getWeekdayFromContext(row),
      week: this.getWeekFromDocument(document)
    });

    lunches.push(lunch);
  }

  return lunches;
}
```

### Pattern 2: Modern Card-Based Layout

```javascript
async parseMenu() {
  const document = await this.fetchDocument();
  const container = this.safeQuery(document, '.lunch-container');
  
  const cards = this.safeQuery(container, '.lunch-card', true);
  const lunches = [];

  for (const card of cards || []) {
    const nameEl = this.safeQuery(card, '.dish-name, h3, .title');
    const descEl = this.safeQuery(card, '.description, p');
    const priceEl = this.safeQuery(card, '.price, .cost');

    if (!nameEl || !priceEl) continue;

    const lunch = this.createLunchObject({
      name: this.extractText(nameEl),
      description: this.extractText(descEl),
      price: this.extractNumber(this.extractText(priceEl)),
      weekday: this.getWeekdayFromCard(card),
      week: this.getCurrentWeek()
    });

    lunches.push(lunch);
  }

  return lunches;
}
```

### Pattern 3: Weekly Layout with Tabs

```javascript
async parseMenu() {
  const document = await this.fetchDocument();
  const lunches = [];

  const weekdays = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'];
  
  for (const weekday of weekdays) {
    const dayContainer = this.safeQuery(
      document, 
      `[data-day="${weekday}"], .${weekday}, #${weekday}`
    );

    if (!dayContainer) continue;

    const items = this.safeQuery(dayContainer, '.lunch-item', true);
    
    for (const item of items || []) {
      const lunch = this.extractLunchFromElement(item, weekday);
      if (lunch) lunches.push(lunch);
    }
  }

  return lunches;
}
```

## Error Handling Best Practices

### 1. Graceful Degradation

```javascript
async parseMenu() {
  try {
    // Primary parsing method
    return await this.parseModernLayout();
  } catch (error) {
    await this.logger.warn('Modern layout failed, trying fallback', {}, error);
    
    try {
      // Fallback parsing method
      return await this.parseLegacyLayout();
    } catch (fallbackError) {
      await this.logger.error('All parsing methods failed', {}, fallbackError);
      throw fallbackError;
    }
  }
}
```

### 2. Validate Before Processing

```javascript
extractLunchFromElement(element) {
  if (!element || !element.tagName) {
    return null;
  }

  const name = this.extractText(this.safeQuery(element, '.name'));
  if (!name || name.length === 0) {
    return null; // Skip invalid items
  }

  // Continue with extraction...
}
```

### 3. Handle Network Issues

```javascript
async parseMenu() {
  try {
    const document = await this.fetchDocument();
    return this.extractFromDocument(document);
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error(`Request timeout for ${this.getName()}`);
    }
    if (error.message.includes('404')) {
      throw new Error(`Menu page not found for ${this.getName()}`);
    }
    throw error; // Re-throw other errors
  }
}
```

## Testing Your Parser

### Unit Tests

```javascript
import { MyRestaurantParser } from './my-restaurant-parser.mjs';

// Test with mock HTML
const mockHtml = `
  <div class="lunch-menu">
    <div class="lunch-item">
      <h3 class="dish-name">Test Dish</h3>
      <p class="description">Test Description</p>
      <span class="price">125:-</span>
    </div>
  </div>
`;

const parser = new MyRestaurantParser();
// Mock the fetchDocument method for testing
parser.fetchDocument = async () => new JSDOM(mockHtml).window.document;

const result = await parser.execute();
console.log('Test result:', result);
```

### Integration Tests

```javascript
// Test against real website
const parser = new MyRestaurantParser();
const result = await parser.execute();

console.log(`Found ${result.lunches.length} lunch items`);
console.log('Health status:', parser.getHealthStatus());
```

## Common Issues and Solutions

### Issue 1: Dynamic Content (JavaScript-rendered)

**Problem**: Menu is loaded by JavaScript after page load.

**Solution**: Look for alternative data sources or static fallbacks:

```javascript
// Check for JSON data in script tags
const scripts = this.safeQuery(document, 'script', true);
for (const script of scripts || []) {
  const content = this.extractText(script);
  if (content.includes('menuData')) {
    const data = this.extractJsonFromScript(content);
    return this.parseFromJson(data);
  }
}
```

### Issue 2: Inconsistent Selectors

**Problem**: Website structure changes frequently.

**Solution**: Use multiple fallback selectors:

```javascript
findElement(container, selectors) {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  
  for (const selector of selectorList) {
    const element = this.safeQuery(container, selector);
    if (element) return element;
  }
  
  return null;
}

// Usage
const nameElement = this.findElement(item, [
  '.dish-name',
  '.name',
  'h3',
  '.title',
  '[data-name]'
]);
```

### Issue 3: Price Format Variations

**Problem**: Prices in different formats (125:-, 125 kr, 125 SEK).

**Solution**: Enhanced number extraction:

```javascript
extractPrice(text) {
  if (!text) return 0;
  
  // Remove all non-numeric except decimal separators
  const cleaned = text.replace(/[^\d,.-]/g, '');
  
  // Handle Swedish format (comma as decimal)
  const normalized = cleaned.replace(',', '.');
  
  const price = parseFloat(normalized);
  return isNaN(price) ? 0 : Math.round(price);
}
```

## Configuration Examples

### Basic Configuration

```javascript
const config = {
  name: "Restaurant Name",
  url: "https://restaurant.se/lunch/",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000
};
```

### Advanced Configuration

```javascript
const config = {
  name: "Restaurant Name",
  url: "https://restaurant.se/lunch/",
  timeout: 45000,
  retries: 5,
  retryDelay: 2000,
  headers: {
    'User-Agent': 'Custom Bot/1.0',
    'Accept-Language': 'sv-SE'
  },
  selectors: {
    container: '.lunch-menu, #menu, .weekly-menu',
    items: '.lunch-item, .dish, .menu-item',
    name: '.name, h3, .title',
    price: '.price, .cost, .amount',
    description: '.desc, p, .details'
  }
};
```

## Performance Considerations

### 1. Minimize DOM Queries

```javascript
// Bad: Multiple queries for same element
const name = this.extractText(this.safeQuery(item, '.content .name'));
const desc = this.extractText(this.safeQuery(item, '.content .description'));

// Good: Query once, reuse
const content = this.safeQuery(item, '.content');
const name = this.extractText(this.safeQuery(content, '.name'));
const desc = this.extractText(this.safeQuery(content, '.description'));
```

### 2. Use Efficient Selectors

```javascript
// Bad: Complex selectors
'.menu table tbody tr td:nth-child(2) span.price'

// Good: Simple, specific selectors
'.lunch-item .price'
```

### 3. Limit Processing

```javascript
// Process only current week's data
if (this.isCurrentWeek(weekNumber)) {
  const lunches = this.extractWeekData(weekContainer);
  allLunches.push(...lunches);
}
```

## Deployment Checklist

- [ ] All abstract methods implemented
- [ ] Error handling for common failure cases
- [ ] Logging for debugging and monitoring
- [ ] Unit tests with mock data
- [ ] Integration tests with real website
- [ ] Performance testing with large responses
- [ ] Health status monitoring working
- [ ] Configuration validated
- [ ] Documentation updated

## Support and Troubleshooting

### Debug Mode

Enable detailed logging by setting log level:

```javascript
process.env.LOG_LEVEL = 'DEBUG';
```

### Health Monitoring

Check parser health:

```javascript
const status = parser.getHealthStatus();
console.log('Parser health:', status);
```

### Common Error Codes

- `PARSE_ERROR`: General parsing failure
- `NETWORK_ERROR`: HTTP request failure
- `TIMEOUT_ERROR`: Request timeout
- `VALIDATION_ERROR`: Data validation failure
- `SELECTOR_ERROR`: CSS selector not found

For more help, check the logs or contact the development team.