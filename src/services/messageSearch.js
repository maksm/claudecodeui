import Fuse from 'fuse.js';

/**
 * Message Search Service
 * Provides fast fuzzy search for chat messages using Fuse.js
 * Includes indexing, caching, and advanced search features
 */
class MessageSearchService {
  constructor(options = {}) {
    // Fuse.js options for optimal message search
    this.fuseOptions = {
      keys: [
        {
          name: 'content',
          weight: 0.7 // Content is most important
        },
        {
          name: 'sender',
          weight: 0.2 // Sender identification
        },
        {
          name: 'metadata.file',
          weight: 0.05 // File attachments
        },
        {
          name: 'metadata.command',
          weight: 0.05 // Commands or tool usage
        }
      ],
      threshold: 0.3, // Fuzzy matching threshold
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      shouldSort: true,
      findAllMatches: true,
      useExtendedSearch: true
    };

    // Service configuration
    this.maxIndexSize = options.maxIndexSize || 10000;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.enableCache = options.enableCache !== false;
    this.enableHighlighting = options.enableHighlighting !== false;

    // Index storage per session
    this.indices = new Map(); // sessionId -> Fuse instance
    this.messages = new Map(); // sessionId -> messages array
    this.cache = new Map(); // Search result cache
    this.timestamps = new Map(); // Cache timestamps

    // Performance metrics
    this.metrics = {
      searchesPerformed: 0,
      averageSearchTime: 0,
      totalSearchTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Cleanup interval for cache
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Index messages for a session
   */
  indexMessages(sessionId, messages) {
    if (!sessionId || !Array.isArray(messages)) {
      throw new Error('Invalid sessionId or messages array');
    }

    try {
      // Limit index size for performance
      const messagesToIndex = messages.slice(-this.maxIndexSize);

      // Process messages for optimal search
      const processedMessages = messagesToIndex.map(msg => this.processMessage(msg));

      // Create Fuse index
      const fuse = new Fuse(processedMessages, this.fuseOptions);

      // Store index and messages
      this.indices.set(sessionId, fuse);
      this.messages.set(sessionId, processedMessages);

      console.log(`Indexed ${messagesToIndex.length} messages for session ${sessionId}`);

      return {
        indexed: messagesToIndex.length,
        total: messages.length,
        truncated: messages.length > this.maxIndexSize
      };
    } catch (error) {
      console.error('Failed to index messages:', error);
      throw error;
    }
  }

  /**
   * Add new messages to existing index
   */
  addMessages(sessionId, newMessages) {
    if (!sessionId || !Array.isArray(newMessages) || newMessages.length === 0) {
      return;
    }

    try {
      const existingMessages = this.messages.get(sessionId) || [];
      const processedNewMessages = newMessages.map(msg => this.processMessage(msg));

      // Combine messages
      const allMessages = [...existingMessages, ...processedNewMessages];

      // Limit size
      const messagesToIndex = allMessages.slice(-this.maxIndexSize);

      // Rebuild index
      const fuse = new Fuse(messagesToIndex, this.fuseOptions);

      this.indices.set(sessionId, fuse);
      this.messages.set(sessionId, messagesToIndex);

      // Clear cache for this session
      this.clearSessionCache(sessionId);

      return {
        added: processedNewMessages.length,
        total: messagesToIndex.length
      };
    } catch (error) {
      console.error('Failed to add messages to index:', error);
      throw error;
    }
  }

  /**
   * Process message for optimal search
   */
  processMessage(message) {
    const processed = {
      id: message.id,
      content: message.content || '',
      sender: message.sender || message.role || 'unknown',
      timestamp: message.timestamp || message.createdAt,
      type: message.type || 'message'
    };

    // Add metadata for extended search
    const metadata = {};

    if (message.attachment) {
      metadata.file = message.attachment.name || '';
      metadata.fileType = message.attachment.type || '';
    }

    if (message.command) {
      metadata.command = message.command;
    }

    if (message.tool) {
      metadata.tool = message.tool;
    }

    if (message.project) {
      metadata.project = message.project;
    }

    // Extract searchable content from different message types
    if (message.type === 'system') {
      metadata.systemMessage = true;
    }

    if (message.type === 'file' || message.attachment) {
      metadata.fileOperation = true;
    }

    // Add processed content for better matching
    processed.searchableContent = [
      processed.content,
      ...Object.values(metadata)
    ].filter(Boolean).join(' ').toLowerCase();

    processed.metadata = metadata;

    return processed;
  }

  /**
   * Search messages in a session
   */
  async search(sessionId, query, options = {}) {
    const {
      limit = 50,
      offset = 0,
      includeContent = true,
      includeMetadata = true,
      enableHighlighting = this.enableHighlighting,
      sortBy = 'relevance', // 'relevance', 'date', 'score'
      sortOrder = 'desc',
      filters = {}
    } = options;

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    if (!query || query.trim().length < 2) {
      return {
        results: [],
        total: 0,
        query,
        sessionId,
        took: 0
      };
    }

    const startTime = performance.now();

    try {
      // Check cache first
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(sessionId, query, options);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      const fuse = this.indices.get(sessionId);
      if (!fuse) {
        throw new Error(`No search index found for session ${sessionId}`);
      }

      // Enhanced query processing
      const processedQuery = this.processQuery(query);

      // Perform search
      let results = fuse.search(processedQuery);

      // Apply filters
      if (Object.keys(filters).length > 0) {
        results = this.applyFilters(results, filters);
      }

      // Process results
      const processedResults = results.slice(offset, offset + limit).map(result => {
        const message = this.messages.get(sessionId).find(msg => msg.id === result.item.id);

        if (!message) return null;

        const searchResult = {
          message: {
            id: message.id,
            content: includeContent ? message.content : null,
            sender: message.sender,
            timestamp: message.timestamp,
            type: message.type
          },
          score: result.score,
          matches: result.matches,
          relevance: this.calculateRelevance(result.score, result.matches)
        };

        // Add metadata if requested
        if (includeMetadata && message.metadata) {
          searchResult.message.metadata = message.metadata;
        }

        // Add highlighting if enabled
        if (enableHighlighting && result.matches) {
          searchResult.highlights = this.generateHighlights(message.content, result.matches);
        }

        return searchResult;
      }).filter(Boolean);

      // Sort results
      processedResults.sort((a, b) => {
        switch (sortBy) {
          case 'date':
            const dateA = new Date(a.message.timestamp);
            const dateB = new Date(b.message.timestamp);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;

          case 'score':
            return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;

          case 'relevance':
          default:
            return sortOrder === 'desc' ? b.relevance - a.relevance : a.relevance - b.relevance;
        }
      });

      const searchTime = performance.now() - startTime;
      const searchResult = {
        results: processedResults,
        total: results.length,
        query,
        sessionId,
        took: searchTime,
        hasMore: results.length > offset + limit,
        indexSize: this.messages.get(sessionId)?.length || 0
      };

      // Cache results
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(sessionId, query, options);
        this.setCache(cacheKey, searchResult);
      }

      // Update metrics
      this.updateMetrics(searchTime);

      return searchResult;

    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Process and enhance search query
   */
  processQuery(query) {
    let processed = query.trim();

    // Handle special search operators
    if (processed.includes('file:')) {
      // Search for files
      processed = processed.replace(/file:/g, '');
    }

    if (processed.includes('sender:')) {
      // Search by sender
      processed = processed.replace(/sender:/g, '');
    }

    // Handle quoted phrases
    const quotedPhrases = processed.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      quotedPhrases.forEach(phrase => {
        const unquoted = phrase.slice(1, -1);
        processed = processed.replace(phrase, `'${unquoted}`);
      });
    }

    return processed;
  }

  /**
   * Apply filters to search results
   */
  applyFilters(results, filters) {
    return results.filter(result => {
      const message = result.item;

      if (filters.sender && !message.sender.toLowerCase().includes(filters.sender.toLowerCase())) {
        return false;
      }

      if (filters.type && message.type !== filters.type) {
        return false;
      }

      if (filters.dateFrom && new Date(message.timestamp) < new Date(filters.dateFrom)) {
        return false;
      }

      if (filters.dateTo && new Date(message.timestamp) > new Date(filters.dateTo)) {
        return false;
      }

      if (filters.hasAttachment && !message.metadata?.file) {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculate relevance score
   */
  calculateRelevance(score, matches) {
    let relevance = 1 - score; // Invert score (lower score = better match)

    // Boost for exact matches
    if (score < 0.1) {
      relevance *= 1.5;
    }

    // Boost for content matches
    const contentMatches = matches?.filter(match => match.key === 'content');
    if (contentMatches?.length > 0) {
      relevance *= 1.2;
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * Generate highlighted text snippets
   */
  generateHighlights(content, matches) {
    if (!content || !matches) return [];

    const highlights = [];

    matches.forEach(match => {
      if (match.key === 'content' && match.indices) {
        match.indices.forEach(([start, end]) => {
          const snippet = content.substring(
            Math.max(0, start - 50),
            Math.min(content.length, end + 50)
          );

          highlights.push({
            snippet,
            startIndex: Math.max(0, start - 50),
            endIndex: Math.min(snippet.length, end - start + 100),
            originalStart: start,
            originalEnd: end
          });
        });
      }
    });

    return highlights;
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(sessionId, partialQuery, limit = 5) {
    if (!sessionId || !partialQuery || partialQuery.length < 2) {
      return [];
    }

    try {
      const fuse = this.indices.get(sessionId);
      if (!fuse) return [];

      // Search for partial matches
      const results = fuse.search(partialQuery, { threshold: 0.6 });

      // Extract unique terms and content snippets
      const suggestions = new Set();

      results.slice(0, limit * 2).forEach(result => {
        if (result.matches) {
          result.matches.forEach(match => {
            if (match.value && match.value.length > 2) {
              suggestions.add(match.value);
            }
          });
        }

        // Add content snippets
        const words = result.item.content.split(/\s+/);
        words.forEach(word => {
          if (word.toLowerCase().includes(partialQuery.toLowerCase()) && word.length > 2) {
            suggestions.add(word);
          }
        });
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get search statistics
   */
  getStats(sessionId = null) {
    const sessionStats = sessionId ? {
      indexedMessages: this.messages.get(sessionId)?.length || 0,
      hasIndex: this.indices.has(sessionId),
      cacheSize: Array.from(this.cache.keys()).filter(key => key.includes(sessionId)).length
    } : {
      totalSessions: this.indices.size,
      totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
      cacheSize: this.cache.size
    };

    return {
      ...sessionStats,
      metrics: { ...this.metrics },
      averageSearchTime: this.metrics.searchesPerformed > 0
        ? this.metrics.totalSearchTime / this.metrics.searchesPerformed
        : 0,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0
        ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
        : 0
    };
  }

  /**
   * Clear session index
   */
  clearSession(sessionId) {
    this.indices.delete(sessionId);
    this.messages.delete(sessionId);
    this.clearSessionCache(sessionId);
  }

  /**
   * Cache management
   */
  getCacheKey(sessionId, query, options) {
    const optionsStr = JSON.stringify({ limit: options.limit, sortBy: options.sortBy });
    return `${sessionId}:${query}:${optionsStr}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    this.timestamps.set(key, Date.now());
  }

  clearSessionCache(sessionId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }

  updateMetrics(searchTime) {
    this.metrics.searchesPerformed++;
    this.metrics.totalSearchTime += searchTime;
    this.metrics.averageSearchTime = this.metrics.totalSearchTime / this.metrics.searchesPerformed;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.indices.clear();
    this.messages.clear();
    this.cache.clear();
    this.timestamps.clear();
  }
}

export default MessageSearchService;