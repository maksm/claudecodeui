import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskMasterProvider, useTaskMaster } from '../../../src/contexts/TaskMasterContext.jsx';
import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/utils/api');

// Mock AuthContext
jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock WebSocketContext
jest.mock('../../../src/contexts/WebSocketContext', () => ({
  useWebSocketContext: jest.fn(),
}));

// Test component to use the TaskMaster context
const TestComponent = () => {
  const {
    projects,
    currentProject,
    tasks,
    nextTask,
    isLoading,
    isLoadingTasks,
    error,
    refreshProjects,
    setCurrentProject,
    refreshTasks,
    clearError,
  } = useTaskMaster();

  return (
    <div data-testid="taskmaster-test">
      <div data-testid="projects-count">{projects.length}</div>
      <div data-testid="current-project">{currentProject?.name || 'none'}</div>
      <div data-testid="tasks-count">{tasks.length}</div>
      <div data-testid="next-task">{nextTask?.title || 'none'}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="loading-tasks">{isLoadingTasks.toString()}</div>
      <div data-testid="error">{error || 'none'}</div>

      <button onClick={refreshProjects} data-testid="refresh-projects">
        Refresh Projects
      </button>
      <button onClick={() => setCurrentProject({ name: 'test-project' })} data-testid="set-project">
        Set Project
      </button>
      <button onClick={refreshTasks} data-testid="refresh-tasks">
        Refresh Tasks
      </button>
      <button onClick={clearError} data-testid="clear-error">
        Clear Error
      </button>
    </div>
  );
};

const renderWithTaskMasterProvider = (authProps = {}, wsProps = {}) => {
  const { useAuth } = require('../../../src/contexts/AuthContext');
  const { useWebSocketContext } = require('../../../src/contexts/WebSocketContext');

  // Default auth mock
  useAuth.mockReturnValue({
    user: { username: 'testuser' },
    token: 'test-token',
    isLoading: false,
    ...authProps,
  });

  // Default WebSocket mock
  useWebSocketContext.mockReturnValue({
    messages: [],
    ...wsProps,
  });

  return render(
    <TaskMasterProvider>
      <TestComponent />
    </TaskMasterProvider>
  );
};

describe('TaskMasterContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with empty state', () => {
      renderWithTaskMasterProvider();

      expect(screen.getByTestId('projects-count')).toHaveTextContent('0');
      expect(screen.getByTestId('current-project')).toHaveTextContent('none');
      expect(screen.getByTestId('tasks-count')).toHaveTextContent('0');
      expect(screen.getByTestId('next-task')).toHaveTextContent('none');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('loading-tasks')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('none');
    });

    it('does not make API calls when user is not authenticated', () => {
      renderWithTaskMasterProvider({ user: null, token: null });

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('Projects Loading', () => {
    it('loads projects on mount when authenticated', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', taskmaster: { hasTaskmaster: true } },
        { id: 2, name: 'Project 2', taskmaster: null },
      ];
      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProjects),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        });

      renderWithTaskMasterProvider();

      expect(api.get).toHaveBeenCalledWith('/projects');

      await waitFor(() => {
        expect(screen.getByTestId('projects-count')).toHaveTextContent('2');
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('enriches projects with TaskMaster metadata', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project 1',
          taskmaster: {
            hasTaskmaster: true,
            status: 'ready',
            metadata: { taskCount: 5, completed: 2 },
          },
        },
      ];

      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProjects),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        });

      renderWithTaskMasterProvider();

      await waitFor(() => {
        expect(screen.getByTestId('projects-count')).toHaveTextContent('1');
      });
    });

    it('handles API errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      api.get = jest.fn().mockRejectedValue(new Error('Network error'));

      renderWithTaskMasterProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('none');
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      consoleError.mockRestore();
    });
  });

  describe('Current Project Management', () => {
    it('sets current project when setCurrentProject is called', async () => {
      const user = userEvent.setup();
      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ taskmaster: { hasTaskmaster: true } }),
        });

      renderWithTaskMasterProvider();

      await user.click(screen.getByTestId('set-project'));

      expect(screen.getByTestId('current-project')).toHaveTextContent('test-project');
    });

    it('clears tasks when switching projects', async () => {
      const user = userEvent.setup();
      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ taskmaster: { hasTaskmaster: true } }),
        });

      renderWithTaskMasterProvider();

      await user.click(screen.getByTestId('set-project'));

      expect(screen.getByTestId('tasks-count')).toHaveTextContent('0');
    });
  });

  describe('Tasks Management', () => {
    it('loads tasks for current project', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'completed' },
      ];

      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([{ name: 'test-project' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            taskmaster: { hasTaskmaster: true },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ tasks: mockTasks }),
        });

      const SetProjectButton = () => {
        const { setCurrentProject } = useTaskMaster();
        return (
          <button
            onClick={() => setCurrentProject({ name: 'test-project' })}
            data-testid="internal-set-project"
          >
            Set Project
          </button>
        );
      };

      render(
        <TaskMasterProvider>
          <div>
            <TestComponent />
            <SetProjectButton />
          </div>
        </TaskMasterProvider>
      );

      const user = userEvent.setup();
      await user.click(screen.getByTestId('internal-set-project'));

      await waitFor(() => {
        expect(screen.getByTestId('tasks-count')).toHaveTextContent('2');
        expect(screen.getByTestId('next-task')).toHaveTextContent('Task 1'); // First pending task
      });
    });

    it('finds next task from pending/in-progress tasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'completed' },
        { id: 2, title: 'Task 2', status: 'in-progress' },
        { id: 3, title: 'Task 3', status: 'pending' },
      ];

      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([{ name: 'test-project' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            taskmaster: { hasTaskmaster: true },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ tasks: mockTasks }),
        });

      const SetProjectButton = () => {
        const { setCurrentProject } = useTaskMaster();
        return (
          <button
            onClick={() => setCurrentProject({ name: 'test-project' })}
            data-testid="internal-set-project"
          >
            Set Project
          </button>
        );
      };

      render(
        <TaskMasterProvider>
          <div>
            <TestComponent />
            <SetProjectButton />
          </div>
        </TaskMasterProvider>
      );

      const user = userEvent.setup();
      await user.click(screen.getByTestId('internal-set-project'));

      await waitFor(() => {
        expect(screen.getByTestId('next-task')).toHaveTextContent('Task 2'); // First in-progress task
      });
    });
  });

  describe('WebSocket Message Handling', () => {
    it('refreshes projects on taskmaster-project-updated message', async () => {
      const mockProjects = [{ name: 'Project 1' }];
      const mockMessage = { type: 'taskmaster-project-updated', projectName: 'Project 1' };

      api.get = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ isReady: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockProjects),
        });

      renderWithTaskMasterProvider({ messages: [mockMessage] });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/projects');
      });
    });
  });

  describe('Error Handling', () => {
    it('clears error state when clearError is called', async () => {
      const user = userEvent.setup();
      api.get = jest.fn().mockRejectedValue(new Error('Test error'));

      renderWithTaskMasterProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('none');
      });

      await user.click(screen.getByTestId('clear-error'));

      expect(screen.getByTestId('error')).toHaveTextContent('none');
    });
  });

  describe('useTaskMaster Hook Error', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTaskMaster must be used within a TaskMasterProvider');

      consoleError.mockRestore();
    });
  });

  describe('Context Value', () => {
    it('provides all required context properties', () => {
      const { result } = renderHook(() => useTaskMaster(), {
        wrapper: ({ children }) => <TaskMasterProvider>{children}</TaskMasterProvider>,
      });

      expect(result.current).toMatchObject({
        projects: expect.any(Array),
        currentProject: null,
        tasks: expect.any(Array),
        nextTask: null,
        isLoading: expect.any(Boolean),
        isLoadingTasks: expect.any(Boolean),
        error: expect.any(String),
        refreshProjects: expect.any(Function),
        setCurrentProject: expect.any(Function),
        refreshTasks: expect.any(Function),
        refreshMCPStatus: expect.any(Function),
        clearError: expect.any(Function),
      });
    });
  });
});
