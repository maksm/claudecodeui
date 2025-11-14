import React from 'react';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import all contexts
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext.jsx';
import { WebSocketProvider, useWebSocketContext } from '../../../src/contexts/WebSocketContext.jsx';
import { ThemeProvider, useTheme } from '../../../src/contexts/ThemeContext.jsx';
import { TaskMasterProvider, useTaskMaster } from '../../../src/contexts/TaskMasterContext.jsx';
import { TasksSettingsProvider, useTasksSettings } from '../../../src/contexts/TasksSettingsContext.jsx';
import { SessionManagerProvider, useSessionManager } from '../../../src/contexts/SessionManagerContext.jsx';

import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/utils/api');
jest.mock('../../../src/utils/websocket.js', () => ({
  useWebSocket: () => ({
    ws: null,
    sendMessage: jest.fn(),
    messages: [],
    isConnected: true
  })
}));

// Mock AuthContext to avoid API calls
jest.mock('../../../src/contexts/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { username: 'testuser' },
    token: 'test-token',
    isLoading: false,
    needsSetup: false,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    error: null
  })
}));

// Test component that uses all contexts
const AllContextsComponent = () => {
  const { user, token, login, logout } = useAuth();
  const { isConnected } = useWebSocketContext();
  const { theme, toggleTheme } = useTheme();
  const { tasksEnabled, toggleTasks } = useTasksSettings();
  const { hasActiveSession, createSession } = useSessionManager();

  return (
    <div data-testid="all-contexts-test">
      <div data-testid="auth-user">{user?.username || 'no-user'}</div>
      <div data-testid="auth-token">{token || 'no-token'}</div>
      <div data-testid="ws-connected">{isConnected.toString()}</div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="tasks-enabled">{tasksEnabled.toString()}</div>
      <div data-testid="has-session">{hasActiveSession.toString()}</div>

      <button onClick={toggleTheme} data-testid="theme-btn">
        Toggle Theme
      </button>
      <button onClick={toggleTasks} data-testid="tasks-btn">
        Toggle Tasks
      </button>
      <button onClick={() => createSession('test-session')} data-testid="create-session-btn">
        Create Session
      </button>
    </div>
  );
};

// Helper to render with all providers
const renderWithAllProviders = () => {
  return render(
    <AuthProvider>
      <WebSocketProvider>
        <ThemeProvider>
          <TaskMasterProvider>
            <TasksSettingsProvider>
              <SessionManagerProvider>
                <AllContextsComponent />
              </SessionManagerProvider>
            </TasksSettingsProvider>
          </TaskMasterProvider>
        </ThemeProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
};

describe('Context Composition and Provider Hierarchies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    api.get = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('Basic Provider Composition', () => {
    it('renders with all providers without errors', () => {
      expect(() => {
        renderWithAllProviders();
      }).not.toThrow();

      expect(screen.getByTestId('all-contexts-test')).toBeInTheDocument();
    });

    it('provides all context values correctly', () => {
      renderWithAllProviders();

      // Check that all contexts provide their default values
      expect(screen.getByTestId('auth-user')).toHaveTextContent('testuser');
      expect(screen.getByTestId('auth-token')).toHaveTextContent('test-token');
      expect(screen.getByTestId('ws-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark'); // default from ThemeContext
      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false'); // default from TasksSettingsContext
      expect(screen.getByTestId('has-session')).toHaveTextContent('false');
    });
  });

  describe('Provider Order Independence', () => {
    it('works regardless of provider order', () => {
      const DifferentOrder = () => (
        <TaskMasterProvider>
          <AuthProvider>
            <ThemeProvider>
              <SessionManagerProvider>
                <WebSocketProvider>
                  <TasksSettingsProvider>
                    <AllContextsComponent />
                  </TasksSettingsProvider>
                </WebSocketProvider>
              </SessionManagerProvider>
            </ThemeProvider>
          </AuthProvider>
        </TaskMasterProvider>
      );

      expect(() => {
        render(<DifferentOrder />);
      }).not.toThrow();

      expect(screen.getByTestId('ws-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
  });

  describe('Context Interactions', () => {
    it('handles theme switching across provider boundaries', async () => {
      const user = userEvent.setup();
      renderWithAllProviders();

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');

      await user.click(screen.getByTestId('theme-btn'));

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    it('handles tasks enabled/disabled state', async () => {
      const user = userEvent.setup();
      renderWithAllProviders();

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('false');

      await user.click(screen.getByTestId('tasks-btn'));

      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('handles session management through SessionManager context', async () => {
      const user = userEvent.setup();
      renderWithAllProviders();

      expect(screen.getByTestId('has-session')).toHaveTextContent('false');

      await user.click(screen.getByTestId('create-session-btn'));

      expect(screen.getByTestId('has-session')).toHaveTextContent('true');
    });
  });

  describe('Error Boundaries and Edge Cases', () => {
    it('handles missing provider gracefully', () => {
      // Component that uses a context without its provider
      const UnprovidedContextComponent = () => {
        const { theme } = useTheme();
        return <div data-testid="theme-only">{theme}</div>;
      };

      // This should throw an error
      expect(() => {
        render(<UnprovidedContextComponent />);
      }).toThrow();
    });

    it('handles partial provider composition', () => {
      // Component that only uses some contexts
      const PartialContextComponent = () => {
        const { theme } = useTheme();
        const { isConnected } = useWebSocketContext();
        return (
          <div>
            <span data-testid="theme">{theme}</span>
            <span data-testid="connected">{isConnected.toString()}</span>
          </div>
        );
      };

      expect(() => {
        render(
          <WebSocketProvider>
            <ThemeProvider>
              <PartialContextComponent />
            </ThemeProvider>
          </WebSocketProvider>
        );
      }).not.toThrow();

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('connected')).toHaveTextContent('true');
    });
  });

  describe('Performance with Multiple Providers', () => {
    it('handles multiple re-renders efficiently', async () => {
      const user = userEvent.setup();
      renderWithAllProviders();

      // Rapidly trigger multiple state changes
      await user.click(screen.getByTestId('theme-btn'));
      await user.click(screen.getByTestId('tasks-btn'));
      await user.click(screen.getByTestId('theme-btn'));

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('tasks-enabled')).toHaveTextContent('true');
    });

    it('does not cause unnecessary re-renders', () => {
      let renderCount = 0;

      const CountingComponent = () => {
        renderCount++;
        const { theme } = useTheme();
        return <div data-testid="theme">{theme}</div>;
      };

      const { rerender } = render(
        <ThemeProvider>
          <CountingComponent />
        </ThemeProvider>
      );

      const initialRenderCount = renderCount;

      // Rerender should not cause additional renders if props haven't changed
      rerender(
        <ThemeProvider>
          <CountingComponent />
        </ThemeProvider>
      );

      expect(renderCount).toBe(initialRenderCount);
    });
  });

  describe('Memory and Cleanup', () => {
    it('cleans up context providers on unmount', () => {
      const { unmount } = renderWithAllProviders();

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Context Hook Usage Patterns', () => {
    it('supports multiple hooks from same context', () => {
      const MultipleHooksComponent = () => {
        const { theme, toggleTheme } = useTheme();
        const { isConnected } = useWebSocketContext();

        return (
          <div>
            <span data-testid="theme1">{theme}</span>
            <span data-testid="theme2">{theme}</span>
            <span data-testid="connected">{isConnected.toString()}</span>
            <button onClick={toggleTheme} data-testid="toggle">Toggle</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <WebSocketProvider>
            <MultipleHooksComponent />
          </WebSocketProvider>
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme1')).toHaveTextContent(screen.getByTestId('theme2').textContent);
      expect(screen.getByTestId('connected')).toHaveTextContent('true');
    });

    it('supports nested context consumers', () => {
      const OuterComponent = () => {
        const { theme } = useTheme();
        return (
          <div data-testid="outer-theme">
            {theme}
            <InnerComponent />
          </div>
        );
      };

      const InnerComponent = () => {
        const { theme } = useTheme();
        return <div data-testid="inner-theme">{theme}</div>;
      };

      render(
        <ThemeProvider>
          <OuterComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('outer-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('inner-theme')).toHaveTextContent('dark');
    });
  });

  describe('Context Values Consistency', () => {
    it('maintains context value consistency across components', () => {
      const ComponentA = () => {
        const { theme } = useTheme();
        return <div data-testid="theme-a">{theme}</div>;
      };

      const ComponentB = () => {
        const { theme } = useTheme();
        return <div data-testid="theme-b">{theme}</div>;
      };

      render(
        <ThemeProvider>
          <div>
            <ComponentA />
            <ComponentB />
          </div>
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-a')).toHaveTextContent(
        screen.getByTestId('theme-b').textContent
      );
    });
  });
});