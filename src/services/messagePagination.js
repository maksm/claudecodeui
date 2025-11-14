/**
 * Message Pagination Service
 * Handles pagination, lazy loading, and caching of chat messages
 */

class MessagePaginationService {
  constructor(options = {}) {
    this.pageSize = options.pageSize || 50;
    this.maxCacheSize = options.maxCacheSize || 5000;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.baseUrl = options.baseUrl || '/api';
    this.enableCache = options.enableCache !== false;

    // Message cache
    this.messageCache = new Map();
    this.pageCache = new Map();

    // Loading states
    this.loadingPages = new Set();
    this.sessionMetadata = new Map();

    // Pagination cursors for backward/forward pagination
    this.cursors = new Map();
  }

  /**
   * Initialize pagination for a session
   */
  async initializeSession(sessionId) {
    if (this.sessionMetadata.has(sessionId)) {
      return this.sessionMetadata.get(sessionId);
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages/info`);
      const info = await response.json();

      const metadata = {
        sessionId,
        totalMessages: info.totalMessages || 0,
        firstMessageId: info.firstMessageId,
        lastMessageId: info.lastMessageId,
        createdAt: info.createdAt,
        hasMore: true,
        loading: false
      };

      this.sessionMetadata.set(sessionId, metadata);
      return metadata;
    } catch (error) {
      console.error('Failed to initialize session pagination:', error);
      throw error;
    }
  }

  /**
   * Load initial messages for a session
   */
  async loadInitialMessages(sessionId, limit = this.pageSize) {
    try {
      this.setLoadingState(sessionId, true);

      const response = await fetch(
        `${this.baseUrl}/sessions/${sessionId}/messages?limit=${limit}&order=desc`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.messages || [];

      // Cache the messages
      if (this.enableCache) {
        this.cacheMessages(sessionId, messages);
      }

      // Update cursors
      this.updateCursor(sessionId, {
        before: data.beforeCursor,
        after: data.afterCursor,
        hasMore: data.hasMore !== false,
        totalLoaded: messages.length
      });

      // Update metadata
      const metadata = this.sessionMetadata.get(sessionId) || {};
      metadata.totalLoaded = messages.length;
      this.sessionMetadata.set(sessionId, metadata);

      return {
        messages,
        hasMore: data.hasMore !== false,
        beforeCursor: data.beforeCursor,
        afterCursor: data.afterCursor,
        totalLoaded: messages.length
      };
    } catch (error) {
      console.error('Failed to load initial messages:', error);
      throw error;
    } finally {
      this.setLoadingState(sessionId, false);
    }
  }

  /**
   * Load older messages (backward pagination)
   */
  async loadOlderMessages(sessionId, cursor = null) {
    const sessionCursor = this.cursors.get(sessionId) || {};
    const beforeCursor = cursor || sessionCursor.before;

    if (!beforeCursor && !this.hasMoreOlderMessages(sessionId)) {
      return { messages: [], hasMore: false };
    }

    try {
      this.setLoadingState(sessionId, true);

      const url = new URL(`${this.baseUrl}/sessions/${sessionId}/messages`);
      url.searchParams.set('limit', this.pageSize);
      url.searchParams.set('order', 'desc');

      if (beforeCursor) {
        url.searchParams.set('before', beforeCursor);
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.messages || [];

      // Cache the messages
      if (this.enableCache) {
        this.cacheMessages(sessionId, messages);
      }

      // Update cursors
      this.updateCursor(sessionId, {
        ...sessionCursor,
        before: data.beforeCursor,
        hasMoreOlder: data.hasMore !== false,
        totalLoaded: (sessionCursor.totalLoaded || 0) + messages.length
      });

      return {
        messages,
        hasMore: data.hasMore !== false,
        beforeCursor: data.beforeCursor,
        addedToTop: true
      };
    } catch (error) {
      console.error('Failed to load older messages:', error);
      throw error;
    } finally {
      this.setLoadingState(sessionId, false);
    }
  }

  /**
   * Load newer messages (forward pagination)
   */
  async loadNewerMessages(sessionId, cursor = null) {
    const sessionCursor = this.cursors.get(sessionId) || {};
    const afterCursor = cursor || sessionCursor.after;

    if (!afterCursor) {
      return { messages: [], hasMore: false };
    }

    try {
      this.setLoadingState(sessionId, true);

      const url = new URL(`${this.baseUrl}/sessions/${sessionId}/messages`);
      url.searchParams.set('limit', this.pageSize);
      url.searchParams.set('order', 'asc');

      if (afterCursor) {
        url.searchParams.set('after', afterCursor);
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.messages || [];

      // Cache the messages
      if (this.enableCache) {
        this.cacheMessages(sessionId, messages);
      }

      // Update cursors
      this.updateCursor(sessionId, {
        ...sessionCursor,
        after: data.afterCursor,
        hasMoreNewer: data.hasMore !== false
      });

      return {
        messages,
        hasMore: data.hasMore !== false,
        afterCursor: data.afterCursor,
        addedToBottom: true
      };
    } catch (error) {
      console.error('Failed to load newer messages:', error);
      throw error;
    } finally {
      this.setLoadingState(sessionId, false);
    }
  }

  /**
   * Add a new message in real-time
   */
  addRealTimeMessage(sessionId, message) {
    const cacheKey = `${sessionId}:messages`;
    const messages = this.messageCache.get(cacheKey) || [];

    // Add message to cache
    const updatedMessages = [...messages, message];

    // Cache management - remove oldest if cache is too large
    if (updatedMessages.length > this.maxCacheSize) {
      const excess = updatedMessages.length - this.maxCacheSize;
      updatedMessages.splice(0, excess);
    }

    this.messageCache.set(cacheKey, updatedMessages);

    // Update metadata
    const metadata = this.sessionMetadata.get(sessionId) || {};
    metadata.totalLoaded = (metadata.totalLoaded || 0) + 1;
    metadata.lastMessageId = message.id;
    this.sessionMetadata.set(sessionId, metadata);
  }

  /**
   * Get messages from cache
   */
  getCachedMessages(sessionId, limit = null) {
    const cacheKey = `${sessionId}:messages`;
    const messages = this.messageCache.get(cacheKey) || [];

    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Cache messages
   */
  cacheMessages(sessionId, messages) {
    const cacheKey = `${sessionId}:messages`;
    const existingMessages = this.messageCache.get(cacheKey) || [];

    // Merge with existing messages, avoiding duplicates
    const mergedMessages = this.mergeMessages(existingMessages, messages);

    // Cache management
    if (mergedMessages.length > this.maxCacheSize) {
      const excess = mergedMessages.length - this.maxCacheSize;
      mergedMessages.splice(0, excess);
    }

    this.messageCache.set(cacheKey, mergedMessages);

    // Set cache expiration
    if (this.enableCache && this.cacheTimeout > 0) {
      setTimeout(() => {
        this.messageCache.delete(cacheKey);
      }, this.cacheTimeout);
    }
  }

  /**
   * Merge messages avoiding duplicates
   */
  mergeMessages(existing, newMessages) {
    const messageMap = new Map();

    // Add existing messages
    existing.forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    // Add or update with new messages
    newMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    // Sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Update pagination cursor
   */
  updateCursor(sessionId, updates) {
    const existing = this.cursors.get(sessionId) || {};
    this.cursors.set(sessionId, { ...existing, ...updates });
  }

  /**
   * Check if there are more older messages
   */
  hasMoreOlderMessages(sessionId) {
    const cursor = this.cursors.get(sessionId) || {};
    return cursor.hasMoreOlder !== false;
  }

  /**
   * Check if there are more newer messages
   */
  hasMoreNewerMessages(sessionId) {
    const cursor = this.cursors.get(sessionId) || {};
    return cursor.hasMoreNewer !== false;
  }

  /**
   * Check if currently loading
   */
  isLoading(sessionId) {
    return this.loadingPages.has(sessionId);
  }

  /**
   * Set loading state
   */
  setLoadingState(sessionId, loading) {
    if (loading) {
      this.loadingPages.add(sessionId);
    } else {
      this.loadingPages.delete(sessionId);
    }
  }

  /**
   * Clear cache for a session
   */
  clearSessionCache(sessionId) {
    this.messageCache.delete(`${sessionId}:messages`);
    this.pageCache.delete(`${sessionId}:pages`);
    this.cursors.delete(sessionId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.messageCache.clear();
    this.pageCache.clear();
    this.cursors.clear();
    this.sessionMetadata.clear();
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const metadata = this.sessionMetadata.get(sessionId) || {};
    const cursor = this.cursors.get(sessionId) || {};
    const cachedMessages = this.getCachedMessages(sessionId);

    return {
      sessionId,
      totalMessages: metadata.totalMessages || 0,
      cachedMessages: cachedMessages.length,
      totalLoaded: metadata.totalLoaded || 0,
      hasMoreOlder: this.hasMoreOlderMessages(sessionId),
      hasMoreNewer: this.hasMoreNewerMessages(sessionId),
      isLoading: this.isLoading(sessionId),
      cacheSize: this.messageCache.size
    };
  }

  /**
   * Search messages in cache
   */
  searchMessages(sessionId, query, options = {}) {
    const {
      caseSensitive = false,
      wholeWord = false,
      limit = 100,
      includeContent = true,
      includeMetadata = true
    } = options;

    const messages = this.getCachedMessages(sessionId);
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    const results = messages
      .filter(message => {
        if (!includeContent && !message.metadata) return false;

        let searchText = '';

        if (includeContent && message.content) {
          searchText += message.content;
        }

        if (includeMetadata && message.metadata) {
          searchText += JSON.stringify(message.metadata);
        }

        if (!caseSensitive) {
          searchText = searchText.toLowerCase();
        }

        if (wholeWord) {
          const regex = new RegExp(`\\b${this.escapeRegExp(searchQuery)}\\b`, caseSensitive ? '' : 'i');
          return regex.test(searchText);
        }

        return searchText.includes(searchQuery);
      })
      .slice(0, limit)
      .map(message => ({
        message,
        score: this.calculateRelevanceScore(message, query, caseSensitive)
      }))
      .sort((a, b) => b.score - a.score)
      .map(result => result.message);

    return results;
  }

  /**
   * Calculate relevance score for search
   */
  calculateRelevanceScore(message, query, caseSensitive = false) {
    let score = 0;
    const searchText = `${message.content || ''} ${JSON.stringify(message.metadata || {})}`;
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const content = caseSensitive ? searchText : searchText.toLowerCase();

    // Exact match gets highest score
    if (content === searchQuery) {
      score += 100;
    }

    // Starts with query
    if (content.startsWith(searchQuery)) {
      score += 50;
    }

    // Count occurrences
    const regex = new RegExp(this.escapeRegExp(searchQuery), 'gi');
    const matches = content.match(regex);
    if (matches) {
      score += matches.length * 10;
    }

    // Prioritize recent messages
    const age = Date.now() - new Date(message.timestamp).getTime();
    const ageInHours = age / (1000 * 60 * 60);
    score += Math.max(0, 10 - ageInHours);

    return score;
  }

  /**
   * Escape regex special characters
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Preload messages for a session
   */
  async preloadSession(sessionId, maxPages = 3) {
    try {
      await this.initializeSession(sessionId);

      // Load initial page
      await this.loadInitialMessages(sessionId);

      // Preload older pages
      for (let i = 1; i < maxPages && this.hasMoreOlderMessages(sessionId); i++) {
        await this.loadOlderMessages(sessionId);
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Failed to preload session:', error);
    }
  }
}

export default MessagePaginationService;