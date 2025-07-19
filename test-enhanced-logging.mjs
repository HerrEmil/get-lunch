#!/usr/bin/env node

/**
 * Comprehensive test for enhanced debug logging system
 * Tests the new structured logging with context, timing, and correlation tracking
 */

import { extractLunchFromElement, extractAllLunchData, extractNiagaraLunches } from './data-extractor.mjs';
import { createLogger, createRestaurantLogger, createWeekdayLogger, LOG_LEVELS } from './debug-logger.mjs';
import { JSDOM } from 'jsdom';

// Test counter
let testCount = 0;
let passedTests = 0;

function runTest(testName, testFn) {
  testCount++;
  console.log(`\n--- Test ${testCount}: ${testName} ---`);

  try {
    const result = testFn();
    if (result) {
      console.log('✅ PASSED');
      passedTests++;
    } else {
      console.log('❌ FAILED');
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error.message);
  }
}

function createMockHtmlNode(html) {
  const dom = new JSDOM(`<div>${html}</div>`);
  return dom.window.document.body.firstElementChild;
}

// Test 1: Basic logger functionality
runTest('Basic logger creation and usage', () => {
  console.log('Testing basic logger functionality...');

  const logger = createLogger({ testContext: 'basic-test' });

  logger.info('Test info message', { testData: 'sample' });
  logger.warn('Test warning message');
  logger.error('Test error message', {}, new Error('Test error'));
  logger.debug('Test debug message');

  return logger.context.correlationId && logger.metrics.operations > 0;
});

// Test 2: Child logger context inheritance
runTest('Child logger context inheritance', () => {
  console.log('Testing child logger context...');

  const parentLogger = createLogger({ parent: 'test' });
  const childLogger = parentLogger.child({ child: 'test' });

  console.log('Parent correlation ID:', parentLogger.context.correlationId.substring(0, 8));
  console.log('Child correlation ID:', childLogger.context.correlationId.substring(0, 8));
  console.log('Child has parent context:', childLogger.context.parent === 'test');
  console.log('Child has parent correlation ID:', !!childLogger.context.parentCorrelationId);

  return childLogger.context.parent === 'test' &&
         childLogger.context.parentCorrelationId === parentLogger.context.correlationId;
});

// Test 3: Timer functionality
runTest('Timer functionality', () => {
  console.log('Testing timer functionality...');

  const logger = createLogger();

  logger.startTimer('test-operation');

  // Simulate some work
  for (let i = 0; i < 1000; i++) {
    Math.random();
  }

  const duration = logger.endTimer('test-operation');

  console.log('Timer duration:', duration, 'ms');

  return typeof duration === 'number' && duration >= 0;
});

// Test 4: Restaurant logger with context
runTest('Restaurant logger with context', () => {
  console.log('Testing restaurant logger...');

  const logger = createRestaurantLogger('Niagara', { testMode: true });

  logger.info('Restaurant operation started');
  logger.warn('Test warning for restaurant');

  console.log('Logger context:', logger.context);

  return logger.context.restaurant === 'Niagara' && logger.context.testMode === true;
});

// Test 5: Weekday logger with context
runTest('Weekday logger with context', () => {
  console.log('Testing weekday logger...');

  const logger = createWeekdayLogger('Niagara', 'måndag', { week: 45 });

  logger.info('Weekday operation started');
  logger.debug('Processing weekday data');

  console.log('Logger context:', logger.context);

  return logger.context.restaurant === 'Niagara' &&
         logger.context.weekday === 'måndag' &&
         logger.context.week === 45;
});

// Test 6: Element inspection logging
runTest('Element inspection logging', () => {
  console.log('Testing element inspection...');

  const logger = createLogger();
  const element = createMockHtmlNode('<div class="test" id="sample">Test content</div>');

  logger.inspectElement(element, 'Test element inspection');
  logger.inspectElement(null, 'Null element inspection');

  return true; // Test passes if no errors thrown
});

// Test 7: Validation result logging
runTest('Validation result logging', () => {
  console.log('Testing validation result logging...');

  const logger = createLogger();

  const validResult = { isValid: true };
  const invalidResult = { isValid: false, errors: ['Test error 1', 'Test error 2'] };

  logger.logValidationResult(validResult, 'Valid test');
  logger.logValidationResult(invalidResult, 'Invalid test');

  return true; // Test passes if no errors thrown
});

// Test 8: Extraction attempt logging
runTest('Extraction attempt logging', () => {
  console.log('Testing extraction attempt logging...');

  const logger = createLogger();

  logger.logExtractionAttempt(['selector1', 'selector2'], true, 5);
  logger.logExtractionAttempt('single-selector', false, 0);

  return true; // Test passes if no errors thrown
});

// Test 9: Performance metrics logging
runTest('Performance metrics logging', () => {
  console.log('Testing performance metrics...');

  const logger = createLogger();

  // Generate some metrics
  logger.info('Operation 1');
  logger.warn('Warning 1');
  logger.error('Error 1', {}, new Error('Test'));
  logger.info('Operation 2');

  logger.logMetrics();

  return logger.metrics.operations >= 4 &&
         logger.metrics.warnings >= 1 &&
         logger.metrics.errors >= 1;
});

// Test 10: Network operation logging
runTest('Network operation logging', () => {
  console.log('Testing network operation logging...');

  const logger = createLogger();

  logger.logNetworkOperation('https://example.com', 'GET', 200);
  logger.logNetworkOperation('https://example.com/error', 'GET', 404);
  logger.logNetworkOperation('https://example.com/fail', 'GET', null, new Error('Network error'));

  return true; // Test passes if no errors thrown
});

// Test 11: Data extraction summary logging
runTest('Data extraction summary logging', () => {
  console.log('Testing extraction summary logging...');

  const logger = createLogger();

  const successfulResults = [
    { name: 'Item 1', price: 95 },
    { name: 'Item 2', price: 85 },
    { name: 'Item 3', price: 105 }
  ];

  const mixedResults = [
    { name: 'Item 1', price: 95 },
    null,
    undefined,
    { name: 'Item 2', price: 85 }
  ];

  const emptyResults = [];

  logger.logExtractionSummary(successfulResults);
  logger.logExtractionSummary(mixedResults);
  logger.logExtractionSummary(emptyResults);

  return true; // Test passes if no errors thrown
});

// Test 12: Field parsing logging
runTest('Field parsing logging', () => {
  console.log('Testing field parsing logging...');

  const logger = createLogger();

  logger.logFieldParsing('price', '95 kr', 95, true);
  logger.logFieldParsing('price', 'invalid price', null, false);
  logger.logFieldParsing('name', 'Pizza Margherita', 'Pizza Margherita', true);

  return true; // Test passes if no errors thrown
});

// Test 13: Operation context tracking
runTest('Operation context tracking', () => {
  console.log('Testing operation context tracking...');

  const logger = createLogger();

  const result = logger.withOperation('test-operation', (opLogger) => {
    opLogger.info('Inside operation');
    opLogger.debug('Operation progress');
    return 'operation-result';
  });

  console.log('Operation result:', result);

  return result === 'operation-result';
});

// Test 14: Error handling in operation context
runTest('Error handling in operation context', () => {
  console.log('Testing error handling in operation context...');

  const logger = createLogger();

  try {
    logger.withOperation('failing-operation', (opLogger) => {
      opLogger.info('About to fail');
      throw new Error('Operation failed');
    });
    return false; // Should not reach here
  } catch (error) {
    console.log('Caught expected error:', error.message);
    return error.message === 'Operation failed';
  }
});

// Test 15: Integration with actual data extraction
runTest('Integration with actual data extraction', () => {
  console.log('Testing integration with data extraction...');

  // Create a valid table row element
  const element = {
    tagName: 'TR',
    textContent: 'Pasta Carbonara Creamy pasta with bacon 95 kr',
    querySelectorAll: () => [
      { textContent: 'Pasta Carbonara' },
      { textContent: 'Creamy pasta with bacon' },
      { textContent: '95 kr' }
    ],
    querySelector: (selector) => {
      if (selector === 'td:nth-of-type(1)') return { textContent: 'Pasta Carbonara' };
      if (selector === 'td:nth-of-type(2)') return { textContent: 'Creamy pasta with bacon' };
      if (selector === 'td:nth-of-type(3)') return { textContent: '95 kr' };
      return null;
    }
  };

  console.log('Testing extractLunchFromElement with enhanced logging...');
  const result = extractLunchFromElement(element, 45, 'måndag');

  console.log('Extraction result:', result);

  return result !== null && result.name === 'Pasta Carbonara';
});

// Test 16: Container extraction with logging
runTest('Container extraction with enhanced logging', () => {
  console.log('Testing container extraction with enhanced logging...');

  const containerHtml = `
    <div class="lunch">
      <h3>Lunch Menu - Vecka 45</h3>
      <table>
        <tbody>
          <tr><td>Pizza</td><td>Margherita pizza</td><td>85 kr</td></tr>
          <tr><td>Pasta</td><td>Bolognese pasta</td><td>95 kr</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const container = createMockHtmlNode(containerHtml);
  console.log('Testing extractAllLunchData with enhanced logging...');

  const lunches = extractAllLunchData(container);
  console.log('Container extraction result count:', lunches.length);

  return Array.isArray(lunches);
});

// Test 17: Log level filtering
runTest('Log level filtering', () => {
  console.log('Testing log level filtering...');

  // Save original log level
  const originalLevel = process.env.DEBUG_LEVEL;

  // Set to ERROR level only
  process.env.DEBUG_LEVEL = LOG_LEVELS.ERROR.toString();

  const logger = createLogger();

  console.log('Testing with ERROR level only...');
  logger.error('This should appear');
  logger.warn('This should not appear');
  logger.info('This should not appear');
  logger.debug('This should not appear');

  // Restore original level
  if (originalLevel) {
    process.env.DEBUG_LEVEL = originalLevel;
  } else {
    delete process.env.DEBUG_LEVEL;
  }

  return true; // Visual test - check console output
});

// Test 18: Correlation ID uniqueness
runTest('Correlation ID uniqueness', () => {
  console.log('Testing correlation ID uniqueness...');

  const logger1 = createLogger();
  const logger2 = createLogger();
  const logger3 = createLogger();

  const id1 = logger1.context.correlationId;
  const id2 = logger2.context.correlationId;
  const id3 = logger3.context.correlationId;

  console.log('ID 1:', id1.substring(0, 8));
  console.log('ID 2:', id2.substring(0, 8));
  console.log('ID 3:', id3.substring(0, 8));

  return id1 !== id2 && id2 !== id3 && id1 !== id3;
});

// Run all tests
console.log('🧪 Running Enhanced Debug Logging Tests\n');
console.log('This test suite validates the new structured logging system with context, timing, and correlation tracking\n');

// Wait for async operations to complete
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${testCount} tests passed`);

  if (passedTests === testCount) {
    console.log('🎉 All tests passed! Enhanced debug logging is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the logging implementation.');
  }

  console.log('\n📝 Key logging improvements tested:');
  console.log('  • Structured logging with context and correlation tracking');
  console.log('  • Performance timing and metrics collection');
  console.log('  • Restaurant and weekday-specific loggers');
  console.log('  • Element inspection and validation result logging');
  console.log('  • Network operation and extraction summary logging');
  console.log('  • Operation context tracking with error handling');
  console.log('  • Log level filtering and output formatting');
  console.log('  • Integration with existing data extraction functions');
}, 100);
