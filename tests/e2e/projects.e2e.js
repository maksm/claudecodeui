import { test, expect, describe } from '@playwright/test';
import DashboardPage from './pages/DashboardPage.js';
import LoginPage from './pages/LoginPage.js';
import { testData, createTestProject } from './fixtures/test-data.js';
import {
  loginAsUser,
  createProject,
  selectProject,
  cleanupTestData,
  generateRandomProjectName
} from './helpers/test-helpers.js';

describe('Project Management E2E Tests', () => {
  let dashboardPage;
  let loginPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    loginPage = new LoginPage(page);
    await cleanupTestData(page);
    await loginAsUser(page);
    await dashboardPage.navigate();
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page);
  });

  describe('Project Display', () => {
    test('should display projects correctly', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      // Should show projects list
      await dashboardPage.expectElementToBeVisible(dashboardPage.projectsList);

      // Should have at least one project card
      const projectCount = await dashboardPage.getProjectsCount();
      expect(projectCount).toBeGreaterThan(0);

      // Should show project names
      const projectNames = await dashboardPage.getProjectNames();
      expect(projectNames.length).toBeGreaterThan(0);
    });

    test('should display project details correctly', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      await expect(firstProjectCard).toBeVisible();

      // Check project name is displayed
      const projectName = firstProjectCard.locator('[data-testid="project-name"]');
      await expect(projectName).toBeVisible();

      // Check project path is displayed
      const projectPath = firstProjectCard.locator('[data-testid="project-path"]');
      await expect(projectPath).toBeVisible();

      // Check project description is displayed
      const projectDescription = firstProjectCard.locator('[data-testid="project-description"]');
      await expect(projectDescription).toBeVisible();
    });

    test('should show project statistics', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      // Check for statistics cards
      const statsCard = page.locator('[data-testid="projects-stats"]');
      await expect(statsCard).toBeVisible();

      const totalProjects = await dashboardPage.getStatValue('total-projects');
      const activeProjects = await dashboardPage.getStatValue('active-projects');

      expect(totalProjects).toBeTruthy();
      expect(activeProjects).toBeTruthy();
    });
  });

  describe('Project Creation', () => {
    test('should open new project modal', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();
      await dashboardPage.clickNewProject();

      // Should show project creation modal
      const modal = page.locator('[data-testid="create-project-modal"]');
      await expect(modal).toBeVisible();

      // Should have form fields
      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const descriptionInput = page.locator('[data-testid="project-description"]');

      await expect(nameInput).toBeVisible();
      await expect(pathInput).toBeVisible();
      await expect(descriptionInput).toBeVisible();
    });

    test('should create new project successfully', async ({ page }) => {
      const newProject = createTestProject({
        name: generateRandomProjectName()
      });

      await dashboardPage.clickNewProject();

      // Fill project form
      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const descriptionInput = page.locator('[data-testid="project-description"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      await nameInput.fill(newProject.name);
      await pathInput.fill(newProject.path);
      await descriptionInput.fill(newProject.description);

      await createButton.click();

      // Wait for project to be created
      await page.waitForLoadState('networkidle');

      // Should show success message
      const successMessage = page.locator('[data-testid="success-toast"]');
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText('Project created successfully');

      // Should show new project in list
      await dashboardPage.expectProjectsToContain([newProject.name]);
    });

    test('should validate project creation form', async ({ page }) => {
      await dashboardPage.clickNewProject();

      const createButton = page.locator('[data-testid="create-project-button"]');
      await createButton.click();

      // Should show validation errors for empty fields
      const nameError = page.locator('[data-testid="project-name-error"]');
      const pathError = page.locator('[data-testid="project-path-error"]');

      await expect(nameError).toBeVisible();
      await expect(pathError).toBeVisible();

      await expect(nameError).toContainText('Project name is required');
      await expect(pathError).toContainText('Project path is required');
    });

    test('should validate project path format', async ({ page }) => {
      await dashboardPage.clickNewProject();

      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      await nameInput.fill('Test Project');
      await pathInput.fill('invalid-path'); // Invalid format
      await createButton.click();

      const pathError = page.locator('[data-testid="project-path-error"]');
      await expect(pathError).toBeVisible();
      await expect(pathError).toContainText('Invalid project path format');
    });

    test('should check for duplicate project paths', async ({ page }) => {
      await dashboardPage.clickNewProject();

      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      // Try to use an existing project path
      const existingPath = '/home/maks/test-project-1';
      await nameInput.fill('Duplicate Project');
      await pathInput.fill(existingPath);
      await createButton.click();

      const pathError = page.locator('[data-testid="project-path-error"]');
      await expect(pathError).toBeVisible();
      await expect(pathError).toContainText('Project path already exists');
    });
  });

  describe('Project Navigation', () => {
    test('should navigate to project when clicked', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      const projectName = await firstProjectCard.locator('[data-testid="project-name"]').textContent();

      await firstProjectCard.click();

      // Should navigate to project page
      await page.waitForURL(/\/projects\/\d+/);

      // Should show project details
      const projectHeader = page.locator('[data-testid="project-header"]');
      await expect(projectHeader).toBeVisible();
      await expect(projectHeader).toContainText(projectName);
    });

    test('should show project sessions', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      await firstProjectCard.click();

      await page.waitForURL(/\/projects\/\d+/);

      // Should show sessions list
      const sessionsList = page.locator('[data-testid="sessions-list"]');
      await expect(sessionsList).toBeVisible();
    });

    test('should support project keyboard navigation', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      // Focus on first project card
      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      await firstProjectCard.focus();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');

      // Press Enter to open project
      await page.keyboard.press('Enter');

      await page.waitForURL(/\/projects\/\d+/);
    });
  });

  describe('Project Search and Filtering', () => {
    test('should search projects by name', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const initialProjectCount = await dashboardPage.getProjectsCount();

      await dashboardPage.searchProjects('Test Project 1');

      // Should filter projects
      await page.waitForTimeout(500); // Wait for debounced search

      const filteredProjects = await dashboardPage.getProjectNames();
      expect(filteredProjects.every(name => name.includes('Test Project 1'))).toBe(true);
    });

    test('should clear search when input is empty', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      await dashboardPage.searchProjects('nonexistent');
      await page.waitForTimeout(500);

      // Should show no projects
      await dashboardPage.expectNoProjectsVisible();

      // Clear search
      await dashboardPage.searchProjects('');
      await page.waitForTimeout(500);

      // Should show all projects again
      const projectsCount = await dashboardPage.getProjectsCount();
      expect(projectsCount).toBeGreaterThan(0);
    });

    test('should handle search with no results', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      await dashboardPage.searchProjects('nonexistent-project-12345');
      await page.waitForTimeout(500);

      await dashboardPage.expectNoProjectsVisible();

      // Should show "no results" message
      const noResults = page.locator('[data-testid="no-projects-found"]');
      await expect(noResults).toBeVisible();
    });

    test('should filter projects by status', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const statusFilter = page.locator('[data-testid="project-status-filter"]');
      await expect(statusFilter).toBeVisible();

      await statusFilter.selectOption('active');

      // Should filter by active status
      await page.waitForTimeout(500);

      const activeProjects = await page.locator('[data-testid="project-status-active"]').all();
      expect(activeProjects.length).toBeGreaterThan(0);
    });
  });

  describe('Project Actions', () => {
    test('should show project context menu', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      const contextMenuButton = firstProjectCard.locator('[data-testid="project-context-menu"]');

      await contextMenuButton.click();

      const contextMenu = page.locator('[data-testid="project-context-menu-dropdown"]');
      await expect(contextMenu).toBeVisible();

      // Should show action items
      const editOption = page.locator('[data-testid="edit-project"]');
      const deleteOption = page.locator('[data-testid="delete-project"]');
      const duplicateOption = page.locator('[data-testid="duplicate-project"]');

      await expect(editOption).toBeVisible();
      await expect(deleteOption).toBeVisible();
      await expect(duplicateOption).toBeVisible();
    });

    test('should edit project details', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      const contextMenuButton = firstProjectCard.locator('[data-testid="project-context-menu"]');

      await contextMenuButton.click();

      const editOption = page.locator('[data-testid="edit-project"]');
      await editOption.click();

      // Should show edit modal
      const editModal = page.locator('[data-testid="edit-project-modal"]');
      await expect(editModal).toBeVisible();

      // Should pre-fill form
      const nameInput = page.locator('[data-testid="edit-project-name"]');
      const descriptionInput = page.locator('[data-testid="edit-project-description"]');

      const currentValue = await nameInput.inputValue();
      expect(currentValue).toBeTruthy();

      // Update project
      const newName = `Updated ${currentValue}`;
      await nameInput.clear();
      await nameInput.fill(newName);
      await descriptionInput.fill('Updated description');

      const saveButton = page.locator('[data-testid="save-project-changes"]');
      await saveButton.click();

      // Should show success message
      const successMessage = page.locator('[data-testid="success-toast"]');
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText('Project updated successfully');

      // Should show updated name
      await dashboardPage.expectProjectsToContain([newName]);
    });

    test('should delete project with confirmation', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const initialCount = await dashboardPage.getProjectsCount();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      const projectName = await firstProjectCard.locator('[data-testid="project-name"]').textContent();

      const contextMenuButton = firstProjectCard.locator('[data-testid="project-context-menu"]');
      await contextMenuButton.click();

      const deleteOption = page.locator('[data-testid="delete-project"]');
      await deleteOption.click();

      // Should show confirmation dialog
      const confirmDialog = page.locator('[data-testid="delete-project-confirm"]');
      await expect(confirmDialog).toBeVisible();

      const confirmButton = page.locator('[data-testid="confirm-delete"]');
      await confirmButton.click();

      // Should show success message
      const successMessage = page.locator('[data-testid="success-toast"]');
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText('Project deleted successfully');

      // Should not show deleted project
      await dashboardPage.expectProjectsNotToContain([projectName]);

      // Project count should decrease
      const finalCount = await dashboardPage.getProjectsCount();
      expect(finalCount).toBe(initialCount - 1);
    });

    test('should cancel delete project action', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      const projectName = await firstProjectCard.locator('[data-testid="project-name"]').textContent();

      const contextMenuButton = firstProjectCard.locator('[data-testid="project-context-menu"]');
      await contextMenuButton.click();

      const deleteOption = page.locator('[data-testid="delete-project"]');
      await deleteOption.click();

      // Should show confirmation dialog
      const confirmDialog = page.locator('[data-testid="delete-project-confirm"]');
      await expect(confirmDialog).toBeVisible();

      const cancelButton = page.locator('[data-testid="cancel-delete"]');
      await cancelButton.click();

      // Dialog should close
      await expect(confirmDialog).not.toBeVisible();

      // Project should still be there
      await dashboardPage.expectProjectsToContain([projectName]);
    });
  });

  describe('Project Sorting', () => {
    test('should sort projects by name', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const sortButton = page.locator('[data-testid="sort-projects"]');
      await expect(sortButton).toBeVisible();

      await sortButton.click();
      const sortByName = page.locator('[data-testid="sort-by-name"]');
      await sortByName.click();

      await page.waitForTimeout(500);

      // Get project names
      const projectNames = await dashboardPage.getProjectNames();

      // Check if sorted alphabetically
      const sortedNames = [...projectNames].sort((a, b) => a.localeCompare(b));
      expect(projectNames).toEqual(sortedNames);
    });

    test('should sort projects by creation date', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const sortButton = page.locator('[data-testid="sort-projects"]');
      await sortButton.click();

      const sortByDate = page.locator('[data-testid="sort-by-date"]');
      await sortByDate.click();

      await page.waitForTimeout(500);

      // Check if projects are sorted by date (newest first)
      const projectDates = await page.locator('[data-testid="project-date"]').allTextContents();

      // Convert dates to timestamps and check descending order
      const timestamps = projectDates.map(date => new Date(date).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });
  });

  describe('Project Sessions', () => {
    test('should create new session', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      await firstProjectCard.click();

      await page.waitForURL(/\/projects\/\d+/);

      const newSessionButton = page.locator('[data-testid="new-session-button"]');
      await newSessionButton.click();

      // Should show session creation modal
      const modal = page.locator('[data-testid="create-session-modal"]');
      await expect(modal).toBeVisible();

      const sessionNameInput = page.locator('[data-testid="session-name"]');
      const createButton = page.locator('[data-testid="create-session-button"]');

      await sessionNameInput.fill('Test Session');
      await createButton.click();

      // Should show success message
      const successMessage = page.locator('[data-testid="success-toast"]');
      await expect(successMessage).toBeVisible();

      // Should show new session in list
      const sessionsList = page.locator('[data-testid="sessions-list"]');
      await expect(sessionsList).toContainText('Test Session');
    });

    test('should switch between sessions', async ({ page }) => {
      await dashboardPage.expectDashboardLoaded();

      const firstProjectCard = page.locator(dashboardPage.projectCard).first();
      await firstProjectCard.click();

      await page.waitForURL(/\/projects\/\d+/);

      // Create first session
      const newSessionButton = page.locator('[data-testid="new-session-button"]');
      await newSessionButton.click();

      const sessionNameInput = page.locator('[data-testid="session-name"]');
      const createButton = page.locator('[data-testid="create-session-button"]');

      await sessionNameInput.fill('Session 1');
      await createButton.click();

      await page.waitForTimeout(1000);

      // Create second session
      await newSessionButton.click();
      await sessionNameInput.clear();
      await sessionNameInput.fill('Session 2');
      await createButton.click();

      await page.waitForTimeout(1000);

      // Switch sessions
      const sessionTabs = page.locator('[data-testid="session-tab"]');
      expect(await sessionTabs.count()).toBe(2);

      const secondTab = sessionTabs.nth(1);
      await secondTab.click();

      // Should switch to second session
      const activeSession = page.locator('[data-testid="active-session"]');
      await expect(activeSession).toContainText('Session 2');
    });
  });

  describe('Error Handling', () => {
    test('should handle project creation errors', async ({ page }) => {
      // Mock server error
      await page.route('**/api/projects', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to create project' })
        });
      });

      await dashboardPage.clickNewProject();

      const nameInput = page.locator('[data-testid="project-name"]');
      const pathInput = page.locator('[data-testid="project-path"]');
      const createButton = page.locator('[data-testid="create-project-button"]');

      await nameInput.fill('Test Project');
      await pathInput.fill('/home/maks/test-project');
      await createButton.click();

      // Should show error message
      const errorMessage = page.locator('[data-testid="error-toast"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Failed to create project');
    });

    test('should handle project loading errors', async ({ page }) => {
      // Mock projects API error
      await page.route('**/api/projects', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load projects' })
        });
      });

      await dashboardPage.navigate();

      // Should show error state
      const errorState = page.locator('[data-testid="projects-error"]');
      await expect(errorState).toBeVisible();
    });
  });

  describe('Performance', () => {
    test('should load projects within reasonable time', async ({ page }) => {
      const startTime = Date.now();

      await dashboardPage.navigate();
      await dashboardPage.expectDashboardLoaded();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should handle large number of projects efficiently', async ({ page }) => {
      // Mock many projects
      await page.route('**/api/projects', route => {
        const manyProjects = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          name: `Project ${i + 1}`,
          path: `/home/maks/project-${i + 1}`,
          description: `Description for project ${i + 1}`
        }));

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(manyProjects)
        });
      });

      await dashboardPage.navigate();

      // Should still load quickly
      const startTime = Date.now();
      await dashboardPage.expectDashboardLoaded();
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds even with 100 projects

      // Should show correct number of projects
      const projectCount = await dashboardPage.getProjectsCount();
      expect(projectCount).toBe(100);
    });
  });
});