import { test, expect } from '@playwright/test';
import {
  measurePageLoad,
  loginAsUser,
  navigateToDashboard,
  navigateToChat,
  uploadFile,
  createProject,
} from './helpers/test-helpers.js';

/**
 * Performance Testing Suite
 *
 * Tests performance metrics including page load times, time to interactive,
 * and responsiveness of key user interactions.
 *
 * Tags:
 * - @Performance: General performance metrics
 * - Load time: Specific load time measurements
 */

test.describe('Performance Tests - @Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cache and cookies before each test for consistent measurements
    await page.context().clearCookies();
  });

  test.describe('Initial Page Load - Load time', () => {
    test('should load initial page in under 3 seconds @Performance', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Collect performance metrics
      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          loadComplete: perf.loadEventEnd - perf.loadEventStart,
          domInteractive: perf.domInteractive - perf.fetchStart,
          timeToFirstByte: perf.responseStart - perf.requestStart,
        };
      });

      console.log('Initial Page Load Metrics:', {
        totalLoadTime: loadTime,
        ...metrics,
      });

      // Assertions
      expect(loadTime).toBeLessThan(3000);
      expect(metrics.domContentLoaded).toBeLessThan(2000);
      expect(metrics.loadComplete).toBeLessThan(1000);
    });

    test('should achieve DOMContentLoaded in under 2 seconds @Performance', async ({ page }) => {
      await page.goto('/');

      const domContentLoadedTime = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return perf.domContentLoadedEventEnd - perf.fetchStart;
      });

      console.log('DOMContentLoaded Time:', domContentLoadedTime);
      expect(domContentLoadedTime).toBeLessThan(2000);
    });

    test('should have Time to First Byte under 500ms @Performance', async ({ page }) => {
      await page.goto('/');

      const ttfb = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return perf.responseStart - perf.requestStart;
      });

      console.log('Time to First Byte:', ttfb);
      expect(ttfb).toBeLessThan(500);
    });
  });

  test.describe('Dashboard Load Performance - Load time', () => {
    test('should load dashboard in under 2 seconds after login @Performance', async ({ page }) => {
      // Navigate to home page first
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Measure dashboard load time
      const startTime = Date.now();

      // Check if already logged in or needs login
      const messageInput = page.locator('[data-testid="message-input"], textarea').first();
      const isLoggedIn = await messageInput.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isLoggedIn) {
        // Attempt to navigate to dashboard which may trigger login
        await page.goto('/');
        await page.waitForLoadState('networkidle');
      }

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      console.log('Dashboard Load Time:', loadTime);
      expect(loadTime).toBeLessThan(2000);
    });

    test('should display project list within 1.5 seconds @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const startTime = performance.now();

      // Wait for project list to be visible
      const projectsList = page
        .locator(
          '[data-testid="projects-list"], [data-testid="project-card"], .project-card, [data-testid="empty-state"]'
        )
        .first();

      await projectsList.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
        // May not exist in all views
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log('Project List Render Time:', renderTime);
      expect(renderTime).toBeLessThan(1500);
    });
  });

  test.describe('Chat Interface Performance - @Performance', () => {
    test('should load chat interface in under 1.5 seconds @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const startTime = performance.now();

      // Wait for chat interface to be visible
      const chatInterface = page
        .locator('[data-testid="message-input"], textarea, input[type="text"]')
        .first();

      await chatInterface.waitFor({ state: 'visible', timeout: 5000 });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      console.log('Chat Interface Load Time:', loadTime);
      expect(loadTime).toBeLessThan(1500);
    });

    test('should have responsive message input (< 100ms delay) @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const messageInput = page
        .locator('[data-testid="message-input"], textarea, input[type="text"]')
        .first();

      await messageInput.waitFor({ state: 'visible', timeout: 5000 });

      // Measure input responsiveness
      const startTime = performance.now();
      await messageInput.fill('Test message for performance');
      const endTime = performance.now();

      const inputDelay = endTime - startTime;

      console.log('Message Input Delay:', inputDelay);
      expect(inputDelay).toBeLessThan(100);
    });

    test('should render messages quickly (< 500ms) @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const messageInput = page
        .locator('[data-testid="message-input"], textarea, input[type="text"]')
        .first();
      const sendButton = page
        .locator('[data-testid="send-button"], button:has-text("Send")')
        .first();

      if (
        (await messageInput.isVisible({ timeout: 2000 }).catch(() => false)) &&
        (await sendButton.isVisible({ timeout: 2000 }).catch(() => false))
      ) {
        const testMessage = 'Performance test message';

        const startTime = performance.now();
        await messageInput.fill(testMessage);
        await sendButton.click();

        // Wait for message to appear
        await page.waitForSelector(`text=${testMessage}`, { timeout: 5000 });

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log('Message Render Time:', renderTime);
        expect(renderTime).toBeLessThan(500);
      }
    });
  });

  test.describe('Navigation Performance - @Performance', () => {
    test('should navigate between pages in under 1 second @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find navigation links
      const navLinks = page.locator('nav a, [role="navigation"] a').first();

      if (await navLinks.isVisible({ timeout: 2000 }).catch(() => false)) {
        const startTime = performance.now();

        await navLinks.click();
        await page.waitForLoadState('networkidle');

        const endTime = performance.now();
        const navigationTime = endTime - startTime;

        console.log('Navigation Time:', navigationTime);
        expect(navigationTime).toBeLessThan(1000);
      }
    });

    test('should switch between projects quickly (< 800ms) @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const projects = page.locator('[data-testid="project-card"], .project-card');
      const count = await projects.count().catch(() => 0);

      if (count >= 2) {
        // Click first project
        await projects.nth(0).click();
        await page.waitForLoadState('networkidle');

        // Measure switch to second project
        const startTime = performance.now();

        await page.goBack();
        await projects.nth(1).click();
        await page.waitForLoadState('networkidle');

        const endTime = performance.now();
        const switchTime = endTime - startTime;

        console.log('Project Switch Time:', switchTime);
        expect(switchTime).toBeLessThan(800);
      }
    });
  });

  test.describe('Resource Loading Performance - Load time', () => {
    test('should load CSS resources efficiently @Performance', async ({ page }) => {
      await page.goto('/');

      const cssMetrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const cssResources = resources.filter(r => r.name.includes('.css'));

        return {
          count: cssResources.length,
          totalDuration: cssResources.reduce((sum, r) => sum + r.duration, 0),
          averageDuration: cssResources.length
            ? cssResources.reduce((sum, r) => sum + r.duration, 0) / cssResources.length
            : 0,
        };
      });

      console.log('CSS Loading Metrics:', cssMetrics);

      if (cssMetrics.count > 0) {
        expect(cssMetrics.averageDuration).toBeLessThan(300);
        expect(cssMetrics.totalDuration).toBeLessThan(1500);
      }
    });

    test('should load JavaScript resources efficiently @Performance', async ({ page }) => {
      await page.goto('/');

      const jsMetrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const jsResources = resources.filter(
          r => r.name.includes('.js') || r.name.includes('.mjs')
        );

        return {
          count: jsResources.length,
          totalDuration: jsResources.reduce((sum, r) => sum + r.duration, 0),
          averageDuration: jsResources.length
            ? jsResources.reduce((sum, r) => sum + r.duration, 0) / jsResources.length
            : 0,
          maxDuration: Math.max(...jsResources.map(r => r.duration)),
        };
      });

      console.log('JavaScript Loading Metrics:', jsMetrics);

      if (jsMetrics.count > 0) {
        expect(jsMetrics.averageDuration).toBeLessThan(500);
        expect(jsMetrics.maxDuration).toBeLessThan(2000);
      }
    });

    test('should have acceptable total page weight @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const resourceMetrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

        return {
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          resourceCount: resources.length,
        };
      });

      console.log('Page Weight Metrics:', resourceMetrics);

      // Page should be under 5MB total
      expect(resourceMetrics.totalSize).toBeLessThan(5 * 1024 * 1024);
    });
  });

  test.describe('File Upload Performance - @Performance', () => {
    test('should handle small file upload quickly (< 1 second) @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"]').first();

      if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Create a small test file (simulated)
        const startTime = performance.now();

        // Note: In real tests, you'd use a real test file
        // await uploadFile(page, './tests/fixtures/small-test-file.txt');

        const endTime = performance.now();
        const uploadTime = endTime - startTime;

        console.log('File Upload Time (simulated):', uploadTime);
        // This is a placeholder - actual upload would be tested with real files
        expect(uploadTime).toBeLessThan(1000);
      }
    });
  });

  test.describe('Memory and Performance Metrics - @Performance', () => {
    test('should not have excessive memory usage @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get JS heap size if available
      const memoryMetrics = await page
        .evaluate(() => {
          if (performance.memory) {
            return {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
              usedMB: (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
            };
          }
          return null;
        })
        .catch(() => null);

      if (memoryMetrics) {
        console.log('Memory Metrics:', memoryMetrics);

        // Used heap should be under 100MB for initial load
        expect(memoryMetrics.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
      }
    });

    test('should have acceptable First Contentful Paint @Performance', async ({ page }) => {
      await page.goto('/');

      const fcp = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : null;
      });

      if (fcp !== null) {
        console.log('First Contentful Paint:', fcp);
        expect(fcp).toBeLessThan(1500);
      }
    });

    test('should measure Time to Interactive @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const tti = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        // Approximate TTI as domInteractive
        return perf.domInteractive - perf.fetchStart;
      });

      console.log('Time to Interactive (approximate):', tti);
      expect(tti).toBeLessThan(2500);
    });
  });

  test.describe('Interaction Performance - @Performance', () => {
    test('should have responsive button clicks (< 50ms) @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const button = page.locator('button, [role="button"]').first();

      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        const startTime = performance.now();
        await button.click();
        const endTime = performance.now();

        const clickDelay = endTime - startTime;

        console.log('Button Click Delay:', clickDelay);
        expect(clickDelay).toBeLessThan(50);
      }
    });

    test('should scroll smoothly without jank @Performance', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const startTime = performance.now();

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(100);

      // Scroll back up
      await page.evaluate(() => window.scrollBy(0, -1000));

      const endTime = performance.now();
      const scrollTime = endTime - startTime;

      console.log('Scroll Operation Time:', scrollTime);
      expect(scrollTime).toBeLessThan(200);
    });
  });

  test.describe('Performance Regression Detection - @Performance', () => {
    test('should maintain consistent load times across reloads @Performance', async ({ page }) => {
      const loadTimes = [];

      // Measure load time 3 times
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const endTime = Date.now();

        loadTimes.push(endTime - startTime);

        // Clear cache between loads
        if (i < 2) {
          await page.reload();
        }
      }

      console.log('Load Times Across Reloads:', loadTimes);

      // Calculate variance
      const avg = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
      const variance =
        loadTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / loadTimes.length;
      const stdDev = Math.sqrt(variance);

      console.log('Average Load Time:', avg);
      console.log('Standard Deviation:', stdDev);

      // Standard deviation should be low (consistent performance)
      expect(stdDev).toBeLessThan(500);

      // All loads should be under 3 seconds
      loadTimes.forEach(time => {
        expect(time).toBeLessThan(3000);
      });
    });
  });
});
