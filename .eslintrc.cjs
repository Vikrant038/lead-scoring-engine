/**
 * ESLint config — enforces CODING_STANDARDS Pillar 0 (global prohibitions) and TS strictness.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: ['dist/', 'node_modules/', 'public/', '*.cjs', 'jest.config.js'],
  rules: {
    // Pillar 0.1 — forbid escape hatches
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
    // Pillar 0.3 — no console (use structured logger)
    'no-console': 'error',
    // Pillar 0.2 — no empty catch
    'no-empty': ['error', { allowEmptyCatch: false }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['src/cli/index.ts', 'src/web/server.ts', 'demo.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};
