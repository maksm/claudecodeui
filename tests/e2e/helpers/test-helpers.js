import { test, expect } from '@playwright/test';
import { testData } from '../fixtures/test-data.js';

// Custom test helpers for E2E testing

export const createTestUser = (overrides = {}) => ({
  username: 'e2e-test-user',
  password: 'test-password-123',
  email: 'e2e-test@example.com',
  ...overrides
});

export const createTestProject = (overrides = {}) => ({
  name: 'E2E Test Project',
  path: '/home/maks/e2e-test-project',
  description: 'A project for E2E testing',
  ...overrides
});

export const createTestTask = (overrides = {}) => ({
  title: 'E2E Test Task',
  description: 'A task for E2E testing',
  priority: 'medium',
  status: 'pending',
  ...overrides
});

// Authentication helpers
export const loginAsUser = async (page, user = testData.users.valid) => {
  const { LoginPage } = await import('../pages/LoginPage.js');
  const loginPage = new LoginPage(page);

  await loginPage.navigate();
  await loginPage.login(user.username, user.password);
  await loginPage.expectLoginSuccessful();

  return loginPage;
};

export const loginAsAdmin = async (page) => {
  const { LoginPage } = await import('../pages/LoginPage.js');
  const loginPage = new LoginPage(page);

  await loginPage.navigate();
  await loginPage.login(testData.users.platform.username, testData.users.platform.password);
  await loginPage.expectLoginSuccessful();

  return loginPage;
};

export const completeSetup = async (page) => {
  const { LoginPage } = await import('../pages/LoginPage.js');
  const loginPage = new LoginPage(page);

  const setupUser = createTestUser();
  await loginPage.navigate();
  await loginPage.completeSetup(setupUser.username, setupUser.email, setupUser.password);
  await loginPage.expectLoginSuccessful();

  return loginPage;
};

// Page navigation helpers
export const navigateToDashboard = async (page) => {
  const { DashboardPage } = await import('../pages/DashboardPage.js');
  const dashboardPage = new DashboardPage(page);

  await dashboardPage.navigate();
  await dashboardPage.expectDashboardLoaded();

  return dashboardPage;
};

export const navigateToChat = async (page) => {
  const { ChatInterfacePage } = await import('../pages/ChatInterfacePage.js');
  const chatPage = new ChatInterfacePage(page);

  await chatPage.navigate();
  await chatPage.expectChatInterfaceLoaded();

  return chatPage;
};

// Project management helpers
export const createProject = async (page, projectData = createTestProject()) => {
  const { DashboardPage } = await import('../pages/DashboardPage.js');
  const dashboardPage = new DashboardPage(page);

  await dashboardPage.clickNewProject();

  // Fill project creation form
  const nameInput = '[data-testid="project-name"]';
  const pathInput = '[data-testid="project-path"]';
  const descriptionInput = '[data-testid="project-description"]';
  const createButton = '[data-testid="create-project-button"]';

  await dashboardPage.fillInput(nameInput, projectData.name);
  await dashboardPage.fillInput(pathInput, projectData.path);
  await dashboardPage.fillInput(descriptionInput, projectData.description);
  await dashboardPage.clickElement(createButton);

  await dashboardPage.waitForPageLoad();

  return projectData;
};

export const selectProject = async (page, projectName) => {
  const { DashboardPage } = await import('../pages/DashboardPage.js');
  const dashboardPage = new DashboardPage(page);

  await dashboardPage.clickProject(projectName);

  return dashboardPage;
};

// Task management helpers
export const createTask = async (page, taskData = createTestTask()) => {
  // Navigate to task creation interface
  const addTaskButton = '[data-testid="add-task-button"]';
  await page.click(addTaskButton);

  // Fill task form
  const titleInput = '[data-testid="task-title"]';
  const descriptionInput = '[data-testid="task-description"]';
  const prioritySelect = '[data-testid="task-priority"]';
  const saveButton = '[data-testid="save-task-button"]';

  await page.fill(titleInput, taskData.title);
  await page.fill(descriptionInput, taskData.description);
  await page.selectOption(prioritySelect, taskData.priority);
  await page.click(saveButton);

  await page.waitForLoadState('networkidle');

  return taskData;
};

// Chat helpers
export const sendMessage = async (page, message) => {
  const { ChatInterfacePage } = await import('../pages/ChatInterfacePage.js');
  const chatPage = new ChatInterfacePage(page);

  await chatPage.sendMessage(message);

  return chatPage;
};

export const sendMultipleMessages = async (page, messages) => {
  const { ChatInterfacePage } = await import('../pages/ChatInterfacePage.js');
  const chatPage = new ChatInterfacePage(page);

  for (const message of messages) {
    await chatPage.sendMessage(message);
  }

  return chatPage;
};

// File system helpers
export const uploadFile = async (page, filePath) => {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
};

export const expectFileUploaded = async (page, fileName) => {
  const uploadedFile = page.locator(`[data-testid="uploaded-file-${fileName}"]`);
  await expect(uploadedFile).toBeVisible();
};

// Settings helpers
export const toggleTheme = async (page) => {
  const themeToggle = '[data-testid="theme-toggle"]';
  await page.click(themeToggle);
};

export const expectThemeToBe = async (page, theme) => {
  const body = page.locator('body');
  if (theme === 'dark') {
    await expect(body).toHaveClass(/dark/);
  } else {
    await expect(body).not.toHaveClass(/dark/);
  }
};

// Performance helpers
export const measurePageLoad = async (page, url) => {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const endTime = Date.now();

  return endTime - startTime;
};

export const expectPageLoadUnder = async (page, url, maxLoadTime) => {
  const loadTime = await measurePageLoad(page, url);
  expect(loadTime).toBeLessThan(maxLoadTime);
};

// Accessibility helpers
export const checkAccessibility = async (page) => {
  const violations = await page.accessibility.snapshot();

  // Basic accessibility checks
  const mainContent = page.locator('main');
  await expect(mainContent).toBeVisible();

  const navigation = page.locator('nav');
  await expect(navigation).toBeVisible();

  return violations;
};

// Error handling helpers
export const expectErrorToast = async (page, expectedError) => {
  const errorToast = page.locator('[data-testid="error-toast"]');
  await expect(errorToast).toBeVisible();
  await expect(errorToast).toContainText(expectedError);
};

export const expectSuccessToast = async (page, expectedMessage) => {
  const successToast = page.locator('[data-testid="success-toast"]');
  await expect(successToast).toBeVisible();
  await expect(successToast).toContainText(expectedMessage);
};

// Network helpers
export const waitForAPIResponse = async (page, endpoint) => {
  return await page.waitForResponse(response =>
    response.url().includes(endpoint)
  );
};

export const mockAPIResponse = async (page, endpoint, responseData) => {
  await page.route(endpoint, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData)
    });
  });
};

// Mobile helpers
export const isMobile = async (page) => {
  const viewport = page.viewportSize();
  return viewport.width < 768;
};

export const expectMobileLayout = async (page) => {
  const mobileMenu = page.locator('[data-testid="mobile-menu"]');
  await expect(mobileMenu).toBeVisible();
};

// Data generation helpers
export const generateRandomString = (length = 10) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

export const generateRandomEmail = () => {
  return `test-${generateRandomString()}@example.com`;
};

export const generateRandomProjectName = () => {
  return `Test Project ${generateRandomString(6)}`;
};

// Cleanup helpers
export const cleanupTestData = async (page) => {
  // Logout if logged in
  const logoutButton = page.locator('[data-testid="logout-button"]');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }

  // Clear any local storage or session data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

// Test data setup
export const setupTestData = async () => {
  // Create test user and projects if needed
  console.log('Setting up test data...');

  // This would typically make API calls to create test data
  // For now, we'll rely on the mock server data
};

// Custom test wrapper
export const createAuthenticatedTest = (testFn, user = testData.users.valid) => {
  return async ({ page }) => {
    await loginAsUser(page, user);
    await testFn({ page });
  };
};

export const createAdminTest = (testFn) => {
  return createAuthenticatedTest(testFn, testData.users.platform);
};

// Test extensions
export const testWithUser = test.extend({
  user: [testData.users.valid, { option: true }],
});

export const testWithAdmin = test.extend({
  user: [testData.users.platform, { option: true }],
});

export default {
  createTestUser,
  createTestProject,
  createTestTask,
  loginAsUser,
  loginAsAdmin,
  completeSetup,
  navigateToDashboard,
  navigateToChat,
  createProject,
  selectProject,
  createTask,
  sendMessage,
  sendMultipleMessages,
  uploadFile,
  expectFileUploaded,
  toggleTheme,
  expectThemeToBe,
  measurePageLoad,
  expectPageLoadUnder,
  checkAccessibility,
  expectErrorToast,
  expectSuccessToast,
  waitForAPIResponse,
  mockAPIResponse,
  isMobile,
  expectMobileLayout,
  generateRandomString,
  generateRandomEmail,
  generateRandomProjectName,
  cleanupTestData,
  setupTestData,
  createAuthenticatedTest,
  createAdminTest,
  testWithUser,
  testWithAdmin
};