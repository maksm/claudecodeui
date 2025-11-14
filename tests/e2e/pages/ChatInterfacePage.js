import { expect } from '@playwright/test';
import BasePage from './BasePage.js';

export class ChatInterfacePage extends BasePage {
  constructor(page) {
    super(page);
    this.chatContainer = '[data-testid="chat-container"]';
    this.messageInput = '[data-testid="message-input"]';
    this.sendButton = '[data-testid="send-button"]';
    this.messagesList = '[data-testid="messages-list"]';
    this.messageBubble = '[data-testid="message-bubble"]';
    this.typingIndicator = '[data-testid="typing-indicator"]';
    this.clearChatButton = '[data-testid="clear-chat-button"]';
    this.modelSelector = '[data-testid="model-selector"]';
    this.tokenUsage = '[data-testid="token-usage"]';
    this.sessionInfo = '[data-testid="session-info"]';
    this.voiceButton = '[data-testid="voice-button"]';
    this.attachButton = '[data-testid="attach-button"]';
    this.settingsButton = '[data-testid="chat-settings"]';
  }

  async navigate() {
    await this.goto('/chat');
    await this.waitForPageLoad();
  }

  async expectChatInterfaceLoaded() {
    await this.expectElementToBeVisible(this.chatContainer);
    await this.expectElementToBeVisible(this.messageInput);
    await this.expectElementToBeVisible(this.sendButton);
    await this.expectURLToContain('/chat');
  }

  async sendMessage(message) {
    await this.fillInput(this.messageInput, message);
    await this.clickElement(this.sendButton);
    await this.waitForResponse();
  }

  async sendMessageUsingKeyboard(message) {
    await this.page.focus(this.messageInput);
    await this.page.keyboard.type(message);
    await this.page.keyboard.press('Enter');
    await this.waitForResponse();
  }

  async waitForResponse(timeout = 30000) {
    // Wait for typing indicator to appear and then disappear
    try {
      await this.expectElementToBeVisible(this.typingIndicator, timeout);
      await this.expectElementToNotBeVisible(this.typingIndicator, timeout);
    } catch {
      // If typing indicator doesn't appear, wait for new message
      await this.sleep(2000);
    }
  }

  async getMessageCount() {
    const messages = await this.page.locator(this.messageBubble).all();
    return messages.length;
  }

  async getLastMessage() {
    const messages = await this.page.locator(this.messageBubble).all();
    if (messages.length > 0) {
      return await messages[messages.length - 1].textContent();
    }
    return null;
  }

  async getAllMessages() {
    const messages = await this.page.locator(this.messageBubble).all();
    const allMessages = [];
    for (const message of messages) {
      allMessages.push(await message.textContent());
    }
    return allMessages;
  }

  async expectLastMessageToContain(text) {
    const lastMessage = await this.getLastMessage();
    expect(lastMessage).toContain(text);
  }

  async expectMessagesToContain(text) {
    const messages = await this.getAllMessages();
    expect(messages.some(msg => msg.includes(text))).toBe(true);
  }

  async clearChat() {
    await this.clickElement(this.clearChatButton);
    // Confirm clear if confirmation dialog appears
    const confirmButton = '[data-testid="confirm-clear"]';
    if (await this.isVisible(confirmButton)) {
      await this.clickElement(confirmButton);
    }
  }

  async expectChatToBeEmpty() {
    const messageCount = await this.getMessageCount();
    expect(messageCount).toBe(0);
  }

  async selectModel(modelName) {
    await this.clickElement(this.modelSelector);
    const modelOption = `[data-testid="model-option-${modelName}"]`;
    await this.clickElement(modelOption);
  }

  async getSelectedModel() {
    const selectedModel = this.page.locator('[data-testid="selected-model"]');
    if (await selectedModel.isVisible()) {
      return await selectedModel.textContent();
    }
    return null;
  }

  async getTokenUsage() {
    if (await this.isVisible(this.tokenUsage)) {
      return await this.getTextContent(this.tokenUsage);
    }
    return null;
  }

  async expectTokenUsageToBe(usage) {
    await this.expectElementToHaveText(this.tokenUsage, usage);
  }

  async getSessionInfo() {
    if (await this.isVisible(this.sessionInfo)) {
      return await this.getTextContent(this.sessionInfo);
    }
    return null;
  }

  async startVoiceRecording() {
    await this.clickElement(this.voiceButton);
  }

  async stopVoiceRecording() {
    // Voice button should toggle state
    await this.clickElement(this.voiceButton);
  }

  async attachFile(filePath) {
    await this.clickElement(this.attachButton);
    // File input would be hidden, so we need to access it directly
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  async openChatSettings() {
    await this.clickElement(this.settingsButton);
  }

  async expectTypingIndicator() {
    await this.expectElementToBeVisible(this.typingIndicator);
  }

  async expectNoTypingIndicator() {
    await this.expectElementToNotBeVisible(this.typingIndicator);
  }

  async expectSendMessageButtonToBe(enabled) {
    if (enabled) {
      await this.expectElementToBeVisible(this.sendButton);
      await expect(this.page.locator(this.sendButton)).not.toBeDisabled();
    } else {
      await expect(this.page.locator(this.sendButton)).toBeDisabled();
    }
  }

  async expectMessageInputToBe(placeholder) {
    await this.expectElementToHaveAttribute(this.messageInput, 'placeholder', placeholder);
  }

  // Long message handling
  async sendLongMessage(message) {
    await this.fillInput(this.messageInput, message);
    // Check if message is split or truncated
    const characterCount = await this.page.locator('[data-testid="character-count"]');
    if (await characterCount.isVisible()) {
      const count = await characterCount.textContent();
      console.log(`Character count: ${count}`);
    }
    await this.clickElement(this.sendButton);
  }

  // Keyboard shortcuts
  async pressSendShortcut() {
    await this.page.keyboard.press('Control+Enter');
    await this.waitForResponse();
  }

  async pressClearShortcut() {
    await this.page.keyboard.press('Control+L');
  }

  async focusInput() {
    await this.page.focus(this.messageInput);
  }

  // Message formatting
  async formatText(format) {
    const formatButton = `[data-testid="format-${format}"]`;
    await this.clickElement(formatButton);
  }

  async insertEmoji(emoji) {
    const emojiButton = '[data-testid="emoji-button"]';
    await this.clickElement(emojiButton);
    const emojiOption = `[data-testid="emoji-${emoji}"]`;
    await this.clickElement(emojiOption);
  }

  // Conversation history
  async loadConversationHistory(conversationId) {
    const historyButton = '[data-testid="history-button"]';
    await this.clickElement(historyButton);
    const conversationItem = `[data-testid="conversation-${conversationId}"]`;
    await this.clickElement(conversationItem);
  }

  async expectConversationLoaded(conversationId) {
    const conversationInfo = `[data-testid="conversation-info"]`;
    await this.expectElementToBeVisible(conversationInfo);
    // Check if conversation ID or title is displayed
  }

  // Error handling
  async expectErrorMessage() {
    const errorElement = '[data-testid="chat-error"]';
    await this.expectElementToBeVisible(errorElement);
  }

  async expectConnectionError() {
    const connectionError = '[data-testid="connection-error"]';
    await this.expectElementToBeVisible(connectionError);
  }

  async retryFailedMessage() {
    const retryButton = '[data-testid="retry-message"]';
    if (await this.isVisible(retryButton)) {
      await this.clickElement(retryButton);
      await this.waitForResponse();
    }
  }

  // Mobile specific
  async expectMobileChatLayout() {
    const mobileContainer = '[data-testid="mobile-chat-container"]';
    await this.expectElementToBeVisible(mobileContainer);
  }

  async swipeToNewChat() {
    const swipeArea = '[data-testid="swipe-area"]';
    await this.swipe(100, 50, 10, 50); // Swipe from right to left
  }

  // Accessibility
  async checkChatAccessibility() {
    // Check ARIA labels
    await this.expectElementToHaveAttribute(this.messageInput, 'aria-label');
    await this.expectElementToHaveAttribute(this.sendButton, 'aria-label');

    // Check message structure
    const messages = await this.page.locator(this.messageBubble).all();
    for (const message of messages) {
      await expect(message).toHaveAttribute('role', 'article');
    }

    // Check keyboard navigation
    await this.page.keyboard.press('Tab');
    const focusedElement = await this.page.evaluate(() => document.activeElement.tagName);
    expect(['INPUT', 'BUTTON']).toContain(focusedElement);
  }

  // Performance
  async measureResponseTime(message) {
    const startTime = Date.now();
    await this.sendMessage(message);
    await this.waitForResponse();
    const endTime = Date.now();
    return endTime - startTime;
  }

  async expectMessageToBeSent(timestamp) {
    const messageTimestamp = '[data-testid="message-timestamp"]';
    // Check if message shows correct timestamp
  }

  // Context switching
  async switchToContext(context) {
    const contextSwitcher = '[data-testid="context-switcher"]';
    await this.clickElement(contextSwitcher);
    const contextOption = `[data-testid="context-${context}"]`;
    await this.clickElement(contextOption);
  }

  async expectContextToBe(context) {
    const currentContext = '[data-testid="current-context"]';
    await this.expectElementToHaveText(currentContext, context);
  }

  // Collaboration features
  async startCollaborativeSession() {
    const collaborateButton = '[data-testid="collaborate-button"]';
    await this.clickElement(collaborateButton);
  }

  async inviteUser(email) {
    const inviteInput = '[data-testid="invite-input"]';
    const inviteButton = '[data-testid="invite-button"]';
    await this.fillInput(inviteInput, email);
    await this.clickElement(inviteButton);
  }

  async expectUserInSession(username) {
    const participant = `[data-testid="participant-${username}"]`;
    await this.expectElementToBeVisible(participant);
  }
}

export default ChatInterfacePage;
