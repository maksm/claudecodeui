import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MessageSearchService from '../services/messageSearch';

/**
 * React hook for message search functionality
 * Provides fast fuzzy search with Fuse.js indexing
 * Includes caching, suggestions, and performance monitoring
 */
export const useMessageSearch = (sessionId, messages = [], options = {}) => {
  const {
    maxIndexSize = 10000,
    enableCache = true,
    enableHighlighting = true,
    debounceDelay = 300,
    autoIndex = true
  } = options;

  // Search service instance
  const searchService = useMemo(() => {
    return new MessageSearchService({
      maxIndexSize,
      enableCache,
      enableHighlighting
    });
  }, [maxIndexSize, enableCache, enableHighlighting]);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searchStats, setSearchStats] = useState(null);
  const [isIndexed, setIsIndexed] = useState(false);

  // Refs
  const searchServiceRef = useRef(searchService);
  const sessionIdRef = useRef(sessionId);
  const messagesRef = useRef(messages);
  const debounceTimeoutRef = useRef(null);

  // Update refs when props change
  useEffect(() => {
    searchServiceRef.current = searchService;
    sessionIdRef.current = sessionId;
    messagesRef.current = messages;
  }, [searchService, sessionId, messages]);

  // Index messages when session or messages change
  useEffect(() => {
    if (!autoIndex || !sessionId || messages.length === 0) {
      setIsIndexed(false);
      return;
    }

    const indexMessages = async () => {
      try {
        setIsIndexed(false);
        const result = searchServiceRef.current.indexMessages(sessionId, messages);
        setIsIndexed(true);
        console.log(`Indexed ${result.indexed} messages for session ${sessionId}`);
      } catch (error) {
        console.error('Failed to index messages:', error);
        setSearchError(error.message);
      }
    };

    indexMessages();
  }, [sessionId, messages, autoIndex]);

  // Add new messages to index
  const addMessages = useCallback((newMessages) => {
    if (!sessionId || !newMessages || newMessages.length === 0) {
      return;
    }

    try {
      searchServiceRef.current.addMessages(sessionId, newMessages);
    } catch (error) {
      console.error('Failed to add messages to search index:', error);
      setSearchError(error.message);
    }
  }, [sessionId]);

  // Search function
  const performSearch = useCallback(async (query, searchOptions = {}) => {
    if (!sessionId || !query || query.trim().length < 2) {
      setSearchResults([]);
      setSearchStats(null);
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);

      const results = await searchServiceRef.current.search(sessionId, query, {
        limit: 50,
        includeContent: true,
        includeMetadata: true,
        enableHighlighting: true,
        sortBy: 'relevance',
        sortOrder: 'desc',
        ...searchOptions
      });

      setSearchResults(results.results);
      setSearchStats({
        total: results.total,
        took: results.took,
        hasMore: results.hasMore,
        indexSize: results.indexSize
      });

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(error.message);
      setSearchResults([]);
      setSearchStats(null);
    } finally {
      setIsSearching(false);
    }
  }, [sessionId]);

  // Debounced search
  const debouncedSearch = useCallback((query, searchOptions = {}) => {
    clearTimeout(debounceTimeoutRef.current);

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setSearchStats(null);
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(query, searchOptions);
    }, debounceDelay);
  }, [performSearch, debounceDelay]);

  // Get suggestions
  const getSuggestions = useCallback(async (partialQuery) => {
    if (!sessionId || !partialQuery || partialQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const suggestionList = await searchServiceRef.current.getSuggestions(sessionId, partialQuery);
      setSuggestions(suggestionList);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([]);
    }
  }, [sessionId]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSuggestions([]);
    setSearchStats(null);
    setSearchError(null);
    clearTimeout(debounceTimeoutRef.current);
  }, []);

  // Get service statistics
  const getStatistics = useCallback(() => {
    return searchServiceRef.current.getStats(sessionId);
  }, [sessionId]);

  // Update search query
  const updateQuery = useCallback((newQuery) => {
    setSearchQuery(newQuery);
    debouncedSearch(newQuery);

    // Get suggestions for partial queries
    if (newQuery && newQuery.length >= 2 && newQuery.length < 10) {
      getSuggestions(newQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearch, getSuggestions]);

  // Search with filters
  const searchWithFilters = useCallback((query, filters = {}) => {
    const searchOptions = {
      limit: 100,
      sortBy: 'relevance',
      includeMetadata: true,
      filters
    };
    return performSearch(query, searchOptions);
  }, [performSearch]);

  // Search by date range
  const searchByDateRange = useCallback((query, startDate, endDate) => {
    const filters = {};
    if (startDate) filters.dateFrom = startDate.toISOString();
    if (endDate) filters.dateTo = endDate.toISOString();

    return searchWithFilters(query, filters);
  }, [searchWithFilters]);

  // Search by sender
  const searchBySender = useCallback((query, sender) => {
    const filters = { sender };
    return searchWithFilters(query, filters);
  }, [searchWithFilters]);

  // Search files only
  const searchFiles = useCallback((query) => {
    const filters = { hasAttachment: true };
    return searchWithFilters(query, filters);
  }, [searchWithFilters]);

  // Advanced search with multiple criteria
  const advancedSearch = useCallback((criteria) => {
    const {
      query,
      sender,
      messageType,
      hasAttachment,
      dateFrom,
      dateTo,
      limit = 50,
      sortBy = 'relevance'
    } = criteria;

    const filters = {};
    if (sender) filters.sender = sender;
    if (messageType) filters.type = messageType;
    if (hasAttachment) filters.hasAttachment = true;
    if (dateFrom) filters.dateFrom = dateFrom.toISOString();
    if (dateTo) filters.dateTo = dateTo.toISOString();

    const searchOptions = {
      limit,
      sortBy,
      includeMetadata: true,
      filters
    };

    return performSearch(query || '', searchOptions);
  }, [performSearch]);

  // Highlight search terms in text
  const highlightText = useCallback((text, highlights = []) => {
    if (!text || !highlights.length) return text;

    let highlightedText = text;

    highlights.forEach(highlight => {
      const { snippet, startIndex, endIndex } = highlight;
      if (snippet && startIndex >= 0 && endIndex > startIndex) {
        const highlighted = snippet.substring(startIndex, endIndex);
        const markedText = snippet.replace(
          highlighted,
          `<mark class="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100">${highlighted}</mark>`
        );
        highlightedText = highlightedText.replace(snippet, markedText);
      }
    });

    return highlightedText;
  }, []);

  // Export search results
  const exportResults = useCallback((format = 'json') => {
    if (!searchResults.length) return null;

    switch (format) {
      case 'json':
        return JSON.stringify({
          query: searchQuery,
          total: searchStats?.total || 0,
          results: searchResults,
          exported: new Date().toISOString()
        }, null, 2);

      case 'csv': {
        const headers = ['ID', 'Content', 'Sender', 'Timestamp', 'Score', 'Relevance'];
        const rows = searchResults.map(result => [
          result.message.id,
          `"${result.message.content?.replace(/"/g, '""') || ''}"`,
          result.message.sender,
          result.message.timestamp,
          result.score,
          result.relevance
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      }

      case 'txt':
        return searchResults.map(result =>
          `Message ID: ${result.message.id}\n` +
          `Sender: ${result.message.sender}\n` +
          `Timestamp: ${result.message.timestamp}\n` +
          `Content: ${result.message.content || ''}\n` +
          `Score: ${result.score} | Relevance: ${result.relevance}\n` +
          `${'='.repeat(50)}\n`
        ).join('\n');

      default:
        return null;
    }
  }, [searchResults, searchQuery, searchStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimeoutRef.current);
      searchServiceRef.current.destroy();
    };
  }, []);

  // Memoized return value
  const searchState = useMemo(() => ({
    // Search state
    query: searchQuery,
    results: searchResults,
    isSearching,
    isIndexed,
    error: searchError,
    suggestions,
    stats: searchStats,

    // Actions
    search: performSearch,
    updateQuery,
    clearSearch,
    getSuggestions,
    addMessages,

    // Advanced search
    searchWithFilters,
    searchByDateRange,
    searchBySender,
    searchFiles,
    advancedSearch,

    // Utilities
    highlightText,
    exportResults,
    getStatistics,

    // Derived state
    hasResults: searchResults.length > 0,
    hasQuery: searchQuery.trim().length > 0,
    canSearch: isIndexed && sessionId
  }), [
    searchQuery,
    searchResults,
    isSearching,
    isIndexed,
    searchError,
    suggestions,
    searchStats,
    sessionId,
    performSearch,
    updateQuery,
    clearSearch,
    getSuggestions,
    addMessages,
    searchWithFilters,
    searchByDateRange,
    searchBySender,
    searchFiles,
    advancedSearch,
    highlightText,
    exportResults,
    getStatistics
  ]);

  return searchState;
};

export default useMessageSearch;