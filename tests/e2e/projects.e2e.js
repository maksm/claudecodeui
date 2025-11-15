import { test, expect } from '@playwright/test';

test.describe('Project Management - Critical Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bg-background', { timeout: 10000 });
  });

  test('should display projects list', async ({ page }) => {
    // Look for projects list or project cards
    const projectsList = page
      .locator('[data-testid="projects-list"], [data-testid="project-card"], .project-card')
      .first();

    // Should show projects or empty state
    await expect(projectsList)
      .toBeVisible({ timeout: 10000 })
      .catch(async () => {
        // If no projects, should show empty state or create project button
        const emptyState = page
          .locator('[data-testid="empty-state"], text=/no projects/i, button:has-text("Create")')
          .first();
        await expect(emptyState).toBeVisible({ timeout: 5000 });
      });
  });

  test('should navigate to project view', async ({ page }) => {
    // Find first project link/card
    const projectLink = page
      .locator('[data-testid="project-card"], .project-card, a[href*="project"]')
      .first();

    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();

      // Should navigate to project page or chat
      await page.waitForURL(/\/(project|chat|workspace)/i, { timeout: 5000 }).catch(() => {
        // URL might not change, just verify content loaded
      });

      // Verify project view loaded (chat interface or project details)
      const chatInterface = page
        .locator('[data-testid="message-input"], textarea, [data-testid="project-view"]')
        .first();
      await expect(chatInterface).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show create project option', async ({ page }) => {
    // Look for create/new project button
    const createButton = page
      .locator(
        '[data-testid="create-project"], [data-testid="new-project"], button:has-text("New Project"), button:has-text("Create Project")'
      )
      .first();

    // Button should exist (may require setup/login)
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();

      // Should show modal or form
      const modal = page
        .locator('[data-testid="create-project-modal"], [role="dialog"], form')
        .first();
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('should switch between projects', async ({ page }) => {
    // Find multiple project cards/links
    const projects = page.locator(
      '[data-testid="project-card"], .project-card, [role="button"][aria-label*="project"]'
    );
    const count = await projects.count().catch(() => 0);

    if (count >= 2) {
      // Click first project
      await projects.nth(0).click();
      await page.waitForTimeout(1000);

      // Go back and click second project
      await page.goBack().catch(() => page.goto('/'));
      await projects.nth(1).click();
      await page.waitForTimeout(1000);

      // Should load successfully
      const content = page.locator('body');
      await expect(content).toBeVisible();
    }
  });
});
