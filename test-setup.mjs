/**
 * Test setup file for vitest
 * Configures global test environment and mocks
 */

import { vi } from 'vitest';

// Mock Node.js built-in modules
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
    resolve: vi.fn((...args) => args.join('/')),
  };
});

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({
    send: vi.fn(),
    destroy: vi.fn(),
  })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  DeleteItemCommand: vi.fn(),
  ScanCommand: vi.fn(),
  QueryCommand: vi.fn(),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
      destroy: vi.fn(),
    })),
  },
  GetCommand: vi.fn(),
  PutCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  ScanCommand: vi.fn(),
  QueryCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: vi.fn(() => ({
    send: vi.fn(),
    destroy: vi.fn(),
  })),
  CreateLogGroupCommand: vi.fn(),
  CreateLogStreamCommand: vi.fn(),
  PutLogEventsCommand: vi.fn(),
}));

// Mock JSDOM for HTML parsing tests
vi.mock('jsdom', () => ({
  JSDOM: vi.fn((html) => ({
    window: {
      document: {
        body: {
          firstElementChild: {
            querySelector: vi.fn(),
            querySelectorAll: vi.fn(),
            innerHTML: html,
            textContent: html.replace(/<[^>]*>/g, ''),
          },
        },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      },
    },
  })),
}));

// Global test helpers
global.createMockElement = (tag, attributes = {}, textContent = '') => ({
  tagName: tag.toUpperCase(),
  textContent,
  innerHTML: textContent,
  getAttribute: vi.fn((attr) => attributes[attr]),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  children: [],
  parentElement: null,
  ...attributes,
});

global.createMockLunch = (overrides = {}) => ({
  week: 47,
  weekday: 'måndag',
  name: 'Test Lunch',
  description: 'Test Description',
  price: 125,
  restaurant: 'test',
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

global.createMockContext = (overrides = {}) => ({
  awsRequestId: 'test-request-id',
  functionName: 'test-function',
  functionVersion: '1',
  memoryLimitInMB: 128,
  remainingTimeInMillis: 30000,
  ...overrides,
});

// Setup console mocking for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Restore console for specific tests that need it
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Mock timers helper
global.mockTimers = () => {
  vi.useFakeTimers();
  return {
    advance: (ms) => vi.advanceTimersByTime(ms),
    restore: () => vi.useRealTimers(),
  };
};

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.LUNCH_TABLE_NAME = 'test-lunch-table';

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
});
