// Mock Service Worker setup for API and WebSocket mocking
import { setupServer } from 'msw/node';
import { http } from 'msw';
import { jest } from '@jest/globals';

// Re-export http for tests (MSW v2 uses http instead of rest)
export { http };

// Mock handlers for API endpoints
export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    const username = body?.username;
    const password = body?.password;

    if (username === 'testuser' && password === 'password123') {
      return Response.json({
        success: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com' },
        token: 'mock-jwt-token'
      });
    }

    return Response.json({
      success: false,
      error: 'Invalid credentials'
    }, { status: 401 });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json();
    const { username, email, password } = body || {};

    if (username && email && password) {
      return Response.json({
        success: true,
        user: { id: 2, username, email },
        token: 'mock-jwt-token-new'
      }, { status: 201 });
    }

    return Response.json({
      success: false,
      error: 'Missing required fields'
    }, { status: 400 });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (authHeader === 'Bearer mock-jwt-token') {
      return Response.json({
        success: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com' }
      });
    }

    return Response.json({
      success: false,
      error: 'Invalid token'
    }, { status: 401 });
  }),

  http.get('/api/auth/user', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (authHeader === 'Bearer mock-jwt-token') {
      return Response.json({
        success: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com' }
      });
    }

    return Response.json({
      success: false,
      error: 'Invalid token'
    }, { status: 401 });
  }),

  http.get('/api/auth/status', () => {
    return Response.json({
      success: true,
      needsSetup: false
    });
  }),

  http.post('/api/auth/logout', () => {
    return Response.json({
      success: true,
      message: 'Logged out successfully'
    });
  }),

  // Projects endpoints
  http.get('/api/projects', () => {
    return Response.json({
      success: true,
      projects: [
        {
          id: 1,
          name: 'Test Project',
          path: '/home/user/test-project',
          description: 'A test project',
          lastModified: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Another Project',
          path: '/home/user/another-project',
          description: 'Another test project',
          lastModified: new Date().toISOString()
        }
      ]
    });
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json();
    const { name, path, description } = body;

    if (name && path) {
      return Response.json({
        success: true,
        project: {
          id: 3,
          name,
          path,
          description: description || '',
          lastModified: new Date().toISOString()
        }
      }, { status: 201 });
    }

    return Response.json({
      success: false,
      error: 'Name and path are required'
    }, { status: 400 });
  }),

  http.get('/api/projects/:id', ({ params }) => {
    const { id } = params;

    if (id === '1') {
      return Response.json({
        success: true,
        project: {
          id: 1,
          name: 'Test Project',
          path: '/home/user/test-project',
          description: 'A test project',
          lastModified: new Date().toISOString()
        }
      });
    }

    return Response.json({
      success: false,
      error: 'Project not found'
    }, { status: 404 });
  }),

  // Git endpoints
  http.get('/api/git/status', ({ request }) => {
    const url = new URL(request.url);
    const project = url.searchParams.get('project');

    if (project) {
      return Response.json({
        success: true,
        status: ' M modified.txt\n?? new.txt\n',
        branch: 'main'
      });
    }

    return Response.json({
      success: false,
      error: 'Project parameter is required'
    }, { status: 400 });
  }),

  http.get('/api/git/log', ({ request }) => {
    const url = new URL(request.url);
    const project = url.searchParams.get('project');

    if (project) {
      return Response.json({
        success: true,
        commits: [
          {
            hash: 'abc123',
            message: 'Latest commit',
            author: 'Test User',
            date: new Date().toISOString()
          },
          {
            hash: 'def456',
            message: 'Previous commit',
            author: 'Test User',
            date: new Date(Date.now() - 86400000).toISOString()
          }
        ]
      });
    }

    return Response.json({
      success: false,
      error: 'Project parameter is required'
    }, { status: 400 });
  }),

  // Settings endpoints
  http.get('/api/settings', () => {
    return Response.json({
      success: true,
      settings: {
        theme: 'light',
        fontSize: 14,
        autoSave: true,
        lineNumbers: true,
        wordWrap: true
      }
    });
  }),

  http.put('/api/settings', async ({ request }) => {
    const settings = await request.json();

    return Response.json({
      success: true,
      settings: { ...settings }
    });
  }),

  // File system endpoints
  http.get('/api/files/*', () => {
    return Response.json({
      success: true,
      content: 'Mock file content for testing'
    });
  }),

  http.post('/api/files/*', async ({ request }) => {
    const { content } = await request.json();

    return Response.json({
      success: true,
      message: 'File saved successfully'
    });
  }),

  // Claude API endpoints
  http.post('/api/claude/chat', async ({ request }) => {
    const { message, sessionId } = await request.json();

    // Simulate streaming response
    return Response.json({
      success: true,
      response: `Mock Claude response to: ${message}`,
      sessionId,
      timestamp: new Date().toISOString()
    });
  }),

  // Error simulation endpoints
  http.get('/api/error/500', () => {
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }),

  http.get('/api/error/404', () => {
    return Response.json({
      success: false,
      error: 'Not found'
    }, { status: 404 });
  }),

  http.get('/api/error/network', () => {
    return Response.error();
  })
];

// Create MSW server
export const server = setupServer(...handlers);

// Mock WebSocket for testing
export const mockWebSocket = {
  instances: [],

  create: jest.fn(() => {
    const ws = {
      readyState: 1, // WebSocket.OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),

      // Simulate receiving messages
      simulateMessage: (data) => {
        const messageHandler = ws.addEventListener.mock.calls.find(
          call => call[0] === 'message'
        );
        if (messageHandler) {
          messageHandler[1]({ data: JSON.stringify(data) });
        }
      },

      // Simulate connection open
      simulateOpen: () => {
        const openHandler = ws.addEventListener.mock.calls.find(
          call => call[0] === 'open'
        );
        if (openHandler) {
          openHandler[1]({ type: 'open' });
        }
      },

      // Simulate connection close
      simulateClose: () => {
        const closeHandler = ws.addEventListener.mock.calls.find(
          call => call[0] === 'close'
        );
        if (closeHandler) {
          closeHandler[1]({ type: 'close' });
        }
      },

      // Simulate connection error
      simulateError: (error) => {
        const errorHandler = ws.addEventListener.mock.calls.find(
          call => call[0] === 'error'
        );
        if (errorHandler) {
          errorHandler[1]({ type: 'error', error });
        }
      }
    };

    mockWebSocket.instances.push(ws);
    return ws;
  })
};

// Setup global WebSocket mock
global.WebSocket = mockWebSocket.create;

// Export helper functions for tests
export const createMockWebSocket = () => mockWebSocket.create();

export const getLastWebSocket = () => {
  return mockWebSocket.instances[mockWebSocket.instances.length - 1];
};

export const clearWebSocketMocks = () => {
  mockWebSocket.instances = [];
  mockWebSocket.create.mockClear();
};

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  ...overrides
});

export const createMockProject = (overrides = {}) => ({
  id: 1,
  name: 'Test Project',
  path: '/home/user/test-project',
  description: 'A test project',
  lastModified: new Date().toISOString(),
  ...overrides
});

export const createMockGitCommit = (overrides = {}) => ({
  hash: 'abc123',
  message: 'Test commit',
  author: 'Test User',
  date: new Date().toISOString(),
  ...overrides
});

export const createMockSettings = (overrides = {}) => ({
  theme: 'light',
  fontSize: 14,
  autoSave: true,
  lineNumbers: true,
  wordWrap: true,
  ...overrides
});