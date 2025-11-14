import { render, screen, waitFor, fireEvent, userEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  mockAuth,
  mockProjects,
  mockTasks,
  mockTaskMaster,
  mockGit,
  mockNetworkError,
  resetMswHandlers,
  createMockUser,
  createMockProject,
  createMockTask,
  waitForMswRequest,
  mockApiEndpoint
} from '../utils/msw-utils';

// Mock components for testing API interactions
const TestAuthComponent = ({ onLogin, onLogout }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleLogin = async (username, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        onLogin?.(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => handleLogin('testuser', 'testpass')} data-testid="login-btn">
        Login
      </button>
      <button onClick={() => handleLogin('wronguser', 'wrongpass')} data-testid="login-fail-btn">
        Login Fail
      </button>
      <button onClick={() => onLogout?.()} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
};

const TestProjectsComponent = () => {
  const [projects, setProjects] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (response.ok) {
        setProjects(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="projects-count">{projects.length}</div>
      <button onClick={fetchProjects} data-testid="fetch-projects-btn">
        Fetch Projects
      </button>
      <div data-testid="projects-list">
        {projects.map(project => (
          <div key={project.id} data-testid={`project-${project.id}`}>
            {project.name}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('API Scenarios with MSW', () => {
  beforeEach(() => {
    resetMswHandlers();
  });

  describe('Authentication Scenarios', () => {
    it('handles successful login', async () => {
      const mockUser = createMockUser();
      mockAuth.success(mockUser);

      const onLogin = jest.fn();
      render(<TestAuthComponent onLogin={onLogin} />);

      const loginBtn = screen.getByTestId('login-btn');
      await userEvent.click(loginBtn);

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith({
          user: mockUser,
          token: 'mock-jwt-token',
          expiresIn: 3600
        });
      });

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('handles failed login with invalid credentials', async () => {
      mockAuth.unauthorized();

      render(<TestAuthComponent />);

      const loginFailBtn = screen.getByTestId('login-fail-btn');
      await userEvent.click(loginFailBtn);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('handles server error during login', async () => {
      mockAuth.serverError();

      render(<TestAuthComponent />);

      const loginBtn = screen.getByTestId('login-btn');
      await userEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Internal server error');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('handles network error during login', async () => {
      mockAuth.networkError();

      render(<TestAuthComponent />);

      const loginBtn = screen.getByTestId('login-btn');
      await userEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });

  describe('Projects Scenarios', () => {
    it('loads projects successfully', async () => {
      const mockProjectsList = [
        createMockProject({ id: 1, name: 'Project 1' }),
        createMockProject({ id: 2, name: 'Project 2' })
      ];
      mockProjects.success(mockProjectsList);

      render(<TestProjectsComponent />);

      const fetchBtn = screen.getByTestId('fetch-projects-btn');
      await userEvent.click(fetchBtn);

      await waitFor(() => {
        expect(screen.getByTestId('projects-count')).toHaveTextContent('2');
      });

      expect(screen.getByTestId('project-1')).toHaveTextContent('Project 1');
      expect(screen.getByTestId('project-2')).toHaveTextContent('Project 2');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    it('handles empty projects list', async () => {
      mockProjects.empty();

      render(<TestProjectsComponent />);

      const fetchBtn = screen.getByTestId('fetch-projects-btn');
      await userEvent.click(fetchBtn);

      await waitFor(() => {
        expect(screen.getByTestId('projects-count')).toHaveTextContent('0');
      });

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    it('handles projects fetch error', async () => {
      mockProjects.error();

      render(<TestProjectsComponent />);

      const fetchBtn = screen.getByTestId('fetch-projects-btn');
      await userEvent.click(fetchBtn);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch projects');
      });

      expect(screen.getByTestId('projects-count')).toHaveTextContent('0');
    });
  });

  describe('Tasks Scenarios', () => {
    it('loads tasks successfully', async () => {
      const mockTasksList = [
        createMockTask({ id: 1, title: 'Task 1', status: 'done' }),
        createMockTask({ id: 2, title: 'Task 2', status: 'in-progress' })
      ];
      mockTasks.success(mockTasksList);

      const response = await fetch('/api/tasks');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toEqual(mockTasksList);
    });

    it('creates a new task successfully', async () => {
      const newTask = createMockTask({ id: 3, title: 'New Task' });
      mockTasks.createSuccess(newTask);

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Task',
          description: 'Task description',
          projectId: 1
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toEqual(newTask);
    });

    it('updates a task successfully', async () => {
      const updatedTask = createMockTask({ id: 1, title: 'Updated Task', status: 'done' });
      mockTasks.updateSuccess(updatedTask);

      const response = await fetch('/api/tasks/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Task',
          status: 'done'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toEqual(updatedTask);
    });

    it('deletes a task successfully', async () => {
      mockTasks.deleteSuccess(1);

      const response = await fetch('/api/tasks/1', {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.message).toBe('Task deleted successfully');
    });

    it('handles task not found', async () => {
      mockTasks.notFound(999);

      const response = await fetch('/api/tasks/999');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(data.error).toBe('Task not found');
    });
  });

  describe('TaskMaster Scenarios', () => {
    it('returns TaskMaster status as ready', async () => {
      mockTaskMaster.statusReady();

      const response = await fetch('/api/taskmaster/status');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.isReady).toBe(true);
      expect(data.taskmaster.hasTaskmaster).toBe(true);
    });

    it('returns TaskMaster status as not installed', async () => {
      mockTaskMaster.statusNotInstalled();

      const response = await fetch('/api/taskmaster/status');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.isInstalled).toBe(false);
      expect(data.isReady).toBe(false);
    });

    it('generates tasks successfully', async () => {
      mockTaskMaster.generateSuccess(10);

      const response = await fetch('/api/taskmaster/generate/test-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Generate development tasks',
          numTasks: 10
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.tasksGenerated).toBe(10);
    });
  });

  describe('Git Scenarios', () => {
    it('returns clean git status', async () => {
      mockGit.statusClean();

      const response = await fetch('/api/git/status/test-project');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.clean).toBe(true);
      expect(data.untracked).toHaveLength(0);
      expect(data.modified).toHaveLength(0);
    });

    it('returns dirty git status', async () => {
      mockGit.statusDirty();

      const response = await fetch('/api/git/status/test-project');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.clean).toBe(false);
      expect(data.untracked).toContain('new-file.js');
      expect(data.modified).toContain('src/App.jsx');
    });

    it('returns git log successfully', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'feat: Add new feature',
          author: 'Test User',
          date: '2024-01-05T10:00:00Z'
        }
      ];
      mockGit.logSuccess(mockCommits);

      const response = await fetch('/api/git/log/test-project');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.commits).toEqual(mockCommits);
    });

    it('commits changes successfully', async () => {
      mockGit.commitSuccess('Test commit message', ['file1.js', 'file2.js']);

      const response = await fetch('/api/git/commit/test-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test commit message',
          files: ['file1.js', 'file2.js']
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.message).toBe('Test commit message');
      expect(data.author).toBe('Test User');
      expect(data.files).toEqual(['file1.js', 'file2.js']);
    });
  });

  describe('Error Scenarios', () => {
    it('handles network error gracefully', async () => {
      mockNetworkError('get', '/api/projects');

      const fetchProjects = async () => {
        try {
          const response = await fetch('/api/projects');
          return await response.json();
        } catch (error) {
          return { error: error.message };
        }
      };

      const result = await fetchProjects();

      // Network errors throw in fetch, not return response
      expect(result).toBeDefined();
    });

    it('handles 500 server error', async () => {
      const mockHandler = mockApiEndpoint('get', '/api/error/500', 500, {
        error: 'Internal Server Error'
      });

      const response = await fetch('/api/error/500');
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('handles 404 not found', async () => {
      const mockHandler = mockApiEndpoint('get', '/api/error/404', 404, {
        error: 'Not Found'
      });

      const response = await fetch('/api/error/404');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
    });
  });

  describe('Performance Scenarios', () => {
    it('handles slow responses', async () => {
      const startTime = Date.now();

      const mockHandler = mockApiEndpoint('get', '/api/slow-endpoint', 200,
        { message: 'Slow response' },
        { delay: 1000 }
      );

      const response = await fetch('/api/slow-endpoint');
      const data = await response.json();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(data.message).toBe('Slow response');
      expect(duration).toBeGreaterThan(900); // Should take at least 1 second
    });
  });
});

// Need to import React for JSX
import React from 'react';