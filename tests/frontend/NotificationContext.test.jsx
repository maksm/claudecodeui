import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationProvider, useNotification } from '../../src/contexts/NotificationContext';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Notification API
const mockNotification = jest.fn();
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: mockNotification,
});

// Test component that uses the notification context
const TestComponent = () => {
  const {
    notifications,
    settings,
    updateSettings,
    addNotification,
    removeNotification,
    notifyAgentCompletion,
    notifyCICompletion,
    clearAll,
  } = useNotification();

  return (
    <div>
      <div data-testid="notification-count">{notifications.length}</div>
      <div data-testid="agent-setting">{settings.agentCompletion.toString()}</div>
      <div data-testid="ci-setting">{settings.ciCompletion.toString()}</div>
      <div data-testid="browser-setting">{settings.browserNotifications.toString()}</div>

      <button
        onClick={() => addNotification({ type: 'success', title: 'Test', message: 'Test message' })}
      >
        Add Notification
      </button>
      <button onClick={() => updateSettings({ agentCompletion: false })}>Update Settings</button>
      <button onClick={() => notifyAgentCompletion('TestProject', true)}>
        Notify Agent Success
      </button>
      <button onClick={() => notifyAgentCompletion('TestProject', false)}>
        Notify Agent Error
      </button>
      <button onClick={() => notifyCICompletion('test-workflow', true)}>Notify CI Success</button>
      <button onClick={() => notifyCICompletion('test-workflow', false)}>Notify CI Error</button>
      <button onClick={clearAll}>Clear All</button>

      <div data-testid="notifications-list">
        {notifications.map(n => (
          <div key={n.id} data-testid={`notification-${n.id}`}>
            <span data-testid={`notification-type-${n.id}`}>{n.type}</span>
            <span data-testid={`notification-title-${n.id}`}>{n.title}</span>
            <span data-testid={`notification-message-${n.id}`}>{n.message}</span>
            <button onClick={() => removeNotification(n.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    // Reset Notification permission
    mockNotification.permission = 'default';
  });

  describe('Default Settings', () => {
    test('should provide default notification settings', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      expect(screen.getByTestId('agent-setting')).toHaveTextContent('true');
      expect(screen.getByTestId('ci-setting')).toHaveTextContent('true');
      expect(screen.getByTestId('browser-setting')).toHaveTextContent('false');
    });

    test('should start with empty notifications array', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });
  });

  describe('Settings Management', () => {
    test('should update settings', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Update Settings').click();
      });

      expect(screen.getByTestId('agent-setting')).toHaveTextContent('false');
    });

    test('should persist settings to localStorage', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Update Settings').click();
      });

      const stored = JSON.parse(localStorage.getItem('notificationSettings'));
      expect(stored.agentCompletion).toBe(false);
    });

    test('should load settings from localStorage on mount', () => {
      localStorage.setItem(
        'notificationSettings',
        JSON.stringify({
          agentCompletion: false,
          ciCompletion: false,
          browserNotifications: true,
        })
      );

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      expect(screen.getByTestId('agent-setting')).toHaveTextContent('false');
      expect(screen.getByTestId('ci-setting')).toHaveTextContent('false');
      expect(screen.getByTestId('browser-setting')).toHaveTextContent('true');
    });
  });

  describe('Notification Management', () => {
    test('should add a notification', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Notification').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    });

    test('should create notification with correct properties', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Notification').click();
      });

      const notifications = screen.getByTestId('notifications-list');
      expect(notifications.textContent).toContain('success');
      expect(notifications.textContent).toContain('Test');
      expect(notifications.textContent).toContain('Test message');
    });

    test('should remove a notification', async () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Notification').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      act(() => {
        screen.getByText('Remove').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    test('should clear all notifications', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      // Add multiple notifications
      act(() => {
        screen.getByText('Add Notification').click();
        screen.getByText('Add Notification').click();
        screen.getByText('Add Notification').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('3');

      act(() => {
        screen.getByText('Clear All').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    test('should auto-remove notification after duration', async () => {
      jest.useFakeTimers();

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Notification').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      });

      jest.useRealTimers();
    });
  });

  describe('Agent Completion Notifications', () => {
    test('should create success notification for agent completion', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Notify Agent Success').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      const notifications = screen.getByTestId('notifications-list');
      expect(notifications.textContent).toContain('success');
      expect(notifications.textContent).toContain('Agent Completed');
      expect(notifications.textContent).toContain('Agent completed successfully in TestProject');
    });

    test('should create error notification for agent failure', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Notify Agent Error').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      const notifications = screen.getByTestId('notifications-list');
      expect(notifications.textContent).toContain('error');
      expect(notifications.textContent).toContain('Agent Completed');
      expect(notifications.textContent).toContain('Agent failed in TestProject');
    });

    test('should not create notification when agent completion is disabled', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      // Disable agent completion notifications
      act(() => {
        screen.getByText('Update Settings').click();
      });

      act(() => {
        screen.getByText('Notify Agent Success').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });
  });

  describe('CI Completion Notifications', () => {
    test('should create success notification for CI completion', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Notify CI Success').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      const notifications = screen.getByTestId('notifications-list');
      expect(notifications.textContent).toContain('success');
      expect(notifications.textContent).toContain('CI Completed');
      expect(notifications.textContent).toContain(
        'CI workflow "test-workflow" completed successfully'
      );
    });

    test('should create error notification for CI failure', () => {
      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Notify CI Error').click();
      });

      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');

      const notifications = screen.getByTestId('notifications-list');
      expect(notifications.textContent).toContain('error');
      expect(notifications.textContent).toContain('CI Completed');
      expect(notifications.textContent).toContain('CI workflow "test-workflow" failed');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('notificationSettings', 'invalid json');

      render(
        <NotificationProvider>
          <TestComponent />
        </NotificationProvider>
      );

      // Should fall back to default settings
      expect(screen.getByTestId('agent-setting')).toHaveTextContent('true');
      expect(screen.getByTestId('ci-setting')).toHaveTextContent('true');
      expect(screen.getByTestId('browser-setting')).toHaveTextContent('false');
    });
  });
});
