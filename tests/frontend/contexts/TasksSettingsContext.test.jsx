import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TasksSettingsProvider, useTasksSettings } from '../../../src/contexts/TasksSettingsContext.jsx';
import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/utils/api');

// Mock AuthContext
jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Test component to use the tasks settings context
const TestComponent = () => {
  const {
    tasksEnabled,
    setTasksEnabled,
    toggleTasksEnabled,
    isTaskMasterInstalled,
    isTaskMasterReady,
    installationStatus,
    isCheckingInstallation
  } = useTasksSettings();

  return (
    <div data-testid="tasks-settings-test">
      <div data-testid="tasks-enabled">{tasksEnabled.toString()}</div>
      <div data-testid="is-installed">{isTaskMasterInstalled?.toString() || 'null'}</div>
      <div data-testid="is-ready">{isTaskMasterReady?.toString() || 'null'}</div>
      <div data-testid="checking-installation">{isCheckingInstallation.toString()}</div>
      <div data-testid="installation-status">{installationStatus ? JSON.stringify(installationStatus) : 'null'}</div>

      <button onClick={() => setTasksEnabled(true)} data-testid="enable-tasks">
        Enable Tasks
      </button>
      <button onClick={() => setTasksEnabled(false)} data-testid="disable-tasks">
        Disable Tasks
      </button>
      <button onClick={toggleTasksEnabled} data-testid="toggle-tasks">
        Toggle Tasks
      </button>
    </div>
  );
};

const renderWithTasksSettingsProvider = (authProps = {}) => {
  const { useAuth } = require('../../../src/contexts/AuthContext');

  // Default auth mock
  useAuth.mockReturnValue({
    user: { username: 'testuser' },
    token: 'test-token',
    isLoading: false,
    ...authProps
  });

  return render(
    <TasksSettingsProvider>
      <TestComponent />
    </TasksSettingsProvider>
  );
};

describe('TasksSettingsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    api.get = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with tasks enabled by default', () => {
      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('checking-installation')).toHaveTextContent('true');
      expect(screen.getByTestId('is-installed')).toHaveTextContent('null');
      expect(screen.getByTestId('is-ready')).toHaveTextContent('null');
    });

    it('loads saved tasks enabled state from localStorage', () => {
      localStorage.setItem('tasks-enabled', 'false');
      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');
    });

    it('loads saved tasks enabled state from localStorage when true', () => {
      localStorage.setItem('tasks-enabled', 'true');
      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('does not check installation when user is not authenticated', () => {
      renderWithTasksSettingsProvider({ user: null, token: null });

      // Should start with checking false if not authenticated
      expect(screen.getByTestId('checking-installation')).toHaveTextContent('true');
      // But should not make API calls
      expect(api.get).not.toHaveBeenCalled();
    });

    it('does not check installation when user is loading', () => {
      renderWithTasksSettingsProvider({ isLoading: true });

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('TaskMaster Installation Check', () => {
    it('checks installation status when user is authenticated', async () => {
      const mockInstallationStatus = {
        installation: { isInstalled: true },
        isReady: true
      };

      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockInstallationStatus)
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/taskmaster/installation-status');
        expect(screen.getByTestId('checking-installation')).toHaveTextContent('false');
        expect(screen.getByTestId('is-installed')).toHaveTextContent('true');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('true');
        expect(screen.getByTestId('installation-status')).toContain('isInstalled');
      });
    });

    it('sets installation status to false when API call fails', async () => {
      api.get = jest.fn().mockRejectedValue(new Error('API Error'));

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('checking-installation')).toHaveTextContent('false');
        expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('false');
      });
    });

    it('sets installation status to false when API returns non-200', async () => {
      api.get = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('false');
      });
    });

    it('disables tasks when TaskMaster is not installed and no user preference exists', async () => {
      localStorage.removeItem('tasks-enabled');
      const mockStatus = {
        installation: { isInstalled: false },
        isReady: false
      };

      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStatus)
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');
      });
    });

    it('keeps user preference when TaskMaster is not installed', async () => {
      localStorage.setItem('tasks-enabled', 'true');
      const mockStatus = {
        installation: { isInstalled: false },
        isReady: false
      };

      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStatus)
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
      });
    });
  });

  describe('Tasks Enabled Management', () => {
    it('toggles tasks enabled state', async () => {
      const user = userEvent.setup();
      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');

      await user.click(screen.getByTestId('toggle-tasks'));

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');

      await user.click(screen.getByTestId('toggle-tasks'));

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('sets tasks enabled to true', async () => {
      const user = userEvent.setup();
      localStorage.setItem('tasks-enabled', 'false');

      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');

      await user.click(screen.getByTestId('enable-tasks'));

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('sets tasks enabled to false', async () => {
      const user = userEvent.setup();
      renderWithTasksSettingsProvider();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');

      await user.click(screen.getByTestId('disable-tasks'));

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');
    });

    it('saves tasks enabled state to localStorage', async () => {
      const user = userEvent.setup();
      renderWithTasksSettingsProvider();

      await user.click(screen.getByTestId('disable-tasks'));

      expect(localStorage.getItem('tasks-enabled')).toBe('false');

      await user.click(screen.getByTestId('enable-tasks'));

      expect(localStorage.getItem('tasks-enabled')).toBe('true');

      await user.click(screen.getByTestId('toggle-tasks'));

      expect(localStorage.getItem('tasks-enabled')).toBe('false');
    });
  });

  describe('API Integration', () => {
    it('calls installation status endpoint with correct URL', async () => {
      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ isReady: true })
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/taskmaster/installation-status');
      });
    });

    it('handles installation status response correctly', async () => {
      const mockResponse = {
        installation: {
          isInstalled: true,
          version: '2.1.0',
          path: '/usr/local/bin/taskmaster'
        },
        isReady: true,
        features: ['auto-detect', 'smart-tasks']
      };

      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('installation-status')).toContain('"isInstalled":true');
        expect(screen.getByTestId('installation-status')).toContain('"version":"2.1.0"');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('true');
      });
    });

    it('handles installation status with missing installation info', async () => {
      const mockResponse = {
        isReady: false,
        features: []
      };

      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('false');
      });
    });

    it('handles malformed installation status response', async () => {
      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      });

      renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(screen.getByTestId('is-installed')).toHaveTextContent('false');
        expect(screen.getByTestId('is-ready')).toHaveTextContent('false');
      });
    });
  });

  describe('useTasksSettings Hook Error', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTasksSettings must be used within a TasksSettingsProvider');

      consoleError.mockRestore();
    });
  });

  describe('Context Value', () => {
    it('provides all required context properties', () => {
      const { result } = renderHook(() => useTasksSettings(), {
        wrapper: ({ children }) => <TasksSettingsProvider>{children}</TasksSettingsProvider>
      });

      expect(result.current).toMatchObject({
        tasksEnabled: expect.any(Boolean),
        setTasksEnabled: expect.any(Function),
        toggleTasksEnabled: expect.any(Function),
        isTaskMasterInstalled: expect.any(Boolean),
        isTaskMasterReady: expect.any(Boolean),
        installationStatus: expect.any(Object),
        isCheckingInstallation: expect.any(Boolean)
      });
    });

    it('provides stable functions', () => {
      const { result: result1 } = renderHook(() => useTasksSettings(), {
        wrapper: ({ children }) => <TasksSettingsProvider>{children}</TasksSettingsProvider>
      });

      const { result: result2 } = renderHook(() => useTasksSettings(), {
        wrapper: ({ children }) => <TasksSettingsProvider>{children}</TasksSettingsProvider>
      });

      // Functions should be stable across renders
      expect(result1.current.setTasksEnabled).toBe(result2.current.setTasksEnabled);
      expect(result1.current.toggleTasksEnabled).toBe(result2.current.toggleTasksEnabled);
    });
  });

  describe('Multiple Consumers', () => {
    it('shares state across multiple consumers', async () => {
      const ConsumerOne = () => {
        const { tasksEnabled, toggleTasksEnabled } = useTasksSettings();
        return (
          <div data-testid="consumer-one">
            <span data-testid="consumer-one-enabled">{tasksEnabled.toString()}</span>
            <button onClick={toggleTasksEnabled} data-testid="consumer-one-toggle">
              Toggle
            </button>
          </div>
        );
      };

      const ConsumerTwo = () => {
        const { tasksEnabled } = useTasksSettings();
        return (
          <div data-testid="consumer-two">
            <span data-testid="consumer-two-enabled">{tasksEnabled.toString()}</span>
          </div>
        );
      };

      render(
        <TasksSettingsProvider>
          <div>
            <ConsumerOne />
            <ConsumerTwo />
          </div>
        </TasksSettingsProvider>
      );

      expect(screen.getByTestId('consumer-one-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('consumer-two-enabled')).toHaveTextContent('true');

      const user = userEvent.setup();
      await user.click(screen.getByTestId('consumer-one-toggle'));

      expect(screen.getByTestId('consumer-one-enabled')).toHaveTextContent('false');
      expect(screen.getByTestId('consumer-two-enabled')).toHaveTextContent('false');
    });
  });

  describe('Edge Cases', () => {
    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem('tasks-enabled', 'invalid-boolean');

      renderWithTasksSettingsProvider();

      // Should default to true when localStorage is invalid
      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('handles null localStorage value gracefully', () => {
      localStorage.setItem('tasks-enabled', 'null');

      renderWithTasksSettingsProvider();

      // Should default to true when localStorage is null
      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('handles missing localStorage gracefully', () => {
      delete window.localStorage;

      expect(() => {
        renderWithTasksSettingsProvider();
      }).not.toThrow();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });
  });

  describe('Performance', () => {
    it('does not make unnecessary API calls when already loaded', async () => {
      api.get = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ isReady: true })
      });

      const { rerender } = renderWithTasksSettingsProvider();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1);
      });

      rerender(
        <TasksSettingsProvider>
          <TestComponent />
        </TasksSettingsProvider>
      );

      // Should not make additional API calls
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });
});