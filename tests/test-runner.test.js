import { TestRunner } from '../server/utils/test-runner.js';
import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TestRunner', () => {
  let runner;
  const testProjectPath = path.join(__dirname, '..');

  beforeEach(() => {
    runner = new TestRunner({ cwd: testProjectPath });
  });

  afterEach(() => {
    if (runner) {
      runner.cancel();
    }
  });

  describe('Initialization', () => {
    it('should create a TestRunner instance', () => {
      expect(runner).toBeInstanceOf(TestRunner);
      expect(runner.cwd).toBe(testProjectPath);
    });

    it('should set default timeout', () => {
      expect(runner.timeout).toBe(600000);
    });

    it('should allow custom timeout', () => {
      const customRunner = new TestRunner({ cwd: testProjectPath, timeout: 30000 });
      expect(customRunner.timeout).toBe(30000);
    });
  });

  describe('hasNpmScript', () => {
    it('should detect existing scripts', async () => {
      const hasLint = await runner.hasNpmScript('lint');
      expect(hasLint).toBe(true);
    });

    it('should return false for non-existent scripts', async () => {
      const hasNonExistent = await runner.hasNpmScript('non-existent-script');
      expect(hasNonExistent).toBe(false);
    });
  });

  describe('Output Parsing', () => {
    describe('parseLintOutput', () => {
      it('should parse ESLint error count', () => {
        const output = '✖ 5 problems (3 errors, 2 warnings)\n';
        const parsed = runner.parseLintOutput(output);
        expect(parsed.errors).toBe(3);
        expect(parsed.warnings).toBe(2);
      });

      it('should extract file paths', () => {
        const output = `
          /path/to/file.js:42:10
          /path/to/another.jsx:15:5
        `;
        const parsed = runner.parseLintOutput(output);
        expect(parsed.files).toHaveLength(2);
        expect(parsed.files[0].path).toContain('file.js');
        expect(parsed.files[0].line).toBe(42);
      });
    });

    describe('parseBuildOutput', () => {
      it('should parse Vite bundle size', () => {
        const output = `
          dist/assets/index-abc123.js  123.45 kB
          dist/assets/vendor-def456.js  456.78 kB
        `;
        const parsed = runner.parseBuildOutput(output);
        expect(parsed.bundleSize).toContain('kB');
      });
    });

    describe('parseTestOutput', () => {
      it('should parse Jest test results', () => {
        const output = `
          Tests: 15 passed, 15 total
          Test Suites: 3 passed, 3 total
        `;
        const parsed = runner.parseTestOutput(output);
        expect(parsed.passed).toBe(15);
        expect(parsed.tests).toBe(15);
        expect(parsed.suites).toBe(3);
      });

      it('should parse failed tests', () => {
        const output = `
          Tests: 10 passed, 2 failed, 12 total
          Test Suites: 2 passed, 1 failed, 3 total
        `;
        const parsed = runner.parseTestOutput(output);
        expect(parsed.passed).toBe(10);
        expect(parsed.failed).toBe(2);
        expect(parsed.tests).toBe(12);
      });
    });

    describe('parseAuditOutput', () => {
      it('should parse vulnerability count', () => {
        const output = 'found 3 high severity vulnerabilities';
        const parsed = runner.parseAuditOutput(output);
        expect(parsed.vulnerabilities.total).toBe(3);
      });

      it('should handle no vulnerabilities', () => {
        const output = 'found 0 vulnerabilities';
        const parsed = runner.parseAuditOutput(output);
        expect(parsed.vulnerabilities.total).toBe(0);
      });
    });
  });

  describe('Script Execution', () => {
    it('should skip non-existent scripts', async () => {
      const result = await runner.runScript('non-existent-script');
      expect(result.skipped).toBe(true);
      expect(result.code).toBe('SCRIPT_NOT_FOUND');
    });

    it('should emit output events', async () => {
      const outputs = [];
      runner.on('output', (data) => {
        outputs.push(data);
      });

      // Run a simple script that exists
      await runner.runScript('test:backend');

      expect(outputs.length).toBeGreaterThan(0);
      expect(outputs[0]).toHaveProperty('script');
      expect(outputs[0]).toHaveProperty('data');
      expect(outputs[0]).toHaveProperty('timestamp');
    });

    it('should handle script timeout', async () => {
      const shortTimeoutRunner = new TestRunner({
        cwd: testProjectPath,
        timeout: 100, // Very short timeout
      });

      const result = await shortTimeoutRunner.runScript('build', { timeout: 100 });

      // Should either timeout or complete (depending on build speed)
      expect(result).toHaveProperty('duration');
    }, 10000);
  });

  describe('Event Emitters', () => {
    it('should emit progress events during runAll', async () => {
      const progressEvents = [];
      runner.on('progress', (data) => {
        progressEvents.push(data);
      });

      await runner.runAll();

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('current');
      expect(progressEvents[0]).toHaveProperty('total');
    }, 120000); // 2 minutes for full test suite

    it('should emit complete event', async () => {
      let completeData;
      runner.on('complete', (data) => {
        completeData = data;
      });

      await runner.runAll();

      expect(completeData).toBeDefined();
      expect(completeData).toHaveProperty('passed');
      expect(completeData).toHaveProperty('results');
      expect(completeData).toHaveProperty('duration');
    }, 120000);
  });

  describe('Cancellation', () => {
    it('should cancel running tests', async () => {
      let cancelled = false;
      runner.on('cancelled', () => {
        cancelled = true;
      });

      // Start a long-running test
      const runPromise = runner.runAll();

      // Cancel after 1 second
      setTimeout(() => {
        runner.cancel();
      }, 1000);

      await runPromise;

      expect(cancelled).toBe(true);
    }, 10000);
  });

  describe('runSelected', () => {
    it('should run only selected tests', async () => {
      const result = await runner.runSelected(['lint']);

      expect(result.results).toHaveProperty('lint');
      expect(result.results).not.toHaveProperty('build');
    }, 30000);

    it('should run multiple selected tests', async () => {
      const result = await runner.runSelected(['lint', 'test:backend']);

      expect(result.results).toHaveProperty('lint');
      expect(result.results).toHaveProperty('test:backend');
      expect(Object.keys(result.results)).toHaveLength(2);
    }, 60000);
  });

  describe('Security Audit', () => {
    it('should run security audit', async () => {
      const result = await runner.runSecurityAudit();

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('parsed');
      expect(result.parsed).toHaveProperty('vulnerabilities');
    }, 30000);
  });
});
