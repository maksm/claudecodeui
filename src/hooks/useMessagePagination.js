import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MessagePaginationService from '../services/messagePagination';

/**
 * React hook for message pagination
 * Provides lazy loading, caching, and pagination for chat messages
 */
export const useMessagePagination = (sessionId, options = {}) => {
  const {
    pageSize = 50,
    maxCacheSize = 5000,
    enableCache = true,
    autoLoad = true,
    preloadPages = 2,
  } = options;

  // Initialize service instance
  const service = useMemo(() => {
    return new MessagePaginationService({
      pageSize,
      maxCacheSize,
      enableCache,
    });
  }, [pageSize, maxCacheSize, enableCache]);

  // State
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [sessionStats, setSessionStats] = useState(null);

  // Refs for managing state
  const serviceRef = useRef(service);
  const sessionIdRef = useRef(sessionId);

  // Initialize session
  const initializeSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const stats = await serviceRef.current.initializeSession(sessionIdRef.current);
      setSessionStats(stats);

      // Auto-load initial messages if enabled
      if (autoLoad) {
        const result = await serviceRef.current.loadInitialMessages(sessionIdRef.current);
        setMessages(result.messages || []);
        setHasMore(result.hasMore !== false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load messages');
      console.error('Session initialization failed:', err);
    } finally {
      setLoading(false);
    }
  }, [autoLoad]);

  // Load older messages
  const loadOlder = useCallback(async () => {
    if (!sessionIdRef.current || loading || !hasMore) return;

    try {
      setLoading(true);
      const result = await serviceRef.current.loadOlderMessages(sessionIdRef.current);

      if (result.addedToTop) {
        setMessages(prev => [...result.messages, ...prev]);
      } else {
        setMessages(prev => [...prev, ...result.messages]);
      }

      setHasMore(result.hasMore !== false);
    } catch (err) {
      setError(err.message || 'Failed to load older messages');
      console.error('Failed to load older messages:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

  // Load newer messages
  const loadNewer = useCallback(async () => {
    if (!sessionIdRef.current || loading) return;

    try {
      setLoading(true);
      const result = await serviceRef.current.loadNewerMessages(sessionIdRef.current);

      if (result.addedToBottom) {
        setMessages(prev => [...prev, ...result.messages]);
      } else {
        setMessages(prev => [...result.messages, ...prev]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load newer messages');
      console.error('Failed to load newer messages:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Add real-time message
  const addRealTimeMessage = useCallback(message => {
    if (!sessionIdRef.current) return;

    serviceRef.current.addRealTimeMessage(sessionIdRef.current, message);

    // Add message to state if it's not already present
    setMessages(prev => {
      const exists = prev.some(msg => msg.id === message.id);
      if (!exists) {
        return [...prev, message];
      }
      return prev;
    });
  }, []);

  // Search messages
  const searchMessages = useCallback((query, searchOptions = {}) => {
    if (!sessionIdRef.current) return [];

    try {
      return serviceRef.current.searchMessages(sessionIdRef.current, query, searchOptions);
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  }, []);

  // Get cached messages
  const getCachedMessages = useCallback((limit = null) => {
    if (!sessionIdRef.current) return [];
    return serviceRef.current.getCachedMessages(sessionIdRef.current, limit);
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    if (!sessionIdRef.current) return;
    serviceRef.current.clearSessionCache(sessionIdRef.current);
    setMessages([]);
    setError(null);
  }, []);

  // Refresh messages
  const refresh = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Clear existing cache and reload
      serviceRef.current.clearSessionCache(sessionIdRef.current);
      const result = await serviceRef.current.loadInitialMessages(sessionIdRef.current);

      setMessages(result.messages || []);
      setHasMore(result.hasMore !== false);

      // Update stats
      const stats = serviceRef.current.getSessionStats(sessionIdRef.current);
      setSessionStats(stats);
    } catch (err) {
      setError(err.message || 'Failed to refresh messages');
      console.error('Refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Preload messages
  const preload = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      await serviceRef.current.preloadSession(sessionIdRef.current, preloadPages);
      const cachedMessages = serviceRef.current.getCachedMessages(sessionIdRef.current);
      setMessages(cachedMessages);

      const stats = serviceRef.current.getSessionStats(sessionIdRef.current);
      setSessionStats(stats);
    } catch (err) {
      console.error('Preload failed:', err);
    }
  }, [preloadPages]);

  // Get detailed statistics
  const getStatistics = useCallback(() => {
    if (!sessionIdRef.current) return null;
    return serviceRef.current.getSessionStats(sessionIdRef.current);
  }, []);

  // Initialize on mount and session change
  useEffect(() => {
    sessionIdRef.current = sessionId;
    initializeSession();

    return () => {
      // Cleanup when session changes or component unmounts
      if (sessionIdRef.current) {
        serviceRef.current.clearSessionCache(sessionIdRef.current);
      }
    };
  }, [sessionId, initializeSession]);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getStatistics();
      if (stats) {
        setSessionStats(stats);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getStatistics]);

  // Memoized return value
  const paginationState = useMemo(
    () => ({
      // Data
      messages,
      loading,
      error,
      hasMore,
      stats: sessionStats,

      // Actions
      loadOlder,
      loadNewer,
      addRealTimeMessage,
      searchMessages,
      getCachedMessages,
      clearCache,
      refresh,
      preload,
      getStatistics,

      // Utilities
      isLoading: loading,
      hasError: !!error,
      messageCount: messages.length,
      isLoadingMore: loading && hasMore,

      // Service reference for advanced usage
      service: serviceRef.current,
    }),
    [
      messages,
      loading,
      error,
      hasMore,
      sessionStats,
      loadOlder,
      loadNewer,
      addRealTimeMessage,
      searchMessages,
      getCachedMessages,
      clearCache,
      refresh,
      preload,
      getStatistics,
    ]
  );

  return paginationState;
};

export default useMessagePagination;
