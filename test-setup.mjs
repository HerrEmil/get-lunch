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

// Mock AWS SDK
vi.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: vi.fn(() => ({
    send: vi.fn(),
    destroy: vi.fn(),
  })),
  CreateLogGroupCommand: vi.fn(),
  CreateLogStreamCommand: vi.fn(),
  PutLogEventsCommand: vi.fn(),
}));

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

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.LUNCH_TABLE_NAME = 'test-lunch-table';

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
});
