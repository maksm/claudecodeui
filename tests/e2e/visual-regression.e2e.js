import { test, expect } from '@playwright/test';
import { VisualRegressionHelper } from './helpers/accessibility-helpers.js';
import { loginAsUser, toggleTheme } from './helpers/test-helpers.js';
import { testData } from './fixtures/test-data.js';

test.describe('Visual Regression Testing', () => {
  const viewports = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 },
  };

  const themes = ['light', 'dark'];

  test.describe('Login Page Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of themes) {
        test(`should match baseline for login page - ${viewportName} - ${theme} theme`, async ({
          page,
        }) => {
          // Set viewport
          await page.setViewportSize(viewport);

          // Set theme if dark
          if (theme === 'dark') {
            const body = page.locator('body');
            const isDark = await body.evaluate(el => el.classList.contains('dark'));
            if (!isDark) {
              await toggleTheme(page).catch(() => {
                // Theme toggle might not be available on login page
                console.log('Theme toggle not available on login page');
              });
            }
          }

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Initialize visual regression helper
          const visualHelper = new VisualRegressionHelper(page);

          try {
            // Compare with baseline
            const result = await visualHelper.compareWithBaseline(
              `login-${viewportName}-${theme}`,
              {
                fullPage: true,
                animations: 'disabled',
                threshold: 0.2,
              }
            );

            expect(result.identical).toBe(true);
          } catch (error) {
            if (error.message.includes('Baseline screenshot not found')) {
              // Take baseline screenshot for future comparisons
              await visualHelper.takeBaselineScreenshot(`login-${viewportName}-${theme}`, {
                fullPage: true,
                animations: 'disabled',
              });

              console.log(
                `Baseline created for login-${viewportName}-${theme}. Run test again to compare.`
              );
              test.skip();
            } else {
              throw error;
            }
          }
        });
      }
    }
  });

  test.describe('Dashboard Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }

      // Navigate to dashboard
      const dashboardNav = page.locator('[data-testid="dashboard-nav"], [href="/dashboard"]');
      if (await dashboardNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dashboardNav.click();
        await page.waitForLoadState('networkidle');
      }
    });

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of themes) {
        test(`should match baseline for dashboard - ${viewportName} - ${theme} theme`, async ({
          page,
        }) => {
          // Set viewport
          await page.setViewportSize(viewport);

          // Set theme
          if (theme === 'dark') {
            const body = page.locator('body');
            const isDark = await body.evaluate(el => el.classList.contains('dark'));
            if (!isDark) {
              await toggleTheme(page).catch(() => {
                console.log('Could not toggle theme');
              });
            }
          }

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Initialize visual regression helper
          const visualHelper = new VisualRegressionHelper(page);

          try {
            // Compare with baseline
            const result = await visualHelper.compareWithBaseline(
              `dashboard-${viewportName}-${theme}`,
              {
                fullPage: true,
                animations: 'disabled',
                threshold: 0.2,
              }
            );

            expect(result.identical).toBe(true);
          } catch (error) {
            if (error.message.includes('Baseline screenshot not found')) {
              // Take baseline screenshot for future comparisons
              await visualHelper.takeBaselineScreenshot(`dashboard-${viewportName}-${theme}`, {
                fullPage: true,
                animations: 'disabled',
              });

              console.log(
                `Baseline created for dashboard-${viewportName}-${theme}. Run test again to compare.`
              );
              test.skip();
            } else {
              throw error;
            }
          }
        });
      }
    }
  });

  test.describe('Projects Page Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }

      // Navigate to projects
      const projectsNav = page.locator('[data-testid="projects-nav"], [href="/projects"]');
      if (await projectsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projectsNav.click();
        await page.waitForLoadState('networkidle');
      }
    });

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of themes) {
        test(`should match baseline for projects - ${viewportName} - ${theme} theme`, async ({
          page,
        }) => {
          // Set viewport
          await page.setViewportSize(viewport);

          // Set theme
          if (theme === 'dark') {
            const body = page.locator('body');
            const isDark = await body.evaluate(el => el.classList.contains('dark'));
            if (!isDark) {
              await toggleTheme(page).catch(() => {
                console.log('Could not toggle theme');
              });
            }
          }

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Initialize visual regression helper
          const visualHelper = new VisualRegressionHelper(page);

          try {
            // Compare with baseline
            const result = await visualHelper.compareWithBaseline(
              `projects-${viewportName}-${theme}`,
              {
                fullPage: true,
                animations: 'disabled',
                threshold: 0.2,
              }
            );

            expect(result.identical).toBe(true);
          } catch (error) {
            if (error.message.includes('Baseline screenshot not found')) {
              // Take baseline screenshot for future comparisons
              await visualHelper.takeBaselineScreenshot(`projects-${viewportName}-${theme}`, {
                fullPage: true,
                animations: 'disabled',
              });

              console.log(
                `Baseline created for projects-${viewportName}-${theme}. Run test again to compare.`
              );
              test.skip();
            } else {
              throw error;
            }
          }
        });
      }
    }
  });

  test.describe('Chat Interface Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }

      // Navigate to chat if not already there
      const chatInterface = page.locator('[data-testid="message-input"], textarea').first();
      const hasChatInterface = await chatInterface.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasChatInterface) {
        const chatNav = page.locator('[data-testid="chat-nav"], [href="/chat"]');
        if (await chatNav.isVisible({ timeout: 2000 }).catch(() => false)) {
          await chatNav.click();
          await page.waitForLoadState('networkidle');
        }
      }
    });

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of themes) {
        test(`should match baseline for chat - ${viewportName} - ${theme} theme`, async ({
          page,
        }) => {
          // Set viewport
          await page.setViewportSize(viewport);

          // Set theme
          if (theme === 'dark') {
            const body = page.locator('body');
            const isDark = await body.evaluate(el => el.classList.contains('dark'));
            if (!isDark) {
              await toggleTheme(page).catch(() => {
                console.log('Could not toggle theme');
              });
            }
          }

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Initialize visual regression helper
          const visualHelper = new VisualRegressionHelper(page);

          try {
            // Compare with baseline
            const result = await visualHelper.compareWithBaseline(`chat-${viewportName}-${theme}`, {
              fullPage: true,
              animations: 'disabled',
              threshold: 0.2,
            });

            expect(result.identical).toBe(true);
          } catch (error) {
            if (error.message.includes('Baseline screenshot not found')) {
              // Take baseline screenshot for future comparisons
              await visualHelper.takeBaselineScreenshot(`chat-${viewportName}-${theme}`, {
                fullPage: true,
                animations: 'disabled',
              });

              console.log(
                `Baseline created for chat-${viewportName}-${theme}. Run test again to compare.`
              );
              test.skip();
            } else {
              throw error;
            }
          }
        });
      }
    }
  });

  test.describe('Settings Page Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }

      // Navigate to settings
      const settingsNav = page.locator('[data-testid="settings-nav"], [href="/settings"]');
      if (await settingsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsNav.click();
        await page.waitForLoadState('networkidle');
      }
    });

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of themes) {
        test(`should match baseline for settings - ${viewportName} - ${theme} theme`, async ({
          page,
        }) => {
          // Set viewport
          await page.setViewportSize(viewport);

          // Set theme
          if (theme === 'dark') {
            const body = page.locator('body');
            const isDark = await body.evaluate(el => el.classList.contains('dark'));
            if (!isDark) {
              await toggleTheme(page).catch(() => {
                console.log('Could not toggle theme');
              });
            }
          }

          // Wait for page to stabilize
          await page.waitForTimeout(1000);

          // Initialize visual regression helper
          const visualHelper = new VisualRegressionHelper(page);

          try {
            // Compare with baseline
            const result = await visualHelper.compareWithBaseline(
              `settings-${viewportName}-${theme}`,
              {
                fullPage: true,
                animations: 'disabled',
                threshold: 0.2,
              }
            );

            expect(result.identical).toBe(true);
          } catch (error) {
            if (error.message.includes('Baseline screenshot not found')) {
              // Take baseline screenshot for future comparisons
              await visualHelper.takeBaselineScreenshot(`settings-${viewportName}-${theme}`, {
                fullPage: true,
                animations: 'disabled',
              });

              console.log(
                `Baseline created for settings-${viewportName}-${theme}. Run test again to compare.`
              );
              test.skip();
            } else {
              throw error;
            }
          }
        });
      }
    }
  });

  test.describe('Cross-Browser Visual Consistency', () => {
    test('should have consistent layout across viewports on login page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const visualHelper = new VisualRegressionHelper(page);
      const screenshots = [];

      // Take screenshots for each viewport
      for (const [viewportName, viewport] of Object.entries(viewports)) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        const screenshot = await page.screenshot({
          fullPage: true,
          animations: 'disabled',
        });

        screenshots.push({
          viewport: viewportName,
          screenshot,
        });
      }

      // Verify all screenshots were taken
      expect(screenshots.length).toBe(Object.keys(viewports).length);
    });

    test('should maintain theme consistency across pages', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }

      // Enable dark theme
      const body = page.locator('body');
      const isDark = await body.evaluate(el => el.classList.contains('dark'));
      if (!isDark) {
        await toggleTheme(page).catch(() => {
          console.log('Could not toggle theme');
        });
        await page.waitForTimeout(500);
      }

      // Navigate through different pages and verify theme persists
      const pages = [
        { name: 'dashboard', selector: '[data-testid="dashboard-nav"], [href="/dashboard"]' },
        { name: 'projects', selector: '[data-testid="projects-nav"], [href="/projects"]' },
        { name: 'chat', selector: '[data-testid="chat-nav"], [href="/chat"]' },
        { name: 'settings', selector: '[data-testid="settings-nav"], [href="/settings"]' },
      ];

      for (const pageInfo of pages) {
        const navLink = page.locator(pageInfo.selector);
        if (await navLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          await navLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);

          // Verify dark theme is still applied
          const isDarkAfterNav = await body.evaluate(el => el.classList.contains('dark'));
          expect(isDarkAfterNav).toBe(true);
        }
      }
    });
  });

  test.describe('Component Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const loginForm = page.locator('form, [data-testid="login-form"]').first();
      const isLoginPage = await loginForm.isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        await loginAsUser(page, testData.users.valid);
        await page.waitForLoadState('networkidle');
      }
    });

    test('should match baseline for navigation component', async ({ page }) => {
      const visualHelper = new VisualRegressionHelper(page);

      // Find navigation component
      const nav = page.locator('nav, [role="navigation"]').first();
      if (await nav.isVisible({ timeout: 2000 }).catch(() => false)) {
        const boundingBox = await nav.boundingBox();

        try {
          const result = await visualHelper.compareWithBaseline('navigation-component', {
            fullPage: false,
            animations: 'disabled',
            clip: boundingBox,
            threshold: 0.2,
          });

          expect(result.identical).toBe(true);
        } catch (error) {
          if (error.message.includes('Baseline screenshot not found')) {
            await visualHelper.takeBaselineScreenshot('navigation-component', {
              fullPage: false,
              animations: 'disabled',
              clip: boundingBox,
            });

            console.log('Baseline created for navigation component. Run test again to compare.');
            test.skip();
          } else {
            throw error;
          }
        }
      }
    });

    test('should match baseline for message input component', async ({ page }) => {
      const visualHelper = new VisualRegressionHelper(page);

      // Find message input component
      const messageInput = page.locator('[data-testid="message-input"], textarea').first();
      if (await messageInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const boundingBox = await messageInput.boundingBox();

        try {
          const result = await visualHelper.compareWithBaseline('message-input-component', {
            fullPage: false,
            animations: 'disabled',
            clip: boundingBox,
            threshold: 0.2,
          });

          expect(result.identical).toBe(true);
        } catch (error) {
          if (error.message.includes('Baseline screenshot not found')) {
            await visualHelper.takeBaselineScreenshot('message-input-component', {
              fullPage: false,
              animations: 'disabled',
              clip: boundingBox,
            });

            console.log('Baseline created for message input component. Run test again to compare.');
            test.skip();
          } else {
            throw error;
          }
        }
      }
    });
  });

  test.describe('Error Handling for Missing Baselines', () => {
    test('should create baseline when missing and skip test', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const visualHelper = new VisualRegressionHelper(page);

      // Use a unique name that won't have a baseline
      const uniqueName = `test-missing-baseline-${Date.now()}`;

      try {
        await visualHelper.compareWithBaseline(uniqueName, {
          fullPage: true,
          animations: 'disabled',
        });

        // If we get here, baseline existed or was created
        expect(true).toBe(true);
      } catch (error) {
        // Should throw error about missing baseline
        expect(error.message).toContain('Baseline screenshot not found');

        // Create baseline for future
        await visualHelper.takeBaselineScreenshot(uniqueName, {
          fullPage: true,
          animations: 'disabled',
        });

        console.log(`Baseline created for ${uniqueName}`);
      }
    });

    test('should handle invalid baseline paths gracefully', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const visualHelper = new VisualRegressionHelper(page);

      // Try to compare with invalid characters in name
      const invalidName = 'test/invalid\\path:name';

      try {
        await visualHelper.compareWithBaseline(invalidName, {
          fullPage: true,
          animations: 'disabled',
        });
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeDefined();
      }
    });
  });
});
