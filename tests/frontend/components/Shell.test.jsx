import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Shell from '../../../src/components/Shell.jsx';

// Mock xterm
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    loadAddon: jest.fn(),
    write: jest.fn(),
    focus: jest.fn(),
    resize: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    onTitle: jest.fn(),
    dispose: jest.fn(),
    element: {
      style: {},
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    },
    rows: 24,
    cols: 80
  }))
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    activate: jest.fn(),
    fit: jest.fn()
  }))
}));

jest.mock('@xterm/addon-clipboard', () => ({
  ClipboardAddon: jest.fn().mockImplementation(() => ({
    activate: jest.fn()
  }))
}));

jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn().mockImplementation(() => ({
    addOnTextureAtlasChange: jest.fn(),
    dispose: jest.fn()
  }))
}));

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

describe('Shell Component', () => {
  const mockSelectedProject = {
    id: 'test-project',
    name: 'Test Project',
    path: '/path/to/project'
  };

  const mockSelectedSession = {
    id: 'session-1',
    type: 'shell'
  };

  const defaultProps = {
    selectedProject: mockSelectedProject,
    selectedSession: mockSelectedSession,
    isActive: true,
    isPlainShell: false,
    onProcessComplete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders shell container when project is selected', () => {
      render(<Shell {...defaultProps} />);

      expect(screen.getByTestId('shell-container')).toBeInTheDocument();
    });

    it('does not render when no project is selected', () => {
      render(<Shell {...defaultProps} selectedProject={null} />);

      expect(screen.queryByTestId('shell-container')).not.toBeInTheDocument();
    });

    it('shows connection status initially', () => {
      render(<Shell {...defaultProps} />);

      expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    });

    it('shows terminal when connected', async () => {
      render(<Shell {...defaultProps} />);

      // Simulate WebSocket connection
      act(() => {
        const mockWebSocket = global.WebSocket.mock.results[0].value;
        mockWebSocket.readyState = 1; // OPEN
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'open') {
            handler();
          }
        });
      });

      await waitFor(() => {
        expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Connection', () => {
    it('establishes WebSocket connection on mount', () => {
      render(<Shell {...defaultProps} />);

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('/shell')
      );
    });

    it('handles WebSocket connection errors', async () => {
      global.WebSocket.mockImplementation(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 3, // CLOSED
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      }));

      render(<Shell {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
      });
    });

    it('attempts to reconnect on connection failure', async () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 3, // CLOSED
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell {...defaultProps} />);

      // Simulate connection error
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'error' || event === 'close') {
            handler();
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
      });

      // Should attempt reconnection after delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('cleans up WebSocket connection on unmount', () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      const { unmount } = render(<Shell {...defaultProps} />);

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Terminal Functionality', () => {
    it('initializes terminal with correct options', () => {
      const { Terminal } = require('@xterm/xterm');

      render(<Shell {...defaultProps} />);

      expect(Terminal).toHaveBeenCalledWith(
        expect.objectContaining({
          allowProposedApi: true,
          convertEol: true,
          fontFamily: expect.stringContaining('SF Mono'),
          fontSize: 12,
          theme: expect.objectContaining({
            background: 'rgba(0, 0, 0, 0.8)',
            foreground: '#ffffff'
          })
        })
      );
    });

    it('loads terminal addons', () => {
      const { FitAddon, ClipboardAddon, WebglAddon } = require('@xterm/addon-fit');

      render(<Shell {...defaultProps} />);

      expect(FitAddon).toHaveBeenCalled();
      expect(ClipboardAddon).toHaveBeenCalled();
      expect(WebglAddon).toHaveBeenCalled();
    });

    it('handles terminal resize', async () => {
      render(<Shell {...defaultProps} />);

      const shellContainer = screen.getByTestId('shell-container');

      // Simulate container resize
      act(() => {
        const resizeEvent = new Event('resize');
        window.dispatchEvent(resizeEvent);
      });

      await waitFor(() => {
        const mockFitAddon = require('@xterm/addon-fit').FitAddon.mock.results[0].value;
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });

    it('sends terminal input through WebSocket', async () => {
      const user = userEvent.setup();
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell {...defaultProps} />);

      // Simulate WebSocket connection established
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'open') {
            handler();
          }
        });
      });

      await waitFor(() => {
        expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
      });

      // Get terminal instance and simulate data input
      const { Terminal } = require('@xterm/xterm');
      const mockTerminal = Terminal.mock.results[0].value;

      act(() => {
        const dataHandler = mockTerminal.onData.mock.calls[0][0];
        dataHandler('ls\n');
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'shell-input',
          data: 'ls\n'
        })
      );
    });
  });

  describe('Session Management', () => {
    it('uses session ID when provided', () => {
      render(<Shell
        {...defaultProps}
        selectedSession={{ id: 'custom-session-123', type: 'shell' }}
      />);

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('sessionId=custom-session-123')
      );
    });

    it('creates new session when none provided', () => {
      render(<Shell
        {...defaultProps}
        selectedSession={null}
      />);

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('sessionId=')
      );
    });

    it('handles session change', async () => {
      const { rerender } = render(<Shell {...defaultProps} />);

      const initialWebSocket = global.WebSocket.mock.calls[0][0];

      rerender(<Shell
        {...defaultProps}
        selectedSession={{ id: 'new-session-456', type: 'shell' }}
      />);

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2);
        expect(global.WebSocket).toHaveBeenLastCalledWith(
          expect.stringContaining('sessionId=new-session-456')
        );
      });
    });
  });

  describe('Process Management', () => {
    it('handles process completion', async () => {
      const mockOnProcessComplete = jest.fn();
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell
        {...defaultProps}
        onProcessComplete={mockOnProcessComplete}
      />);

      // Simulate process completion message
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'message') {
            handler({
              data: JSON.stringify({
                type: 'shell-process-complete',
                exitCode: 0
              })
            });
          }
        });
      });

      expect(mockOnProcessComplete).toHaveBeenCalledWith(0);
    });

    it('handles shell abort', async () => {
      const mockOnProcessComplete = jest.fn();
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell
        {...defaultProps}
        onProcessComplete={mockOnProcessComplete}
      />);

      // Simulate shell abort message
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'message') {
            handler({
              data: JSON.stringify({
                type: 'shell-abort'
              })
            });
          }
        });
      });

      expect(mockOnProcessComplete).toHaveBeenCalledWith(null);
    });
  });

  describe('Plain Shell Mode', () => {
    it('works in plain shell mode', () => {
      render(<Shell
        {...defaultProps}
        isPlainShell={true}
      />);

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('plainShell=true')
      );
    });

    it('executes initial command when provided', () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell
        {...defaultProps}
        initialCommand="echo 'Hello World'"
      />);

      // Should send initial command after connection
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'open') {
            handler();
          }
        });
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'shell-input',
          data: "echo 'Hello World'\n"
        })
      );
    });
  });

  describe('Active State Management', () => {
    it('pauses terminal when not active', async () => {
      const { rerender } = render(<Shell {...defaultProps} isActive={true} />);

      // Should be active initially
      expect(screen.getByTestId('shell-container')).toBeInTheDocument();

      rerender(<Shell {...defaultProps} isActive={false} />);

      // Should still render but potentially with different behavior
      expect(screen.getByTestId('shell-container')).toBeInTheDocument();
    });

    it('resumes terminal when becoming active again', async () => {
      const { rerender } = render(<Shell {...defaultProps} isActive={false} />);

      rerender(<Shell {...defaultProps} isActive={true} />);

      expect(screen.getByTestId('shell-container')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket errors gracefully', async () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 3,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell {...defaultProps} />);

      // Simulate error event
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'error') {
            handler({ error: new Error('Connection failed') });
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Connection error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on connection failure', async () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 3,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('retries connection when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 3,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      global.WebSocket.mockImplementation(() => mockWebSocket);

      render(<Shell {...defaultProps} />);

      await waitFor(() => {
        const retryButton = screen.getByText(/retry/i);
        user.click(retryButton);
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<Shell {...defaultProps} />);

      const shellContainer = screen.getByTestId('shell-container');
      expect(shellContainer).toHaveAttribute('role', 'application');
      expect(shellContainer).toHaveAttribute('aria-label', 'Terminal');
    });

    it('announces connection status to screen readers', async () => {
      render(<Shell {...defaultProps} />);

      // Should announce connecting status
      expect(screen.getByRole('status')).toHaveTextContent(/Connecting/);

      // Simulate successful connection
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      act(() => {
        mockWebSocket.addEventListener.mock.calls.forEach(([event, handler]) => {
          if (event === 'open') {
            handler();
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Connected/);
      });
    });
  });

  describe('Performance', () => {
    it('does not create multiple WebSocket connections unnecessarily', () => {
      const { rerender } = render(<Shell {...defaultProps} />);

      const initialCallCount = global.WebSocket.mock.calls.length;

      rerender(<Shell {...defaultProps} isActive={false} />);
      rerender(<Shell {...defaultProps} isActive={true} />);

      expect(global.WebSocket).toHaveBeenCalledTimes(initialCallCount);
    });

    it('debounces resize events', async () => {
      render(<Shell {...defaultProps} />);

      const mockFitAddon = require('@xterm/addon-fit').FitAddon.mock.results[0].value;

      // Simulate multiple rapid resize events
      act(() => {
        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(new Event('resize'));
        }
      });

      // Should only call fit once due to debouncing
      act(() => {
        jest.advanceTimersByTime(250);
      });

      expect(mockFitAddon.fit).toHaveBeenCalledTimes(1);
    });

    it('properly cleans up resources on unmount', () => {
      const mockWebSocket = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      };

      const { Terminal } = require('@xterm/xterm');
      const mockTerminal = {
        loadAddon: jest.fn(),
        write: jest.fn(),
        focus: jest.fn(),
        resize: jest.fn(),
        onData: jest.fn(),
        onResize: jest.fn(),
        onTitle: jest.fn(),
        dispose: jest.fn(),
        element: {
          style: {},
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        },
        rows: 24,
        cols: 80
      };

      Terminal.mockImplementation(() => mockTerminal);
      global.WebSocket.mockImplementation(() => mockWebSocket);

      const { unmount } = render(<Shell {...defaultProps} />);

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(mockTerminal.dispose).toHaveBeenCalled();
    });
  });
});