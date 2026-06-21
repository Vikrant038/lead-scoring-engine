/** Jest config — unit + integration projects (CODING Pillar 7). */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.types.ts', '!src/web/views/**'],
  coverageThreshold: {
    // Commercial tier (CODING 7.1): services 80%, utilities 90%.
    global: { branches: 70, functions: 80, lines: 80, statements: 80 },
  },
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
  ],
};
