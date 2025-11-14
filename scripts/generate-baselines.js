#!/usr/bin/env node

/**
 * Script to generate baseline screenshots for visual regression testing
 * This should be run whenever major visual changes are made to the application
 */

import { chromium } from 'playwright';
import { VisualRegressionHelper } from '../tests/e2e/helpers/accessibility-helpers.js';
import { loginAsUser, cleanupTestData } from '../tests/e2e/helpers/test-helpers.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

const viewports = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'mobile-large', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const themes = [
  { name: 'light', style: '' },
  {
    name: 'dark',
    style: `
    :root {
      --background: #1a1a1a;
      --foreground: #ffffff;
      --card: #2d2d2d;
      --text: #ffffff;
      --border: #404040;
    }
    body {
      background: #1a1a1a !important;
      color: #ffffff !important;
    }
    .card, [data-testid="card"] {
      background: #2d2d2d !important;
      border-color: #404040 !important;
    }
  `,
  },
];

const baselineScenarios = [
  {
    name: 'login-page',
    path: '/login',
    description: 'Login page with form',
    setup: async page => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'login-page-with-errors',
    path: '/login',
    description: 'Login page with validation errors',
    setup: async page => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForLoadState('networkidle');
      await page.click('button[type="submit"]');
      await page.waitForSelector('[role="alert"], .error');
    },
  },
  {
    name: 'dashboard',
    path: '/dashboard',
    description: 'Main dashboard page',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'dashboard-sidebar',
    path: '/dashboard',
    description: 'Dashboard sidebar navigation',
    setup: async (page, visualHelper) => {
      await loginAsUser(page, baseUrl);
      await page.waitForLoadState('networkidle');

      // Focus on sidebar
      const sidebar = page.locator('aside, [data-testid="sidebar"], nav');
      const boundingBox = await sidebar.boundingBox();

      if (boundingBox) {
        return {
          clip: {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
          },
        };
      }
    },
  },
  {
    name: 'dashboard-main-content',
    path: '/dashboard',
    description: 'Dashboard main content area',
    setup: async (page, visualHelper) => {
      await loginAsUser(page, baseUrl);
      await page.waitForLoadState('networkidle');

      // Focus on main content
      const mainContent = page.locator('main, [data-testid="main-content"]');
      const boundingBox = await mainContent.boundingBox();

      if (boundingBox) {
        return {
          clip: {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
          },
        };
      }
    },
  },
  {
    name: 'projects-list',
    path: '/projects',
    description: 'Projects list page',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click('[data-testid="projects-nav"], a[href*="project"]');
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'projects-with-search',
    path: '/projects',
    description: 'Projects page with search active',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click('[data-testid="projects-nav"], a[href*="project"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="search"]'
      );
      if ((await searchInput.count()) > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
      }
    },
  },
  {
    name: 'chat-interface',
    path: '/chat',
    description: 'Chat interface page',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click('[data-testid="chat-nav"], a[href*="chat"]');
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'chat-with-message',
    path: '/chat',
    description: 'Chat interface with message input',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click('[data-testid="chat-nav"], a[href*="chat"]');
      await page.waitForLoadState('networkidle');

      const messageInput = page.locator(
        'textarea[placeholder*="message"], textarea[placeholder*="Message"]'
      );
      if ((await messageInput.count()) > 0) {
        await messageInput.fill('Hello, this is a test message');
        await page.waitForTimeout(200);
      }
    },
  },
  {
    name: 'settings-page',
    path: '/settings',
    description: 'Settings page',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click(
        '[data-testid="settings-nav"], [data-testid="settings-button"], a[href*="settings"]'
      );
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'settings-appearance',
    path: '/settings',
    description: 'Settings appearance tab',
    setup: async page => {
      await loginAsUser(page, baseUrl);
      await page.click(
        '[data-testid="settings-nav"], [data-testid="settings-button"], a[href*="settings"]'
      );
      await page.waitForLoadState('networkidle');

      const appearanceTab = page.locator(
        '[data-testid="appearance-tab"], button:has-text("Appearance")'
      );
      if ((await appearanceTab.count()) > 0) {
        await appearanceTab.click();
        await page.waitForTimeout(200);
      }
    },
  },
];

class BaselineGenerator {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.generatedBaselines = [];
    this.errors = [];
  }

  async initialize() {
    console.log('🚀 Initializing baseline generator...');

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    this.page = await this.context.newPage();

    console.log('✅ Browser initialized');
  }

  async generateScenario(scenario, viewport, theme) {
    const name = `${scenario.name}-${viewport.name}-${theme.name}`;
    console.log(`📸 Generating baseline: ${name}`);

    try {
      // Set viewport
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });

      // Apply theme if not default
      if (theme.style) {
        await this.page.addStyleTag({ content: theme.style });
      }

      // Setup scenario
      const options = await scenario.setup(this.page, {
        takeBaselineScreenshot: (screenshotName, screenshotOptions = {}) => {
          const finalName = `${screenshotName}-${viewport.name}-${theme.name}`;
          return this.page.screenshot({
            path: `test-results/visual-baselines/${finalName}.png`,
            fullPage: true,
            animations: 'disabled',
            ...screenshotOptions,
          });
        },
      });

      // Take baseline screenshot
      const screenshotPath = `test-results/visual-baselines/${name}.png`;

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: 'disabled',
        clip: options?.clip,
      });

      this.generatedBaselines.push({
        name,
        scenario: scenario.name,
        viewport: viewport.name,
        theme: theme.name,
        path: screenshotPath,
        description: scenario.description,
      });

      console.log(`✅ Generated baseline: ${name}`);
    } catch (error) {
      const errorMessage = `Failed to generate baseline for ${name}: ${error.message}`;
      console.error(`❌ ${errorMessage}`);
      this.errors.push(errorMessage);
    }
  }

  async generateAllBaselines() {
    console.log('\n🎨 Starting baseline generation...\n');

    const totalBaselines = baselineScenarios.length * viewports.length * themes.length;
    let completed = 0;

    for (const scenario of baselineScenarios) {
      console.log(`\n📋 Processing scenario: ${scenario.description}`);

      for (const viewport of viewports) {
        for (const theme of themes) {
          await this.generateScenario(scenario, viewport, theme);
          completed++;

          // Progress indicator
          const progress = Math.round((completed / totalBaselines) * 100);
          process.stdout.write(`\r⏳ Progress: ${progress}% (${completed}/${totalBaselines})`);
        }
      }
    }

    console.log('\n\n✨ Baseline generation completed!');
  }

  async generateReport() {
    console.log('\n📊 Generating baseline report...');

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      totalGenerated: this.generatedBaselines.length,
      totalErrors: this.errors.length,
      baselines: this.generatedBaselines,
      errors: this.errors,
      viewports: viewports.map(v => v.name),
      themes: themes.map(t => t.name),
      scenarios: baselineScenarios.map(s => ({
        name: s.name,
        description: s.description,
        path: s.path,
      })),
    };

    // Write report to file
    const fs = await import('fs');
    const path = `test-results/baseline-report-${Date.now()}.json`;

    try {
      await fs.promises.mkdir('test-results', { recursive: true });
      await fs.promises.writeFile(path, JSON.stringify(report, null, 2));

      console.log(`📈 Report generated: ${path}`);

      // Print summary
      console.log('\n📋 Summary:');
      console.log(`   Generated baselines: ${this.generatedBaselines.length}`);
      console.log(`   Errors: ${this.errors.length}`);

      if (this.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        this.errors.forEach(error => console.log(`   - ${error}`));
      }

      return path;
    } catch (error) {
      console.error('Failed to write report:', error);
      return null;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.page) {
      await this.page.close();
    }

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Cleanup completed');
  }
}

async function main() {
  const generator = new BaselineGenerator();

  try {
    await generator.initialize();
    await generator.generateAllBaselines();
    const reportPath = await generator.generateReport();

    if (reportPath) {
      console.log('\n🎉 Baseline generation completed successfully!');
      console.log(`   Report: ${reportPath}`);
      console.log('   Baselines stored in: test-results/visual-baselines/');
    } else {
      console.log('\n⚠️  Baseline generation completed with some issues');
    }
  } catch (error) {
    console.error('\n💥 Fatal error during baseline generation:', error);
    process.exit(1);
  } finally {
    await generator.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Process terminated');
  process.exit(0);
});

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BaselineGenerator, baselineScenarios, viewports, themes };
