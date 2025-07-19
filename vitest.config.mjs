import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.mjs', '**/*.test.js'],
    exclude: ['node_modules/**', 'infrastructure/**'],
    setupFiles: ['./test-setup.mjs'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'infrastructure/**',
        '**/*.test.mjs',
        '**/*.test.js',
        'test-setup.mjs',
        'vitest.config.mjs'
      ]
    },
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json'
    }
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname
    }
  }
});
