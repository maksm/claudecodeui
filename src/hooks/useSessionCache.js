import { useState, useEffect, useCallback, useRef } from 'react';
import SessionCacheService from '../services/sessionCache';

/**
 * React hook for session caching and background loading
 * Provides intelligent caching with stale-while-revalidate and preloading
 */
export const useSessionCache = (options = {}) => {
  const {
    maxCacheSize = 50,
    maxMemoryUsage = 50 * 1024 * 1024, // 50MB
    defaultTTL = 300000, // 5 minutes
    enableBackgroundLoading = true,
    preloadStrategy = 'adjacent',
    preloadDistance = 2
  } = options;

  // Cache service instance
  const cacheService = useRef(null);

  // Initialize cache service
  if (!cacheService.current) {
    cacheService.current = new SessionCacheService({
      maxCacheSize,
      maxMemoryUsage,
      defaultTTL,
      enableBackgroundLoading,
      preloadStrategy,
      preloadDistance
    });
  }

  // State for reactive updates
  const [stats, setStats] = useState(null);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);

  // Update stats periodically
  useEffect(() => {
    const updateStats = () => {
      const currentStats = cacheService.current.getStats();
      setStats(currentStats);
      setIsBackgroundLoading(currentStats.backgroundLoadQueue > 0 || currentStats.loadingPromises > 0);
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cacheService.current) {
        cacheService.current.destroy();
      }
    };
  }, []);

  // Get session from cache
  const getSession = useCallback(async (sessionId, loader, options = {}) => {
    if (!cacheService.current) {
      throw new Error('Cache service not initialized');
    }

    const customLoader = loader || options.loader;
    const result = await cacheService.current.get(sessionId, {
      ...options,
      customLoader
    });

    return result;
  }, []);

  // Set session in cache
  const setSession = useCallback((sessionId, data, options = {}) => {
    if (!cacheService.current) {
      console.warn('Cache service not initialized');
      return;
    }

    cacheService.current.set(sessionId, data, options);
  }, []);

  // Check if session exists in cache
  const hasSession = useCallback((sessionId) => {
    return cacheService.current ? cacheService.current.has(sessionId) : false;
  }, []);

  // Remove session from cache
  const removeSession = useCallback((sessionId) => {
    return cacheService.current ? cacheService.current.delete(sessionId) : false;
  }, []);

  // Preload sessions
  const preloadSessions = useCallback((sessionIds, currentSessionId, loader) => {
    if (!cacheService.current) {
      console.warn('Cache service not initialized');
      return;
    }

    return cacheService.current.preloadSessions(sessionIds, currentSessionId, loader);
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (sessionId, loader) => {
    if (!cacheService.current) {
      throw new Error('Cache service not initialized');
    }

    return await cacheService.current.refresh(sessionId, loader);
  }, []);

  // Stale-while-revalidate
  const getStaleWhileRevalidate = useCallback(async (sessionId, loader) => {
    if (!cacheService.current) {
      throw new Error('Cache service not initialized');
    }

    return await cacheService.current.staleWhileRevalidate(sessionId, loader);
  }, []);

  // Warm cache
  const warmCache = useCallback(async (sessionIds, loader, prioritySessions = []) => {
    if (!cacheService.current) {
      console.warn('Cache service not initialized');
      return;
    }

    await cacheService.current.warmCache(sessionIds, loader, prioritySessions);
  }, []);

  // Get cached session IDs
  const getCachedSessionIds = useCallback(() => {
    return cacheService.current ? cacheService.current.getCachedSessionIds() : [];
  }, []);

  // Get session metadata
  const getSessionMetadata = useCallback((sessionId) => {
    return cacheService.current ? cacheService.current.getSessionMetadata(sessionId) : null;
  }, []);

  // Update session metadata
  const updateSessionMetadata = useCallback((sessionId, metadata) => {
    if (cacheService.current) {
      cacheService.current.updateSessionMetadata(sessionId, metadata);
    }
  }, []);

  // Invalidate session
  const invalidateSession = useCallback((sessionId) => {
    if (cacheService.current) {
      cacheService.current.invalidate(sessionId);
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    if (cacheService.current) {
      cacheService.current.clear();
    }
  }, []);

  // Export/Import cache
  const exportCache = useCallback(() => {
    return cacheService.current ? cacheService.current.exportCache() : null;
  }, []);

  const importCache = useCallback((data, options = {}) => {
    if (cacheService.current) {
      cacheService.current.importCache(data, options);
    }
  }, []);

  return {
    // Core cache operations
    getSession,
    setSession,
    hasSession,
    removeSession,
    refreshSession,

    // Advanced caching strategies
    getStaleWhileRevalidate,
    preloadSessions,
    warmCache,

    // Cache management
    clearCache,
    exportCache,
    importCache,
    invalidateSession,

    // Metadata and stats
    getSessionMetadata,
    updateSessionMetadata,
    getCachedSessionIds,
    stats,
    isBackgroundLoading,

    // Derived state
    cacheSize: stats?.cacheSize || 0,
    hitRate: stats?.hitRate || 0,
    memoryUsage: stats?.totalMemoryUsage || 0,
    backgroundLoadQueue: stats?.backgroundLoadQueue || 0
  };
};

/**
 * Hook for managing a specific session with caching
 */
export const useCachedSession = (sessionId, loader, options = {}) => {
  const {
    autoLoad = true,
    staleWhileRevalidate = true,
    refreshInterval = null,
    refreshOnWindowFocus = false
  } = options;

  const sessionCache = useSessionCache();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load session
  const loadSession = useCallback(async () => {
    if (!sessionId || !loader) return;

    try {
      setLoading(true);
      setError(null);

      let result;
      if (staleWhileRevalidate) {
        result = await sessionCache.getStaleWhileRevalidate(sessionId, loader);
      } else {
        result = await sessionCache.getSession(sessionId, loader);
      }

      if (result) {
        setSession(result.data);
        setLastUpdated(result.fromCache ? result.cachedAt : Date.now());
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, loader, staleWhileRevalidate, sessionCache]);

  // Refresh session
  const refresh = useCallback(async () => {
    if (!sessionId || !loader) return;

    try {
      setLoading(true);
      setError(null);

      const data = await sessionCache.refreshSession(sessionId, loader);
      setSession(data);
      setLastUpdated(Date.now());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, loader, sessionCache]);

  // Update session in cache
  const updateSession = useCallback((newData) => {
    if (sessionId) {
      sessionCache.setSession(sessionId, newData);
      setSession(newData);
      setLastUpdated(Date.now());
    }
  }, [sessionId, sessionCache]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && sessionId && loader) {
      loadSession();
    }
  }, [autoLoad, sessionId, loader, loadSession]);

  // Refresh interval
  useEffect(() => {
    if (!refreshInterval || !sessionId || !loader) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, sessionId, loader, refresh]);

  // Refresh on window focus
  useEffect(() => {
    if (!refreshOnWindowFocus || !sessionId || !loader) return;

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshOnWindowFocus, sessionId, loader, refresh]);

  // Get session metadata
  const metadata = sessionCache.getSessionMetadata(sessionId);

  return {
    session,
    loading,
    error,
    metadata,
    lastUpdated,
    loadSession,
    refresh,
    updateSession,
    isFromCache: metadata?.cachedAt ? true : false,
    isStale: metadata?.isStale || false
  };
};

/**
 * Hook for cache statistics and monitoring
 */
export const useCacheMonitor = (interval = 2000) => {
  const sessionCache = useSessionCache();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const updateStats = () => {
      const currentStats = sessionCache.getStats();
      setStats(currentStats);
    };

    updateStats();
    const intervalId = setInterval(updateStats, interval);

    return () => clearInterval(intervalId);
  }, [sessionCache, interval]);

  const getCacheHealth = useCallback(() => {
    if (!stats) return 'unknown';

    const hitRate = stats.hitRate;
    const memoryUsage = stats.memoryUsagePercentage;

    if (hitRate < 50 || memoryUsage > 90) return 'poor';
    if (hitRate < 70 || memoryUsage > 75) return 'fair';
    if (hitRate < 85 || memoryUsage > 60) return 'good';
    return 'excellent';
  }, [stats]);

  const formatCacheSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return {
    stats,
    getCacheHealth,
    formatCacheSize,
    cacheHitRate: stats?.hitRate || 0,
    cacheSize: stats?.cacheSize || 0,
    memoryUsage: stats?.totalMemoryUsage || 0,
    backgroundLoading: stats?.backgroundLoadQueue > 0 || stats?.loadingPromises > 0
  };
};

/**
 * Hook for session preloading strategy
 */
export const useSessionPreloader = (sessionIds, currentSessionId, loader) => {
  const sessionCache = useSessionCache();
  const [preloadStatus, setPreloadStatus] = useState({});

  // Get adjacent session IDs
  const getAdjacentSessionIds = useCallback((allIds, currentId) => {
    const currentIndex = allIds.indexOf(currentId);
    const adjacentIds = [];

    // Previous and next sessions
    if (currentIndex > 0) adjacentIds.push(allIds[currentIndex - 1]);
    if (currentIndex < allIds.length - 1) adjacentIds.push(allIds[currentIndex + 1]);

    return adjacentIds;
  }, []);

  // Preload adjacent sessions
  const preloadAdjacent = useCallback(() => {
    if (!sessionIds || !currentSessionId || !loader) return;

    sessionCache.preloadSessions(sessionIds, currentSessionId, loader);

    // Update preload status
    const adjacentSessions = getAdjacentSessionIds(sessionIds, currentSessionId);
    const status = {};
    adjacentSessions.forEach(id => {
      status[id] = 'preloading';
    });
    setPreloadStatus(status);
  }, [sessionIds, currentSessionId, loader, sessionCache, getAdjacentSessionIds]);

  // Warm cache with prioritized sessions
  const warmCache = useCallback(async (prioritySessions = []) => {
    if (!sessionIds || !loader) return;

    await sessionCache.warmCache(sessionIds, loader, prioritySessions);
  }, [sessionIds, loader, sessionCache]);

  // Check preload status for a session
  const getPreloadStatus = useCallback((sessionId) => {
    return preloadStatus[sessionId] || 'not-preloaded';
  }, [preloadStatus]);

  return {
    preloadAdjacent,
    warmCache,
    getPreloadStatus,
    getAdjacentSessionIds,
    preloadStatus
  };
};

export default useSessionCache;