import { server } from '../../src/mocks/server';
import { http } from 'msw';

// Helper utilities for MSW testing

/**
 * Mocks a specific API endpoint with custom response
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 * @param {number} status - Response status code
 * @param {Object} response - Response body
 * @param {Object} options - Additional options like delay
 */
export const mockApiEndpoint = (method, path, status, response, options = {}) => {
  const handler = http[method.toLowerCase()](path, (req, res, ctx) => {
    let result = res(status);

    if (options.delay) {
      result = result.delay(options.delay);
    }

    if (response) {
      result = result.json(response);
    }

    return result;
  });

  server.use(handler);
  return handler;
};

/**
 * Mocks network error for an endpoint
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 */
export const mockNetworkError = (method, path) => {
  const handler = http[method.toLowerCase()](path, (req, res, ctx) => {
    return res.networkError('Network error');
  });

  server.use(handler);
  return handler;
};

/**
 * Mocks timeout for an endpoint
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 * @param {number} timeout - Timeout in milliseconds
 */
export const mockTimeout = (method, path, timeout = 10000) => {
  const handler = http[method.toLowerCase()](path, (req, res, ctx) => {
    return res.delay(timeout);
  });

  server.use(handler);
  return handler;
};

/**
 * Mocks authentication endpoint with different scenarios
 */
export const mockAuth = {
  success: (user = { username: 'testuser', id: 1 }) => {
    return mockApiEndpoint('post', '/api/auth/login', 200, {
      user,
      token: 'mock-jwt-token',
      expiresIn: 3600,
    });
  },

  unauthorized: () => {
    return mockApiEndpoint('post', '/api/auth/login', 401, {
      error: 'Invalid credentials',
    });
  },

  serverError: () => {
    return mockApiEndpoint('post', '/api/auth/login', 500, {
      error: 'Internal server error',
    });
  },

  networkError: () => {
    return mockNetworkError('post', '/api/auth/login');
  },
};

/**
 * Mocks projects endpoint
 */
export const mockProjects = {
  success: (projects = []) => {
    return mockApiEndpoint('get', '/api/projects', 200, projects);
  },

  empty: () => {
    return mockApiEndpoint('get', '/api/projects', 200, []);
  },

  error: () => {
    return mockApiEndpoint('get', '/api/projects', 500, {
      error: 'Failed to fetch projects',
    });
  },
};

/**
 * Mocks tasks endpoint
 */
export const mockTasks = {
  success: (tasks = []) => {
    return mockApiEndpoint('get', '/api/tasks', 200, tasks);
  },

  byProject: (projectId, tasks = []) => {
    return mockApiEndpoint('get', `/api/tasks?projectId=${projectId}`, 200, tasks);
  },

  createSuccess: task => {
    return mockApiEndpoint('post', '/api/tasks', 201, task);
  },

  updateSuccess: task => {
    return mockApiEndpoint('put', `/api/tasks/${task.id}`, 200, task);
  },

  deleteSuccess: taskId => {
    return mockApiEndpoint('delete', `/api/tasks/${taskId}`, 200, {
      message: 'Task deleted successfully',
    });
  },

  notFound: taskId => {
    return mockApiEndpoint('get', `/api/tasks/${taskId}`, 404, {
      error: 'Task not found',
    });
  },
};

/**
 * Mocks WebSocket messages
 */
export const mockWebSocket = {
  simulateConnection: ws => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'connection',
          status: 'connected',
          timestamp: new Date().toISOString(),
        })
      );
    }
  },

  simulateClaudeResponse: (ws, message, response) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'claude-response',
          id: Date.now(),
          message: response || `Mock Claude response to: ${message}`,
          timestamp: new Date().toISOString(),
        })
      );
    }
  },

  simulateError: (ws, error) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: error || 'Mock WebSocket error',
          timestamp: new Date().toISOString(),
        })
      );
    }
  },

  simulateProjectsUpdated: (ws, projects) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'projects_updated',
          projects,
          timestamp: new Date().toISOString(),
        })
      );
    }
  },
};

/**
 * Mocks TaskMaster endpoints
 */
export const mockTaskMaster = {
  statusReady: () => {
    return mockApiEndpoint('get', '/api/taskmaster/status', 200, {
      isInstalled: true,
      version: '1.0.0',
      isReady: true,
      taskmaster: { hasTaskmaster: true, version: '2.1.0' },
    });
  },

  statusNotInstalled: () => {
    return mockApiEndpoint('get', '/api/taskmaster/status', 200, {
      isInstalled: false,
      isReady: false,
      taskmaster: { hasTaskmaster: false },
    });
  },

  tasksSuccess: (tasks = []) => {
    return mockApiEndpoint('get', '/api/taskmaster/tasks/:projectPath', 200, {
      tasks,
      total: tasks.length,
    });
  },

  generateSuccess: (numTasks = 5) => {
    return mockApiEndpoint('post', '/api/taskmaster/generate/:projectPath', 200, {
      message: 'Tasks generated successfully',
      tasksGenerated: numTasks,
    });
  },
};

/**
 * Mocks Git endpoints
 */
export const mockGit = {
  statusClean: () => {
    return mockApiEndpoint('get', '/api/git/status/:projectPath', 200, {
      branch: 'main',
      ahead: 0,
      behind: 0,
      clean: true,
      untracked: [],
      modified: [],
      staged: [],
    });
  },

  statusDirty: () => {
    return mockApiEndpoint('get', '/api/git/status/:projectPath', 200, {
      branch: 'feature-branch',
      ahead: 3,
      behind: 1,
      clean: false,
      untracked: ['new-file.js'],
      modified: ['src/App.jsx', 'README.md'],
      staged: ['package.json'],
    });
  },

  logSuccess: (commits = []) => {
    return mockApiEndpoint('get', '/api/git/log/:projectPath', 200, {
      commits,
    });
  },

  commitSuccess: (message, files = []) => {
    return mockApiEndpoint('post', '/api/git/commit/:projectPath', 200, {
      hash: `commit-${Date.now()}`,
      message,
      author: 'Test User',
      files,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Creates a mock user for testing
 * @param {Object} overrides - User properties to override
 */
export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00Z',
  lastLogin: '2024-01-05T12:00:00Z',
  ...overrides,
});

/**
 * Creates a mock project for testing
 * @param {Object} overrides - Project properties to override
 */
export const createMockProject = (overrides = {}) => ({
  id: 1,
  name: 'Test Project',
  path: '/home/maks/test-project',
  description: 'A test project',
  createdAt: '2024-01-01T00:00:00Z',
  sessions: [],
  ...overrides,
});

/**
 * Creates a mock task for testing
 * @param {Object} overrides - Task properties to override
 */
export const createMockTask = (overrides = {}) => ({
  id: 1,
  title: 'Test Task',
  description: 'A test task description',
  status: 'pending',
  priority: 'medium',
  projectId: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Waits for MSW request to be processed
 * @param {number} timeout - Timeout in milliseconds
 */
export const waitForMswRequest = (timeout = 100) => {
  return new Promise(resolve => setTimeout(resolve, timeout));
};

/**
 * Resets all MSW handlers to defaults
 */
export const resetMswHandlers = () => {
  server.resetHandlers();
};

/**
 * Cleans up all MSW handlers
 */
export const cleanupMswHandlers = () => {
  server.close();
};

export default {
  mockApiEndpoint,
  mockNetworkError,
  mockTimeout,
  mockAuth,
  mockProjects,
  mockTasks,
  mockWebSocket,
  mockTaskMaster,
  mockGit,
  createMockUser,
  createMockProject,
  createMockTask,
  waitForMswRequest,
  resetMswHandlers,
  cleanupMswHandlers,
};
