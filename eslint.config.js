import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/*.config.ts', '.claude/**'],
  },

  {
    files: ['eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    ...eslint.configs.recommended,
  },

  {
    files: ['.github/scripts/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
    ...eslint.configs.recommended,
  },

  ...tseslint.config({
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [...tseslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
  }),
);
