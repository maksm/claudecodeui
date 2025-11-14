export default {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns - exclude e2e tests (those are for Playwright)
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.ts',
    '!**/tests/e2e/**',
    '!**/tests/frontend/**',
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 30, // Realistic threshold based on current coverage
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Exclude patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.taskmaster/',
    '/tests/e2e/',
    '/tests/frontend/',
    '\\.e2e\\.(js|ts)$',
    '\\.spec\\.(js|ts)$',
    '/tests/integration.test.js',
    '/tests/auth.test.js',
    '/tests/projects.test.js',
    '/tests/security.test.js',
    '/tests/websocket.test.js',
    '/tests/example.test.js',
  ],

  // Coverage exclude patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.taskmaster/',
    '/coverage/',
    '.*\\.config\\.js$',
    '.*\\.config\\.ts$',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'mjs'],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Module name mapping for absolute imports (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
