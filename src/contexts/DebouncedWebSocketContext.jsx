import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';

/**
 * Debounced WebSocket Context
 * Provides WebSocket connection with debounced message processing to prevent UI thrashing
 */

const DebouncedWebSocketContext = createContext({
  // Connection state
  connected: false,
  connecting: false,
  error: null,

  // Message handling
  sendMessage: () => {},
  messages: [],
  connectionStats: {},

  // Debouncing controls
  debounceDelay: 300,
  batchMode: false,
  enableDebouncing: true,

  // Advanced controls
  pauseUpdates: () => {},
  resumeUpdates: () => {},
  clearQueue: () => {},
  flushQueue: () => {}
});

export const useDebouncedWebSocket = () => {
  const context = useContext(DebouncedWebSocketContext);
  if (!context) {
    throw new Error('useDebouncedWebSocket must be used within a DebouncedWebSocketProvider');
  }
  return context;
};

export const DebouncedWebSocketProvider = ({
  children,
  debounceDelay = 300,
  batchMode = false,
  maxQueueSize = 1000,
  enableDebouncing = true
}) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [connectionStats, setConnectionStats] = useState({});

  // WebSocket connection
  const wsRef = useRef(null);
  const wsUrlRef = useRef(null);

  // Debouncing state
  const messageQueueRef = useRef([]);
  const debounceTimeoutRef = useRef(null);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);

  // Batch processing state
  const batchTimeoutRef = useRef(null);
  const batchRef = useRef([]);

  // Performance metrics
  const metricsRef = useRef({
    messagesReceived: 0,
    messagesQueued: 0,
    messagesProcessed: 0,
    messagesDropped: 0,
    averageProcessingTime: 0,
    lastProcessingTime: 0,
    debounceHits: 0
  });

  // Process single message
  const processMessage = useCallback((message) => {
    const startTime = performance.now();

    try {
      // Add timestamp and metadata
      const processedMessage = {
        ...message,
        processedAt: new Date().toISOString(),
        queueSize: messageQueueRef.current.length
      };

      setMessages(prev => [...prev, processedMessage]);

      // Update metrics
      const processingTime = performance.now() - startTime;
      const metrics = metricsRef.current;
      metrics.messagesProcessed++;
      metrics.lastProcessingTime = processingTime;

      // Update average processing time
      if (metrics.averageProcessingTime === 0) {
        metrics.averageProcessingTime = processingTime;
      } else {
        metrics.averageProcessingTime =
          (metrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
      }

    } catch (err) {
      console.error('Error processing message:', err);
      setError(`Message processing error: ${err.message}`);
    }
  }, []);

  // Process batch of messages
  const processBatch = useCallback((batch) => {
    const startTime = performance.now();

    try {
      if (batch.length === 0) return;

      // Process messages in batch
      setMessages(prev => {
        const processedBatch = batch.map(msg => ({
          ...msg,
          processedAt: new Date().toISOString(),
          batchId: Date.now()
        }));
        return [...prev, ...processedBatch];
      });

      // Update metrics
      const processingTime = performance.now() - startTime;
      const metrics = metricsRef.current;
      metrics.messagesProcessed += batch.length;
      metrics.lastProcessingTime = processingTime;

    } catch (err) {
      console.error('Error processing batch:', err);
      setError(`Batch processing error: ${err.message}`);
    }
  }, []);

  // Debounced message processing
  const debouncedProcess = useCallback((message) => {
    if (pausedRef.current) {
      // Queue message when paused
      if (messageQueueRef.current.length < maxQueueSize) {
        messageQueueRef.current.push(message);
        metricsRef.current.messagesQueued++;
      } else {
        metricsRef.current.messagesDropped++;
        console.warn('Message queue full, dropping message');
      }
      return;
    }

    if (!enableDebouncing) {
      // Process immediately if debouncing is disabled
      processMessage(message);
      return;
    }

    if (batchMode) {
      // Add to batch
      batchRef.current.push(message);

      // Clear existing timeout and set new one
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      batchTimeoutRef.current = setTimeout(() => {
        const batch = batchRef.current.splice(0);
        processBatch(batch);
      }, debounceDelay);

      return;
    }

    // Individual message debouncing
    messageQueueRef.current.push(message);
    metricsRef.current.messagesQueued++;
    metricsRef.current.debounceHits++;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout to process messages
    debounceTimeoutRef.current = setTimeout(() => {
      const queuedMessages = messageQueueRef.current.splice(0);

      if (queuedMessages.length > 0) {
        if (queuedMessages.length === 1) {
          processMessage(queuedMessages[0]);
        } else {
          // Process as batch if multiple messages queued
          processBatch(queuedMessages);
        }
      }
    }, debounceDelay);
  }, [enableDebouncing, batchMode, debounceDelay, maxQueueSize, processMessage, processBatch]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      metricsRef.current.messagesReceived++;

      // Route message based on type
      switch (message.type) {
        case 'claude-response':
        case 'cursor-response':
        case 'system-message':
          debouncedProcess(message);
          break;

        case 'session-update':
        case 'project-update':
          // High priority - process immediately
          processMessage(message);
          break;

        case 'heartbeat':
        case 'ping':
          // Low priority - debounce
          debouncedProcess(message);
          break;

        default:
          // Unknown message type - process immediately for safety
          processMessage(message);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
      setError(`Message parsing error: ${err.message}`);
    }
  }, [debouncedProcess, processMessage]);

  // WebSocket connection management
  const connect = useCallback((url, protocols = []) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      setConnecting(true);
      setError(null);
      wsUrlRef.current = url;

      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
        setConnecting(false);
        setError('Connection timeout');
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        setConnected(true);
        setConnecting(false);
        setError(null);

        // Reset metrics
        metricsRef.current = {
          messagesReceived: 0,
          messagesQueued: 0,
          messagesProcessed: 0,
          messagesDropped: 0,
          averageProcessingTime: 0,
          lastProcessingTime: 0,
          debounceHits: 0
        };

        // Update connection stats
        setConnectionStats({
          url,
          connectedAt: new Date().toISOString(),
          protocol: ws.protocol,
          extensions: ws.extensions
        });

        resolve();
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (event) => {
        clearTimeout(timeoutId);
        setConnected(false);
        setConnecting(false);
        setError('WebSocket connection error');
        reject(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        setConnected(false);
        setConnecting(false);

        if (event.code !== 1000) {
          setError(`WebSocket closed: ${event.code} - ${event.reason}`);
        }
      };
    });
  }, [handleWebSocketMessage]);

  // Send message
  const sendMessage = useCallback((message) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        wsRef.current.send(messageStr);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear timeouts
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Clear queues
    messageQueueRef.current = [];
    batchRef.current = [];

    setConnected(false);
    setConnecting(false);
    setError(null);
  }, []);

  // Pause updates
  const pauseUpdates = useCallback(() => {
    pausedRef.current = true;
  }, []);

  // Resume updates
  const resumeUpdates = useCallback(() => {
    pausedRef.current = false;

    // Process queued messages
    const queuedMessages = messageQueueRef.current.splice(0);
    if (queuedMessages.length > 0) {
      queuedMessages.forEach(msg => {
        processMessage(msg);
      });
    }
  }, [processMessage]);

  // Clear queue
  const clearQueue = useCallback(() => {
    messageQueueRef.current = [];
    batchRef.current = [];

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  // Flush queue (process all pending messages immediately)
  const flushQueue = useCallback(() => {
    const allMessages = [
      ...messageQueueRef.current.splice(0),
      ...batchRef.current.splice(0)
    ];

    // Clear timeouts
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Process all messages immediately
    if (allMessages.length > 0) {
      processBatch(allMessages);
    }
  }, [processBatch]);

  // Get metrics
  const getMetrics = useCallback(() => {
    return {
      ...metricsRef.current,
      queueSize: messageQueueRef.current.length,
      batchSize: batchRef.current.length,
      isProcessing: processingRef.current,
      isPaused: pausedRef.current
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Periodic metrics update
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionStats(prev => ({
        ...prev,
        metrics: getMetrics(),
        lastUpdate: new Date().toISOString()
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  const value = {
    // Connection state
    connected,
    connecting,
    error,

    // Message handling
    sendMessage,
    messages,
    connectionStats,

    // Debouncing controls
    debounceDelay,
    batchMode,
    enableDebouncing,

    // Advanced controls
    pauseUpdates,
    resumeUpdates,
    clearQueue,
    flushQueue,
    getMetrics,

    // Connection management
    connect,
    disconnect
  };

  return (
    <DebouncedWebSocketContext.Provider value={value}>
      {children}
    </DebouncedWebSocketContext.Provider>
  );
};

export { DebouncedWebSocketContext };
export default DebouncedWebSocketProvider;