import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Accessibility testing settings */
    axe: {
      analyze: false, // Set to true to run axe analysis automatically
      axeOptions: {
        reporter: 'v2',
        rules: {
          'keyboard-navigation': { enabled: true },
          'color-contrast': { enabled: true },
          'duplicate-id': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'page-has-heading-one': { enabled: true },
          region: { enabled: true },
        },
      },
    },

    /* Global timeout for each action */
    actionTimeout: 10 * 1000, // 10 seconds

    /* Global timeout for each test */
    timeout: 60 * 1000, // 60 seconds
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run server',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  },

  /* Test files to exclude */
  testIgnore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],

  /* Test files to include */
  testMatch: [
    '**/*.e2e.js',
    '**/*.e2e.jsx',
    '**/*.e2e.ts',
    '**/*.spec.e2e.js',
    '**/*.spec.e2e.jsx',
    '**/*.spec.e2e.ts',
  ],

  /* Output directory for test artifacts */
  outputDir: 'test-results/',

  /* Environment variables */
  env: {
    NODE_ENV: 'test',
    ...process.env,
  },
});
