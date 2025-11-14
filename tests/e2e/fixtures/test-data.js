// Test data for E2E tests
export const testData = {
  // User credentials
  users: {
    valid: {
      username: 'testuser',
      password: 'testpass',
      email: 'test@example.com',
    },
    platform: {
      username: 'platform-user',
      password: 'platform-pass',
      email: 'platform@example.com',
      role: 'admin',
    },
    invalid: {
      username: 'wronguser',
      password: 'wrongpass',
    },
  },

  // Project data
  projects: [
    {
      name: 'Test Project 1',
      path: '/home/maks/test-project-1',
      description: 'A test project for development',
    },
    {
      name: 'Test Project 2',
      path: '/home/maks/test-project-2',
      description: 'Another test project',
    },
  ],

  // Tasks data
  tasks: [
    {
      title: 'Setup development environment',
      description: 'Configure development tools and environment',
      priority: 'high',
    },
    {
      title: 'Implement user authentication',
      description: 'Add login and registration functionality',
      priority: 'high',
    },
    {
      title: 'Create dashboard UI',
      description: 'Design and implement the main dashboard',
      priority: 'medium',
    },
  ],

  // Messages for chat interface
  chatMessages: [
    'Hello, how can you help me?',
    'Explain React testing with Playwright',
    'Create a simple component example',
    'What are React best practices?',
  ],

  // File tree data
  fileTree: [
    {
      name: 'src',
      type: 'directory',
      children: [
        {
          name: 'App.jsx',
          type: 'file',
          size: '2.5 KB',
        },
        {
          name: 'components',
          type: 'directory',
          children: [
            { name: 'Header.jsx', type: 'file', size: '1.2 KB' },
            { name: 'Footer.jsx', type: 'file', size: '0.8 KB' },
          ],
        },
      ],
    },
  ],

  // Settings configurations
  settings: {
    theme: {
      light: { mode: 'light', primaryColor: '#3b82f6' },
      dark: { mode: 'dark', primaryColor: '#8b5cf6' },
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: false,
    },
    api: {
      endpoint: 'http://localhost:3001/api',
      timeout: 5000,
      retries: 3,
    },
  },
};

export default testData;

// Helper functions to create test data
export function createTestUser(overrides = {}) {
  return {
    ...testData.users.valid,
    ...overrides,
  };
}

export function createTestProject(overrides = {}) {
  return {
    ...testData.projects[0],
    ...overrides,
  };
}

export function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}
