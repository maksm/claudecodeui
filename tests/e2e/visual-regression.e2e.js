import { expect, describe } from '@playwright/test';
import { test as baseTest } from '@playwright/test';
import { VisualRegressionHelper, AccessibilityHelper } from '../helpers/accessibility-helpers.js';
import { loginAsUser, cleanupTestData } from './helpers/test-helpers.js';

// Extend base test to include visual regression helpers
/* eslint-disable react-hooks/rules-of-hooks */
export const testWithVisual = baseTest.extend({
  visualHelper: async ({ page }, use) => {
    const helper = new VisualRegressionHelper(page);
    await use(helper);
  },
  accessibilityHelper: async ({ page }, use) => {
    const helper = new AccessibilityHelper(page);
    await use(helper);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

const test = testWithVisual;

describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  describe('Login Page Visual Tests', () => {
    test('should match baseline login page on desktop', async ({ page, visualHelper }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('login-page-desktop');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline login page on mobile', async ({ page, visualHelper }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('login-page-mobile');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline login page on tablet', async ({ page, visualHelper }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('login-page-tablet');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline login form with validation errors', async ({
      page,
      visualHelper,
    }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Trigger validation errors
      await page.click('button[type="submit"]');
      await page.waitForSelector('.error, [role="alert"]');

      const result = await visualHelper.compareWithBaseline('login-form-errors');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline focused form fields', async ({ page, visualHelper }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Focus each field
      await page.focus('input[type="text"]');
      await page.waitForTimeout(100);

      const result = await visualHelper.compareWithBaseline('login-form-focused-username');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Dashboard Visual Tests', () => {
    test('should match baseline dashboard on desktop', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('dashboard-desktop');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline dashboard sidebar', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('aside, [data-testid="sidebar"], nav');
      const clip = await sidebar.boundingBox();

      const result = await visualHelper.compareWithBaseline('dashboard-sidebar', {
        clip: clip ? { x: clip.x, y: clip.y, width: clip.width, height: clip.height } : undefined,
      });
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline dashboard main content', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [data-testid="main-content"]');
      const clip = await mainContent.boundingBox();

      const result = await visualHelper.compareWithBaseline('dashboard-main-content', {
        clip: clip ? { x: clip.x, y: clip.y, width: clip.width, height: clip.height } : undefined,
      });
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline mobile dashboard', async ({ page, visualHelper }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('dashboard-mobile');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Projects Page Visual Tests', () => {
    test('should match baseline projects list', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="projects-nav"]');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('projects-list');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline projects with search', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="projects-nav"]');
      await page.waitForLoadState('networkidle');

      // Type in search field
      await page.fill('[data-testid="search-input"], input[placeholder*="search"]', 'test');
      await page.waitForTimeout(500);

      const result = await visualHelper.compareWithBaseline('projects-with-search');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline project creation modal', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="projects-nav"]');
      await page.waitForLoadState('networkidle');

      // Open create project modal
      await page.click('[data-testid="create-project-button"]');
      await page.waitForSelector('[data-testid="project-modal"]');

      const result = await visualHelper.compareWithBaseline('project-creation-modal');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Chat Interface Visual Tests', () => {
    test('should match baseline chat interface', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('chat-interface');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline chat with message input', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      // Type a message
      await page.fill(
        'textarea[placeholder*="message"], textarea[placeholder*="Message"]',
        'Hello, how are you?'
      );
      await page.waitForTimeout(200);

      const result = await visualHelper.compareWithBaseline('chat-with-message-input');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline mobile chat interface', async ({ page, visualHelper }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAsUser(page);
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('chat-interface-mobile');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Settings Visual Tests', () => {
    test('should match baseline settings page', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="settings-nav"], [data-testid="settings-button"]');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('settings-page');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline settings with active tab', async ({ page, visualHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="settings-nav"], [data-testid="settings-button"]');
      await page.waitForLoadState('networkidle');

      // Click on a specific settings tab
      await page.click('[data-testid="appearance-tab"], button:has-text("Appearance")');
      await page.waitForTimeout(200);

      const result = await visualHelper.compareWithBaseline('settings-appearance-tab');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Dark Mode Visual Tests', () => {
    test('should match baseline login page in dark mode', async ({ page, visualHelper }) => {
      // Enable dark mode
      await page.addStyleTag({
        content: `
          :root {
            --background: #1a1a1a;
            --foreground: #ffffff;
            --card: #2d2d2d;
            --text: #ffffff;
          }
          body {
            background: #1a1a1a !important;
            color: #ffffff !important;
          }
        `,
      });

      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('login-page-dark');
      expect(result.identical).toBeTruthy();
    });

    test('should match baseline dashboard in dark mode', async ({ page, visualHelper }) => {
      // Enable dark mode
      await page.addStyleTag({
        content: `
          :root {
            --background: #1a1a1a;
            --foreground: #ffffff;
            --card: #2d2d2d;
            --text: #ffffff;
          }
          body {
            background: #1a1a1a !important;
            color: #ffffff !important;
          }
        `,
      });

      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('dashboard-dark');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Responsive Design Visual Tests', () => {
    const viewports = [
      { name: 'mobile-small', width: 320, height: 568 },
      { name: 'mobile', width: 375, height: 667 },
      { name: 'mobile-large', width: 414, height: 896 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'desktop-large', width: 2560, height: 1440 },
    ];

    viewports.forEach(({ name, width, height }) => {
      test(`should match baseline dashboard on ${name} (${width}x${height})`, async ({
        page,
        visualHelper,
      }) => {
        await page.setViewportSize({ width, height });
        await loginAsUser(page);
        await page.waitForLoadState('networkidle');

        const result = await visualHelper.compareWithBaseline(`dashboard-${name}`);
        expect(result.identical).toBeTruthy();
      });
    });
  });

  describe('Component State Visual Tests', () => {
    test('should match baseline button states', async ({ page, visualHelper }) => {
      await loginAsUser(page);

      // Test different button states
      const buttons = await page.locator('button').all();
      if (buttons.length > 0) {
        // Hover state
        await buttons[0].hover();
        await page.waitForTimeout(100);

        const hoverResult = await visualHelper.compareWithBaseline('button-hover');
        expect(hoverResult.identical).toBeTruthy();

        // Focus state
        await buttons[0].focus();
        await page.waitForTimeout(100);

        const focusResult = await visualHelper.compareWithBaseline('button-focus');
        expect(focusResult.identical).toBeTruthy();
      }
    });

    test('should match baseline form field states', async ({ page, visualHelper }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Focus username field
      await page.focus('input[type="text"]');
      await page.waitForTimeout(100);

      const focusResult = await visualHelper.compareWithBaseline('input-focus');
      expect(focusResult.identical).toBeTruthy();

      // Fill with content
      await page.fill('input[type="text"]', 'testuser');
      await page.waitForTimeout(100);

      const filledResult = await visualHelper.compareWithBaseline('input-filled');
      expect(filledResult.identical).toBeTruthy();
    });
  });

  describe('Loading States Visual Tests', () => {
    test('should match baseline loading states', async ({ page, visualHelper }) => {
      // Mock slow network to create loading states
      await page.route('**/api/**', route => {
        // eslint-disable-next-line no-undef
        setTimeout(
          () =>
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: 'mocked' }),
            }),
          2000
        );
      });

      await loginAsUser(page);

      // Navigate to a page that triggers loading
      await page.click('[data-testid="projects-nav"]');

      // Take screenshot while loading
      await page.waitForTimeout(500);
      const result = await visualHelper.compareWithBaseline('loading-state');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Error States Visual Tests', () => {
    test('should match baseline error states', async ({ page, visualHelper }) => {
      // Mock network error
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await loginAsUser(page);

      // Trigger an API call that will fail
      await page.click('[data-testid="projects-nav"]');
      await page.waitForTimeout(1000);

      const result = await visualHelper.compareWithBaseline('error-state');
      expect(result.identical).toBeTruthy();
    });
  });

  describe('Visual Accessibility Tests', () => {
    test('should maintain visual accessibility across themes', async ({
      page,
      accessibilityHelper,
      visualHelper,
    }) => {
      await loginAsUser(page);

      // Test light theme
      const lightAccessibility = await accessibilityHelper.analyzeAccessibility();
      expect(lightAccessibility.violations.filter(v => v.impact === 'critical')).toHaveLength(0);

      const lightVisual = await visualHelper.compareWithBaseline('accessibility-light-theme');
      expect(lightVisual.identical).toBeTruthy();

      // Test dark theme
      await page.addStyleTag({
        content: `
          :root {
            --background: #1a1a1a;
            --foreground: #ffffff;
            --card: #2d2d2d;
            --text: #ffffff;
          }
          body {
            background: #1a1a1a !important;
            color: #ffffff !important;
          }
        `,
      });

      const darkAccessibility = await accessibilityHelper.analyzeAccessibility();
      expect(darkAccessibility.violations.filter(v => v.impact === 'critical')).toHaveLength(0);

      const darkVisual = await visualHelper.compareWithBaseline('accessibility-dark-theme');
      expect(darkVisual.identical).toBeTruthy();
    });
  });

  describe('Performance Visual Tests', () => {
    test('should maintain visual consistency during performance constraints', async ({
      page,
      visualHelper,
    }) => {
      // Simulate high CPU load
      await page.addInitScript(() => {
        // Simulate blocking operations
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Blocking operation
        }
      });

      await loginAsUser(page);
      await page.waitForLoadState('networkidle');

      const result = await visualHelper.compareWithBaseline('performance-visual-test');
      expect(result.identical).toBeTruthy();
    });
  });
});

describe('Visual Regression Report Generation', () => {
  test('should generate comprehensive visual comparison report', async ({ page, visualHelper }) => {
    const results = [];

    // Collect multiple comparisons
    await loginAsUser(page);

    const dashboardResult = await visualHelper.compareWithBaseline('report-dashboard');
    results.push(dashboardResult);

    await page.click('[data-testid="projects-nav"]');
    await page.waitForLoadState('networkidle');

    const projectsResult = await visualHelper.compareWithBaseline('report-projects');
    results.push(projectsResult);

    // Generate comparison report
    const reportPath = await visualHelper.generateComparisonReport(results);
    expect(reportPath).toBeTruthy();

    // Verify report was created
    const fs = await import('fs');
    const reportExists = await fs.promises
      .access(reportPath)
      .then(() => true)
      .catch(() => false);
    expect(reportExists).toBeTruthy();
  });
});
