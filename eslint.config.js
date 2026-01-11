import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const unusedVarsOptions = {
  argsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  // Also ignore framer-motion's `motion` namespace (used as `<motion.div />`).
  varsIgnorePattern: '(^[A-Z_]|^motion$)',
}

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),

  // Frontend (React)
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
      // Too noisy for shadcn/ui patterns (exports helpers/constants).
      'react-refresh/only-export-components': 'off',
      // Avoid false-positives on benign placeholders (e.g. Math.random()).
      'react-hooks/purity': 'off',
    },
  },

  // Backend + Node scripts/config
  {
    files: [
      'server/**/*.js',
      'scripts/**/*.js',
      '*.js',
      '*.cjs',
      '*.mjs',
      'vite.config.js',
      'postcss.config.js',
      'tailwind.config.js',
    ],
    ignores: ['src/**/*'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
])
