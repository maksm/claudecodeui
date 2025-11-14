/* eslint-disable no-undef */
import { test, expect, describe } from '@playwright/test';
import ChatInterfacePage from './pages/ChatInterfacePage.js';
import LoginPage from './pages/LoginPage.js';
import { testData } from './fixtures/test-data.js';
import {
  loginAsUser,
  navigateToChat,
  sendMessage,
  sendMultipleMessages,
  cleanupTestData
} from './helpers/test-helpers.js';

describe('Chat Interface E2E Tests', () => {
  let chatPage;
  let loginPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatInterfacePage(page);
    loginPage = new LoginPage(page);
    await cleanupTestData(page);
    await loginAsUser(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  describe('Chat Interface Loading', () => {
    test('should load chat interface correctly', async ({ page }) => {
      await navigateToChat(page);
      await chatPage.expectChatInterfaceLoaded();

      // Check all main elements are present
      await chatPage.expectElementToBeVisible(chatPage.messageInput);
      await chatPage.expectElementToBeVisible(chatPage.sendButton);
      await chatPage.expectElementToBeVisible(chatPage.messagesList);
    });

    test('should show connection status', async ({ page }) => {
      await navigateToChat(page);

      // Should show connected status
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible();
      await expect(connectionStatus).toContainText('Connected');
    });

    test('should display model selector', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.expectElementToBeVisible(chatPage.modelSelector);

      // Should show default model
      const selectedModel = await chatPage.getSelectedModel();
      expect(selectedModel).toBeTruthy();
    });
  });

  describe('Message Sending and Receiving', () => {
    test('should send a message successfully', async ({ page }) => {
      await navigateToChat(page);

      const testMessage = 'Hello, this is a test message';
      await chatPage.sendMessage(testMessage);

      // Should show user message
      await chatPage.expectMessagesToContain(testMessage);

      // Should receive AI response
      await chatPage.expectTypingIndicator();
      await chatPage.expectNoTypingIndicator();

      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage).toBeTruthy();
      expect(lastMessage).not.toBe(testMessage); // Should be AI response
    });

    test('should send message using Enter key', async ({ page }) => {
      await navigateToChat(page);

      const testMessage = 'Test message with Enter key';
      await chatPage.sendMessageUsingKeyboard(testMessage);

      // Should show message in chat
      await chatPage.expectMessagesToContain(testMessage);

      // Should receive response
      await chatPage.waitForResponse();
    });

    test('should send multiple messages in sequence', async ({ page }) => {
      await navigateToChat(page);

      const messages = [
        'First message',
        'Second message',
        'Third message'
      ];

      await sendMultipleMessages(page, messages);

      // Should show all user messages
      for (const message of messages) {
        await chatPage.expectMessagesToContain(message);
      }

      // Should have corresponding AI responses
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBeGreaterThanOrEqual(messages.length * 2);
    });

    test('should handle empty message gracefully', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.fillInput(chatPage.messageInput, '');

      // Send button should be disabled
      await chatPage.expectSendMessageButtonToBe(false);

      // Pressing Enter should not send message
      await page.press('Enter');

      // Should not have any messages
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBe(0);
    });

    test('should handle whitespace-only messages', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.fillInput(chatPage.messageInput, '   ');
      await page.press('Enter');

      // Should not send message
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBe(0);
    });

    test('should show typing indicator while AI is responding', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.sendMessage('Please respond with a longer message');

      // Should show typing indicator
      await chatPage.expectTypingIndicator();

      // Should hide typing indicator when done
      await chatPage.expectNoTypingIndicator();
    });
  });

  describe('Message Display and Formatting', () => {
    test('should display messages with proper timestamps', async ({ page }) => {
      await navigateToChat(page);

      const testMessage = 'Message with timestamp test';
      await chatPage.sendMessage(testMessage);

      // Should show timestamp for user message
      const userMessage = page.locator('[data-testid="message-user"]').last();
      const timestamp = userMessage.locator('[data-testid="message-timestamp"]');
      await expect(timestamp).toBeVisible();

      // Should show timestamp for AI response
      const aiMessage = page.locator('[data-testid="message-ai"]').last();
      const aiTimestamp = aiMessage.locator('[data-testid="message-timestamp"]');
      await expect(aiTimestamp).toBeVisible();
    });

    test('should handle code blocks in messages', async ({ page }) => {
      await navigateToChat(page);

      const codeMessage = 'Please show me a JavaScript code block with a function';
      await chatPage.sendMessage(codeMessage);

      await chatPage.waitForResponse();

      // Should display code block
      const codeBlock = page.locator('[data-testid="code-block"]');
      await expect(codeBlock).toBeVisible();

      // Should have copy button
      const copyButton = page.locator('[data-testid="copy-code-button"]');
      await expect(copyButton).toBeVisible();
    });

    test('should handle markdown formatting', async ({ page }) => {
      await navigateToChat(page);

      const markdownMessage = 'Please respond with **bold text** and *italic text*';
      await chatPage.sendMessage(markdownMessage);

      await chatPage.waitForResponse();

      // Should show formatted text
      const boldText = page.locator('strong');
      const italicText = page.locator('em');

      expect(await boldText.count()).toBeGreaterThan(0);
      expect(await italicText.count()).toBeGreaterThan(0);
    });

    test('should handle links in messages', async ({ page }) => {
      await navigateToChat(page);

      const linkMessage = 'Please include a link to https://example.com';
      await chatPage.sendMessage(linkMessage);

      await chatPage.waitForResponse();

      // Should show clickable link
      const link = page.locator('a[href="https://example.com"]');
      await expect(link).toBeVisible();
    });
  });

  describe('Chat Controls and Features', () => {
    test('should clear chat history', async ({ page }) => {
      await navigateToChat(page);

      // Send some messages first
      await chatPage.sendMessage('First message');
      await chatPage.sendMessage('Second message');

      // Verify messages exist
      const initialCount = await chatPage.getMessageCount();
      expect(initialCount).toBeGreaterThan(0);

      // Clear chat
      await chatPage.clearChat();

      // Should show empty chat
      await chatPage.expectChatToBeEmpty();
    });

    test('should change AI model', async ({ page }) => {
      await navigateToChat(page);

      // Click model selector
      await chatPage.clickElement(chatPage.modelSelector);

      // Should show available models
      const modelOptions = page.locator('[data-testid^="model-option-"]');
      expect(await modelOptions.count()).toBeGreaterThan(0);

      // Select different model
      const firstOption = modelOptions.first();
      await firstOption.click();

      // Should update selected model
      const selectedModel = await chatPage.getSelectedModel();
      expect(selectedModel).toBeTruthy();
    });

    test('should show token usage information', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.sendMessage('Please give me a detailed response');

      await chatPage.waitForResponse();

      // Should show token usage
      if (await chatPage.isVisible(chatPage.tokenUsage)) {
        const tokenUsage = await chatPage.getTokenUsage();
        expect(tokenUsage).toBeTruthy();
        expect(tokenUsage).toMatch(/\d+ tokens/);
      }
    });

    test('should show session information', async ({ page }) => {
      await navigateToChat(page);

      // Should show session info
      if (await chatPage.isVisible(chatPage.sessionInfo)) {
        const sessionInfo = await chatPage.getSessionInfo();
        expect(sessionInfo).toBeTruthy();
      }
    });

    test('should toggle theme', async ({ page }) => {
      await navigateToChat(page);

      // Get initial theme
      const body = page.locator('body');
      const initialTheme = await body.getAttribute('class');

      // Toggle theme
      await chatPage.toggleTheme();

      // Theme should change
      const currentTheme = await body.getAttribute('class');
      expect(currentTheme).not.toBe(initialTheme);
    });
  });

  describe('Voice and Input Features', () => {
    test('should show voice input button', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.expectElementToBeVisible(chatPage.voiceButton);
    });

    test('should show file attachment button', async ({ page }) => {
      await navigateToChat(page);

      await chatPage.expectElementToBeVisible(chatPage.attachButton);
    });

    test('should handle file attachment', async ({ page }) => {
      await navigateToChat(page);

      // Create a test file
      const testFilePath = '/tmp/test-file.txt';
      await page.evaluate(() => {
        const fs = require('fs');
        fs.writeFileSync('/tmp/test-file.txt', 'Test file content');
      });

      await chatPage.attachFile(testFilePath);

      // Should show uploaded file
      const uploadedFile = page.locator('[data-testid="uploaded-file"]');
      await expect(uploadedFile).toBeVisible();
    });

    test('should support emoji input', async ({ page }) => {
      await navigateToChat(page);

      // Click emoji button (if available)
      const emojiButton = page.locator('[data-testid="emoji-button"]');
      if (await emojiButton.isVisible()) {
        await emojiButton.click();

        // Should show emoji picker
        const emojiPicker = page.locator('[data-testid="emoji-picker"]');
        await expect(emojiPicker).toBeVisible();

        // Select an emoji
        const firstEmoji = emojiPicker.locator('[data-testid^="emoji-"]').first();
        await firstEmoji.click();

        // Emoji should be in input
        const inputValue = await chatPage.page.getAttribute(chatPage.messageInput, 'value');
        expect(inputValue).toMatch(/[^\w\s]/); // Should contain non-alphanumeric character
      }
    });
  });

  describe('Chat History and Context', () => {
    test('should load chat history', async ({ page }) => {
      await navigateToChat(page);

      // Send some messages
      await chatPage.sendMessage('First message');
      await chatPage.sendMessage('Second message');

      // Reload page
      await page.reload();
      await chatPage.expectChatInterfaceLoaded();

      // Should show previous messages
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBeGreaterThan(0);
    });

    test('should maintain conversation context', async ({ page }) => {
      await navigateToChat(page);

      // Start a conversation
      await chatPage.sendMessage('My name is Alice');
      await chatPage.waitForResponse();

      // Follow up message
      await chatPage.sendMessage('What is my name?');
      await chatPage.waitForResponse();

      // Response should mention Alice
      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage).toMatch(/Alice/i);
    });

    test('should switch conversation contexts', async ({ page }) => {
      await navigateToChat(page);

      // Check if context switcher is available
      const contextSwitcher = page.locator('[data-testid="context-switcher"]');
      if (await contextSwitcher.isVisible()) {
        await contextSwitcher.click();

        // Should show available contexts
        const contextOptions = page.locator('[data-testid^="context-"]');
        expect(await contextOptions.count()).toBeGreaterThan(0);

        // Select different context
        const firstContext = contextOptions.first();
        await firstContext.click();

        // Should update context
        const currentContext = page.locator('[data-testid="current-context"]');
        await expect(currentContext).toBeVisible();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await navigateToChat(page);

      // Mock network failure
      await page.route('**/api/claude/chat', route => {
        route.abort('failed');
      });

      const testMessage = 'Test message for network error';
      await chatPage.sendMessage(testMessage);

      // Should show error message
      const errorMessage = page.locator('[data-testid="chat-error"]');
      await expect(errorMessage).toBeVisible();

      // Should show retry option
      const retryButton = page.locator('[data-testid="retry-message"]');
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();
      }
    });

    test('should handle connection errors', async ({ page }) => {
      await navigateToChat(page);

      // Mock WebSocket disconnection
      await page.evaluate(() => {
        // Simulate WebSocket disconnection
        window.dispatchEvent(new Event('websocket-disconnected'));
      });

      // Should show connection error
      const connectionError = page.locator('[data-testid="connection-error"]');
      await expect(connectionError).toBeVisible();
    });

    test('should handle timeout errors', async ({ page }) => {
      await navigateToChat(page);

      // Mock timeout
      await page.route('**/api/claude/chat', route => {
        // Don't respond to simulate timeout
      });

      const testMessage = 'Test message for timeout';
      await chatPage.sendMessage(testMessage);

      // Should show timeout error after some time
      await page.waitForTimeout(30000); // Wait for timeout

      const timeoutError = page.locator('[data-testid="timeout-error"]');
      if (await timeoutError.isVisible()) {
        await expect(timeoutError).toBeVisible();
      }
    });
  });

  describe('Performance', () => {
    test('should load chat interface quickly', async ({ page }) => {
      const startTime = Date.now();

      await navigateToChat(page);
      await chatPage.expectChatInterfaceLoaded();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle message input performance', async ({ page }) => {
      await navigateToChat(page);

      // Type a long message quickly
      const longMessage = 'This is a very long message '.repeat(20);

      const startTime = Date.now();

      await chatPage.page.type(chatPage.messageInput, longMessage, { delay: 10 });

      const typingTime = Date.now() - startTime;
      expect(typingTime).toBeLessThan(5000); // Should handle typing smoothly

      // Input should contain full message
      const inputValue = await chatPage.page.getAttribute(chatPage.messageInput, 'value');
      expect(inputValue).toBe(longMessage);
    });

    test('should handle rapid message sending', async ({ page }) => {
      await navigateToChat(page);

      const messages = [
        'Rapid message 1',
        'Rapid message 2',
        'Rapid message 3'
      ];

      const startTime = Date.now();

      for (const message of messages) {
        await chatPage.sendMessage(message);
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Accessibility', () => {
    test('should have proper accessibility labels', async ({ page }) => {
      await navigateToChat(page);

      // Check ARIA labels
      await expect(chatPage.page.locator(chatPage.messageInput)).toHaveAttribute('aria-label');
      await expect(chatPage.page.locator(chatPage.sendButton)).toHaveAttribute('aria-label');

      // Check message structure
      const messages = await chatPage.page.locator(chatPage.messageBubble).all();
      for (const message of messages) {
        await expect(message).toHaveAttribute('role', 'article');
      }
    });

    test('should support keyboard navigation', async ({ page }) => {
      await navigateToChat(page);

      // Tab through interface
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement.tagName);

      expect(['INPUT', 'BUTTON', 'TEXTAREA']).toContain(focusedElement);

      // Navigate through messages with arrow keys if supported
      await page.keyboard.press('ArrowDown');

      // Should be able to focus input and send message
      await page.keyboard.press('Control+l'); // Focus input
      await page.keyboard.type('Keyboard test message');
      await page.keyboard.press('Control+Enter');

      await chatPage.waitForResponse();
    });

    test('should support screen readers', async ({ page }) => {
      await navigateToChat(page);

      // Check for proper heading structure
      const mainHeading = page.locator('h1, h2, h3').first();
      if (await mainHeading.isVisible()) {
        await expect(mainHeading).toHaveAttribute('role', 'heading');
      }

      // Check for landmark regions
      const main = page.locator('main');
      await expect(main).toHaveAttribute('role', 'main');

      const navigation = page.locator('nav');
      if (await navigation.isVisible()) {
        await expect(navigation).toHaveAttribute('role', 'navigation');
      }
    });
  });

  describe('Mobile Responsiveness', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateToChat(page);
      await chatPage.expectChatInterfaceLoaded();

      // Should show mobile-specific elements
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
      }

      // Input should be easily accessible
      await chatPage.expectElementToBeVisible(chatPage.messageInput);

      // Should be able to send messages
      await chatPage.sendMessage('Mobile test message');
      await chatPage.waitForResponse();
    });

    test('should handle mobile-specific interactions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateToChat(page);

      // Test touch interactions
      await page.tap(chatPage.messageInput);
      await page.fill(chatPage.messageInput, 'Touch test message');

      await page.tap(chatPage.sendButton);
      await chatPage.waitForResponse();

      // Should show message
      await chatPage.expectMessagesToContain('Touch test message');
    });
  });

  describe('Real-time Features', () => {
    test('should show live typing indicators in collaborative mode', async ({ page }) => {
      // Mock collaborative session
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('user-typing', {
          detail: { username: 'Other User' }
        }));
      });

      const typingIndicator = page.locator('[data-testid="other-user-typing"]');
      if (await typingIndicator.isVisible()) {
        await expect(typingIndicator).toBeVisible();
        await expect(typingIndicator).toContainText('Other User is typing');
      }
    });

    test('should show online status indicators', async ({ page }) => {
      await navigateToChat(page);

      const onlineStatus = page.locator('[data-testid="online-status"]');
      if (await onlineStatus.isVisible()) {
        await expect(onlineStatus).toBeVisible();
        await expect(onlineStatus).toContainText('Online');
      }
    });
  });

  describe('Search and Filtering', () => {
    test('should search chat history', async ({ page }) => {
      await navigateToChat(page);

      // Send some messages
      await chatPage.sendMessage('Important information about React');
      await chatPage.sendMessage('Another message about JavaScript');
      await chatPage.waitForResponse();

      // Check if search functionality is available
      const searchButton = page.locator('[data-testid="search-chat"]');
      if (await searchButton.isVisible()) {
        await searchButton.click();

        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill('React');

        // Should show filtered results
        const searchResults = page.locator('[data-testid="search-results"]');
        await expect(searchResults).toBeVisible();
      }
    });
  });

  describe('Export and Sharing', () => {
    test('should export chat conversation', async ({ page }) => {
      await navigateToChat(page);

      // Send a message
      await chatPage.sendMessage('Test message for export');
      await chatPage.waitForResponse();

      // Check if export is available
      const exportButton = page.locator('[data-testid="export-chat"]');
      if (await exportButton.isVisible()) {
        // Start download listener
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.(txt|md|json)$/);
      }
    });

    test('should share conversation link', async ({ page }) => {
      await navigateToChat(page);

      const shareButton = page.locator('[data-testid="share-conversation"]');
      if (await shareButton.isVisible()) {
        await shareButton.click();

        const shareModal = page.locator('[data-testid="share-modal"]');
        await expect(shareModal).toBeVisible();

        const shareLink = page.locator('[data-testid="share-link"]');
        await expect(shareLink).toBeVisible();

        const linkValue = await shareLink.inputValue();
        expect(linkValue).toMatch(/^https?:\/\//);
      }
    });
  });
});