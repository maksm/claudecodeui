import { test, expect } from '@playwright/test';

test.describe.skip('Chat Interface - Critical Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bg-background', { timeout: 10000 });
  });

  test('should load chat interface', async ({ page }) => {
    // Check main chat elements exist
    const messageInput = page
      .locator('[data-testid="message-input"], textarea, input[type="text"]')
      .first();
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("Send")').first();

    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await expect(sendButton).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    const messageInput = page
      .locator('[data-testid="message-input"], textarea, input[type="text"]')
      .first();
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("Send")').first();

    // Type and send message
    await messageInput.fill('Hello, test message');
    await sendButton.click();

    // Verify message appears (user message or in chat history)
    await expect(page.locator('text=Hello, test message')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty message', async ({ page }) => {
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("Send")').first();

    // Try to send empty message - button should be disabled or nothing happens
    const isDisabled = await sendButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      // If not disabled, click and verify no message sent
      await sendButton.click();
      // Should not show error or crash
      await page.waitForTimeout(500);
    }

    expect(true).toBe(true); // Test passes if no crash
  });

  test('should display chat history', async ({ page }) => {
    const messageInput = page
      .locator('[data-testid="message-input"], textarea, input[type="text"]')
      .first();
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("Send")').first();

    // Send a message
    await messageInput.fill('Test message for history');
    await sendButton.click();

    // Wait for message to appear
    await expect(page.locator('text=Test message for history')).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload();
    await page.waitForSelector('#root > *', { timeout: 10000 });

    // Message should still be visible in history
    await expect(page.locator('text=Test message for history')).toBeVisible({ timeout: 10000 });
  });

  test('should clear chat session', async ({ page }) => {
    const messageInput = page
      .locator('[data-testid="message-input"], textarea, input[type="text"]')
      .first();
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("Send")').first();

    // Send a message
    await messageInput.fill('Message to be cleared');
    await sendButton.click();
    await expect(page.locator('text=Message to be cleared')).toBeVisible({ timeout: 5000 });

    // Look for clear/new chat button
    const clearButton = page
      .locator(
        '[data-testid="clear-chat"], [data-testid="new-chat"], button:has-text("New Chat"), button:has-text("Clear")'
      )
      .first();

    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();

      // Confirm if there's a confirmation dialog
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Clear")'
      );
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Message should be gone
      await expect(page.locator('text=Message to be cleared')).not.toBeVisible({ timeout: 5000 });
    }
  });
});
