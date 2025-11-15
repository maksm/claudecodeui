import express from 'express';
import { TestRunner } from '../utils/test-runner.js';
import { extractProjectDirectory } from '../projects.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Store active CI runs in memory
const activeRuns = new Map();
const runHistory = new Map(); // Simple in-memory history (will move to DB later)

/**
 * Get actual project path from project name
 */
async function getProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    console.error(`Error extracting project directory for ${projectName}:`, error);
    return projectName.replace(/-/g, '/');
  }
}

/**
 * Create a new CI run
 */
function createRun(projectPath, tests) {
  const runId = `ci-${randomUUID()}`;
  const runner = new TestRunner({ cwd: projectPath });

  const run = {
    id: runId,
    projectPath,
    tests,
    status: 'running',
    runner,
    startedAt: new Date().toISOString(),
    results: null,
    error: null,
  };

  activeRuns.set(runId, run);
  return run;
}

/**
 * Clean up completed run
 */
function completeRun(runId, results, error = null) {
  const run = activeRuns.get(runId);
  if (run) {
    run.status = error ? 'failed' : results.passed ? 'passed' : 'failed';
    run.results = results;
    run.error = error;
    run.completedAt = new Date().toISOString();

    // Move to history
    runHistory.set(runId, {
      id: runId,
      projectPath: run.projectPath,
      tests: run.tests,
      status: run.status,
      results,
      error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      duration: results?.duration,
    });

    // Clean up active runs after 1 hour
    setTimeout(() => {
      activeRuns.delete(runId);
    }, 3600000);

    // Keep only last 50 runs in history
    if (runHistory.size > 50) {
      const oldestKey = runHistory.keys().next().value;
      runHistory.delete(oldestKey);
    }
  }
}

/**
 * Send WebSocket message to all clients
 */
function broadcastToClients(wss, message) {
  if (!wss || !wss.clients) return;

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  });
}

/**
 * POST /api/ci/run - Run full CI suite
 *
 * Body: { project: string, tests?: string[] }
 * Returns: { runId, status, startedAt, tests }
 */
router.post('/run', async (req, res) => {
  const { project, tests } = req.body;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getProjectPath(project);

    // Check if project already has a running test
    const existingRun = Array.from(activeRuns.values()).find(
      (run) => run.projectPath === projectPath && run.status === 'running'
    );

    if (existingRun) {
      return res.status(409).json({
        error: 'CI tests are already running for this project',
        runId: existingRun.id,
      });
    }

    // Create new run
    const testsToRun = tests || ['lint', 'audit', 'build', 'test:backend'];
    const run = createRun(projectPath, testsToRun);

    // Get WebSocket server from app
    const wss = req.app.get('wss');

    // Set up event listeners
    run.runner.on('output', (data) => {
      broadcastToClients(wss, {
        type: 'ci-output',
        runId: run.id,
        testType: data.script,
        data: data.data,
        timestamp: data.timestamp,
      });
    });

    run.runner.on('progress', (data) => {
      broadcastToClients(wss, {
        type: 'ci-progress',
        runId: run.id,
        current: data.current,
        total: data.total,
        currentTest: data.step,
      });
    });

    // Start tests in background
    (async () => {
      try {
        const results = tests
          ? await run.runner.runSelected(testsToRun)
          : await run.runner.runAll();

        completeRun(run.id, results);

        broadcastToClients(wss, {
          type: 'ci-complete',
          runId: run.id,
          passed: results.passed,
          results: results.results,
          duration: results.duration,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('CI run error:', error);
        completeRun(run.id, null, error.message);

        broadcastToClients(wss, {
          type: 'ci-error',
          runId: run.id,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    })();

    // Return immediately
    res.json({
      runId: run.id,
      status: 'running',
      startedAt: run.startedAt,
      tests: testsToRun,
    });
  } catch (error) {
    console.error('Error starting CI run:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ci/run-single - Run a single test type
 *
 * Body: { project: string, test: string }
 * Returns: { runId, status, startedAt, test }
 */
router.post('/run-single', async (req, res) => {
  const { project, test } = req.body;

  if (!project || !test) {
    return res.status(400).json({ error: 'Project name and test type are required' });
  }

  try {
    const projectPath = await getProjectPath(project);
    const run = createRun(projectPath, [test]);

    const wss = req.app.get('wss');

    // Set up event listeners
    run.runner.on('output', (data) => {
      broadcastToClients(wss, {
        type: 'ci-output',
        runId: run.id,
        testType: data.script,
        data: data.data,
        timestamp: data.timestamp,
      });
    });

    // Run single test in background
    (async () => {
      try {
        const result = await run.runner.runScript(test);
        const results = { [test]: result };

        completeRun(run.id, {
          passed: result.passed,
          results,
          duration: result.duration,
        });

        broadcastToClients(wss, {
          type: 'ci-complete',
          runId: run.id,
          passed: result.passed,
          results,
          duration: result.duration,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('CI run error:', error);
        completeRun(run.id, null, error.message);

        broadcastToClients(wss, {
          type: 'ci-error',
          runId: run.id,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    })();

    res.json({
      runId: run.id,
      status: 'running',
      startedAt: run.startedAt,
      test,
    });
  } catch (error) {
    console.error('Error starting CI run:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ci/cancel/:runId - Cancel a running test
 */
router.post('/cancel/:runId', async (req, res) => {
  const { runId } = req.params;

  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  if (run.status !== 'running') {
    return res.status(400).json({ error: 'Run is not active' });
  }

  try {
    run.runner.cancel();
    run.status = 'cancelled';
    run.completedAt = new Date().toISOString();

    const wss = req.app.get('wss');
    broadcastToClients(wss, {
      type: 'ci-cancelled',
      runId,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      runId,
      status: 'cancelled',
    });
  } catch (error) {
    console.error('Error cancelling CI run:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ci/status/:runId - Get status of a test run
 */
router.get('/status/:runId', async (req, res) => {
  const { runId } = req.params;

  // Check active runs first
  const activeRun = activeRuns.get(runId);
  if (activeRun) {
    return res.json({
      runId: activeRun.id,
      status: activeRun.status,
      startedAt: activeRun.startedAt,
      completedAt: activeRun.completedAt,
      results: activeRun.results,
      error: activeRun.error,
    });
  }

  // Check history
  const historicalRun = runHistory.get(runId);
  if (historicalRun) {
    return res.json(historicalRun);
  }

  res.status(404).json({ error: 'Run not found' });
});

/**
 * GET /api/ci/history - Get CI run history
 *
 * Query params: project?: string, limit?: number
 */
router.get('/history', async (req, res) => {
  const { project, limit = 10 } = req.query;

  try {
    let runs = Array.from(runHistory.values());

    // Filter by project if specified
    if (project) {
      const projectPath = await getProjectPath(project);
      runs = runs.filter((run) => run.projectPath === projectPath);
    }

    // Sort by most recent first
    runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    // Limit results
    runs = runs.slice(0, parseInt(limit, 10));

    res.json({
      runs: runs.map((run) => ({
        runId: run.id,
        status: run.status,
        passed: run.results?.passed,
        testsRun: run.results ? Object.keys(run.results.results || {}).length : 0,
        duration: run.duration,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching CI history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ci/active - Get all active CI runs
 */
router.get('/active', async (req, res) => {
  const runs = Array.from(activeRuns.values())
    .filter((run) => run.status === 'running')
    .map((run) => ({
      runId: run.id,
      projectPath: run.projectPath,
      tests: run.tests,
      status: run.status,
      startedAt: run.startedAt,
    }));

  res.json({ runs });
});

export default router;
