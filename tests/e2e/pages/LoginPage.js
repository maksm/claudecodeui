import { expect } from '@playwright/test';
import BasePage from './BasePage.js';

export class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.usernameInput = '[data-testid="username-input"]';
    this.passwordInput = '[data-testid="password-input"]';
    this.loginButton = '[data-testid="login-button"]';
    this.errorMessage = '[data-testid="error-message"]';
    this.signupLink = '[data-testid="signup-link"]';
    this.setupForm = '[data-testid="setup-form"]';
    this.rememberMeCheckbox = '[data-testid="remember-me"]';
  }

  async navigate() {
    await this.goto('/login');
    await this.waitForPageLoad();
  }

  async login(username, password, rememberMe = false) {
    await this.fillInput(this.usernameInput, username);
    await this.fillInput(this.passwordInput, password);

    if (rememberMe) {
      await this.checkCheckbox(this.rememberMeCheckbox);
    }

    await this.clickElement(this.loginButton);
    await this.waitForPageLoad();
  }

  async getErrorMessage() {
    if (await this.isVisible(this.errorMessage)) {
      return await this.getTextContent(this.errorMessage);
    }
    return null;
  }

  async expectLoginSuccessful() {
    // Should redirect to dashboard or projects page
    await this.expectURLToContain('/dashboard|/projects');

    // Should not see error message
    await expect(this.page.locator(this.errorMessage)).not.toBeVisible();
  }

  async expectLoginFailed(expectedError = null) {
    // Should still be on login page
    await this.expectURLToContain('/login');

    // Should see error message
    await this.expectElementToBeVisible(this.errorMessage);

    if (expectedError) {
      await this.expectElementToHaveText(this.errorMessage, expectedError);
    }
  }

  async clickSignup() {
    await this.clickElement(this.signupLink);
  }

  async expectSetupFormVisible() {
    await this.expectElementToBeVisible(this.setupForm);
  }

  async fillSetupForm(username, email, password) {
    const usernameInput = '[data-testid="setup-username"]';
    const emailInput = '[data-testid="setup-email"]';
    const passwordInput = '[data-testid="setup-password"]';
    const confirmPasswordInput = '[data-testid="setup-confirm-password"]';

    await this.fillInput(usernameInput, username);
    await this.fillInput(emailInput, email);
    await this.fillInput(passwordInput, password);
    await this.fillInput(confirmPasswordInput, password);
  }

  async submitSetupForm() {
    const submitButton = '[data-testid="setup-submit"]';
    await this.clickElement(submitButton);
    await this.waitForPageLoad();
  }

  async completeSetup(username, email, password) {
    await this.expectSetupFormVisible();
    await this.fillSetupForm(username, email, password);
    await this.submitSetupForm();
  }

  // Validation helpers
  async getUsernameInputValue() {
    const element = await this.waitForElement(this.usernameInput);
    return await element.inputValue();
  }

  async getPasswordInputValue() {
    const element = await this.waitForElement(this.passwordInput);
    return await element.inputValue();
  }

  async expectFieldsToBeEmpty() {
    await expect(this.page.locator(this.usernameInput)).toHaveValue('');
    await expect(this.page.locator(this.passwordInput)).toHaveValue('');
  }

  async expectFieldsToBePrefilled(username) {
    await expect(this.page.locator(this.usernameInput)).toHaveValue(username);
    // Password should remain empty for security
    await expect(this.page.locator(this.passwordInput)).toHaveValue('');
  }

  // Accessibility tests
  async checkLoginAccessibility() {
    // Check form labels
    await this.expectElementToHaveAttribute(this.usernameInput, 'aria-label');
    await this.expectElementToHaveAttribute(this.passwordInput, 'aria-label');

    // Check button accessibility
    await this.expectElementToHaveAttribute(this.loginButton, 'aria-label');

    // Check form accessibility
    const form = await this.waitForElement('form');
    await expect(form).toHaveAttribute('role', 'form');
  }

  // Keyboard navigation
  async loginUsingKeyboard(username, password) {
    await this.page.focus(this.usernameInput);
    await this.page.keyboard.type(username);
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.type(password);
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  // Error handling
  async expectValidationError(field, expectedError) {
    const errorSelector = `[data-testid="${field}-error"]`;
    await this.expectElementToBeVisible(errorSelector);
    await this.expectElementToHaveText(errorSelector, expectedError);
  }

  async expectNetworkError() {
    await this.expectLoginFailed('Network error');
  }

  // Social login methods (if implemented)
  async clickGoogleLogin() {
    const googleButton = '[data-testid="google-login"]';
    await this.clickElement(googleButton);
  }

  async clickGitHubLogin() {
    const githubButton = '[data-testid="github-login"]';
    await this.clickElement(githubButton);
  }
}

export default LoginPage;