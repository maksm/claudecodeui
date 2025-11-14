import { expect } from '@playwright/test';
import BasePage from './BasePage.js';

export class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.header = '[data-testid="dashboard-header"]';
    this.welcomeMessage = '[data-testid="welcome-message"]';
    this.projectsList = '[data-testid="projects-list"]';
    this.projectCard = '[data-testid="project-card"]';
    this.newProjectButton = '[data-testid="new-project-button"]';
    this.searchInput = '[data-testid="search-input"]';
    this.userMenu = '[data-testid="user-menu"]';
    this.logoutButton = '[data-testid="logout-button"]';
    this.themeToggle = '[data-testid="theme-toggle"]';
    this.sidebar = '[data-testid="sidebar"]';
    this.notificationBell = '[data-testid="notification-bell"]';
  }

  async navigate() {
    await this.goto('/dashboard');
    await this.waitForPageLoad();
  }

  async expectDashboardLoaded() {
    await this.expectElementToBeVisible(this.header);
    await this.expectElementToBeVisible(this.welcomeMessage);
    await this.expectURLToContain('/dashboard');
  }

  async getWelcomeMessage() {
    return await this.getTextContent(this.welcomeMessage);
  }

  async getProjectsCount() {
    const projects = await this.page.locator(this.projectCard).all();
    return projects.length;
  }

  async getProjectNames() {
    const projectCards = await this.page.locator(this.projectCard).all();
    const names = [];
    for (const card of projectCards) {
      const nameElement = card.locator('[data-testid="project-name"]');
      if (await nameElement.isVisible()) {
        names.push(await nameElement.textContent());
      }
    }
    return names;
  }

  async clickProject(projectName) {
    const projectCard = this.page.locator(this.projectCard).filter({
      has: this.page.locator(`text=${projectName}`)
    });
    await this.clickElement(projectCard);
    await this.waitForPageLoad();
  }

  async clickNewProject() {
    await this.clickElement(this.newProjectButton);
  }

  async searchProjects(query) {
    await this.fillInput(this.searchInput, query);
    await this.sleep(500); // Wait for debounced search
  }

  async expectProjectsToContain(projectNames) {
    for (const name of projectNames) {
      const projectCard = this.page.locator(this.projectCard).filter({
        has: this.page.locator(`text=${name}`)
      });
      await expect(projectCard).toBeVisible();
    }
  }

  async expectProjectsNotToContain(projectNames) {
    for (const name of projectNames) {
      const projectCard = this.page.locator(this.projectCard).filter({
        has: this.page.locator(`text=${name}`)
      });
      await expect(projectCard).not.toBeVisible();
    }
  }

  async expectNoProjectsVisible() {
    const projects = await this.page.locator(this.projectCard).all();
    expect(projects.length).toBe(0);
  }

  async openUserMenu() {
    await this.clickElement(this.userMenu);
  }

  async logout() {
    await this.openUserMenu();
    await this.clickElement(this.logoutButton);
    await this.waitForPageLoad();
  }

  async toggleTheme() {
    await this.clickElement(this.themeToggle);
  }

  async expectThemeToBe(theme) {
    const body = this.page.locator('body');
    if (theme === 'dark') {
      await expect(body).toHaveClass(/dark/);
    } else {
      await expect(body).not.toHaveClass(/dark/);
    }
  }

  async openSidebar() {
    if (!(await this.isVisible(this.sidebar))) {
      const sidebarToggle = '[data-testid="sidebar-toggle"]';
      await this.clickElement(sidebarToggle);
    }
  }

  async closeSidebar() {
    if (await this.isVisible(this.sidebar)) {
      const sidebarToggle = '[data-testid="sidebar-toggle"]';
      await this.clickElement(sidebarToggle);
    }
  }

  async clickNotificationBell() {
    await this.clickElement(this.notificationBell);
  }

  async getNotificationCount() {
    const badge = this.page.locator('[data-testid="notification-count"]');
    if (await badge.isVisible()) {
      return await badge.textContent();
    }
    return '0';
  }

  async expectNotificationCount(count) {
    const badge = this.page.locator('[data-testid="notification-count"]');
    if (count > 0) {
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(count.toString());
    } else {
      await expect(badge).not.toBeVisible();
    }
  }

  // Recent activity
  async getRecentActivity() {
    const activityList = '[data-testid="recent-activity"]';
    if (await this.isVisible(activityList)) {
      const items = await this.page.locator(`${activityList} [data-testid="activity-item"]`).all();
      const activities = [];
      for (const item of items) {
        const text = await item.textContent();
        activities.push(text.trim());
      }
      return activities;
    }
    return [];
  }

  async expectRecentActivityToContain(activity) {
    const activities = await this.getRecentActivity();
    expect(activities.some(a => a.includes(activity))).toBe(true);
  }

  // Quick actions
  async clickQuickAction(action) {
    const actionButton = `[data-testid="quick-action-${action}"]`;
    await this.clickElement(actionButton);
  }

  async expectQuickActionsAvailable(actions) {
    for (const action of actions) {
      const actionButton = `[data-testid="quick-action-${action}"]`;
      await this.expectElementToBeVisible(actionButton);
    }
  }

  // Stats and metrics
  async getStatValue(statName) {
    const statElement = `[data-testid="stat-${statName}"]`;
    if (await this.isVisible(statElement)) {
      return await this.getTextContent(statElement);
    }
    return null;
  }

  async expectStatToBe(statName, value) {
    const statElement = `[data-testid="stat-${statName}"]`;
    await this.expectElementToHaveText(statElement, value);
  }

  // Keyboard shortcuts
  async pressShortcut(key) {
    await this.pressKey(key);
  }

  async searchUsingKeyboard(query) {
    await this.page.keyboard.press('Control+K'); // Common search shortcut
    await this.fillInput(this.searchInput, query);
    await this.sleep(500);
  }

  // Mobile specific
  async openMobileMenu() {
    const mobileMenuButton = '[data-testid="mobile-menu-button"]';
    if (await this.isVisible(mobileMenuButton)) {
      await this.clickElement(mobileMenuButton);
    }
  }

  async expectMobileNavigation() {
    const mobileNav = '[data-testid="mobile-navigation"]';
    await this.expectElementToBeVisible(mobileNav);
  }

  // Accessibility
  async checkDashboardAccessibility() {
    // Check main landmarks
    await this.expectElementToHaveAttribute('main', 'role', 'main');
    await this.expectElementToHaveAttribute('nav', 'role', 'navigation');

    // Check ARIA labels
    await this.expectElementToHaveAttribute(this.searchInput, 'aria-label');
    await this.expectElementToHaveAttribute(this.newProjectButton, 'aria-label');

    // Check keyboard navigation
    await this.page.keyboard.press('Tab');
    const focusedElement = await this.page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
  }

  // Performance
  async measurePageLoadTime() {
    const navigationStart = await this.page.evaluate(() => performance.timing.navigationStart);
    const loadComplete = await this.page.evaluate(() => performance.timing.loadEventEnd);
    return loadComplete - navigationStart;
  }

  // Error states
  async expectErrorState() {
    const errorElement = '[data-testid="error-state"]';
    await this.expectElementToBeVisible(errorElement);
  }

  async expectLoadingState() {
    const loadingElement = '[data-testid="loading-state"]';
    await this.expectElementToBeVisible(loadingElement);
  }

  async expectContentToLoad() {
    const loadingElement = '[data-testid="loading-state"]';
    await expect(this.page.locator(loadingElement)).not.toBeVisible();
    await this.expectElementToBeVisible(this.projectsList);
  }
}

export default DashboardPage;