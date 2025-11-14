/**
 * Session Cache Service
 * Provides intelligent caching and background loading for chat sessions
 * Includes LRU cache, preloading, and stale-while-revalidate strategies
 */
class SessionCacheService {
  constructor(options = {}) {
    // Cache configuration
    this.maxCacheSize = options.maxCacheSize || 50; // Max number of sessions
    this.maxMemoryUsage = options.maxMemoryUsage || 50 * 1024 * 1024; // 50MB
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.staleWhileRevalidate = options.staleWhileRevalidate || 60000; // 1 minute
    this.backgroundLoadDelay = options.backgroundLoadDelay || 1000; // 1 second

    // Cache storage
    this.cache = new Map(); // sessionId -> cache entry
    this.accessOrder = []; // LRU access order
    this.backgroundLoadQueue = new Set();
    this.loadingPromises = new Map();

    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      backgroundLoads: 0,
      evictions: 0,
      totalMemoryUsage: 0,
      averageLoadTime: 0,
      cacheHitRate: 0
    };

    // Background loading
    this.backgroundLoadTimer = null;
    this.isBackgroundLoadingEnabled = options.enableBackgroundLoading !== false;

    // Preloading strategy
    this.preloadStrategy = options.preloadStrategy || 'adjacent'; // 'adjacent', 'recent', 'predictive'
    this.preloadDistance = options.preloadDistance || 2; // Number of adjacent sessions to preload

    // Initialize background loading
    if (this.isBackgroundLoadingEnabled) {
      this.startBackgroundLoader();
    }

    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
      this.enforceMemoryLimits();
    }, 60000); // Every minute
  }

  /**
   * Get session from cache
   */
  async get(sessionId, options = {}) {
    const {
      forceRefresh = false,
      enableBackgroundLoad = true,
      customLoader = null
    } = options;

    const entry = this.cache.get(sessionId);

    // Cache hit
    if (entry && !forceRefresh) {
      this.updateAccessOrder(sessionId);
      this.metrics.hits++;

      // Check if entry is stale but still usable
      if (this.isStale(entry) && enableBackgroundLoad) {
        this.scheduleBackgroundLoad(sessionId, customLoader);
      }

      return {
        data: entry.data,
        fromCache: true,
        isStale: this.isStale(entry),
        cachedAt: entry.cachedAt
      };
    }

    // Cache miss
    this.metrics.misses++;

    if (customLoader) {
      try {
        const data = await this.loadWithCustomLoader(sessionId, customLoader);
        this.set(sessionId, data);
        return {
          data,
          fromCache: false,
          isStale: false,
          cachedAt: Date.now()
        };
      } catch (error) {
        console.error(`Failed to load session ${sessionId}:`, error);
        throw error;
      }
    }

    return null;
  }

  /**
   * Set session in cache
   */
  set(sessionId, data, options = {}) => {
    const {
      ttl = this.defaultTTL,
      priority = 'normal',
      metadata = {}
    } = options;

    const now = Date.now();
    const entry = {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      priority,
      metadata,
      accessCount: 0,
      size: this.calculateDataSize(data)
    };

    // Check memory limits before adding
    this.enforceMemoryLimits();

    // Add or update entry
    if (this.cache.has(sessionId)) {
      this.accessOrder = this.accessOrder.filter(id => id !== sessionId);
    }

    this.cache.set(sessionId, entry);
    this.accessOrder.push(sessionId);
    this.updateMetrics();

    console.log(`Session cached: ${sessionId} (${entry.size} bytes, priority: ${priority})`);
  }

  /**
   * Check if session exists in cache
   */
  has(sessionId) {
    const entry = this.cache.get(sessionId);
    return entry && !this.isExpired(entry);
  }

  /**
   * Remove session from cache
   */
  delete(sessionId) {
    const entry = this.cache.get(sessionId);
    if (entry) {
      this.cache.delete(sessionId);
      this.accessOrder = this.accessOrder.filter(id => id !== sessionId);
      this.metrics.totalMemoryUsage -= entry.size;
      return true;
    }
    return false;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.metrics.totalMemoryUsage = 0;
    this.backgroundLoadQueue.clear();
  }

  /**
   * Preload sessions based on strategy
   */
  async preloadSessions(sessionIds, currentSessionId, loader) {
    if (!this.isBackgroundLoadingEnabled) {
      return;
    }

    let sessionsToLoad = [];

    switch (this.preloadStrategy) {
      case 'adjacent':
        sessionsToLoad = this.getAdjacentSessions(sessionIds, currentSessionId);
        break;

      case 'recent':
        sessionsToLoad = this.getRecentSessions(sessionIds, currentSessionId);
        break;

      case 'predictive':
        sessionsToLoad = this.getPredictiveSessions(sessionIds, currentSessionId);
        break;

      default:
        sessionsToLoad = sessionIds.slice(0, this.preloadDistance);
    }

    // Filter out already cached sessions
    sessionsToLoad = sessionsToLoad.filter(id => !this.has(id));

    // Load sessions in background
    for (const sessionId of sessionsToLoad) {
      this.scheduleBackgroundLoad(sessionId, loader);
    }
  }

  /**
   * Schedule background load for a session
   */
  scheduleBackgroundLoad(sessionId, loader) {
    if (this.backgroundLoadQueue.has(sessionId) || this.loadingPromises.has(sessionId)) {
      return;
    }

    this.backgroundLoadQueue.add(sessionId);

    setTimeout(() => {
      this.performBackgroundLoad(sessionId, loader);
    }, this.backgroundLoadDelay);
  }

  /**
   * Perform background load
   */
  async performBackgroundLoad(sessionId, loader) {
    if (!loader || this.loadingPromises.has(sessionId)) {
      return;
    }

    const loadPromise = this.loadWithCustomLoader(sessionId, loader);
    this.loadingPromises.set(sessionId, loadPromise);

    try {
      const data = await loadPromise;
      this.set(sessionId, data, { priority: 'low' });
      this.metrics.backgroundLoads++;
    } catch (error) {
      console.warn(`Background load failed for session ${sessionId}:`, error);
    } finally {
      this.loadingPromises.delete(sessionId);
      this.backgroundLoadQueue.delete(sessionId);
    }
  }

  /**
   * Load session with custom loader
   */
  async loadWithCustomLoader(sessionId, loader) {
    const startTime = performance.now();

    try {
      const data = await loader(sessionId);
      const loadTime = performance.now() - startTime;

      // Update average load time
      this.updateLoadTimeMetrics(loadTime);

      return data;
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;

    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      averageEntrySize: this.cache.size > 0 ? this.metrics.totalMemoryUsage / this.cache.size : 0,
      backgroundLoadQueue: this.backgroundLoadQueue.size,
      loadingPromises: this.loadingPromises.size,
      memoryUsagePercentage: (this.metrics.totalMemoryUsage / this.maxMemoryUsage) * 100
    };
  }

  /**
   * Get cached session IDs
   */
  getCachedSessionIds() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId) {
    const entry = this.cache.get(sessionId);
    if (!entry) return null;

    return {
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      priority: entry.priority,
      accessCount: entry.accessCount,
      size: entry.size,
      isStale: this.isStale(entry),
      isExpired: this.isExpired(entry),
      ttl: Math.max(0, entry.expiresAt - Date.now()),
      ...entry.metadata
    };
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(sessionId, metadata) {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...metadata };
      entry.cachedAt = Date.now(); // Update cached at to extend TTL
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(sessionId) {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.expiresAt = Date.now(); // Mark as expired
    }
  }

  /**
   * Refresh cache entry
   */
  async refresh(sessionId, loader) {
    try {
      const data = await this.loadWithCustomLoader(sessionId, loader);
      this.set(sessionId, data);
      return data;
    } catch (error) {
      console.error(`Failed to refresh session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Cache warming - preload frequently accessed sessions
   */
  async warmCache(sessionIds, loader, prioritySessions = []) {
    // Prioritize important sessions
    const prioritizedIds = [
      ...prioritySessions,
      ...sessionIds.filter(id => !prioritySessions.includes(id))
    ];

    // Load in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < prioritizedIds.length; i += batchSize) {
      const batch = prioritizedIds.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(sessionId =>
          this.performBackgroundLoad(sessionId, loader)
        )
      );

      // Small delay between batches
      if (i + batchSize < prioritizedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Implement stale-while-revalidate strategy
   */
  async staleWhileRevalidate(sessionId, loader) {
    const entry = this.cache.get(sessionId);

    if (entry && !this.isExpired(entry)) {
      // Return cached data immediately
      const cachedData = entry.data;

      // If stale, trigger background refresh
      if (this.isStale(entry) && !this.loadingPromises.has(sessionId)) {
        this.scheduleBackgroundLoad(sessionId, loader);
      }

      return {
        data: cachedData,
        fromCache: true,
        isStale: this.isStale(entry),
        backgroundRefresh: this.isStale(entry)
      };
    }

    // No valid cache, load fresh data
    const data = await this.loadWithCustomLoader(sessionId, loader);
    this.set(sessionId, data);

    return {
      data,
      fromCache: false,
      isStale: false,
      backgroundRefresh: false
    };
  }

  /**
   * Background loader management
   */
  startBackgroundLoader() {
    this.backgroundLoadTimer = setInterval(() => {
      this.processBackgroundQueue();
    }, 5000); // Process every 5 seconds
  }

  stopBackgroundLoader() {
    if (this.backgroundLoadTimer) {
      clearInterval(this.backgroundLoadTimer);
      this.backgroundLoadTimer = null;
    }
  }

  processBackgroundQueue() {
    if (this.backgroundLoadQueue.size === 0) {
      return;
    }

    // Process a limited number of items per cycle
    const maxProcessing = 3;
    const toProcess = Array.from(this.backgroundLoadQueue).slice(0, maxProcessing);

    toProcess.forEach(sessionId => {
      this.backgroundLoadQueue.delete(sessionId);
      // The actual loading would be done by the caller who scheduled the load
    });
  }

  /**
   * Preloading strategies
   */
  getAdjacentSessions(sessionIds, currentSessionId) {
    const currentIndex = sessionIds.indexOf(currentSessionId);
    const adjacentIds = [];

    for (let i = 1; i <= this.preloadDistance; i++) {
      const prevIndex = currentIndex - i;
      const nextIndex = currentIndex + i;

      if (prevIndex >= 0) adjacentIds.push(sessionIds[prevIndex]);
      if (nextIndex < sessionIds.length) adjacentIds.push(sessionIds[nextIndex]);
    }

    return adjacentIds;
  }

  getRecentSessions(sessionIds, currentSessionId) {
    // Return most recent sessions (simplified - would need access to timestamps)
    return sessionIds.slice(-this.preloadDistance);
  }

  getPredictiveSessions(sessionIds, currentSessionId) {
    // Simplified predictive model - in reality would use usage patterns
    return this.getAdjacentSessions(sessionIds, currentSessionId);
  }

  /**
   * Utility methods
   */
  updateAccessOrder(sessionId) {
    this.accessOrder = this.accessOrder.filter(id => id !== sessionId);
    this.accessOrder.push(sessionId);

    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.accessCount++;
    }
  }

  isStale(entry) {
    return Date.now() > (entry.cachedAt + this.defaultTTL - this.staleWhileRevalidate);
  }

  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  calculateDataSize(data) {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  updateMetrics() {
    this.metrics.totalMemoryUsage = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  updateLoadTimeMetrics(loadTime) {
    const totalLoads = this.metrics.hits + this.metrics.misses;
    this.metrics.averageLoadTime =
      (this.metrics.averageLoadTime * (totalLoads - 1) + loadTime) / totalLoads;
  }

  enforceMemoryLimits() {
    // Evict least recently used entries if over size limit
    while (this.cache.size > this.maxCacheSize) {
      this.evictLRU();
    }

    // Evict if over memory limit
    while (this.metrics.totalMemoryUsage > this.maxMemoryUsage && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  evictLRU() {
    if (this.accessOrder.length === 0) return;

    const lruId = this.accessOrder.shift();
    const entry = this.cache.get(lruId);

    if (entry) {
      this.metrics.totalMemoryUsage -= entry.size;
      this.cache.delete(lruId);
      this.metrics.evictions++;
    }
  }

  cleanupExpiredEntries() {
    const now = Date.now();
    const expiredIds = [];

    for (const [sessionId, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredIds.push(sessionId);
      }
    }

    expiredIds.forEach(sessionId => this.delete(sessionId));
  }

  /**
   * Export cache state
   */
  exportCache() {
    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      entries: {},
      metadata: this.getStats()
    };

    for (const [sessionId, entry] of this.cache.entries()) {
      exportData.entries[sessionId] = {
        data: entry.data,
        cachedAt: entry.cachedAt,
        expiresAt: entry.expiresAt,
        priority: entry.priority,
        metadata: entry.metadata
      };
    }

    return exportData;
  }

  /**
   * Import cache state
   */
  importCache(exportData, options = {}) {
    const { overwrite = false, validateData = true } = options;

    if (!exportData || !exportData.entries) {
      throw new Error('Invalid cache export data');
    }

    for (const [sessionId, entryData] of Object.entries(exportData.entries)) {
      if (validateData && !this.validateCacheEntry(entryData)) {
        console.warn(`Skipping invalid cache entry for session ${sessionId}`);
        continue;
      }

      if (!this.has(sessionId) || overwrite) {
        this.set(sessionId, entryData.data, {
          ttl: entryData.expiresAt - Date.now(),
          priority: entryData.priority,
          metadata: entryData.metadata
        });
      }
    }
  }

  validateCacheEntry(entry) {
    return entry && entry.data && typeof entry.cachedAt === 'number' && typeof entry.expiresAt === 'number';
  }

  /**
   * Destroy cache service
   */
  destroy() {
    this.clear();
    this.stopBackgroundLoader();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default SessionCacheService;