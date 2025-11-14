import { http } from 'msw';

// Mock data
const mockProjects = [
  {
    id: 1,
    name: 'Test Project 1',
    path: '/home/maks/test-project-1',
    description: 'A test project for development',
    createdAt: '2024-01-01T00:00:00Z',
    sessions: [
      { id: 'session-1', name: 'Initial Setup', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'session-2', name: 'Feature Development', createdAt: '2024-01-02T00:00:00Z' },
    ],
  },
  {
    id: 2,
    name: 'Test Project 2',
    path: '/home/maks/test-project-2',
    description: 'Another test project',
    createdAt: '2024-01-03T00:00:00Z',
    sessions: [{ id: 'session-3', name: 'Bug Fixing', createdAt: '2024-01-04T00:00:00Z' }],
  },
];

const mockTasks = [
  {
    id: 1,
    title: 'Setup development environment',
    description: 'Configure development tools and environment',
    status: 'done',
    priority: 'high',
    projectId: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T02:00:00Z',
  },
  {
    id: 2,
    title: 'Implement user authentication',
    description: 'Add login and registration functionality',
    status: 'in-progress',
    priority: 'high',
    projectId: 1,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T01:00:00Z',
  },
  {
    id: 3,
    title: 'Create dashboard UI',
    description: 'Design and implement the main dashboard',
    status: 'pending',
    priority: 'medium',
    projectId: 2,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
];

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00Z',
  lastLogin: '2024-01-05T12:00:00Z',
};

const mockTaskMasterStatus = {
  isInstalled: true,
  version: '1.0.0',
  isReady: true,
  taskmaster: {
    hasTaskmaster: true,
    version: '2.1.0',
  },
  npx: {
    hasNpx: true,
    version: '10.0.0',
  },
};

const mockGitStatus = {
  branch: 'main',
  ahead: 2,
  behind: 0,
  untracked: ['file1.js', 'file2.css'],
  modified: ['src/App.jsx', 'README.md'],
  staged: ['package.json'],
  clean: false,
};

const mockGitLog = [
  {
    hash: 'abc123',
    message: 'feat: Add new feature',
    author: 'Test User',
    date: '2024-01-05T10:00:00Z',
    files: ['src/new-feature.js'],
  },
  {
    hash: 'def456',
    message: 'fix: Resolve bug in authentication',
    author: 'Test User',
    date: '2024-01-04T15:30:00Z',
    files: ['src/auth.js'],
  },
];

// API Handlers
export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', (req, res, ctx) => {
    const { username, password } = req.body;

    if (username === 'testuser' && password === 'testpass') {
      return res(
        ctx.status(200),
        ctx.json({
          user: mockUser,
          token: 'mock-jwt-token',
          expiresIn: 3600,
        })
      );
    }

    if (username === 'platform-user' && password === 'platform-pass') {
      return res(
        ctx.status(200),
        ctx.json({
          user: { ...mockUser, username: 'platform-user', role: 'admin' },
          token: 'mock-platform-jwt-token',
          expiresIn: 3600,
        })
      );
    }

    return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
  }),

  http.post('/api/auth/register', (req, res, ctx) => {
    const { username, email, password } = req.body;

    if (username && email && password) {
      return res(
        ctx.status(201),
        ctx.json({
          user: { ...mockUser, username, email },
          token: 'mock-registration-token',
          expiresIn: 3600,
        })
      );
    }

    return res(ctx.status(400), ctx.json({ error: 'Missing required fields' }));
  }),

  http.post('/api/auth/logout', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ message: 'Logged out successfully' }));
  }),

  http.get('/api/auth/me', (req, res, ctx) => {
    const token = req.headers.get('authorization');

    if (token === 'Bearer mock-jwt-token') {
      return res(ctx.status(200), ctx.json({ user: mockUser }));
    }

    if (token === 'Bearer mock-platform-jwt-token') {
      return res(
        ctx.status(200),
        ctx.json({ user: { ...mockUser, username: 'platform-user', role: 'admin' } })
      );
    }

    return res(ctx.status(401), ctx.json({ error: 'Invalid token' }));
  }),

  http.post('/api/auth/setup', (req, res, ctx) => {
    const { username, email, password } = req.body;

    if (username && email && password) {
      return res(
        ctx.status(200),
        ctx.json({
          user: { ...mockUser, username, email },
          token: 'mock-setup-token',
          expiresIn: 3600,
        })
      );
    }

    return res(
      ctx.status(400),
      ctx.json({ error: 'Setup requires username, email, and password' })
    );
  }),

  // Projects endpoints
  http.get('/api/projects', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockProjects));
  }),

  http.get('/api/projects/:id', (req, res, ctx) => {
    const { id } = req.params;
    const project = mockProjects.find(p => p.id === parseInt(id));

    if (!project) {
      return res(ctx.status(404), ctx.json({ error: 'Project not found' }));
    }

    return res(ctx.status(200), ctx.json(project));
  }),

  http.post('/api/projects', (req, res, ctx) => {
    const { name, path, description } = req.body;

    if (!name || !path) {
      return res(ctx.status(400), ctx.json({ error: 'Name and path are required' }));
    }

    const newProject = {
      id: mockProjects.length + 1,
      name,
      path,
      description: description || '',
      createdAt: new Date().toISOString(),
      sessions: [],
    };

    mockProjects.push(newProject);

    return res(ctx.status(201), ctx.json(newProject));
  }),

  // Sessions endpoints
  http.get('/api/projects/:projectId/sessions', (req, res, ctx) => {
    const { projectId } = req.params;
    const project = mockProjects.find(p => p.id === parseInt(projectId));

    if (!project) {
      return res(ctx.status(404), ctx.json({ error: 'Project not found' }));
    }

    return res(ctx.status(200), ctx.json(project.sessions));
  }),

  http.post('/api/projects/:projectId/sessions', (req, res, ctx) => {
    const { projectId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res(ctx.status(400), ctx.json({ error: 'Session name is required' }));
    }

    const project = mockProjects.find(p => p.id === parseInt(projectId));
    if (!project) {
      return res(ctx.status(404), ctx.json({ error: 'Project not found' }));
    }

    const newSession = {
      id: `session-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
    };

    project.sessions.push(newSession);

    return res(ctx.status(201), ctx.json(newSession));
  }),

  http.delete('/api/sessions/:sessionId', (req, res, ctx) => {
    const { sessionId } = req.params;

    // Find and remove session
    for (const project of mockProjects) {
      const sessionIndex = project.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        project.sessions.splice(sessionIndex, 1);
        return res(ctx.status(200), ctx.json({ message: 'Session deleted successfully' }));
      }
    }

    return res(ctx.status(404), ctx.json({ error: 'Session not found' }));
  }),

  // Tasks endpoints
  http.get('/api/tasks', (req, res, ctx) => {
    const { projectId } = req.url.searchParams;

    if (projectId) {
      const filteredTasks = mockTasks.filter(task => task.projectId === parseInt(projectId));
      return res(ctx.status(200), ctx.json(filteredTasks));
    }

    return res(ctx.status(200), ctx.json(mockTasks));
  }),

  http.get('/api/tasks/:id', (req, res, ctx) => {
    const { id } = req.params;
    const task = mockTasks.find(t => t.id === parseInt(id));

    if (!task) {
      return res(ctx.status(404), ctx.json({ error: 'Task not found' }));
    }

    return res(ctx.status(200), ctx.json(task));
  }),

  http.post('/api/tasks', (req, res, ctx) => {
    const { title, description, priority, projectId } = req.body;

    if (!title || !projectId) {
      return res(ctx.status(400), ctx.json({ error: 'Title and projectId are required' }));
    }

    const newTask = {
      id: mockTasks.length + 1,
      title,
      description: description || '',
      status: 'pending',
      priority: priority || 'medium',
      projectId: parseInt(projectId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockTasks.push(newTask);

    return res(ctx.status(201), ctx.json(newTask));
  }),

  http.put('/api/tasks/:id', (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body;

    const taskIndex = mockTasks.findIndex(t => t.id === parseInt(id));

    if (taskIndex === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Task not found' }));
    }

    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return res(ctx.status(200), ctx.json(mockTasks[taskIndex]));
  }),

  http.delete('/api/tasks/:id', (req, res, ctx) => {
    const { id } = req.params;
    const taskIndex = mockTasks.findIndex(t => t.id === parseInt(id));

    if (taskIndex === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Task not found' }));
    }

    mockTasks.splice(taskIndex, 1);

    return res(ctx.status(200), ctx.json({ message: 'Task deleted successfully' }));
  }),

  // Git endpoints
  http.get('/api/git/status/:projectPath', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockGitStatus));
  }),

  http.get('/api/git/log/:projectPath', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ commits: mockGitLog }));
  }),

  http.post('/api/git/commit/:projectPath', (req, res, ctx) => {
    const { message, files } = req.body;

    if (!message) {
      return res(ctx.status(400), ctx.json({ error: 'Commit message is required' }));
    }

    return res(
      ctx.status(200),
      ctx.json({
        hash: `commit-${Date.now()}`,
        message,
        author: 'Test User',
        date: new Date().toISOString(),
        files: files || [],
      })
    );
  }),

  // TaskMaster endpoints
  http.get('/api/taskmaster/status', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockTaskMasterStatus));
  }),

  http.post('/api/taskmaster/init/:projectPath', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        message: 'TaskMaster initialized successfully',
        projectPath: req.params.projectPath,
      })
    );
  }),

  http.get('/api/taskmaster/tasks/:projectPath', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        tasks: mockTasks,
        total: mockTasks.length,
      })
    );
  }),

  http.post('/api/taskmaster/generate/:projectPath', (req, res, ctx) => {
    const { numTasks, prompt } = req.body;

    return res(
      ctx.status(200),
      ctx.json({
        message: 'Tasks generated successfully',
        tasksGenerated: numTasks || 5,
        prompt: prompt || 'Generate development tasks',
      })
    );
  }),

  // Cursor CLI endpoints
  http.get('/api/cursor/status', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        installed: true,
        version: '1.0.0',
        ready: true,
      })
    );
  }),

  http.post('/api/cursor/command', (req, res, ctx) => {
    const { command, args } = req.body;

    return res(
      ctx.status(200),
      ctx.json({
        output: `Mock cursor output for command: ${command} ${args?.join(' ') || ''}`,
        exitCode: 0,
      })
    );
  }),

  // MCP endpoints
  http.get('/api/mcp/servers', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        servers: [
          { name: 'task-master-ai', status: 'running', version: '0.31.2' },
          { name: 'filesystem', status: 'running', version: '1.0.0' },
        ],
      })
    );
  }),

  http.post('/api/mcp/servers/:serverName/execute', (req, res, ctx) => {
    const { serverName } = req.params;
    const { method, params } = req.body;

    return res(
      ctx.status(200),
      ctx.json({
        serverName,
        method,
        result: `Mock result for ${method} on ${serverName}`,
        params,
      })
    );
  }),

  // Claude SDK endpoints
  http.post('/api/claude/chat', (req, res, ctx) => {
    const { message, context } = req.body;

    return res(
      ctx.status(200),
      ctx.json({
        response: `Mock Claude response to: ${message}`,
        context: context || {},
        usage: { tokens: 50 },
      })
    );
  }),

  http.post('/api/claude/stream', (req, res, ctx) => {
    const { message } = req.body;

    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/plain'),
      ctx.body(
        `data: {"type": "content", "text": "Mock stream response for: ${message}"}\n\ndata: [DONE]\n`
      )
    );
  }),

  // Error simulation handlers
  http.get('/api/error/500', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }));
  }),

  http.get('/api/error/404', (req, res, ctx) => {
    return res(ctx.status(404), ctx.json({ error: 'Not Found' }));
  }),

  http.get('/api/error/network', (req, res, ctx) => {
    return res.networkError('Network error');
  }),

  http.get('/api/error/timeout', (req, res, ctx) => {
    return res(
      ctx.delay(10000), // 10 second delay to simulate timeout
      ctx.status(200),
      ctx.json({ message: 'This should timeout' })
    );
  }),
];

// WebSocket handlers for MSW
export const websocketHandlers = [
  // WebSocket connection handler
  {
    channel: 'ws://localhost:3001/ws',
    onConnect: (ws, req) => {
      console.log('WebSocket connected');

      // Send initial connection message
      ws.send(
        JSON.stringify({
          type: 'connection',
          status: 'connected',
          timestamp: new Date().toISOString(),
        })
      );
    },
    onMessage: (ws, message) => {
      try {
        const data = JSON.parse(message);

        // Handle different message types
        switch (data.type) {
          case 'claude-command':
            ws.send(
              JSON.stringify({
                type: 'claude-response',
                id: data.id,
                response: `Mock Claude response for: ${data.command}`,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          case 'cursor-command':
            ws.send(
              JSON.stringify({
                type: 'cursor-response',
                id: data.id,
                response: `Mock Cursor response for: ${data.command}`,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          case 'projects_updated':
            ws.send(
              JSON.stringify({
                type: 'projects_synced',
                projects: mockProjects,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          case 'session-aborted':
            ws.send(
              JSON.stringify({
                type: 'session_ended',
                sessionId: data.sessionId,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          default:
            ws.send(
              JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${data.type}`,
                timestamp: new Date().toISOString(),
              })
            );
        }
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message',
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
    onClose: () => {
      console.log('WebSocket disconnected');
    },
  },

  // Shell WebSocket handler
  {
    channel: 'ws://localhost:3001/shell',
    onConnect: (ws, req) => {
      console.log('Shell WebSocket connected');

      ws.send(
        JSON.stringify({
          type: 'shell-ready',
          timestamp: new Date().toISOString(),
        })
      );
    },
    onMessage: (ws, message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'shell-command':
            // Simulate shell command execution
            ws.send(
              JSON.stringify({
                type: 'shell-output',
                id: data.id,
                command: data.command,
                output: `Mock shell output for: ${data.command}`,
                exitCode: 0,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          case 'shell-resize':
            ws.send(
              JSON.stringify({
                type: 'shell-resized',
                cols: data.cols,
                rows: data.rows,
                timestamp: new Date().toISOString(),
              })
            );
            break;

          case 'shell-input':
            ws.send(
              JSON.stringify({
                type: 'shell-output',
                id: data.id,
                input: data.input,
                output: data.input, // Echo back input
                timestamp: new Date().toISOString(),
              })
            );
            break;

          default:
            ws.send(
              JSON.stringify({
                type: 'error',
                message: `Unknown shell message type: ${data.type}`,
                timestamp: new Date().toISOString(),
              })
            );
        }
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message',
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
    onClose: () => {
      console.log('Shell WebSocket disconnected');
    },
  },
];

export default handlers;
