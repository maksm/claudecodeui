import { expect } from '@playwright/test';

export class BasePage {
  constructor(page) {
    this.page = page;
  }

  // Navigation helpers
  async goto(path = '/') {
    await this.page.goto(path);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(selector, timeout = 10000) {
    return await this.page.waitForSelector(selector, { timeout });
  }

  async clickElement(selector, timeout = 10000) {
    const element = await this.waitForElement(selector, timeout);
    await element.click();
  }

  async fillInput(selector, value, timeout = 10000) {
    const element = await this.waitForElement(selector, timeout);
    await element.fill(value);
  }

  async getTextContent(selector, timeout = 10000) {
    const element = await this.waitForElement(selector, timeout);
    return await element.textContent();
  }

  async isVisible(selector, timeout = 5000) {
    try {
      await this.waitForElement(selector, timeout);
      return true;
    } catch {
      return false;
    }
  }

  async waitForText(selector, text, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expectedText) => {
        const element = document.querySelector(sel);
        return element && element.textContent.includes(expectedText);
      },
      selector,
      text,
      { timeout }
    );
  }

  // Screenshot helpers
  async takeScreenshot(name) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }

  // Utility methods
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForAPIResponse(urlPattern, timeout = 10000) {
    return await this.page.waitForResponse(response => response.url().includes(urlPattern), {
      timeout,
    });
  }

  async mockAPIResponse(urlPattern, response) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  // Form helpers
  async selectOption(selector, value) {
    const element = await this.waitForElement(selector);
    await element.selectOption(value);
  }

  async checkCheckbox(selector) {
    const element = await this.waitForElement(selector);
    await element.check();
  }

  async uncheckCheckbox(selector) {
    const element = await this.waitForElement(selector);
    await element.uncheck();
  }

  // Assertions
  async expectElementToBeVisible(selector) {
    const element = await this.waitForElement(selector);
    await expect(element).toBeVisible();
  }

  async expectElementToHaveText(selector, text) {
    const element = await this.waitForElement(selector);
    await expect(element).toHaveText(text);
  }

  async expectElementToHaveAttribute(selector, attribute, value) {
    const element = await this.waitForElement(selector);
    await expect(element).toHaveAttribute(attribute, value);
  }

  async expectPageToHaveTitle(title) {
    await expect(this.page).toHaveTitle(title);
  }

  async expectURLToContain(path) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  // Keyboard shortcuts
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }

  async typeText(selector, text, delay = 100) {
    const element = await this.waitForElement(selector);
    await element.type(text, { delay });
  }

  // Mobile-specific helpers
  async tapElement(selector) {
    const element = await this.waitForElement(selector);
    await element.tap();
  }

  async swipe(startX, startY, endX, endY) {
    await this.page.touchstart(startX, startY);
    await this.page.touchmove(endX, endY);
    await this.page.touchend();
  }

  // Accessibility helpers
  async getAccessibilityTree() {
    return await this.page.accessibility.snapshot();
  }

  async checkAccessibilityContrast(selector) {
    const element = await this.waitForElement(selector);
    const computedStyle = await element.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    return computedStyle;
  }
}

export default BasePage;
