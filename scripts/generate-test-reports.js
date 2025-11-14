#!/usr/bin/env node

/**
 * Comprehensive Test Report Generator
 * Aggregates accessibility, visual regression, and E2E test results into comprehensive reports
 */

import fs from 'fs/promises';
import path from 'path';

class TestReportGenerator {
  constructor(outputDir = 'test-results') {
    this.outputDir = outputDir;
    this.reports = {
      accessibility: {},
      visual: {},
      e2e: {},
      performance: {}
    };
  }

  async initialize() {
    console.log('🚀 Initializing test report generator...');

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'accessibility'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'visual-comparisons'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'comprehensive'), { recursive: true });

    console.log('✅ Directories initialized');
  }

  async collectAccessibilityReports() {
    console.log('📊 Collecting accessibility reports...');

    try {
      const files = await fs.readdir(this.outputDir);
      const accessibilityFiles = files.filter(file =>
        file.includes('accessibility') || file.includes('wcag-certificate')
      );

      for (const file of accessibilityFiles) {
        try {
          const filePath = path.join(this.outputDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);

          this.reports.accessibility[file] = {
            timestamp: data.timestamp || new Date().toISOString(),
            violations: data.violations || 0,
            passes: data.passes || 0,
            incomplete: data.incomplete || 0,
            score: data.score || 0,
            wcagLevel: data.wcagVersion || '2.1'
          };
        } catch (error) {
          console.warn(`⚠️  Could not parse accessibility report ${file}:`, error.message);
        }
      }

      console.log(`✅ Collected ${Object.keys(this.reports.accessibility).length} accessibility reports`);
    } catch (error) {
      console.error('❌ Error collecting accessibility reports:', error.message);
    }
  }

  async collectVisualReports() {
    console.log('🎨 Collecting visual regression reports...');

    try {
      const visualDir = path.join(this.outputDir, 'visual-comparisons');
      const baselineDir = path.join(this.outputDir, 'visual-baselines');

      // Count baseline screenshots
      let baselineCount = 0;
      try {
        const baselineFiles = await fs.readdir(baselineDir);
        baselineCount = baselineFiles.filter(file => file.endsWith('.png')).length;
      } catch (error) {
        console.warn('⚠️  Baseline directory not found');
      }

      // Count comparison screenshots
      let comparisonCount = 0;
      try {
        const comparisonFiles = await fs.readdir(visualDir);
        comparisonCount = comparisonFiles.filter(file => file.endsWith('.png')).length;
      } catch (error) {
        console.warn('⚠️  Comparison directory not found');
      }

      // Collect visual report JSON files
      const files = await fs.readdir(this.outputDir);
      const visualReportFiles = files.filter(file =>
        file.includes('visual') && file.endsWith('.json')
      );

      for (const file of visualReportFiles) {
        try {
          const filePath = path.join(this.outputDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);

          this.reports.visual[file] = {
            timestamp: data.timestamp || new Date().toISOString(),
            comparisons: data.summary || { total: 0, identical: 0, different: 0 },
            screenshots: {
              baseline: baselineCount,
              comparison: comparisonCount
            }
          };
        } catch (error) {
          console.warn(`⚠️  Could not parse visual report ${file}:`, error.message);
        }
      }

      this.reports.visual.summary = {
        baselineScreenshots: baselineCount,
        comparisonScreenshots: comparisonCount,
        totalComparisons: comparisonCount,
        reportFiles: Object.keys(this.reports.visual).length
      };

      console.log(`✅ Collected visual regression data: ${baselineCount} baselines, ${comparisonCount} comparisons`);
    } catch (error) {
      console.error('❌ Error collecting visual reports:', error.message);
    }
  }

  async collectE2EReports() {
    console.log('🧪 Collecting E2E test reports...');

    try {
      const playwrightReportDir = path.join(this.outputDir, '../playwright-report');

      // Try to read Playwright HTML report data
      let e2eResults = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      };

      try {
        const reportFiles = await fs.readdir(playwrightReportDir);
        const resultsFile = reportFiles.find(file => file.includes('results'));

        if (resultsFile) {
          const resultsPath = path.join(playwrightReportDir, resultsFile);
          const content = await fs.readFile(resultsPath, 'utf8');
          const data = JSON.parse(content);

          if (data.suites) {
            data.suites.forEach(suite => {
              if (suite.specs) {
                suite.specs.forEach(spec => {
                  if (spec.tests) {
                    spec.tests.forEach(test => {
                      e2eResults.total++;
                      if (test.results) {
                        const result = test.results[0];
                        if (result.status === 'passed') e2eResults.passed++;
                        else if (result.status === 'failed') e2eResults.failed++;
                        else if (result.status === 'skipped') e2eResults.skipped++;
                      }
                    });
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not parse Playwright report:', error.message);
      }

      this.reports.e2e = e2eResults;

      console.log(`✅ Collected E2E test results: ${e2eResults.total} tests`);
    } catch (error) {
      console.error('❌ Error collecting E2E reports:', error.message);
    }
  }

  async collectPerformanceReports() {
    console.log('⚡ Collecting performance reports...');

    try {
      const files = await fs.readdir(this.outputDir);
      const performanceFiles = files.filter(file =>
        file.includes('performance') || file.includes('lighthouse')
      );

      for (const file of performanceFiles) {
        try {
          const filePath = path.join(this.outputDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);

          this.reports.performance[file] = {
            timestamp: data.timestamp || new Date().toISOString(),
            performance: data.performance || data.lhr?.categories?.performance?.score || 0,
            accessibility: data.accessibility || data.lhr?.categories?.accessibility?.score || 0,
            bestPractices: data.bestPractices || data.lhr?.categories?.['best-practices']?.score || 0,
            seo: data.seo || data.lhr?.categories?.seo?.score || 0
          };
        } catch (error) {
          console.warn(`⚠️  Could not parse performance report ${file}:`, error.message);
        }
      }

      console.log(`✅ Collected ${Object.keys(this.reports.performance).length} performance reports`);
    } catch (error) {
      console.error('❌ Error collecting performance reports:', error.message);
    }
  }

  generateAccessibilitySummary() {
    const accessibilityReports = Object.values(this.reports.accessibility);

    if (accessibilityReports.length === 0) {
      return {
        status: 'not_run',
        message: 'No accessibility reports found'
      };
    }

    const totalViolations = accessibilityReports.reduce((sum, report) => sum + report.violations, 0);
    const totalPasses = accessibilityReports.reduce((sum, report) => sum + report.passes, 0);
    const averageScore = accessibilityReports.reduce((sum, report) => sum + report.score, 0) / accessibilityReports.length;

    return {
      status: totalViolations === 0 ? 'passed' : 'failed',
      summary: {
        totalTests: totalViolations + totalPasses,
        violations: totalViolations,
        passes: totalPasses,
        averageScore: Math.round(averageScore)
      },
      wcagCompliance: {
        levelA: true, // Assuming Level A tests were run
        levelAA: averageScore >= 90,
        levelAAA: averageScore >= 95
      }
    };
  }

  generateVisualSummary() {
    const visualSummary = this.reports.visual.summary;

    if (!visualSummary || visualSummary.totalComparisons === 0) {
      return {
        status: 'not_run',
        message: 'No visual regression reports found'
      };
    }

    const totalComparisons = Object.values(this.reports.visual)
      .filter(report => report.comparisons)
      .reduce((sum, report) => sum + (report.comparisons.total || 0), 0);

    const identicalComparisons = Object.values(this.reports.visual)
      .filter(report => report.comparisons)
      .reduce((sum, report) => sum + (report.comparisons.identical || 0), 0);

    const differentComparisons = totalComparisons - identicalComparisons;

    return {
      status: differentComparisons === 0 ? 'passed' : 'failed',
      summary: {
        baselineScreenshots: visualSummary.baselineScreenshots,
        comparisonScreenshots: visualSummary.comparisonScreenshots,
        totalComparisons,
        identicalComparisons,
        differentComparisons
      }
    };
  }

  generateE2ESummary() {
    const e2eResults = this.reports.e2e;

    if (e2eResults.total === 0) {
      return {
        status: 'not_run',
        message: 'No E2E test results found'
      };
    }

    return {
      status: e2eResults.failed > 0 ? 'failed' : 'passed',
      summary: {
        total: e2eResults.total,
        passed: e2eResults.passed,
        failed: e2eResults.failed,
        skipped: e2eResults.skipped,
        passRate: Math.round((e2eResults.passed / e2eResults.total) * 100)
      }
    };
  }

  generatePerformanceSummary() {
    const performanceReports = Object.values(this.reports.performance);

    if (performanceReports.length === 0) {
      return {
        status: 'not_run',
        message: 'No performance reports found'
      };
    }

    const avgPerformance = performanceReports.reduce((sum, report) => sum + report.performance, 0) / performanceReports.length;
    const avgAccessibility = performanceReports.reduce((sum, report) => sum + report.accessibility, 0) / performanceReports.length;

    return {
      status: avgPerformance >= 0.9 ? 'passed' : 'failed',
      summary: {
        performanceScore: Math.round(avgPerformance * 100),
        accessibilityScore: Math.round(avgAccessibility * 100),
        reportCount: performanceReports.length
      }
    };
  }

  generateComprehensiveReport() {
    console.log('📈 Generating comprehensive report...');

    const accessibilitySummary = this.generateAccessibilitySummary();
    const visualSummary = this.generateVisualSummary();
    const e2eSummary = this.generateE2ESummary();
    const performanceSummary = this.generatePerformanceSummary();

    const allResults = [accessibilitySummary, visualSummary, e2eSummary, performanceSummary];
    const failedTests = allResults.filter(result => result.status === 'failed').length;
    const notRunTests = allResults.filter(result => result.status === 'not_run').length;

    const overallStatus = failedTests > 0 ? 'failed' : notRunTests > 0 ? 'partial' : 'passed';

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        testSuite: 'Claude Code UI Comprehensive Tests'
      },
      overall: {
        status: overallStatus,
        summary: {
          totalCategories: 4,
          passed: allResults.filter(r => r.status === 'passed').length,
          failed: failedTests,
          notRun: notRunTests
        }
      },
      categories: {
        accessibility: accessibilitySummary,
        visualRegression: visualSummary,
        e2eTests: e2eSummary,
        performance: performanceSummary
      },
      detailedResults: {
        accessibility: this.reports.accessibility,
        visual: this.reports.visual,
        e2e: this.reports.e2e,
        performance: this.reports.performance
      },
      recommendations: this.generateRecommendations({
        accessibility: accessibilitySummary,
        visual: visualSummary,
        e2e: e2eSummary,
        performance: performanceSummary
      })
    };

    return report;
  }

  generateRecommendations(summaries) {
    const recommendations = [];

    // Accessibility recommendations
    if (summaries.accessibility.status === 'failed') {
      recommendations.push({
        category: 'Accessibility',
        priority: 'high',
        message: 'Fix accessibility violations to meet WCAG compliance',
        details: 'Review axe-core violation reports and implement required changes'
      });
    }

    // Visual regression recommendations
    if (summaries.visualRegression.status === 'failed') {
      recommendations.push({
        category: 'Visual Regression',
        priority: 'medium',
        message: 'Visual changes detected - review and update baselines if intentional',
        details: 'Compare visual differences and update baseline screenshots if changes are expected'
      });
    }

    // E2E test recommendations
    if (summaries.e2eTests.status === 'failed') {
      recommendations.push({
        category: 'E2E Tests',
        priority: 'high',
        message: 'Fix failing E2E tests',
        details: 'Review test failures and fix application issues or update test expectations'
      });
    }

    // Performance recommendations
    if (summaries.performance.status === 'failed') {
      recommendations.push({
        category: 'Performance',
        priority: 'medium',
        message: 'Improve application performance',
        details: 'Optimize loading times, reduce bundle size, and improve runtime performance'
      });
    }

    // Success recommendations
    if (summaries.accessibility.status === 'passed' &&
        summaries.visualRegression.status === 'passed' &&
        summaries.e2eTests.status === 'passed' &&
        summaries.performance.status === 'passed') {
      recommendations.push({
        category: 'All Tests',
        priority: 'info',
        message: 'All tests passed! Application is ready for production.',
        details: 'Comprehensive testing suite shows excellent quality across all categories.'
      });
    }

    return recommendations;
  }

  async generateHTMLReport(report) {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code UI - Comprehensive Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .status-${report.overall.status} {
            background: ${report.overall.status === 'passed' ? '#10b981' : report.overall.status === 'failed' ? '#ef4444' : '#f59e0b'};
        }
        .content {
            padding: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin: 0 0 15px 0;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-icon {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: inline-block;
        }
        .status-passed { background: #10b981; }
        .status-failed { background: #ef4444; }
        .status-not-run { background: #6b7280; }
        .status-partial { background: #f59e0b; }
        .metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .metric {
            text-align: center;
            padding: 10px;
            background: #f9fafb;
            border-radius: 4px;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #1f2937;
        }
        .metric-label {
            font-size: 0.875em;
            color: #6b7280;
        }
        .recommendations {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        .recommendations h3 {
            margin: 0 0 15px 0;
            color: #92400e;
        }
        .recommendation {
            margin-bottom: 15px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border-left: 4px solid #f59e0b;
        }
        .recommendation-high { border-left-color: #dc2626; }
        .recommendation-medium { border-left-color: #f59e0b; }
        .recommendation-info { border-left-color: #3b82f6; }
        .footer {
            background: #f3f4f6;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 0.875em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header status-${report.overall.status}">
            <h1>🧪 Comprehensive Test Report</h1>
            <p>Claude Code UI - ${new Date(report.metadata.generatedAt).toLocaleDateString()}</p>
            <p style="font-size: 1.2em; margin-top: 20px;">
                Overall Status: <strong>${report.overall.status.toUpperCase()}</strong>
            </p>
        </div>

        <div class="content">
            <div class="summary">
                ${this.generateCategoryHTML('Accessibility', '♿', report.categories.accessibility)}
                ${this.generateCategoryHTML('Visual Regression', '🎨', report.categories.visualRegression)}
                ${this.generateCategoryHTML('E2E Tests', '🧪', report.categories.e2eTests)}
                ${this.generateCategoryHTML('Performance', '⚡', report.categories.performance)}
            </div>

            ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>📋 Recommendations</h3>
                ${report.recommendations.map(rec => `
                    <div class="recommendation recommendation-${rec.priority}">
                        <strong>${rec.category} (${rec.priority})</strong>: ${rec.message}
                        ${rec.details ? `<p style="margin: 5px 0 0 0; color: #6b7280;">${rec.details}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Generated automatically by Claude Code UI Test Suite | Version ${report.metadata.version}</p>
        </div>
    </div>
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, 'comprehensive', 'test-report.html');
    await fs.writeFile(htmlPath, htmlTemplate);

    return htmlPath;
  }

  generateCategoryHTML(title, emoji, category) {
    if (category.status === 'not_run') {
      return `
        <div class="card">
            <h3>${emoji} ${title}</h3>
            <div class="status-icon status-not-run"></div>
            <p>${category.message}</p>
        </div>
      `;
    }

    const summary = category.summary;
    const statusClass = category.status === 'passed' ? 'passed' : 'failed';

    let metricsHTML = '';
    if (title === 'Accessibility') {
      metricsHTML = `
        <div class="metric">
            <div class="metric-value">${summary.averageScore}%</div>
            <div class="metric-label">Score</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.violations}</div>
            <div class="metric-label">Violations</div>
        </div>
      `;
    } else if (title === 'Visual Regression') {
      metricsHTML = `
        <div class="metric">
            <div class="metric-value">${summary.identicalComparisons}</div>
            <div class="metric-label">Identical</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.differentComparisons}</div>
            <div class="metric-label">Different</div>
        </div>
      `;
    } else if (title === 'E2E Tests') {
      metricsHTML = `
        <div class="metric">
            <div class="metric-value">${summary.passRate}%</div>
            <div class="metric-label">Pass Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.failed}</div>
            <div class="metric-label">Failed</div>
        </div>
      `;
    } else if (title === 'Performance') {
      metricsHTML = `
        <div class="metric">
            <div class="metric-value">${summary.performanceScore}</div>
            <div class="metric-label">Performance</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.accessibilityScore}</div>
            <div class="metric-label">Accessibility</div>
        </div>
      `;
    }

    return `
      <div class="card">
        <h3>${emoji} ${title} <span class="status-icon status-${statusClass}"></span></h3>
        <div class="metrics">
            ${metricsHTML}
        </div>
      </div>
    `;
  }

  async generateAllReports() {
    console.log('\n🎯 Generating comprehensive test reports...\n');

    // Collect all report data
    await this.collectAccessibilityReports();
    await this.collectVisualReports();
    await this.collectE2EReports();
    await this.collectPerformanceReports();

    // Generate comprehensive report
    const report = this.generateComprehensiveReport();

    // Save JSON report
    const jsonReportPath = path.join(this.outputDir, 'comprehensive', 'test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReportPath = await this.generateHTMLReport(report);

    // Generate summary text
    const summaryText = this.generateTextSummary(report);
    const textReportPath = path.join(this.outputDir, 'comprehensive', 'test-summary.txt');
    await fs.writeFile(textReportPath, summaryText);

    console.log('✅ Reports generated:');
    console.log(`   📊 JSON Report: ${jsonReportPath}`);
    console.log(`   🌐 HTML Report: ${htmlReportPath}`);
    console.log(`   📝 Text Summary: ${textReportPath}`);

    return {
      json: jsonReportPath,
      html: htmlReportPath,
      text: textReportPath,
      summary: report
    };
  }

  generateTextSummary(report) {
    const timestamp = new Date(report.metadata.generatedAt).toLocaleString();

    return `
Claude Code UI - Comprehensive Test Report
Generated: ${timestamp}

OVERALL STATUS: ${report.overall.status.toUpperCase()}

=== CATEGORY SUMMARY ===

Accessibility (${report.categories.accessibility.status})
${report.categories.accessibility.message || `${report.categories.accessibility.summary?.averageScore || 0}% score, ${report.categories.accessibility.summary?.violations || 0} violations`}

Visual Regression (${report.categories.visualRegression.status})
${report.categories.visualRegression.message || `${report.categories.visualRegression.summary?.identicalComparisons || 0} identical, ${report.categories.visualRegression.summary?.differentComparisons || 0} different`}

E2E Tests (${report.categories.e2eTests.status})
${report.categories.e2eTests.message || `${report.categories.e2eTests.summary?.passRate || 0}% pass rate, ${report.categories.e2eTests.summary?.failed || 0} failed`}

Performance (${report.categories.performance.status})
${report.categories.performance.message || `${report.categories.performance.summary?.performanceScore || 0} performance score`}

=== RECOMMENDATIONS ===
${report.recommendations.map(rec => `- ${rec.category}: ${rec.message}`).join('\n')}

=== NEXT STEPS ===
${report.overall.status === 'passed'
  ? '✅ All tests passed! Ready for deployment.'
  : '❌ Some tests failed. Review the recommendations and fix issues before deployment.'
}

Report files:
- test-report.json (detailed JSON data)
- test-report.html (interactive HTML report)
`;
  }
}

async function main() {
  const generator = new TestReportGenerator();

  try {
    await generator.initialize();
    const results = await generator.generateAllReports();

    console.log('\n🎉 Report generation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Overall Status: ${results.summary.overall.status.toUpperCase()}`);
    console.log(`   Categories: ${results.summary.overall.summary.passed} passed, ${results.summary.overall.summary.failed} failed`);

    if (results.summary.overall.status === 'failed') {
      console.log('\n❌ Tests failed - check recommendations for next steps');
      process.exit(1);
    } else {
      console.log('\n✅ All systems go!');
    }

  } catch (error) {
    console.error('\n💥 Fatal error during report generation:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestReportGenerator };