/** Jest config — unit + integration projects (CODING Pillar 7). */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^better-auth$': '<rootDir>/tests/mocks/better-auth.mock.ts',
    '^better-auth/node$': '<rootDir>/tests/mocks/better-auth.mock.ts',
    '^better-auth/crypto$': '<rootDir>/tests/mocks/better-auth.mock.ts',
    '^better-auth/adapters/drizzle$': '<rootDir>/tests/mocks/better-auth.mock.ts',
  },
  // Exclude type-only definition files and root demo script.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/*.d.ts',
    '!demo.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 90, statements: 90 },
    // Per-file floor: every individual source file must clear this bar (not just the aggregate).
    // Branches sit at 80 to catch under-tested modules; lines/funcs/stmts at 90.
    'src/**/*.ts': { branches: 80, functions: 90, lines: 90, statements: 90 },
  },
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^better-auth$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/node$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/crypto$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/adapters/drizzle$': '<rootDir>/tests/mocks/better-auth.mock.ts',
      },
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^better-auth$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/node$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/crypto$': '<rootDir>/tests/mocks/better-auth.mock.ts',
        '^better-auth/adapters/drizzle$': '<rootDir>/tests/mocks/better-auth.mock.ts',
      },
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
  ],
};
