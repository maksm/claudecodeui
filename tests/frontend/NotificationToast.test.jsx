import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NotificationToast from '../../src/components/NotificationToast';
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

// Test wrapper component
const NotificationTestWrapper = ({ children }) => {
  const { addNotification } = useNotification();

  return (
    <div>
      {children}
      <button onClick={() => addNotification({ type: 'success', title: 'Success', message: 'Operation completed' })}>
        Add Success
      </button>
      <button onClick={() => addNotification({ type: 'error', title: 'Error', message: 'Something went wrong' })}>
        Add Error
      </button>
      <button onClick={() => addNotification({ type: 'warning', title: 'Warning', message: 'Please be careful' })}>
        Add Warning
      </button>
      <button onClick={() => addNotification({ type: 'info', title: 'Info', message: 'Here is some information' })}>
        Add Info
      </button>
    </div>
  );
};

describe('NotificationToast Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should not render anything when no notifications', () => {
      const { container } = render(
        <NotificationProvider>
          <NotificationToast />
        </NotificationProvider>
      );

      // Component should render null when no notifications
      expect(container.firstChild).toBeNull();
    });

    test('should render toast with success notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed')).toBeInTheDocument();
    });

    test('should render toast with error notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Error').click();
      });

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    test('should render toast with warning notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Warning').click();
      });

      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Please be careful')).toBeInTheDocument();
    });

    test('should render toast with info notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Info').click();
      });

      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('Here is some information')).toBeInTheDocument();
    });

    test('should render multiple notifications', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
        screen.getByText('Add Error').click();
        screen.getByText('Add Info').click();
      });

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });

  describe('Notification Icons', () => {
    test('should display success icon for success notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      // Check for success icon (CheckCircle)
      const successIcon = document.querySelector('.text-green-500');
      expect(successIcon).toBeInTheDocument();
    });

    test('should display error icon for error notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Error').click();
      });

      // Check for error icon (AlertCircle)
      const errorIcon = document.querySelector('.text-red-500');
      expect(errorIcon).toBeInTheDocument();
    });

    test('should display warning icon for warning notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Warning').click();
      });

      // Check for warning icon (AlertTriangle)
      const warningIcon = document.querySelector('.text-yellow-500');
      expect(warningIcon).toBeInTheDocument();
    });

    test('should display info icon for info notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Info').click();
      });

      // Check for info icon (Info)
      const infoIcon = document.querySelector('.text-blue-500');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('should close notification when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      expect(screen.getByText('Success')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);

      // Wait for exit animation and removal
      await waitFor(
        () => {
          expect(screen.queryByText('Success')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    test('should auto-dismiss notification after default duration', async () => {
      jest.useFakeTimers();

      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      expect(screen.getByText('Success')).toBeInTheDocument();

      // Fast-forward past the default 5 second duration
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Styling and Appearance', () => {
    test('should apply success styling for success notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      const toast = screen.getByText('Success').closest('div').closest('div');
      expect(toast).toHaveClass('bg-green-50');
    });

    test('should apply error styling for error notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Error').click();
      });

      const toast = screen.getByText('Error').closest('div').closest('div');
      expect(toast).toHaveClass('bg-red-50');
    });

    test('should apply warning styling for warning notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Warning').click();
      });

      const toast = screen.getByText('Warning').closest('div').closest('div');
      expect(toast).toHaveClass('bg-yellow-50');
    });

    test('should apply info styling for info notification', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Info').click();
      });

      const toast = screen.getByText('Info').closest('div').closest('div');
      expect(toast).toHaveClass('bg-blue-50');
    });

    test('should be positioned in top-right corner', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      const container = screen.getByText('Success').closest('div').closest('div').parentElement;
      expect(container).toHaveClass('fixed', 'top-4', 'right-4');
    });
  });

  describe('Accessibility', () => {
    test('should have proper aria-label on close button', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
    });

    test('should be keyboard accessible', async () => {
      const user = userEvent.setup();

      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      const closeButton = screen.getByLabelText('Close notification');

      // Tab to the close button
      await user.tab();

      // Press Enter to close
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByText('Success')).not.toBeInTheDocument();
      });
    });
  });

  describe('Animation', () => {
    test('should have slide-in animation classes', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
      });

      const toast = screen.getByText('Success').closest('div').closest('div');
      expect(toast).toHaveClass('transition-all', 'duration-300');
    });
  });

  describe('Edge Cases', () => {
    test('should handle notification without title', () => {
      const TestNoTitle = () => {
        const { addNotification } = useNotification();
        return (
          <>
            <NotificationToast />
            <button onClick={() => addNotification({ type: 'info', message: 'No title message' })}>
              Add No Title
            </button>
          </>
        );
      };

      render(
        <NotificationProvider>
          <TestNoTitle />
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add No Title').click();
      });

      expect(screen.getByText('No title message')).toBeInTheDocument();
    });

    test('should stack multiple notifications vertically', () => {
      render(
        <NotificationProvider>
          <NotificationTestWrapper>
            <NotificationToast />
          </NotificationTestWrapper>
        </NotificationProvider>
      );

      act(() => {
        screen.getByText('Add Success').click();
        screen.getByText('Add Error').click();
        screen.getByText('Add Warning').click();
      });

      const container = screen.getByText('Success').closest('div').closest('div').parentElement;
      expect(container).toHaveClass('space-y-2');
    });
  });
});
