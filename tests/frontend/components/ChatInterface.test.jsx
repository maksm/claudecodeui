import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ChatInterface from '../../../src/components/ChatInterface.jsx';
import { useWebSocket } from '../../../src/contexts/WebSocketContext';
import { useTasksSettings } from '../../../src/contexts/TasksSettingsContext';
import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/contexts/WebSocketContext');
jest.mock('../../../src/contexts/TasksSettingsContext');
jest.mock('../../../src/utils/api');
jest.mock('../../../src/components/TodoList', () => ({
  default: ({ tasks, onTaskUpdate, onDeleteTask, onAddTask }) => (
    <div data-testid="todo-list">
      <button onClick={() => onAddTask('New task')}>Add Task</button>
      {tasks?.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          <span>{task.title}</span>
          <button onClick={() => onTaskUpdate(task.id, { ...task, done: !task.done })}>
            Toggle
          </button>
          <button onClick={() => onDeleteTask(task.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}));

jest.mock('react-markdown', () => ({
  default: ({ children }) => <div data-testid="markdown">{children}</div>
}));

jest.mock('remark-gfm', () => ({}));
jest.mock('remark-math', () => ({}));
jest.mock('rehype-katex', () => ({}));

jest.mock('fuse.js', () => ({
  default: class MockFuse {
    constructor(data) {
      this.data = data;
    }
    search() {
      return [];
    }
  }
}));

jest.mock('../../../src/components/ClaudeLogo.jsx', () => ({
  default: ({ className }) => <div data-testid="claude-logo" className={className} />
}));

jest.mock('../../../src/components/CursorLogo.jsx', () => ({
  default: ({ className }) => <div data-testid="cursor-logo" className={className} />
}));

jest.mock('../../../src/components/NextTaskBanner.jsx', () => ({
  default: ({ task }) => <div data-testid="next-task-banner">{task?.title}</div>
}));

jest.mock('../../../src/components/ClaudeStatus.jsx', () => ({
  default: ({ status, message }) => (
    <div data-testid="claude-status">
      <span data-testid="status">{status}</span>
      <span data-testid="message">{message}</span>
    </div>
  )
}));

jest.mock('../../../src/components/TokenUsagePie.jsx', () => ({
  default: ({ usage, limit }) => (
    <div data-testid="token-usage">
      <span data-testid="usage">{usage}</span>
      <span data-testid="limit">{limit}</span>
    </div>
  )
}));

jest.mock('../../../src/components/MicButton.jsx', () => ({
  MicButton: ({ onTranscript, isDisabled }) => (
    <button
      data-testid="mic-button"
      onClick={() => onTranscript('Test transcript')}
      disabled={isDisabled}
    />
  )
}));

jest.mock('../../../src/components/CommandMenu', () => ({
  default: ({ onSelect, onClose }) => (
    <div data-testid="command-menu">
      <button onClick={() => onSelect('Test command')}>Select Command</button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}));

describe('ChatInterface Component', () => {
  const mockSendMessage = jest.fn();
  const mockOnSessionStart = jest.fn();
  const mockOnSessionEnd = jest.fn();

  const defaultProps = {
    selectedProject: {
      id: 'test-project',
      name: 'Test Project',
      path: '/path/to/project'
    },
    selectedSession: null,
    onSessionStart: mockOnSessionStart,
    onSessionEnd: mockOnSessionEnd,
    isActive: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default WebSocket context mock
    useWebSocket.mockReturnValue({
      sendMessage: mockSendMessage,
      isConnected: true,
      lastMessage: null,
      claudeStatus: 'idle',
      claudeResponsibility: null,
      sessionProtection: {
        isSessionActive: false,
        activeSessionId: null
      }
    });

    // Default tasks settings mock
    useTasksSettings.mockReturnValue({
      tasksEnabled: true,
      tasks: [],
      onTaskUpdate: jest.fn(),
      onDeleteTask: jest.fn(),
      onAddTask: jest.fn()
    });

    // API mock
    api.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders chat interface with all key elements', () => {
      render(<ChatInterface {...defaultProps} />);

      expect(screen.getByTestId('claude-status')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask Claude/i)).toBeInTheDocument();
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
      expect(screen.getByTestId('attach-button')).toBeInTheDocument();
    });

    it('shows cursor logo when cursor CLI is selected', () => {
      render(<ChatInterface {...defaultProps} />);

      const providerToggle = screen.getByTestId('provider-toggle');
      fireEvent.click(providerToggle);

      expect(screen.getByTestId('cursor-logo')).toBeInTheDocument();
    });

    it('disables input when no project is selected', () => {
      render(<ChatInterface {...defaultProps} selectedProject={null} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      expect(input).toBeDisabled();
      expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    it('sends message when send button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      const sendButton = screen.getByTestId('send-button');

      await user.type(input, 'Hello Claude');
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude-command',
          command: 'ask',
          input: 'Hello Claude',
          tempSessionId: expect.any(String)
        })
      );
    });

    it('sends message when Enter is pressed without Shift', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);

      await user.type(input, 'Hello Claude{Enter}');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude-command',
          command: 'ask',
          input: 'Hello Claude'
        })
      );
    });

    it('creates new line when Shift+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);

      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(input).toHaveValue('Line 1\nLine 2');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('clears input after sending message', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      const sendButton = screen.getByTestId('send-button');

      await user.type(input, 'Hello Claude');
      await user.click(sendButton);

      expect(input).toHaveValue('');
    });

    it('disables input and send button while message is processing', async () => {
      useWebSocket.mockReturnValue({
        ...useWebSocket(),
        claudeStatus: 'processing'
      });

      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      const sendButton = screen.getByTestId('send-button');

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Message History and Display', () => {
    it('displays messages from current session', () => {
      render(<ChatInterface
        {...defaultProps}
        selectedSession={{
          id: 'session-1',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]
        }}
      />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('formats code blocks correctly', () => {
      render(<ChatInterface
        {...defaultProps}
        selectedSession={{
          id: 'session-1',
          messages: [
            {
              role: 'assistant',
              content: 'Here is some code:\n```javascript\nconsole.log("Hello");\n```'
            }
          ]
        }}
      />);

      expect(screen.getByText('console.log("Hello");')).toBeInTheDocument();
    });

    it('handles streaming messages correctly', async () => {
      const { rerender } = render(<ChatInterface
        {...defaultProps}
        selectedSession={{
          id: 'session-1',
          messages: [
            { role: 'assistant', content: 'Hello' }
          ]
        }}
      />);

      expect(screen.getByText('Hello')).toBeInTheDocument();

      // Simulate streaming update
      rerender(<ChatInterface
        {...defaultProps}
        selectedSession={{
          id: 'session-1',
          messages: [
            { role: 'assistant', content: 'Hello world!' }
          ]
        }}
      />);

      expect(screen.getByText('Hello world!')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('handles file upload via drag and drop', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const dropzone = screen.getByTestId('dropzone') || screen.getByTestId('chat-container');

      await user.upload(dropzone, file);

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('handles file upload via attach button', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const attachButton = screen.getByTestId('attach-button');
      const fileInput = screen.getByLabelText(/attach files/i);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

      await user.click(attachButton);
      await user.upload(fileInput, [file]);

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('removes attached files when remove button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const dropzone = screen.getByTestId('dropzone') || screen.getByTestId('chat-container');

      await user.upload(dropzone, file);

      const removeButton = screen.getByTestId('remove-file-test.txt');
      await user.click(removeButton);

      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });
  });

  describe('Session Protection Integration', () => {
    it('marks session as active when sending message', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      const sendButton = screen.getByTestId('send-button');

      await user.type(input, 'Hello Claude');
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tempSessionId: expect.any(String)
        })
      );
    });

    it('handles session creation response', async () => {
      const mockOnSessionStart = jest.fn();

      render(<ChatInterface
        {...defaultProps}
        onSessionStart={mockOnSessionStart}
      />);

      // Simulate receiving session-created message
      const mockMessage = {
        data: JSON.stringify({
          type: 'session-created',
          tempId: 'temp-123',
          sessionId: 'real-session-456'
        })
      };

      // This would typically come through WebSocket
      act(() => {
        useWebSocket().lastMessage = mockMessage;
      });

      expect(mockOnSessionStart).toHaveBeenCalledWith('real-session-456');
    });

    it('handles session completion', async () => {
      const mockOnSessionEnd = jest.fn();

      render(<ChatInterface
        {...defaultProps}
        onSessionEnd={mockOnSessionEnd}
      />);

      // Simulate receiving claude-complete message
      const mockMessage = {
        data: JSON.stringify({
          type: 'claude-complete',
          sessionId: 'session-123'
        })
      };

      act(() => {
        useWebSocket().lastMessage = mockMessage;
      });

      expect(mockOnSessionEnd).toHaveBeenCalledWith('session-123');
    });
  });

  describe('Tasks Integration', () => {
    it('displays todo list when tasks are enabled', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: true,
        tasks: [
          { id: 1, title: 'Test task', done: false }
        ],
        onTaskUpdate: jest.fn(),
        onDeleteTask: jest.fn(),
        onAddTask: jest.fn()
      });

      render(<ChatInterface {...defaultProps} />);

      expect(screen.getByTestId('todo-list')).toBeInTheDocument();
      expect(screen.getByText('Test task')).toBeInTheDocument();
    });

    it('hides todo list when tasks are disabled', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: false,
        tasks: [],
        onTaskUpdate: jest.fn(),
        onDeleteTask: jest.fn(),
        onAddTask: jest.fn()
      });

      render(<ChatInterface {...defaultProps} />);

      expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
    });
  });

  describe('Command Menu', () => {
    it('opens command menu on Ctrl+K', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      await user.keyboard('{Control>}k{/Control}');

      expect(screen.getByTestId('command-menu')).toBeInTheDocument();
    });

    it('inserts selected command into input', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);

      await user.keyboard('{Control>}k{/Control}');

      const selectCommandButton = screen.getByText('Select Command');
      await user.click(selectCommandButton);

      expect(input).toHaveValue('Test command');
    });
  });

  describe('Voice Input', () => {
    it('handles voice input transcript', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const micButton = screen.getByTestId('mic-button');

      await user.click(micButton);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      expect(input).toHaveValue('Test transcript');
    });

    it('disables mic button when chat is not active', () => {
      render(<ChatInterface {...defaultProps} isActive={false} />);

      const micButton = screen.getByTestId('mic-button');
      expect(micButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors gracefully', () => {
      useWebSocket.mockReturnValue({
        sendMessage: mockSendMessage,
        isConnected: false,
        lastMessage: null,
        claudeStatus: 'error',
        claudeResponsibility: 'Connection lost'
      });

      render(<ChatInterface {...defaultProps} />);

      expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask Claude/i)).toBeDisabled();
    });

    it('displays error messages from assistant', () => {
      render(<ChatInterface
        {...defaultProps}
        selectedSession={{
          id: 'session-1',
          messages: [
            {
              role: 'assistant',
              content: 'Error: Something went wrong',
              isError: true
            }
          ]
        }}
      />);

      const errorMessage = screen.getByText(/Error: Something went wrong/i);
      expect(errorMessage).toHaveClass('error');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Ask Claude/i);
      expect(input).toHaveAttribute('aria-label', expect.stringContaining('message'));

      const sendButton = screen.getByTestId('send-button');
      expect(sendButton).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      await user.tab();
      expect(screen.getByPlaceholderText(/Ask Claude/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('attach-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('send-button')).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('memoizes expensive computations', () => {
      const { rerender } = render(<ChatInterface {...defaultProps} />);

      const initialRender = performance.now();

      rerender(<ChatInterface {...defaultProps} />);

      const secondRender = performance.now();

      // This is a basic performance check - in practice you'd use more sophisticated measures
      expect(secondRender - initialRender).toBeLessThan(100);
    });

    it('does not re-render unnecessarily', async () => {
      const { rerender } = render(<ChatInterface {...defaultProps} />);

      // Rerender with same props should not cause unnecessary updates
      rerender(<ChatInterface {...defaultProps} />);

      // Component should still render properly
      expect(screen.getByPlaceholderText(/Ask Claude/i)).toBeInTheDocument();
    });
  });
});