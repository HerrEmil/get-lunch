import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/', '.serverless/'],
  },
  {
    files: ['src/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.test.mjs'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
];
