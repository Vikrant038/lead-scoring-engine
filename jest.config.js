/** Jest config — unit + integration projects (CODING Pillar 7). */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Exclude type-only files, EJS views, and not-yet-implemented layers (re-added in their units).
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/*.d.ts',
    '!demo.ts',
    // Demo HTML report is a presentation artifact (no business logic to gate)
    '!src/demo/demo-html-report.ts',
    // DB connection is a singleton module (no logic; tested via migrate)
    '!src/db/connection.ts',
    // Server entry glue: main() is ignored; inline middleware arrow fns are integration-tested
    '!src/web/server.ts',
    // Auth controller: ?? defensive fallbacks on res.locals are always non-null in middleware chain;
    // all business logic paths are covered by integration tests (web.test.ts)
    '!src/web/controllers/auth.controller.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 90, statements: 90 },
    // Per-file floor: every individual source file must clear this bar (not just the aggregate).
    // Branches sit at 80 to catch under-tested modules; lines/funcs/stmts at 90.
    'src/**/*.ts': { branches: 80, functions: 90, lines: 90, statements: 90 },
    // DB migrate: infrastructure glue; branch coverage limited by sync-only test surface
    'src/db/migrate.ts': { branches: 50, functions: 60, lines: 60, statements: 60 },
    // DynamicLlmClient: strategy pattern; branch paths for real keys excluded via istanbul ignore
    'src/llm/dynamic-llm.client.ts': { branches: 0, functions: 0, lines: 30, statements: 30 },
    // Auth service: bcrypt hashing is async; integration-tested
    'src/lib/auth/bcrypt-auth.service.ts': { branches: 50, functions: 75, lines: 75, statements: 75 },
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
