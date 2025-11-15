import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * TestRunner - Executes CI tests and streams output in real-time
 *
 * Usage:
 *   const runner = new TestRunner({ cwd: '/path/to/project' });
 *   runner.on('output', (data) => console.log(data));
 *   runner.on('complete', (results) => console.log(results));
 *   const results = await runner.runAll();
 */
export class TestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.cwd = options.cwd || process.cwd();
    this.timeout = options.timeout || 600000; // 10 minutes default
    this.cancelled = false;
    this.currentProcess = null;
  }

  /**
   * Run a single npm script
   * @param {string} scriptName - Name of the script (e.g., 'lint', 'test')
   * @param {object} options - Additional options
   * @returns {Promise<object>} Test results
   */
  async runScript(scriptName, options = {}) {
    const startTime = Date.now();
    const output = [];

    try {
      // Check if script exists in package.json
      const hasScript = await this.hasNpmScript(scriptName);
      if (!hasScript) {
        return {
          passed: false,
          skipped: true,
          output: '',
          error: `Script "${scriptName}" not found in package.json`,
          code: 'SCRIPT_NOT_FOUND',
          duration: 0,
          exitCode: null,
        };
      }

      // Spawn the npm script process
      const result = await this.executeCommand('npm', ['run', scriptName], {
        timeout: options.timeout || this.timeout,
        onOutput: (data) => {
          output.push(data);
          this.emit('output', {
            script: scriptName,
            data,
            timestamp: new Date().toISOString(),
          });
        },
      });

      const duration = Date.now() - startTime;
      const fullOutput = output.join('');

      // Parse output for meaningful info
      const parsed = this.parseOutput(scriptName, fullOutput);

      return {
        passed: result.exitCode === 0,
        skipped: false,
        output: fullOutput,
        parsed,
        duration,
        exitCode: result.exitCode,
        error: result.exitCode !== 0 ? result.error : null,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        passed: false,
        skipped: false,
        output: output.join(''),
        error: error.message,
        code: error.code,
        duration,
        exitCode: error.exitCode || null,
      };
    }
  }

  /**
   * Run all CI tests in sequence
   * @returns {Promise<object>} All test results
   */
  async runAll() {
    const startTime = Date.now();
    const results = {};

    this.emit('progress', { current: 0, total: 5, step: 'starting' });

    // Define test sequence
    const tests = [
      { name: 'lint', required: false },
      { name: 'audit', required: false },
      { name: 'build', required: true },
      { name: 'test:backend', required: false },
      { name: 'test:e2e', required: false },
    ];

    let currentTest = 0;

    for (const test of tests) {
      if (this.cancelled) {
        this.emit('cancelled', { results });
        break;
      }

      currentTest++;
      this.emit('progress', {
        current: currentTest,
        total: tests.length,
        step: test.name,
      });

      // Handle special cases
      if (test.name === 'audit') {
        results[test.name] = await this.runSecurityAudit();
      } else {
        results[test.name] = await this.runScript(test.name);
      }

      // Stop on critical failure if required
      if (test.required && !results[test.name].passed && !results[test.name].skipped) {
        this.emit('critical-failure', { test: test.name, results: results[test.name] });
        break;
      }
    }

    const duration = Date.now() - startTime;
    const allPassed = Object.values(results).every(
      (r) => r.passed || r.skipped
    );

    const summary = {
      passed: allPassed,
      results,
      duration,
      timestamp: new Date().toISOString(),
      testsRun: Object.keys(results).length,
      testsPassed: Object.values(results).filter((r) => r.passed).length,
      testsSkipped: Object.values(results).filter((r) => r.skipped).length,
      testsFailed: Object.values(results).filter((r) => !r.passed && !r.skipped).length,
    };

    this.emit('complete', summary);
    return summary;
  }

  /**
   * Run specific test types
   * @param {string[]} testTypes - Array of test types to run
   * @returns {Promise<object>} Test results
   */
  async runSelected(testTypes) {
    const startTime = Date.now();
    const results = {};

    for (let i = 0; i < testTypes.length; i++) {
      if (this.cancelled) break;

      const testType = testTypes[i];
      this.emit('progress', {
        current: i + 1,
        total: testTypes.length,
        step: testType,
      });

      if (testType === 'audit') {
        results[testType] = await this.runSecurityAudit();
      } else {
        results[testType] = await this.runScript(testType);
      }
    }

    const duration = Date.now() - startTime;
    const allPassed = Object.values(results).every((r) => r.passed || r.skipped);

    return {
      passed: allPassed,
      results,
      duration,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run lint tests
   */
  async runLint() {
    return this.runScript('lint');
  }

  /**
   * Run security audit
   */
  async runSecurityAudit() {
    const startTime = Date.now();
    const output = [];

    try {
      const result = await this.executeCommand(
        'npm',
        ['audit', '--audit-level', 'high'],
        {
          onOutput: (data) => {
            output.push(data);
            this.emit('output', {
              script: 'audit',
              data,
              timestamp: new Date().toISOString(),
            });
          },
        }
      );

      const duration = Date.now() - startTime;
      const fullOutput = output.join('');
      const parsed = this.parseAuditOutput(fullOutput);

      return {
        passed: result.exitCode === 0,
        skipped: false,
        output: fullOutput,
        parsed,
        duration,
        exitCode: result.exitCode,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        passed: false,
        skipped: false,
        output: output.join(''),
        error: error.message,
        duration,
        exitCode: error.exitCode || null,
      };
    }
  }

  /**
   * Run build tests
   */
  async runBuild() {
    return this.runScript('build');
  }

  /**
   * Run backend tests
   */
  async runTests() {
    return this.runScript('test:backend');
  }

  /**
   * Cancel the current test run
   */
  cancel() {
    this.cancelled = true;
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
    }
    this.emit('cancelled', { timestamp: new Date().toISOString() });
  }

  /**
   * Execute a command and return result
   * @private
   */
  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeout || this.timeout;
      let timeoutId;

      this.currentProcess = spawn(command, args, {
        cwd: this.cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' }, // Disable colors for cleaner parsing
      });

      let stdout = '';
      let stderr = '';

      // Set up timeout
      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          this.currentProcess.kill('SIGTERM');
          reject({
            message: `Command timed out after ${timeoutMs}ms`,
            code: 'TIMEOUT',
            exitCode: null,
          });
        }, timeoutMs);
      }

      this.currentProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (options.onOutput) {
          options.onOutput(text);
        }
      });

      this.currentProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (options.onOutput) {
          options.onOutput(text);
        }
      });

      this.currentProcess.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject({
          message: error.message,
          code: error.code,
          exitCode: null,
        });
      });

      this.currentProcess.on('close', (exitCode) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.currentProcess = null;

        if (exitCode === 0) {
          resolve({
            exitCode,
            stdout,
            stderr,
          });
        } else {
          resolve({
            exitCode,
            stdout,
            stderr,
            error: stderr || stdout,
          });
        }
      });
    });
  }

  /**
   * Check if npm script exists in package.json
   * @private
   */
  async hasNpmScript(scriptName) {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.scripts && scriptName in packageJson.scripts;
    } catch (error) {
      console.error('Error reading package.json:', error);
      return false;
    }
  }

  /**
   * Parse output for meaningful information
   * @private
   */
  parseOutput(scriptName, output) {
    const parsed = {
      errors: 0,
      warnings: 0,
      files: [],
    };

    if (!output) return parsed;

    // Parse based on test type
    switch (scriptName) {
      case 'lint':
        return this.parseLintOutput(output);
      case 'build':
        return this.parseBuildOutput(output);
      case 'test:backend':
      case 'test':
        return this.parseTestOutput(output);
      default:
        return parsed;
    }
  }

  /**
   * Parse ESLint output
   * @private
   */
  parseLintOutput(output) {
    const parsed = {
      errors: 0,
      warnings: 0,
      files: [],
    };

    // Match ESLint summary: "✖ 5 problems (3 errors, 2 warnings)"
    const summaryMatch = output.match(/✖\s+(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    if (summaryMatch) {
      parsed.errors = parseInt(summaryMatch[2], 10);
      parsed.warnings = parseInt(summaryMatch[3], 10);
    }

    // Extract file paths with errors
    const fileMatches = output.matchAll(/^\s*(.+\.(?:js|jsx|ts|tsx|mjs|cjs)):(\d+):(\d+)/gm);
    for (const match of fileMatches) {
      const filePath = match[1];
      const line = match[2];
      if (!parsed.files.some((f) => f.path === filePath)) {
        parsed.files.push({
          path: filePath,
          line: parseInt(line, 10),
        });
      }
    }

    return parsed;
  }

  /**
   * Parse build output
   * @private
   */
  parseBuildOutput(output) {
    const parsed = {
      bundleSize: null,
      chunks: [],
    };

    // Match Vite build output: "dist/assets/index-abc123.js  123.45 kB"
    const sizeMatches = output.matchAll(/dist\/.*?\s+([\d.]+)\s+(kB|MB)/g);
    let totalSize = 0;

    for (const match of sizeMatches) {
      const size = parseFloat(match[1]);
      const unit = match[2];
      const sizeInKB = unit === 'MB' ? size * 1024 : size;
      totalSize += sizeInKB;
    }

    if (totalSize > 0) {
      parsed.bundleSize = `${totalSize.toFixed(2)} kB`;
    }

    return parsed;
  }

  /**
   * Parse test output
   * @private
   */
  parseTestOutput(output) {
    const parsed = {
      tests: 0,
      passed: 0,
      failed: 0,
      suites: 0,
    };

    // Match Jest output: "Tests: 5 passed, 5 total"
    const testMatch = output.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/);
    if (testMatch) {
      parsed.passed = parseInt(testMatch[1], 10);
      parsed.failed = testMatch[2] ? parseInt(testMatch[2], 10) : 0;
      parsed.tests = parseInt(testMatch[3], 10);
    }

    // Match suites: "Test Suites: 3 passed, 3 total"
    const suiteMatch = output.match(/Test Suites:\s+(?:\d+\s+passed(?:,\s+\d+\s+failed)?,\s+)?(\d+)\s+total/);
    if (suiteMatch) {
      parsed.suites = parseInt(suiteMatch[1], 10);
    }

    return parsed;
  }

  /**
   * Parse npm audit output
   * @private
   */
  parseAuditOutput(output) {
    const parsed = {
      vulnerabilities: {
        high: 0,
        moderate: 0,
        low: 0,
        total: 0,
      },
    };

    // Match audit summary: "found 3 high severity vulnerabilities"
    const vulnMatch = output.match(/found\s+(\d+)\s+(?:high|moderate|low|critical)\s+severity\s+vulnerabilit(?:y|ies)/i);
    if (vulnMatch) {
      parsed.vulnerabilities.total = parseInt(vulnMatch[1], 10);
    }

    // Match individual severity levels
    const highMatch = output.match(/(\d+)\s+high/i);
    if (highMatch) parsed.vulnerabilities.high = parseInt(highMatch[1], 10);

    const moderateMatch = output.match(/(\d+)\s+moderate/i);
    if (moderateMatch) parsed.vulnerabilities.moderate = parseInt(moderateMatch[1], 10);

    const lowMatch = output.match(/(\d+)\s+low/i);
    if (lowMatch) parsed.vulnerabilities.low = parseInt(lowMatch[1], 10);

    return parsed;
  }
}

export default TestRunner;
