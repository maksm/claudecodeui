import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

const mockFs = {
  access: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn(),
};

await jest.unstable_mockModule('fs', () => ({
  promises: mockFs,
}));

const mockProcesses = [];
const mockSpawn = jest.fn(() => {
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  const listeners = {
    close: [],
    error: [],
  };

  const processRef = {
    stdout: {
      on: (event, handler) => {
        stdoutEmitter.on(event, handler);
      },
    },
    stderr: {
      on: (event, handler) => {
        stderrEmitter.on(event, handler);
      },
    },
    on: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    kill: jest.fn(signal => {
      processRef.killed = true;
      listeners.close?.forEach(cb => cb(signal === 'SIGKILL' ? 137 : 1, signal));
    }),
    killed: false,
  };

  processRef.emitClose = (code = 0, signal = null) => {
    listeners.close?.forEach(cb => cb(code, signal));
  };

  processRef.emitStdout = data => {
    stdoutEmitter.emit('data', Buffer.from(data));
  };

  processRef.emitStderr = data => {
    stderrEmitter.emit('data', Buffer.from(data));
  };

  mockProcesses.push(processRef);
  return processRef;
});

await jest.unstable_mockModule('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
}));

const extractProjectDirectory = jest.fn();
await jest.unstable_mockModule('../server/projects.js', () => ({
  extractProjectDirectory,
}));

const validatePathComprehensive = jest.fn();
await jest.unstable_mockModule('../server/utils/path-validator.js', () => ({
  validatePathComprehensive,
}));

const { default: ciRoutes } = await import('../server/routes/ci.js');

const WORKFLOW_YAML = `
name: Test Workflow
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: echo "running"
`;

const WORKFLOW_WITH_WORKDIR = `
name: Test Workflow
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: echo "running"
        working-directory: subdir
`;

const setupApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ci', ciRoutes);
  return app;
};

const waitForQueue = () => new Promise(resolve => setTimeout(resolve, 10));

describe('CI Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcesses.length = 0;

    mockFs.access.mockResolvedValue();
    mockFs.readdir.mockResolvedValue(['ci.yml']);
    mockFs.readFile.mockResolvedValue(WORKFLOW_YAML);

    extractProjectDirectory.mockResolvedValue('/projects/sample');
    validatePathComprehensive.mockResolvedValue({
      valid: true,
      resolvedPath: '/projects/sample',
    });

    app = setupApp();
  });

  test('lists workflows for a project', async () => {
    const response = await request(app).get('/api/ci/workflows?project=test-project').expect(200);

    expect(response.body.workflows).toHaveLength(1);
    expect(response.body.workflows[0]).toMatchObject({
      id: 'ci.yml',
      jobCount: 1,
    });
    expect(extractProjectDirectory).toHaveBeenCalledWith('test-project');
  });

  test('rejects invalid project path', async () => {
    validatePathComprehensive.mockResolvedValueOnce({
      valid: false,
      error: 'Invalid project path',
    });

    const response = await request(app).get('/api/ci/workflows?project=bad-project').expect(500);

    expect(response.body.error).toContain('Invalid project path');
  });

  test('executes workflow steps successfully', async () => {
    const runResponse = await request(app)
      .post('/api/ci/run')
      .send({
        project: 'test-project',
        workflowFile: 'ci.yml',
        selectedSteps: ['build-step-0'],
        env: {},
      })
      .expect(200);

    expect(runResponse.body.status).toBe('started');
    await waitForQueue();
    expect(mockSpawn).toHaveBeenCalled();

    const runId = runResponse.body.runId;
    expect(mockProcesses.length).toBeGreaterThan(0);
    mockProcesses[0].emitStdout('done');
    mockProcesses[0].emitClose(0);
    await waitForQueue();

    const statusResponse = await request(app).get(`/api/ci/run/${runId}`).expect(200);

    expect(statusResponse.body.status).toBe('success');
    expect(statusResponse.body.jobs[0].steps[0].output).toContain('done');
  });

  test('cancels a running workflow and terminates processes', async () => {
    const runResponse = await request(app)
      .post('/api/ci/run')
      .send({
        project: 'test-project',
        workflowFile: 'ci.yml',
        selectedSteps: ['build-step-0'],
        env: {},
      })
      .expect(200);

    const runId = runResponse.body.runId;
    await waitForQueue();
    expect(mockProcesses.length).toBeGreaterThan(0);

    const cancelResponse = await request(app).post(`/api/ci/run/${runId}/cancel`).expect(200);

    expect(cancelResponse.body.run.status).toBe('cancelled');
    expect(mockProcesses[0].kill).toHaveBeenCalled();

    // ensure internal workflow cleanup finishes after kill-triggered close
    await waitForQueue();

    const statusResponse = await request(app).get(`/api/ci/run/${runId}`).expect(200);

    expect(statusResponse.body.status).toBe('cancelled');
    expect(statusResponse.body.jobs[0].steps[0].status).toBe('cancelled');
  });

  test('honors working-directory for steps', async () => {
    mockFs.readFile.mockResolvedValueOnce(WORKFLOW_WITH_WORKDIR);

    const runResponse = await request(app)
      .post('/api/ci/run')
      .send({
        project: 'test-project',
        workflowFile: 'ci.yml',
        selectedSteps: ['build-step-0'],
        env: {},
      })
      .expect(200);

    expect(runResponse.body.status).toBe('started');
    await waitForQueue();

    const spawnCall = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
    expect(spawnCall[0]).toContain('echo "running"');
    expect(spawnCall[1]).toMatchObject({ cwd: '/projects/sample/subdir' });

    mockProcesses[mockProcesses.length - 1].emitClose(0);
    await waitForQueue();
  });
});
