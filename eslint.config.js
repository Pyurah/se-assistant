import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  // Base config for all TypeScript/TSX.
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // No console anywhere — use the structured logger (src/core/logger).
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // PURITY BOUNDARY: src/core and src/data must stay platform-agnostic.
  // Zero React, zero DOM, zero UI/app imports — so the engine can be wrapped
  // in Tauri (or run in a worker / on a server) without modification.
  {
    files: ['src/core/**/*.ts', 'src/data/**/*.ts'],
    ignores: ['src/core/**/*.test.ts', 'src/data/**/*.test.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*'],
              message:
                'src/core and src/data must be platform-agnostic. No React/UI framework imports allowed here — keep the calc engine pure so it can be wrapped in Tauri or run headless.',
            },
            {
              group: ['@ui/*', '@app/*'],
              message:
                'src/core and src/data must not depend on UI or app layers. Dependencies flow inward: app -> ui -> core -> data.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core and src/data must not touch the DOM.' },
        { name: 'document', message: 'src/core and src/data must not touch the DOM.' },
        { name: 'localStorage', message: 'src/core and src/data must not touch browser storage.' },
      ],
    },
  },

  // The logger is the one sanctioned place console output is produced.
  {
    files: ['src/core/logger/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Build-time scripts (block-definition generator) live OUTSIDE the src/
  // purity boundary. They run under Node with tsx, use `fs`, and print to the
  // console — all sanctioned here. Not shipped in the app bundle.
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Test files: relax a few strict rules that fight with test ergonomics.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-globals': 'off',
    },
  },
);
