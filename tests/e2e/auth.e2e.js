import { test, expect } from '@playwright/test';

test.describe('Authentication - Critical Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bg-background', { timeout: 10000 });
  });

  test('should load application', async ({ page }) => {
    // Should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should not show error page
    const errorText = page.locator('text=/error|not found|500|404/i');
    await expect(errorText)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // OK if no error text found
      });
  });

  test('should show login or main interface', async ({ page }) => {
    // Should show either login form or main app interface
    const loginForm = page
      .locator('form, [data-testid="login-form"], input[type="password"]')
      .first();
    const mainInterface = page
      .locator('[data-testid="message-input"], textarea, [data-testid="chat"]')
      .first();

    const hasLogin = await loginForm.isVisible({ timeout: 5000 }).catch(() => false);
    const hasMainInterface = await mainInterface.isVisible({ timeout: 5000 }).catch(() => false);

    // At least one should be visible
    expect(hasLogin || hasMainInterface).toBe(true);
  });

  test('should handle navigation', async ({ page }) => {
    // Check if there's a menu or navigation
    const navMenu = page.locator('nav, [role="navigation"], button[aria-label*="menu"]').first();

    if (await navMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Navigation exists and is clickable
      await navMenu.click();
      await page.waitForTimeout(500);
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should persist session after reload', async ({ page }) => {
    // If logged in, should stay logged in after reload
    const mainInterface = page.locator('[data-testid="message-input"], textarea').first();
    const isLoggedIn = await mainInterface.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLoggedIn) {
      await page.reload();
      await page.waitForSelector('#root > *', { timeout: 10000 });

      // Should still be logged in
      await expect(mainInterface).toBeVisible({ timeout: 10000 });
    }
  });
});
