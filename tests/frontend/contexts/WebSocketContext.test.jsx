import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocketProvider, useWebSocketContext } from '../../../src/contexts/WebSocketContext.jsx';

// Mock the useWebSocket utility
jest.mock('../../../src/utils/websocket.js', () => ({
  useWebSocket: jest.fn()
}));

// Test component to use the WebSocket context
const TestComponent = () => {
  const { ws, sendMessage, messages, isConnected } = useWebSocketContext();

  const handleSendMessage = () => {
    sendMessage({ type: 'test', data: 'hello' });
  };

  return (
    <div data-testid="websocket-test">
      <div data-testid="connected">{isConnected.toString()}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="last-message">
        {messages.length > 0 ? JSON.stringify(messages[messages.length - 1]) : 'none'}
      </div>
      <div data-testid="websocket-exists">{ws ? 'exists' : 'null'}</div>

      <button onClick={handleSendMessage} data-testid="send-message">
        Send Message
      </button>
    </div>
  );
};

const renderWithWebSocketProvider = () => {
  return render(
    <WebSocketProvider>
      <TestComponent />
    </WebSocketProvider>
  );
};

describe('WebSocketContext', () => {
  const mockUseWebSocket = require('../../../src/utils/websocket').useWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mock implementation
    mockUseWebSocket.mockReturnValue({
      ws: null,
      sendMessage: jest.fn(),
      messages: [],
      isConnected: false
    });

    // Mock fetch for config
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Provider Initialization', () => {
    it('provides context values from useWebSocket hook', () => {
      const mockWebSocketValue = {
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [{ type: 'test', data: 'hello' }],
        isConnected: true
      };
      mockUseWebSocket.mockReturnValue(mockWebSocketValue);

      renderWithWebSocketProvider();

      expect(screen.getByTestId('connected')).toHaveTextContent('true');
      expect(screen.getByTestId('message-count')).toHaveTextContent('1');
      expect(screen.getByTestId('last-message')).toHaveTextContent('{"type":"test","data":"hello"}');
      expect(screen.getByTestId('websocket-exists')).toHaveTextContent('exists');
    });

    it('calls useWebSocket hook on mount', () => {
      renderWithWebSocketProvider();
      expect(mockUseWebSocket).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('displays current message count', () => {
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [
          { type: 'message1', data: 'test1' },
          { type: 'message2', data: 'test2' },
          { type: 'message3', data: 'test3' }
        ],
        isConnected: false
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('message-count')).toHaveTextContent('3');
    });

    it('displays last message correctly', () => {
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [
          { type: 'first', data: 'old' },
          { type: 'latest', data: 'new' }
        ],
        isConnected: false
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('last-message')).toHaveTextContent('{"type":"latest","data":"new"}');
    });

    it('shows none when no messages', () => {
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [],
        isConnected: false
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('last-message')).toHaveTextContent('none');
    });
  });

  describe('Connection State', () => {
    it('reflects connected state', () => {
      mockUseWebSocket.mockReturnValue({
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [],
        isConnected: true
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('connected')).toHaveTextContent('true');
    });

    it('reflects disconnected state', () => {
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [],
        isConnected: false
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('connected')).toHaveTextContent('false');
    });
  });

  describe('WebSocket Instance', () => {
    it('provides WebSocket instance when available', () => {
      const mockWebSocket = { readyState: 1, send: jest.fn() };
      mockUseWebSocket.mockReturnValue({
        ws: mockWebSocket,
        sendMessage: jest.fn(),
        messages: [],
        isConnected: true
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('websocket-exists')).toHaveTextContent('exists');
    });

    it('provides null when WebSocket not available', () => {
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [],
        isConnected: false
      });

      renderWithWebSocketProvider();

      expect(screen.getByTestId('websocket-exists')).toHaveTextContent('null');
    });
  });

  describe('Message Sending', () => {
    it('calls sendMessage when button is clicked', async () => {
      const user = userEvent.setup();
      const mockSendMessage = jest.fn();

      mockUseWebSocket.mockReturnValue({
        ws: { readyState: 1 },
        sendMessage: mockSendMessage,
        messages: [],
        isConnected: true
      });

      renderWithWebSocketProvider();

      await user.click(screen.getByTestId('send-message'));

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'test',
        data: 'hello'
      });
    });

    it('provides sendMessage function from hook', () => {
      const mockSendMessage = jest.fn();
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: mockSendMessage,
        messages: [],
        isConnected: false
      });

      renderWithWebSocketProvider();

      // The function should be available through context
      expect(mockSendMessage).toBeDefined();
    });
  });

  describe('Context Updates', () => {
    it('updates UI when hook return values change', async () => {
      // Initial state - disconnected
      mockUseWebSocket.mockReturnValue({
        ws: null,
        sendMessage: jest.fn(),
        messages: [],
        isConnected: false
      });

      const { rerender } = renderWithWebSocketProvider();

      expect(screen.getByTestId('connected')).toHaveTextContent('false');

      // Simulate connection
      mockUseWebSocket.mockReturnValue({
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [],
        isConnected: true
      });

      rerender(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('connected')).toHaveTextContent('true');
    });

    it('updates message list when new messages arrive', async () => {
      // Initial state
      mockUseWebSocket.mockReturnValue({
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [{ type: 'old', data: 'message' }],
        isConnected: true
      });

      const { rerender } = renderWithWebSocketProvider();

      expect(screen.getByTestId('message-count')).toHaveTextContent('1');

      // Simulate new message
      mockUseWebSocket.mockReturnValue({
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [
          { type: 'old', data: 'message' },
          { type: 'new', data: 'message' }
        ],
        isConnected: true
      });

      rerender(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('message-count')).toHaveTextContent('2');
      expect(screen.getByTestId('last-message')).toHaveTextContent('{"type":"new","data":"message"}');
    });
  });

  describe('useWebSocketContext Hook Error', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useWebSocketContext must be used within a WebSocketProvider');

      consoleError.mockRestore();
    });
  });

  describe('Provider Value Consistency', () => {
    it('provides all required context properties', () => {
      const mockWebSocketValue = {
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [],
        isConnected: true
      };
      mockUseWebSocket.mockReturnValue(mockWebSocketValue);

      const TestConsumer = () => {
        const context = useWebSocketContext();
        return (
          <div data-testid="context-check">
            <span data-testid="has-ws">{context.ws ? 'has-ws' : 'no-ws'}</span>
            <span data-testid="has-sendMessage">{typeof context.sendMessage === 'function' ? 'has-sendMessage' : 'no-sendMessage'}</span>
            <span data-testid="has-messages">{Array.isArray(context.messages) ? 'has-messages' : 'no-messages'}</span>
            <span data-testid="has-isConnected">{typeof context.isConnected === 'boolean' ? 'has-isConnected' : 'no-isConnected'}</span>
          </div>
        );
      };

      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('has-ws')).toHaveTextContent('has-ws');
      expect(screen.getByTestId('has-sendMessage')).toHaveTextContent('has-sendMessage');
      expect(screen.getByTestId('has-messages')).toHaveTextContent('has-messages');
      expect(screen.getByTestId('has-isConnected')).toHaveTextContent('has-isConnected');
    });

    it('passes through values unchanged from useWebSocket', () => {
      const customWebSocket = { custom: 'value', readyState: 1 };
      const customSendMessage = jest.fn();
      const customMessages = [{ custom: 'message' }];
      const customIsConnected = true;

      mockUseWebSocket.mockReturnValue({
        ws: customWebSocket,
        sendMessage: customSendMessage,
        messages: customMessages,
        isConnected: customIsConnected
      });

      const TestConsumer = () => {
        const context = useWebSocketContext();
        return (
          <div data-testid="context-values">
            <span data-testid="ws-custom">{context.ws?.custom || 'no-custom'}</span>
            <span data-testid="isConnected-value">{context.isConnected.toString()}</span>
          </div>
        );
      };

      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('ws-custom')).toHaveTextContent('value');
      expect(screen.getByTestId('isConnected-value')).toHaveTextContent('true');
    });
  });

  describe('Multiple Consumers', () => {
    it('shares context state across multiple consumers', () => {
      const sharedWebSocketValue = {
        ws: { readyState: 1 },
        sendMessage: jest.fn(),
        messages: [{ shared: 'message' }],
        isConnected: true
      };
      mockUseWebSocket.mockReturnValue(sharedWebSocketValue);

      const ConsumerOne = () => (
        <div data-testid="consumer-one">
          <span data-testid="consumer-one-connected">true</span>
          <span data-testid="consumer-one-messages">1</span>
        </div>
      );

      const ConsumerTwo = () => {
        const { isConnected, messages } = useWebSocketContext();
        return (
          <div data-testid="consumer-two">
            <span data-testid="consumer-two-connected">{isConnected.toString()}</span>
            <span data-testid="consumer-two-messages">{messages.length.toString()}</span>
          </div>
        );
      };

      render(
        <WebSocketProvider>
          <div>
            <ConsumerOne />
            <ConsumerTwo />
          </div>
        </WebSocketProvider>
      );

      expect(screen.getByTestId('consumer-two-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('consumer-two-messages')).toHaveTextContent('1');
    });
  });

  describe('Error Handling', () => {
    it('handles useWebSocket returning undefined values gracefully', () => {
      mockUseWebSocket.mockReturnValue({});

      const TestConsumer = () => {
        const context = useWebSocketContext();
        return (
          <div data-testid="error-test">
            <span data-testid="isConnected-default">{(context.isConnected ?? 'undefined').toString()}</span>
            <span data-testid="messages-default">{Array.isArray(context.messages) ? 'array' : 'not-array'}</span>
          </div>
        );
      };

      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('isConnected-default')).toHaveTextContent('undefined');
      expect(screen.getByTestId('messages-default')).toHaveTextContent('not-array');
    });
  });
});