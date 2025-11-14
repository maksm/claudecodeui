import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  User,
  File,
  X,
  ChevronDown,
  Download,
  BarChart3,
} from 'lucide-react';
import { useMessageSearch } from '../hooks/useMessageSearch';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Message Search Component
 * Provides advanced search functionality for chat messages
 * Includes filters, suggestions, and result highlighting
 */
const MessageSearch = ({
  sessionId,
  messages = [],
  onResultClick,
  className = '',
  compact = false,
  showAdvanced = true,
  ...props
}) => {
  const { theme } = useTheme();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    sender: '',
    messageType: '',
    hasAttachment: false,
    dateFrom: '',
    dateTo: '',
  });
  const [exportFormat, setExportFormat] = useState('json');

  // Use message search hook
  const {
    query,
    results,
    isSearching,
    isIndexed,
    error,
    suggestions,
    stats,
    updateQuery,
    clearSearch,
    searchWithFilters,
    exportResults,
    getStatistics,
  } = useMessageSearch(sessionId, messages, {
    autoIndex: true,
    maxIndexSize: 10000,
    enableHighlighting: true,
    debounceDelay: 300,
  });

  // Handle search input
  const handleSearchChange = e => {
    updateQuery(e.target.value);
  };

  // Handle advanced search
  const handleAdvancedSearch = () => {
    const filters = {};

    if (searchFilters.sender) filters.sender = searchFilters.sender;
    if (searchFilters.messageType) filters.type = searchFilters.messageType;
    if (searchFilters.hasAttachment) filters.hasAttachment = true;
    if (searchFilters.dateFrom) filters.dateFrom = searchFilters.dateFrom;
    if (searchFilters.dateTo) filters.dateTo = searchFilters.dateTo;

    searchWithFilters(query, filters);
  };

  // Clear search and filters
  const handleClearSearch = () => {
    clearSearch();
    setSearchFilters({
      sender: '',
      messageType: '',
      hasAttachment: false,
      dateFrom: '',
      dateTo: '',
    });
  };

  // Export search results
  const handleExport = () => {
    const exportedData = exportResults(exportFormat);
    if (exportedData) {
      const blob = new Blob([exportedData], {
        type: exportFormat === 'json' ? 'application/json' : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${sessionId}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Format timestamp
  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Highlight search terms in content
  const highlightContent = (content, highlights = []) => {
    if (!content || !highlights.length) return content;

    let highlightedContent = content;
    highlights.forEach(highlight => {
      const { snippet, startIndex, endIndex } = highlight;
      if (snippet) {
        const markedText = `<mark class="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-1 rounded">${snippet}</mark>`;
        highlightedContent = highlightedContent.replace(snippet, markedText);
      }
    });

    return highlightedContent;
  };

  // Compact mode renders
  if (compact) {
    return (
      <div className={`message-search-compact ${className}`} {...props}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search messages..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!isIndexed}
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isSearching && (
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>

        {error && <div className="mt-2 text-red-500 text-sm">Search error: {error}</div>}

        {stats && stats.total > 0 && (
          <div className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
            {stats.total} results found in {Math.round(stats.took)}ms
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`message-search ${className}`} {...props}>
      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search messages... (2+ characters)"
            className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            disabled={!isIndexed}
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              title="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {isSearching && (
            <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>

        {/* Search Status */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span
              className={`px-2 py-1 rounded text-xs ${isIndexed ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'}`}
            >
              {isIndexed ? 'Indexed' : 'Indexing...'}
            </span>
            {stats && (
              <span className="text-gray-500 dark:text-gray-400">
                {stats.total > 0 ? `${stats.total} results` : 'No results'}
                {stats.took && ` (${Math.round(stats.took)}ms)`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showAdvanced && (
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">Advanced</span>
                <ChevronDown
                  className={`w-3 h-3 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
                />
              </button>
            )}
            {results.length > 0 && (
              <button
                onClick={handleExport}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                title="Export results"
              >
                <Download className="w-4 h-4" />
                <select
                  value={exportFormat}
                  onChange={e => setExportFormat(e.target.value)}
                  className="text-sm bg-transparent border-0 focus:ring-0"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="txt">TXT</option>
                </select>
              </button>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !query && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => updateQuery(suggestion)}
                className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            Search error: {error}
          </div>
        )}
      </div>

      {/* Advanced Search Filters */}
      {showAdvancedFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">
            Advanced Search
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sender Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Sender
              </label>
              <input
                type="text"
                value={searchFilters.sender}
                onChange={e => setSearchFilters(prev => ({ ...prev, sender: e.target.value }))}
                placeholder="Filter by sender..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Message Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <File className="w-4 h-4 inline mr-1" />
                Message Type
              </label>
              <select
                value={searchFilters.messageType}
                onChange={e => setSearchFilters(prev => ({ ...prev, messageType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All types</option>
                <option value="message">Message</option>
                <option value="system">System</option>
                <option value="file">File</option>
                <option value="command">Command</option>
              </select>
            </div>

            {/* Has Attachment Filter */}
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchFilters.hasAttachment}
                  onChange={e =>
                    setSearchFilters(prev => ({ ...prev, hasAttachment: e.target.checked }))
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Has attachment
                </span>
              </label>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={searchFilters.dateFrom}
                onChange={e => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={searchFilters.dateTo}
                onChange={e => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={handleAdvancedSearch}
                disabled={!query || isSearching}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Search Results ({results.length})
          </h3>

          {results.map((result, index) => (
            <div
              key={result.message.id}
              onClick={() => onResultClick?.(result.message)}
              className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {result.message.sender}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatTimestamp(result.message.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Score: {(result.score * 100).toFixed(1)}%</span>
                  <span>Relevance: {(result.relevance * 100).toFixed(1)}%</span>
                </div>
              </div>

              {result.message.content && (
                <div
                  className="text-gray-700 dark:text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightContent(result.message.content, result.highlights),
                  }}
                />
              )}

              {result.message.metadata?.file && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <File className="w-4 h-4" />
                  {result.message.metadata.file}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No messages found matching &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
};

export default MessageSearch;
