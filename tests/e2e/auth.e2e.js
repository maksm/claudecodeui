import { test, expect, describe } from '@playwright/test';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import { testData, createTestUser } from './fixtures/test-data.js';
import {
  loginAsUser,
  loginAsAdmin,
  completeSetup,
  cleanupTestData,
  generateRandomEmail
} from './helpers/test-helpers.js';

describe('Authentication E2E Tests', () => {
  let loginPage;
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await cleanupTestData(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  describe('Login Functionality', () => {
    test('should display login form correctly', async ({ page }) => {
      await loginPage.navigate();

      // Check all form elements are present
      await loginPage.expectElementToBeVisible(loginPage.usernameInput);
      await loginPage.expectElementToBeVisible(loginPage.passwordInput);
      await loginPage.expectElementToBeVisible(loginPage.loginButton);

      // Check initial state
      await loginPage.expectFieldsToBeEmpty();
      await loginPage.expectURLToContain('/login');
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(
        testData.users.valid.username,
        testData.users.valid.password
      );

      await loginPage.expectLoginSuccessful();
      await dashboardPage.expectDashboardLoaded();

      // Should see welcome message with username
      const welcomeMessage = await dashboardPage.getWelcomeMessage();
      expect(welcomeMessage).toContain(testData.users.valid.username);
    });

    test('should login successfully with admin credentials', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(
        testData.users.platform.username,
        testData.users.platform.password
      );

      await loginPage.expectLoginSuccessful();
      await dashboardPage.expectDashboardLoaded();

      // Admin users should see admin-specific features
      const adminPanel = page.locator('[data-testid="admin-panel"]');
      await expect(adminPanel).toBeVisible();
    });

    test('should show error message with invalid credentials', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(
        testData.users.invalid.username,
        testData.users.invalid.password
      );

      await loginPage.expectLoginFailed('Invalid credentials');
    });

    test('should show error message with empty credentials', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login('', '');

      await loginPage.expectLoginFailed('Username and password are required');
    });

    test('should show error message with correct username but wrong password', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(testData.users.valid.username, 'wrongpassword');

      await loginPage.expectLoginFailed('Invalid credentials');
    });

    test('should handle remember me functionality', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login(
        testData.users.valid.username,
        testData.users.valid.password,
        true
      );

      await loginPage.expectLoginSuccessful();

      // Check if remember me token is set
      const cookies = await page.context().cookies();
      const rememberMeCookie = cookies.find(cookie => cookie.name === 'remember-me');
      expect(rememberMeCookie).toBeDefined();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.loginUsingKeyboard(
        testData.users.valid.username,
        testData.users.valid.password
      );

      await loginPage.expectLoginSuccessful();
    });

    test('should handle login with Enter key in password field', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.fillInput(loginPage.usernameInput, testData.users.valid.username);
      await loginPage.fillInput(loginPage.passwordInput, testData.users.valid.password);
      await page.press('Enter');

      await loginPage.expectLoginSuccessful();
    });
  });

  describe('Setup/Registration Flow', () => {
    test('should display setup form for first-time users', async ({ page }) => {
      await loginPage.navigate();

      // Mock first-time user scenario
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });

      await page.reload();
      await loginPage.expectSetupFormVisible();
    });

    test('should complete setup successfully', async ({ page }) => {
      const setupUser = createTestUser({
        email: generateRandomEmail()
      });

      await completeSetup(page);

      // Should be logged in after setup
      await loginPage.expectLoginSuccessful();
      await dashboardPage.expectDashboardLoaded();
    });

    test('should validate setup form fields', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });

      await loginPage.navigate();
      await loginPage.expectSetupFormVisible();

      // Try to submit empty form
      const submitButton = '[data-testid="setup-submit"]';
      await loginPage.clickElement(submitButton);

      // Should show validation errors
      await loginPage.expectValidationError('username', 'Username is required');
      await loginPage.expectValidationError('email', 'Email is required');
      await loginPage.expectValidationError('password', 'Password is required');
    });

    test('should validate email format in setup form', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });

      await loginPage.navigate();
      await loginPage.expectSetupFormVisible();

      await loginPage.fillSetupForm('testuser', 'invalid-email', 'password123');
      await loginPage.submitSetupForm();

      await loginPage.expectValidationError('email', 'Invalid email format');
    });

    test('should validate password confirmation', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });

      await loginPage.navigate();
      await loginPage.expectSetupFormVisible();

      await loginPage.fillSetupForm('testuser', 'test@example.com', 'password123');

      // Fill different password in confirmation field
      const confirmPasswordInput = '[data-testid="setup-confirm-password"]';
      await loginPage.fillInput(confirmPasswordInput, 'differentpassword');
      await loginPage.submitSetupForm();

      await loginPage.expectValidationError('password', 'Passwords do not match');
    });
  });

  describe('Logout Functionality', () => {
    test('should logout successfully', async ({ page }) => {
      await loginAsUser(page);
      await dashboardPage.openUserMenu();
      await dashboardPage.logout();

      // Should redirect to login page
      await loginPage.expectURLToContain('/login');

      // Should be able to access login page again
      await loginPage.expectElementToBeVisible(loginPage.usernameInput);
      await loginPage.expectElementToBeVisible(loginPage.passwordInput);
    });

    test('should clear session data on logout', async ({ page }) => {
      await loginAsUser(page);

      // Verify user is logged in
      await dashboardPage.expectDashboardLoaded();

      await dashboardPage.openUserMenu();
      await dashboardPage.logout();

      // Verify session data is cleared
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name === 'session-token');
      expect(sessionCookie).toBeUndefined();

      // Try to access protected route
      await page.goto('/dashboard');
      await loginPage.expectURLToContain('/login');
    });
  });

  describe('Session Persistence', () => {
    test('should maintain login session across page reloads', async ({ page }) => {
      await loginAsUser(page);
      await dashboardPage.expectDashboardLoaded();

      // Reload page
      await page.reload();
      await dashboardPage.expectDashboardLoaded();

      // Should still be logged in
      await dashboardPage.expectElementToBeVisible(dashboardPage.welcomeMessage);
    });

    test('should expire session after timeout', async ({ page }) => {
      await loginAsUser(page);

      // Mock session expiration
      await page.evaluate(() => {
        localStorage.setItem('sessionExpired', 'true');
      });

      // Try to navigate to dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await loginPage.expectURLToContain('/login');
    });
  });

  describe('Password Reset', () => {
    test('should navigate to password reset page', async ({ page }) => {
      await loginPage.navigate();

      const resetLink = '[data-testid="forgot-password"]';
      await loginPage.clickElement(resetLink);

      await loginPage.expectURLToContain('/reset-password');
    });

    test('should send password reset email', async ({ page }) => {
      await page.goto('/reset-password');

      const emailInput = '[data-testid="reset-email"]';
      const sendButton = '[data-testid="send-reset-email"]';

      await loginPage.fillInput(emailInput, 'test@example.com');
      await loginPage.clickElement(sendButton);

      const successMessage = '[data-testid="reset-sent-message"]';
      await expect(page.locator(successMessage)).toBeVisible();
    });
  });

  describe('Security Features', () => {
    test('should enforce password complexity', async ({ page }) => {
      const setupUser = createTestUser({
        password: '123' // Weak password
      });

      await page.evaluate(() => {
        localStorage.setItem('needsSetup', 'true');
      });

      await loginPage.navigate();
      await loginPage.expectSetupFormVisible();

      await loginPage.fillSetupForm(
        setupUser.username,
        setupUser.email,
        setupUser.password
      );
      await loginPage.submitSetupForm();

      await loginPage.expectValidationError(
        'password',
        'Password must be at least 8 characters long and contain letters and numbers'
      );
    });

    test('should handle rate limiting for failed login attempts', async ({ page }) => {
      await loginPage.navigate();

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await loginPage.login('wronguser', 'wrongpass');
        await page.waitForTimeout(100); // Brief pause between attempts
      }

      // Should show rate limiting message
      await loginPage.expectLoginFailed('Too many failed attempts. Please try again later.');
    });

    test('should hide password input characters', async ({ page }) => {
      await loginPage.navigate();

      await loginPage.fillInput(loginPage.passwordInput, 'password123');

      // Check if password field has type="password"
      const inputType = await page.getAttribute(loginPage.passwordInput, 'type');
      expect(inputType).toBe('password');
    });
  });

  describe('Accessibility', () => {
    test('should have proper accessibility labels', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.checkLoginAccessibility();
    });

    test('should support screen readers', async ({ page }) => {
      await loginPage.navigate();

      // Check ARIA labels and roles
      await expect(page.locator(loginPage.usernameInput)).toHaveAttribute('aria-label');
      await expect(page.locator(loginPage.passwordInput)).toHaveAttribute('aria-label');
      await expect(page.locator(loginPage.loginButton)).toHaveAttribute('aria-label');

      // Check form has proper role
      const form = page.locator('form');
      await expect(form).toHaveAttribute('role', 'form');
    });

    test('should be navigable with keyboard only', async ({ page }) => {
      await loginPage.navigate();

      // Tab through form elements
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBe('INPUT');

      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBe('INPUT');

      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBe('BUTTON');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/auth/login', route => {
        route.abort('failed');
      });

      await loginPage.navigate();
      await loginPage.login(
        testData.users.valid.username,
        testData.users.valid.password
      );

      await loginPage.expectNetworkError();
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Mock server error
      await page.route('**/api/auth/login', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      await loginPage.navigate();
      await loginPage.login(
        testData.users.valid.username,
        testData.users.valid.password
      );

      await loginPage.expectLoginFailed('Internal Server Error');
    });
  });
});