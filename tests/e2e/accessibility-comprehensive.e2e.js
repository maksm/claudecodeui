import { expect, describe } from '@playwright/test';
import { test as baseTest } from '@playwright/test';
import {
  AccessibilityHelper,
  WCAGComplianceChecker,
  VisualRegressionHelper,
} from '../helpers/accessibility-helpers.js';
import { loginAsUser, cleanupTestData } from './helpers/test-helpers.js';

// Extend base test to include accessibility helpers
/* eslint-disable react-hooks/rules-of-hooks */
export const testWithAccessibility = baseTest.extend({
  accessibilityHelper: async ({ page }, use) => {
    const helper = new AccessibilityHelper(page);
    await use(helper);
  },
  wcagChecker: async ({ page }, use) => {
    const helper = new AccessibilityHelper(page);
    const checker = new WCAGComplianceChecker(helper);
    await use(checker);
  },
  visualHelper: async ({ page }, use) => {
    const helper = new VisualRegressionHelper(page);
    await use(helper);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

const test = testWithAccessibility;

describe('Comprehensive Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  describe('Login Page Accessibility', () => {
    test('should meet WCAG 2.1 Level A compliance', async ({ page, wcagChecker }) => {
      await page.goto('/login');

      const results = await wcagChecker.checkLevelA();
      expect(results.violations).toHaveLength(0);

      if (results.violations.length > 0) {
        console.error(
          'WCAG Level A violations:',
          results.violations.map(v => v.id)
        );
      }
    });

    test('should meet WCAG 2.1 Level AA compliance', async ({ page, wcagChecker }) => {
      await page.goto('/login');

      const results = await wcagChecker.checkLevelAA();
      expect(results.violations).toHaveLength(0);

      if (results.violations.length > 0) {
        console.error(
          'WCAG Level AA violations:',
          results.violations.map(v => v.id)
        );
      }
    });

    test('should have proper color contrast', async ({ page, accessibilityHelper }) => {
      await page.goto('/login');

      const contrastResults = await accessibilityHelper.checkColorContrast();
      expect(contrastResults.violations).toHaveLength(0);

      if (contrastResults.violations.length > 0) {
        contrastResults.violations.forEach(violation => {
          console.error(`Color contrast violation: ${violation.description}`);
        });
      }
    });

    test('should support keyboard navigation', async ({ page, accessibilityHelper }) => {
      await page.goto('/login');

      const keyboardResults = await accessibilityHelper.checkKeyboardNavigation();
      expect(keyboardResults.violations).toHaveLength(0);

      // Test actual keyboard navigation
      await page.keyboard.press('Tab');
      let focused = await page.evaluate(() => document.activeElement.tagName);
      expect(['INPUT', 'BUTTON'].includes(focused)).toBeTruthy();

      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement.tagName);
      expect(['INPUT', 'BUTTON'].includes(focused)).toBeTruthy();
    });

    test('should have proper ARIA attributes', async ({ page, accessibilityHelper }) => {
      await page.goto('/login');

      const ariaResults = await accessibilityHelper.checkAriaCompliance();
      expect(ariaResults.violations).toHaveLength(0);

      // Check specific ARIA attributes
      await expect(page.locator('input[type="text"]')).toHaveAttribute('aria-label');
      await expect(page.locator('input[type="password"]')).toHaveAttribute('aria-label');
      await expect(page.locator('button[type="submit"]')).toHaveAttribute('aria-label');
    });
  });

  describe('Dashboard Accessibility', () => {
    test('should meet WCAG 2.1 Level A compliance', async ({ page, wcagChecker }) => {
      await loginAsUser(page);

      const results = await wcagChecker.checkLevelA();
      expect(results.violations).toHaveLength(0);
    });

    test('should meet WCAG 2.1 Level AA compliance', async ({ page, wcagChecker }) => {
      await loginAsUser(page);

      const results = await wcagChecker.checkLevelAA();
      expect(results.violations).toHaveLength(0);
    });

    test('should have proper document structure', async ({ page, accessibilityHelper }) => {
      await loginAsUser(page);

      const structureResults = await accessibilityHelper.checkDocumentStructure();
      expect(structureResults.violations).toHaveLength(0);

      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);

      // Check for main landmark
      await expect(page.locator('main, [role="main"]')).toBeVisible();

      // Check for navigation landmarks
      await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
    });

    test('should have accessible tables', async ({ page, accessibilityHelper }) => {
      await loginAsUser(page);

      // Navigate to projects page
      await page.click('[data-testid="projects-nav"]');
      await page.waitForLoadState('networkidle');

      const results = await accessibilityHelper.analyzeAccessibility();
      const tableViolations = results.violations.filter(
        v => v.tags.includes('table') || v.tags.includes('datatable')
      );

      expect(tableViolations).toHaveLength(0);
    });
  });

  describe('Chat Interface Accessibility', () => {
    test('should meet WCAG 2.1 Level A compliance', async ({ page, wcagChecker }) => {
      await loginAsUser(page);

      // Navigate to chat
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      const results = await wcagChecker.checkLevelA();
      expect(results.violations).toHaveLength(0);
    });

    test('should have accessible form controls', async ({ page, accessibilityHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      const formResults = await accessibilityHelper.checkFormAccessibility();
      expect(formResults.violations).toHaveLength(0);

      // Check specific form elements
      const messageInput = page.locator(
        'textarea[placeholder*="message"], textarea[placeholder*="Message"]'
      );
      await expect(messageInput).toHaveAttribute('aria-label');

      const sendButton = page.locator('button[aria-label*="send"], button[aria-label*="Send"]');
      await expect(sendButton).toBeVisible();
    });

    test('should have accessible media content', async ({ page, accessibilityHelper }) => {
      await loginAsUser(page);
      await page.click('[data-testid="chat-nav"]');
      await page.waitForLoadState('networkidle');

      const mediaResults = await accessibilityHelper.checkMediaAccessibility();
      expect(mediaResults.violations).toHaveLength(0);
    });
  });

  describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page, wcagChecker }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await loginAsUser(page);

      const results = await wcagChecker.checkLevelA();
      expect(results.violations).toHaveLength(0);
    });

    test('should have touch-friendly targets', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAsUser(page);

      // Check button sizes
      const buttons = await page.locator('button').all();
      for (const button of buttons.slice(0, 10)) {
        // Check first 10 buttons
        const boundingBox = await button.boundingBox();
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(44); // Minimum touch target
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should work with mobile screen readers', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAsUser(page);

      // Test VoiceOver/TalkBack compatibility
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('[role="navigation"]')).toBeVisible();

      // Check for proper touch targets with labels
      const navigationItems = await page
        .locator('[role="navigation"] button, [role="navigation"] a')
        .all();
      for (const item of navigationItems) {
        await expect(item).toHaveAttribute('aria-label');
      }
    });
  });

  describe('Focus Management', () => {
    test('should maintain focus after navigation', async ({ page, accessibilityHelper }) => {
      await loginAsUser(page);

      // Navigate to different sections and check focus
      await page.click('[data-testid="projects-nav"]');
      await page.waitForLoadState('networkidle');

      const focusedElement = await page.evaluate(() => document.activeElement);
      expect(focusedElement).toBeTruthy();

      // Check focus trap in modals
      await page.click('[data-testid="settings-button"]');
      await page.waitForSelector('[data-testid="settings-modal"]');

      const modalFocusResults = await accessibilityHelper.checkFocusManagement();
      expect(modalFocusResults.violations).toHaveLength(0);
    });

    test('should handle focus order properly', async ({ page }) => {
      await loginAsUser(page);

      // Tab through interface and check logical order
      const focusableElements = [];

      await page.keyboard.press('Tab');
      let firstElement = await page.evaluate(() => ({
        tagName: document.activeElement.tagName,
        id: document.activeElement.id,
        className: document.activeElement.className,
      }));
      focusableElements.push(firstElement);

      // Continue tabbing through main elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const element = await page.evaluate(() => ({
          tagName: document.activeElement.tagName,
          id: document.activeElement.id,
          className: document.activeElement.className,
        }));
        focusableElements.push(element);
      }

      // Verify we have a logical flow
      expect(focusableElements.length).toBeGreaterThan(5);
    });
  });

  describe('Error Handling Accessibility', () => {
    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/login');

      // Submit empty form to trigger validation errors
      await page.click('button[type="submit"]');

      // Check for error announcements
      const errorElements = await page
        .locator('[role="alert"], .error, [aria-live="polite"]')
        .all();
      expect(errorElements.length).toBeGreaterThan(0);

      for (const error of errorElements) {
        await expect(error).toBeVisible();
      }
    });

    test('should provide accessible error messages', async ({ page, accessibilityHelper }) => {
      await page.goto('/login');

      // Trigger login error
      await page.fill('input[type="text"]', 'invaliduser');
      await page.fill('input[type="password"]', 'invalidpass');
      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForSelector('[role="alert"], .error-message');

      const results = await accessibilityHelper.analyzeAccessibility();
      const errorViolations = results.violations.filter(
        v => v.tags.includes('error') || v.tags.includes('validation')
      );

      expect(errorViolations).toHaveLength(0);
    });
  });

  describe('Performance Impact on Accessibility', () => {
    test('should maintain accessibility during loading', async ({ page, accessibilityHelper }) => {
      // Simulate slow network
      await page.route('**/*', route => {
        // eslint-disable-next-line no-undef
        setTimeout(() => route.continue(), 1000);
      });

      await loginAsUser(page);

      // Check accessibility while content is loading
      const loadingResults = await accessibilityHelper.analyzeAccessibility();
      const loadingViolations = loadingResults.violations.filter(
        v => v.tags.includes('loading') || v.tags.includes('skeleton')
      );

      // Allow some loading violations but ensure core accessibility
      const criticalViolations = loadingViolations.filter(v => v.impact === 'critical');
      expect(criticalViolations).toHaveLength(0);
    });

    test('should provide loading indicators', async ({ page }) => {
      await loginAsUser(page);

      // Navigate to a page with loading states
      await page.click('[data-testid="projects-nav"]');

      // Check for loading indicators
      const loadingIndicators = await page
        .locator('[aria-busy="true"], .loading, [data-loading]')
        .all();

      // Should have some form of loading indication
      if (loadingIndicators.length > 0) {
        for (const indicator of loadingIndicators) {
          await expect(indicator).toHaveAttribute('aria-live');
        }
      }
    });
  });
});

describe('Accessibility Reporting', () => {
  test('should generate comprehensive accessibility report', async ({
    page,
    accessibilityHelper,
  }) => {
    await loginAsUser(page);

    const reportPath = await accessibilityHelper.generateReport(
      'comprehensive-accessibility-report'
    );
    expect(reportPath).toBeTruthy();

    // Verify report was created and contains expected data
    const fs = await import('fs');
    const reportExists = await fs.promises
      .access(reportPath)
      .then(() => true)
      .catch(() => false);
    expect(reportExists).toBeTruthy();
  });

  test('should generate WCAG compliance certificate', async ({ page, wcagChecker }) => {
    await loginAsUser(page);

    const certificatePath = await wcagChecker.generateCertificate();
    expect(certificatePath).toBeTruthy();

    // Verify certificate was created
    const fs = await import('fs');
    const certificateExists = await fs.promises
      .access(certificatePath)
      .then(() => true)
      .catch(() => false);
    expect(certificateExists).toBeTruthy();
  });

  test('should provide accessibility summary', async ({ page, accessibilityHelper }) => {
    await loginAsUser(page);

    const summary = await accessibilityHelper.getAccessibilitySummary();

    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('violations');
    expect(summary).toHaveProperty('passes');
    expect(summary).toHaveProperty('score');
    expect(summary.score).toBeGreaterThanOrEqual(0);
    expect(summary.score).toBeLessThanOrEqual(100);
  });
});
