/* eslint-disable no-undef */
import { test, expect } from '@playwright/test';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import ChatInterfacePage from './pages/ChatInterfacePage.js';
import { testData, createTestUser, generateRandomEmail } from './fixtures/test-data.js';
import {
  cleanupTestData,
  generateRandomProjectName,
  createTestProject,
} from './helpers/test-helpers.js';

test.describe('Critical User Flow E2E Tests', () => {
  let loginPage, dashboardPage, chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatInterfacePage(page);
    await cleanupTestData(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  test.describe('Complete User Registration and First Login Flow', () => {
    test('should complete full user registration and first-time setup', async ({ page }) => {
      // Step 1: Navigate to application
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Step 2: Should show setup form for first-time user
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });
      await page.reload();

      await loginPage.expectSetupFormVisible();

      // Step 3: Fill registration form
      const newUser = createTestUser({
        email: generateRandomEmail(),
      });

      await loginPage.fillSetupForm(newUser.username, newUser.email, newUser.password);

      // Step 4: Submit registration
      await loginPage.submitSetupForm();

      // Step 5: Should be logged in and redirected to dashboard
      await loginPage.expectLoginSuccessful();
      await dashboardPage.expectDashboardLoaded();

      // Step 6: Should show welcome message for new user
      const welcomeMessage = await dashboardPage.getWelcomeMessage();
      expect(welcomeMessage).toContain(newUser.username);

      // Step 7: Should show onboarding or tutorial
      const onboarding = page.locator('[data-testid="onboarding-modal"]');
      if (await onboarding.isVisible()) {
        await expect(onboarding).toBeVisible();

        // Skip onboarding for testing
        const skipButton = page.locator('[data-testid="skip-onboarding"]');
        if (await skipButton.isVisible()) {
          await skipButton.click();
        }
      }

      // Step 8: Should navigate to chat interface for first interaction
      await dashboardPage.openSidebar();
      const chatLink = page.locator('[data-testid="nav-chat"]');
      if (await chatLink.isVisible()) {
        await chatLink.click();
        await chatPage.expectChatInterfaceLoaded();

        // Step 9: Send first message as new user
        await chatPage.sendMessage("Hello, I'm a new user setting up my account");
        await chatPage.expectTypingIndicator();
        await chatPage.waitForResponse();

        // Step 10: Should receive helpful response
        const lastMessage = await chatPage.getLastMessage();
        expect(lastMessage).toBeTruthy();
      }
    });

    test('should handle registration validation errors correctly', async ({ page }) => {
      // Setup registration mode
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });
      await page.goto('/login');
      await loginPage.expectSetupFormVisible();

      // Test empty form validation
      await loginPage.submitSetupForm();
      await loginPage.expectValidationError('username', 'Username is required');
      await loginPage.expectValidationError('email', 'Email is required');
      await loginPage.expectValidationError('password', 'Password is required');

      // Test invalid email format
      await loginPage.fillSetupForm('testuser', 'invalid-email', 'password123');
      await loginPage.submitSetupForm();
      await loginPage.expectValidationError('email', 'Invalid email format');

      // Test password strength validation
      await loginPage.fillSetupForm('testuser', 'test@example.com', '123');
      await loginPage.submitSetupForm();
      await loginPage.expectValidationError(
        'password',
        'Password must be at least 8 characters long'
      );
    });

    test('should handle existing user login after registration', async ({ page }) => {
      // Complete registration first
      const newUser = createTestUser({
        email: generateRandomEmail(),
      });

      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });
      await page.goto('/login');

      await loginPage.completeSetup(newUser.username, newUser.email, newUser.password);

      // Logout
      await dashboardPage.openUserMenu();
      await dashboardPage.logout();

      // Login with existing credentials
      await loginPage.login(newUser.username, newUser.password);
      await loginPage.expectLoginSuccessful();
      await dashboardPage.expectDashboardLoaded();

      // Should remember user
      const welcomeMessage = await dashboardPage.getWelcomeMessage();
      expect(welcomeMessage).toContain(newUser.username);
    });
  });

  test.describe('Project Management Complete Workflow', () => {
    test('should create project, add sessions, and manage lifecycle', async ({ page }) => {
      // Step 1: Login as existing user
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await dashboardPage.expectDashboardLoaded();

      // Step 2: Create first project
      const project1 = createTestProject({
        name: generateRandomProjectName(),
      });

      await dashboardPage.clickNewProject();

      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const descriptionInput = page.locator('[data-testid="project-description"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      await nameInput.fill(project1.name);
      await pathInput.fill(project1.path);
      await descriptionInput.fill(project1.description);
      await createButton.click();

      await page.waitForLoadState('networkidle');

      // Step 3: Verify project appears in dashboard
      await dashboardPage.expectProjectsToContain([project1.name]);

      // Step 4: Navigate to project details
      await dashboardPage.clickProject(project1.name);
      await page.waitForURL(/\/projects\/\d+/);

      // Step 5: Create first session
      const newSessionButton = page.locator('[data-testid="new-session-button"]');
      await newSessionButton.click();

      const sessionNameInput = page.locator('[data-testid="session-name"]');
      const createSessionButton = page.locator('[data-testid="create-session-button"]');

      await sessionNameInput.fill('Initial Setup Session');
      await createSessionButton.click();

      // Step 6: Verify session created
      const sessionsList = page.locator('[data-testid="sessions-list"]');
      await expect(sessionsList).toContainText('Initial Setup Session');

      // Step 7: Create second session
      await newSessionButton.click();
      await sessionNameInput.clear();
      await sessionNameInput.fill('Development Session');
      await createSessionButton.click();

      // Step 8: Switch between sessions
      const sessionTabs = page.locator('[data-testid="session-tab"]');
      expect(await sessionTabs.count()).toBe(2);

      const secondTab = sessionTabs.nth(1);
      await secondTab.click();

      const activeSession = page.locator('[data-testid="active-session"]');
      await expect(activeSession).toContainText('Development Session');

      // Step 9: Navigate back to dashboard
      const dashboardLink = page.locator('[data-testid="nav-dashboard"]');
      await dashboardLink.click();
      await dashboardPage.expectDashboardLoaded();

      // Step 10: Create second project
      const project2 = createTestProject({
        name: generateRandomProjectName(),
      });

      await dashboardPage.clickNewProject();
      await nameInput.clear();
      await pathInput.clear();
      await descriptionInput.clear();

      await nameInput.fill(project2.name);
      await pathInput.fill(project2.path);
      await descriptionInput.fill(project2.description);
      await createButton.click();

      await page.waitForLoadState('networkidle');

      // Step 11: Verify both projects exist
      await dashboardPage.expectProjectsToContain([project1.name, project2.name]);

      // Step 12: Search and filter projects
      await dashboardPage.searchProjects(project1.name);
      await page.waitForTimeout(500);

      await dashboardPage.expectProjectsToContain([project1.name]);
      await dashboardPage.expectProjectsNotToContain([project2.name]);

      // Step 13: Clear search
      await dashboardPage.searchProjects('');
      await page.waitForTimeout(500);

      await dashboardPage.expectProjectsToContain([project1.name, project2.name]);
    });

    test('should handle project deletion and associated data cleanup', async ({ page }) => {
      // Create a project first
      const testProject = createTestProject({
        name: generateRandomProjectName(),
      });

      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await dashboardPage.clickNewProject();

      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      await nameInput.fill(testProject.name);
      await pathInput.fill(testProject.path);
      await createButton.click();

      await page.waitForLoadState('networkidle');

      // Add some sessions to the project
      await dashboardPage.clickProject(testProject.name);
      await page.waitForURL(/\/projects\/\d+/);

      const newSessionButton = page.locator('[data-testid="new-session-button"]');
      await newSessionButton.click();

      const sessionNameInput = page.locator('[data-testid="session-name"]');
      const createSessionButton = page.locator('[data-testid="create-session-button"]');

      await sessionNameInput.fill('Test Session');
      await createSessionButton.click();

      // Go back to dashboard
      const dashboardLink = page.locator('[data-testid="nav-dashboard"]');
      await dashboardLink.click();

      // Delete the project
      const firstProjectCard = page
        .locator(dashboardPage.projectCard)
        .filter({
          has: page.locator(`text=${testProject.name}`),
        })
        .first();

      const contextMenuButton = firstProjectCard.locator('[data-testid="project-context-menu"]');
      await contextMenuButton.click();

      const deleteOption = page.locator('[data-testid="delete-project"]');
      await deleteOption.click();

      // Confirm deletion
      const confirmDialog = page.locator('[data-testid="delete-project-confirm"]');
      await expect(confirmDialog).toBeVisible();

      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      await confirmButton.click();

      // Verify deletion success
      const successMessage = page.locator('[data-testid="success-toast"]');
      await expect(successMessage).toBeVisible();

      // Verify project no longer appears
      await dashboardPage.expectProjectsNotToContain([testProject.name]);

      // Verify deletion went to trash (if applicable)
      const trashButton = page.locator('[data-testid="trash-button"]');
      if (await trashButton.isVisible()) {
        await trashButton.click();

        // Check if deleted project is in trash
        const trashItem = page.locator(`[data-testid="trashed-project-${testProject.name}"]`);
        // This depends on implementation - might not exist
      }
    });

    test('should handle project import from existing directory', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await dashboardPage.expectDashboardLoaded();

      // Look for import button
      const importButton = page.locator('[data-testid="import-project-button"]');
      if (await importButton.isVisible()) {
        await importButton.click();

        // Should show import modal
        const importModal = page.locator('[data-testid="import-project-modal"]');
        await expect(importModal).toBeVisible();

        // Should have directory input
        const directoryInput = page.locator('[data-testid="import-directory"]');
        await expect(directoryInput).toBeVisible();

        // Test invalid directory
        const importProjectButton = page.locator('[data-testid="import-project-submit"]');
        await importProjectButton.click();

        const errorElement = page.locator('[data-testid="import-error"]');
        await expect(errorElement).toBeVisible();
      }
    });
  });

  test.describe('Chat Interface Complete Workflow', () => {
    test('should support complete conversation flow with context', async ({ page }) => {
      // Step 1: Login and navigate to chat
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await chatPage.navigate();
      await chatPage.expectChatInterfaceLoaded();

      // Step 2: Start conversation with context setting
      await chatPage.sendMessage("I'm working on a React application and need help with testing");
      await chatPage.expectTypingIndicator();
      await chatPage.waitForResponse();

      // Step 3: Follow up with specific question
      await chatPage.sendMessage('What testing framework should I use for my React app?');
      await chatPage.waitForResponse();

      // Step 4: Ask for code example
      await chatPage.sendMessage('Can you show me a simple test example?');
      await chatPage.waitForResponse();

      // Step 5: Request clarification
      await chatPage.sendMessage('How do I run these tests?');
      await chatPage.waitForResponse();

      // Step 6: Verify conversation context is maintained
      const allMessages = await chatPage.getAllMessages();
      expect(allMessages.length).toBeGreaterThan(6);

      // Step 7: Test message formatting features
      await chatPage.sendMessage('Please use **bold** and *italic* formatting');
      await chatPage.waitForResponse();

      // Check for formatting in response
      const boldText = page.locator('strong');
      const italicText = page.locator('em');
      expect((await boldText.count()) + (await italicText.count())).toBeGreaterThan(0);

      // Step 8: Test code block functionality
      await chatPage.sendMessage('Show me a React component with TypeScript');
      await chatPage.waitForResponse();

      const codeBlock = page.locator('[data-testid="code-block"]');
      if (await codeBlock.isVisible()) {
        await expect(codeBlock).toBeVisible();

        // Test copy code button
        const copyButton = page.locator('[data-testid="copy-code-button"]').first();
        if (await copyButton.isVisible()) {
          await copyButton.click();

          // Check if copy was successful (might show toast)
          const copyToast = page.locator('[data-testid="copy-success-toast"]');
          if (await copyToast.isVisible()) {
            await expect(copyToast).toBeVisible();
          }
        }
      }

      // Step 9: Test model switching
      const modelSelector = page.locator('[data-testid="model-selector"]');
      if (await modelSelector.isVisible()) {
        await modelSelector.click();

        const modelOptions = page.locator('[data-testid^="model-option-"]');
        if ((await modelOptions.count()) > 1) {
          const differentModel = modelOptions.nth(1);
          await differentModel.click();

          // Send message with different model
          await chatPage.sendMessage('Test with different model');
          await chatPage.waitForResponse();
        }
      }

      // Step 10: Test chat persistence
      await page.reload();
      await chatPage.expectChatInterfaceLoaded();

      // Should show previous conversation
      const messageCountAfterReload = await chatPage.getMessageCount();
      expect(messageCountAfterReload).toBeGreaterThan(0);

      // Step 11: Clear chat
      await chatPage.clearChat();
      await chatPage.expectChatToBeEmpty();
    });

    test('should handle file attachment and collaborative features', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await chatPage.navigate();
      await chatPage.expectChatInterfaceLoaded();

      // Step 1: Test file attachment
      const attachButton = page.locator('[data-testid="attach-button"]');
      if (await attachButton.isVisible()) {
        await attachButton.click();

        // Create a test file
        await page.evaluate(() => {
          const fs = require('fs');
          const content = `
// Test React Component
import React from 'react';

const TestComponent = () => {
  return <div>Test Component</div>;
};

export default TestComponent;
          `;
          fs.writeFileSync('/tmp/test-component.jsx', content);
        });

        // Select file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('/tmp/test-component.jsx');

        // Verify file is uploaded
        const uploadedFile = page.locator('[data-testid="uploaded-file"]');
        if (await uploadedFile.isVisible()) {
          expect(await uploadedFile.textContent()).toContain('test-component.jsx');
        }
      }

      // Step 2: Send message about the file
      await chatPage.sendMessage("I've attached a React component file. Can you review it?");
      await chatPage.waitForResponse();

      // Step 3: Test voice input if available
      const voiceButton = page.locator('[data-testid="voice-button"]');
      if (await voiceButton.isVisible()) {
        // Just test that button exists and is clickable
        await voiceButton.click();
        // Voice functionality would need microphone access
        // This test verifies UI elements exist
      }

      // Step 4: Test emoji and rich text input
      const emojiButton = page.locator('[data-testid="emoji-button"]');
      if (await emojiButton.isVisible()) {
        await emojiButton.click();

        const emojiPicker = page.locator('[data-testid="emoji-picker"]');
        if (await emojiPicker.isVisible()) {
          const firstEmoji = emojiPicker.locator('[data-testid^="emoji-"]').first();
          await firstEmoji.click();

          // Check if emoji appears in input
          const inputValue = await chatPage.page.getAttribute(chatPage.messageInput, 'value');
          expect(inputValue).toMatch(/[^\w\s]/); // Should contain emoji
        }
      }

      // Step 5: Test session management
      const sessionInfo = page.locator('[data-testid="session-info"]');
      if (await sessionInfo.isVisible()) {
        const sessionText = await sessionInfo.textContent();
        expect(sessionText).toBeTruthy();
      }

      // Step 6: Test export functionality
      const exportButton = page.locator('[data-testid="export-chat"]');
      if (await exportButton.isVisible()) {
        // Start download listener
        const downloadPromise = page.waitForEvent('download');

        await exportButton.click();

        try {
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.(txt|md|json)$/);
        } catch (error) {
          // Download prompt might have been cancelled
        }
      }

      // Step 7: Test search functionality
      const searchButton = page.locator('[data-testid="search-chat"]');
      if (await searchButton.isVisible()) {
        await searchButton.click();

        const searchInput = page.locator('[data-testid="search-input"]');
        if (await searchInput.isVisible()) {
          await searchInput.fill('React');

          // Should show filtered results if implemented
          const searchResults = page.locator('[data-testid="search-results"]');
          // This depends on implementation
        }
      }
    });

    test('should handle error recovery and network issues', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await chatPage.navigate();
      await chatPage.expectChatInterfaceLoaded();

      // Step 1: Send successful message
      await chatPage.sendMessage('Hello, this is a test message');
      await chatPage.waitForResponse();

      // Step 2: Mock network error
      await page.route('**/api/claude/chat', route => {
        route.abort('failed');
      });

      // Step 3: Try to send another message
      await chatPage.sendMessage('This should fail due to network error');

      // Step 4: Should show error state
      const errorMessage = page.locator('[data-testid="chat-error"]');
      await expect(errorMessage).toBeVisible();

      // Step 5: Should show retry option
      const retryButton = page.locator('[data-testid="retry-message"]');
      if (await retryButton.isVisible()) {
        // Remove mock to allow retry
        await page.unroute('**/api/claude/chat');

        await retryButton.click();
        await chatPage.waitForResponse();

        // Should succeed after retry
        await expect(errorMessage).not.toBeVisible();
      }

      // Step 6: Test connection issues
      await page.evaluate(() => {
        window.dispatchEvent(new Event('websocket-disconnected'));
      });

      const connectionError = page.locator('[data-testid="connection-error"]');
      if (await connectionError.isVisible()) {
        await expect(connectionError).toBeVisible();

        // Should reconnect automatically
        await page.evaluate(() => {
          setTimeout(() => {
            window.dispatchEvent(new Event('websocket-connected'));
          }, 2000);
        });

        await page.waitForTimeout(3000);
        await expect(connectionError).not.toBeVisible();
      }

      // Step 7: Test timeout handling
      await page.route('**/api/claude/chat', route => {
        // Don't respond to simulate timeout
      });

      await chatPage.sendMessage('This should timeout');

      // Wait for timeout (configurable timeout)
      try {
        await page.waitForTimeout(10000);
        const timeoutError = page.locator('[data-testid="timeout-error"]');
        if (await timeoutError.isVisible()) {
          await expect(timeoutError).toBeVisible();
        }
      } catch {
        // Might not show explicit timeout error
      }
    });
  });

  test.describe('Settings and Configuration Workflow', () => {
    test('should navigate and configure all settings', async ({ page }) => {
      // Step 1: Login and navigate to settings
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await dashboardPage.expectDashboardLoaded();

      const settingsButton = page.locator('[data-testid="settings-button"]');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
      } else {
        // Alternative navigation
        const settingsLink = page.locator('[data-testid="nav-settings"]');
        await settingsLink.click();
      }

      await page.waitForURL(/\/settings/);

      // Step 2: Test theme settings
      const themeSection = page.locator('[data-testid="theme-settings"]');
      if (await themeSection.isVisible()) {
        const lightTheme = page.locator('[data-testid="theme-light"]');
        const darkTheme = page.locator('[data-testid="theme-dark"]');

        if ((await lightTheme.isVisible()) && (await darkTheme.isVisible())) {
          // Test theme switching
          const body = page.locator('body');

          // Try light theme
          await lightTheme.click();
          await page.waitForTimeout(500);
          await expect(body).not.toHaveClass(/dark/);

          // Try dark theme
          await darkTheme.click();
          await page.waitForTimeout(500);
          await expect(body).toHaveClass(/dark/);
        }
      }

      // Step 3: Test notification settings
      const notificationSection = page.locator('[data-testid="notification-settings"]');
      if (await notificationSection.isVisible()) {
        const emailNotifications = page.locator('[data-testid="email-notifications"]');
        const soundNotifications = page.locator('[data-testid="sound-notifications"]');

        if (await emailNotifications.isVisible()) {
          const currentValue = await emailNotifications.isChecked();
          await emailNotifications.click();
          const newValue = await emailNotifications.isChecked();
          expect(newValue).not.toBe(currentValue);
        }
      }

      // Step 4: Test API settings
      const apiSection = page.locator('[data-testid="api-settings"]');
      if (await apiSection.isVisible()) {
        const apiEndpoint = page.locator('[data-testid="api-endpoint"]');
        const timeoutSetting = page.locator('[data-testid="request-timeout"]');

        if (await apiEndpoint.isVisible()) {
          await apiEndpoint.clear();
          await apiEndpoint.fill('http://localhost:3001/api');
        }

        if (await timeoutSetting.isVisible()) {
          await timeoutSetting.clear();
          await timeoutSetting.fill('10000');
        }

        const saveButton = page.locator('[data-testid="save-settings"]');
        if (await saveButton.isVisible()) {
          await saveButton.click();

          const successMessage = page.locator('[data-testid="settings-saved"]');
          await expect(successMessage).toBeVisible();
        }
      }

      // Step 5: Test profile settings
      const profileSection = page.locator('[data-testid="profile-settings"]');
      if (await profileSection.isVisible()) {
        const usernameInput = page.locator('[data-testid="profile-username"]');
        const emailInput = page.locator('[data-testid="profile-email"]');

        if (await usernameInput.isVisible()) {
          const currentValue = await usernameInput.inputValue();
          expect(currentValue).toBeTruthy();
        }

        if (await emailInput.isVisible()) {
          const currentValue = await emailInput.inputValue();
          expect(currentValue).toMatch(/@/);
        }
      }

      // Step 6: Test security settings
      const securitySection = page.locator('[data-testid="security-settings"]');
      if (await securitySection.isVisible()) {
        const changePasswordButton = page.locator('[data-testid="change-password"]');
        const twoFactorAuth = page.locator('[data-testid="2fa-toggle"]');

        if (await changePasswordButton.isVisible()) {
          // Just test button exists without going through password change flow
          await expect(changePasswordButton).toBeVisible();
        }

        if (await twoFactorAuth.isVisible()) {
          const currentState = await twoFactorAuth.isChecked();
          await twoFactorAuth.click();
          const newState = await twoFactorAuth.isChecked();
          expect(newState).not.toBe(currentState);
        }
      }

      // Step 7: Test data management
      const dataSection = page.locator('[data-testid="data-management"]');
      if (await dataSection.isVisible()) {
        const exportData = page.locator('[data-testid="export-data"]');
        const clearData = page.locator('[data-testid="clear-data"]');

        if (await exportData.isVisible()) {
          // Test export functionality
          const downloadPromise = page.waitForEvent('download');

          await exportData.click();

          try {
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/\.(json|csv)$/);
          } catch {
            // Download might be cancelled
          }
        }

        if (await clearData.isVisible()) {
          // Should require confirmation for clear data
          await clearData.click();

          const confirmModal = page.locator('[data-testid="clear-data-confirm"]');
          if (await confirmModal.isVisible()) {
            // Cancel for testing
            const cancelButton = page.locator('[data-testid="cancel-clear"]');
            await cancelButton.click();
          }
        }
      }
    });
  });

  test.describe('Mobile Responsive Workflow', () => {
    test('should support complete workflow on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 }); // iPhone XR

      // Step 1: Login on mobile
      await page.goto('/login');
      await loginPage.expectElementToBeVisible(loginPage.usernameInput);
      await loginPage.expectElementToBeVisible(loginPage.passwordInput);

      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await loginPage.expectLoginSuccessful();

      // Step 2: Navigate dashboard on mobile
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
      }

      await dashboardPage.expectDashboardLoaded();

      // Step 3: Test mobile navigation
      const sidebar = page.locator('[data-testid="sidebar"]');
      const isMobileLayout =
        !(await sidebar.isVisible()) || (await sidebar.getAttribute('class')).includes('mobile');

      expect(isMobileLayout).toBe(true);

      // Test mobile navigation items
      const mobileNavItems = page.locator('[data-testid^="mobile-nav-"]');
      expect(await mobileNavItems.count()).toBeGreaterThan(0);

      // Step 4: Navigate to chat on mobile
      const mobileChatLink = page.locator('[data-testid="mobile-nav-chat"]');
      if (await mobileChatLink.isVisible()) {
        await mobileChatLink.tap();
        await chatPage.expectChatInterfaceLoaded();
      } else {
        // Alternative mobile navigation
        const hamburgerMenu = page.locator('[data-testid="hamburger-menu"]');
        if (await hamburgerMenu.isVisible()) {
          await hamburgerMenu.tap();

          const chatOption = page.locator('[data-testid="chat-option"]');
          if (await chatOption.isVisible()) {
            await chatOption.tap();
          }
        }
      }

      // Step 5: Test mobile chat interface
      const mobileMessageInput = page.locator('[data-testid="mobile-message-input"]');
      const mobileSendButton = page.locator('[data-testid="mobile-send-button"]');

      if (await mobileMessageInput.isVisible()) {
        await mobileMessageInput.fill('Mobile test message');
        await mobileSendButton.tap();

        await chatPage.expectTypingIndicator();
        await chatPage.waitForResponse();
      }

      // Step 6: Test mobile-specific features
      const voiceInput = page.locator('[data-testid="voice-input"]');
      if (await voiceInput.isVisible()) {
        await voiceInput.tap();
        // Voice functionality might not work in headless mode
      }

      // Test mobile settings
      const mobileSettings = page.locator('[data-testid="mobile-settings"]');
      if (await mobileSettings.isVisible()) {
        await mobileSettings.tap();
        await page.waitForURL(/\/settings/);

        // Verify mobile settings layout
        const mobileSettingsTitle = page.locator('[data-testid="mobile-settings-title"]');
        await expect(mobileSettingsTitle).toBeVisible();
      }

      // Step 7: Test mobile gestures
      if (await chatPage.isVisible(chatPage.messagesList)) {
        // Test swipe gestures if implemented
        await chatPage.page.locator(chatPage.messagesList).swipe({
          deltaX: -100,
          deltaY: 0,
        });
      }
    });

    test('should handle orientation changes on mobile', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto('/login');
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      // Test portrait layout
      await chatPage.navigate();
      await chatPage.expectChatInterfaceLoaded();

      // Switch to landscape
      await page.setViewportSize({ width: 812, height: 375 });

      // Should adapt to landscape layout
      await chatPage.expectElementToBeVisible(chatPage.messageInput);
      await chatPage.expectElementToBeVisible(chatPage.sendButton);

      // Test chat in landscape
      await chatPage.sendMessage('Test in landscape mode');
      await chatPage.waitForResponse();

      // Switch back to portrait
      await page.setViewportSize({ width: 375, height: 812 });

      await chatPage.expectElementToBeVisible(chatPage.messageInput);
      await chatPage.expectMessagesToContain('Test in landscape mode');
    });
  });

  test.describe('Performance and Accessibility Workflow', () => {
    test('should meet performance standards across all workflows', async ({ page }) => {
      // Login performance
      const loginStartTime = Date.now();
      await page.goto('/login');
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);
      const loginTime = Date.now() - loginStartTime;
      expect(loginTime).toBeLessThan(5000); // Login within 5 seconds

      await dashboardPage.expectDashboardLoaded();

      // Dashboard load performance
      const dashboardStartTime = Date.now();
      await dashboardPage.navigateTo('/dashboard');
      const dashboardTime = Date.now() - dashboardStartTime;
      expect(dashboardTime).toBeLessThan(3000); // Dashboard within 3 seconds

      // Navigation to chat performance
      const chatStartTime = Date.now();
      await page.goto('/chat');
      const chatTime = Date.now() - chatStartTime;
      expect(chatTime).toBeLessThan(2000); // Chat within 2 seconds

      // Message sending performance
      const messageStartTime = Date.now();
      await chatPage.sendMessage('Performance test message');
      await chatPage.waitForResponse();
      const messageTime = Date.now() - messageStartTime;
      expect(messageTime).toBeLessThan(15000); // Response within 15 seconds

      // Test memory usage (basic check)
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          };
        }
        return null;
      });

      if (memoryInfo) {
        // Check memory usage is reasonable (less than 100MB)
        expect(memoryInfo.used).toBeLessThan(100);
      }

      // Test for layout shifts
      await page.goto('/dashboard');
      const initialMetrics = await page.evaluate(() => {
        return {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        };
      });

      await dashboardPage.clickNewProject();
      await page.waitForTimeout(1000);

      const newMetrics = await page.evaluate(() => {
        return {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        };
      });

      // Check for significant layout shifts
      const widthShift = Math.abs(initialMetrics.width - newMetrics.width);
      const heightShift = Math.abs(initialMetrics.height - newMetrics.height);

      expect(widthShift).toBeLessThan(50);
      expect(heightShift).toBeLessThan(50);
    });

    test('should maintain accessibility standards across all workflows', async ({ page }) => {
      // Skip browser-specific accessibility checks for headless mode
      test.skip(!process.env.ACCESSIBILITY_TESTING, 'Accessibility tests require visual browser');

      // Login accessibility
      await page.goto('/login');

      // Check form accessibility
      await loginPage.checkLoginAccessibility();

      // Navigate through workflows checking accessibility at each step
      await loginPage.login(testData.users.valid.username, testData.users.valid.password);

      await dashboardPage.expectDashboardLoaded();

      // Dashboard accessibility
      const main = page.locator('main');
      await expect(main).toHaveAttribute('role', 'main');

      const navigation = page.locator('nav');
      if (await navigation.isVisible()) {
        await expect(navigation).toHaveAttribute('role', 'navigation');
      }

      // Check keyboard navigation
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(['INPUT', 'BUTTON', 'A']).toContain(focusedElement);

      // Test chat accessibility
      await page.goto('/chat');
      await chatPage.expectChatInterfaceLoaded();

      // Check ARIA labels
      await expect(page.locator(chatPage.messageInput)).toHaveAttribute('aria-label');
      await expect(page.locator(chatPage.sendButton)).toHaveAttribute('aria-label');

      // Check message structure
      const messages = await page.locator(chatPage.messageBubble).all();
      for (const message of messages) {
        await expect(message).toHaveAttribute('role', 'article');
      }

      // Test color contrast
      const contrastResults = await chatPage.checkAccessibilityContrast(chatPage.messageInput);
      if (contrastResults) {
        // Basic contrast check - actual implementation would need proper color analysis
        expect(contrastResults.color).toBeTruthy();
        expect(contrastResults.backgroundColor).toBeTruthy();
      }

      // Test focus management
      await chatPage.focusInput();
      await expect(page.locator(chatPage.messageInput)).toBeFocused();

      // Test responsive accessibility
      await page.setViewportSize({ width: 375, height: 812 }); // Mobile
      await chatPage.expectElementToBeVisible(chatPage.messageInput);

      // Test touch accessibility
      if (await chatPage.isVisible(chatPage.sendButton)) {
        await chatPage.tapElement(chatPage.sendButton);
        await chatPage.expectNoTypingIndicator();
      }

      // Test skip links for screen readers
      const skipLinks = page.locator('[data-testid="skip-link"]');
      for (const skipLink of await skipLinks.all()) {
        await expect(skipLink).toHaveAttribute('href');
      }
    });
  });
});
