import React, { useState, useMemo } from 'react';
import {
  Archive,
  Download,
  Upload,
  Trash2,
  Search,
  Filter,
  Calendar,
  Tag,
  BarChart3,
  X,
  Check,
  AlertTriangle,
  Package,
  Clock,
  HardDrive,
} from 'lucide-react';
import { useSessionArchive } from '../hooks/useSessionArchive';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Archive Manager Component
 * Provides UI for managing archived chat sessions
 * Includes archive, search, export, and import functionality
 */
const ArchiveManager = ({
  className = '',
  compact = false,
  showImport = true,
  showExport = true,
  onArchiveLoad,
  ...props
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArchives, setSelectedArchives] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Use session archive hook
  const {
    archives,
    stats,
    error,
    isProcessing,
    progress,
    deleteArchive,
    createExportPackage,
    importExportPackage,
    loadArchive,
    searchArchives,
    filterByTags,
    filterByDateRange,
    batchDeleteArchives,
    getStorageInfo,
    cleanupArchives,
    formatFileSize,
    formatDate,
    calculateSavings,
    getAllTags,
    getArchiveStats,
  } = useSessionArchive();

  // Get all available tags
  const allTags = useMemo(() => getAllTags(), [getAllTags]);

  // Filter archives based on search and filters
  const filteredArchives = useMemo(() => {
    let filtered = archives;

    // Apply search
    if (searchQuery) {
      const searchResults = searchArchives(searchQuery);
      filtered = searchResults.archives;
    }

    // Apply tag filters
    if (filterTags.length > 0) {
      const tagResults = filterByTags(filterTags);
      filtered = filtered.filter(archive =>
        tagResults.archives.some(taggedArchive => taggedArchive.id === archive.id)
      );
    }

    // Apply date range
    if (dateRange.start || dateRange.end) {
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      filtered = filtered.filter(archive => {
        const archiveDate = new Date(archive.createdAt);
        if (startDate && archiveDate < startDate) return false;
        if (endDate && archiveDate > endDate) return false;
        return true;
      });
    }

    // Sort archives
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'lastAccessed':
          comparison = new Date(a.lastAccessed) - new Date(b.lastAccessed);
          break;
        case 'createdAt':
        default:
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [
    archives,
    searchQuery,
    filterTags,
    dateRange,
    sortBy,
    sortOrder,
    searchArchives,
    filterByTags,
  ]);

  // Handle archive selection
  const handleArchiveSelect = archiveId => {
    setSelectedArchives(prev =>
      prev.includes(archiveId) ? prev.filter(id => id !== archiveId) : [...prev, archiveId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedArchives.length === filteredArchives.length) {
      setSelectedArchives([]);
    } else {
      setSelectedArchives(filteredArchives.map(a => a.id));
    }
  };

  // Handle archive loading
  const handleLoadArchive = async archiveId => {
    try {
      const result = await loadArchive(archiveId);
      onArchiveLoad?.(result.sessionData, archiveId);
    } catch (error) {
      console.error('Failed to load archive:', error);
    }
  };

  // Handle single archive deletion
  const handleDeleteArchive = async archiveId => {
    if (
      window.confirm('Are you sure you want to delete this archive? This action cannot be undone.')
    ) {
      try {
        await deleteArchive(archiveId);
      } catch (error) {
        console.error('Failed to delete archive:', error);
      }
    }
  };

  // Handle batch deletion
  const handleBatchDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedArchives.length} archives? This action cannot be undone.`
      )
    ) {
      try {
        await batchDeleteArchives(selectedArchives);
        setSelectedArchives([]);
      } catch (error) {
        console.error('Failed to delete archives:', error);
      }
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const archiveIds =
        selectedArchives.length > 0 ? selectedArchives : filteredArchives.map(a => a.id);
      const result = await createExportPackage(archiveIds);

      // Download the export file
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export archives:', error);
    }
  };

  // Handle import
  const handleImport = async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await importExportPackage(file);
      alert(`Import completed: ${result.imported} archives imported, ${result.failed} failed`);
    } catch (error) {
      console.error('Failed to import archives:', error);
      alert('Import failed: ' + error.message);
    }

    // Reset file input
    event.target.value = '';
  };

  // Handle cleanup
  const handleCleanup = async () => {
    if (window.confirm('This will remove old archives to free up space. Continue?')) {
      try {
        await cleanupArchives();
      } catch (error) {
        console.error('Failed to cleanup archives:', error);
      }
    }
  };

  // Archive stats
  const archiveStats = useMemo(() => getArchiveStats(), [getArchiveStats]);

  if (compact) {
    return (
      <div className={`archive-manager-compact ${className}`} {...props}>
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              {archiveStats.totalArchives} Archives
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <HardDrive className="w-4 h-4" />
            <span>{formatFileSize(archiveStats.totalSize)}</span>
            {archiveStats.compressionRate > 0 && (
              <span className="text-green-600 dark:text-green-400">
                ({Math.round(archiveStats.compressionRate * 100)}% compressed)
              </span>
            )}
          </div>

          <div className="flex-1" />

          {showImport && (
            <label className="cursor-pointer p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
              <Upload className="w-5 h-5" />
              <input
                type="file"
                accept=".zip"
                onChange={handleImport}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          )}

          {showExport && (
            <button
              onClick={handleExport}
              disabled={isProcessing || filteredArchives.length === 0}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              title="Export archives"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`archive-manager ${className}`} {...props}>
      {/* Header with Stats */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Archive className="w-6 h-6" />
            Archive Manager
          </h2>
          {isProcessing && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {archiveStats.totalArchives}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Archives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatFileSize(archiveStats.totalSize)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Storage Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(archiveStats.compressionRate * 100)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Compressed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {archiveStats.tags.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Tags Used</div>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {progress.stage}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search archives..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
          >
            <Filter className="w-4 h-4" />
            <span>Advanced Filters</span>
          </button>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="createdAt">Date Created</option>
            <option value="lastAccessed">Last Accessed</option>
            <option value="title">Title</option>
            <option value="size">Size</option>
          </select>

          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>

          {selectedArchives.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedArchives.length} selected
              </span>
              <button
                onClick={handleBatchDelete}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
            {/* Tag Filters */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() =>
                        setFilterTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        filterTags.includes(tag)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  From Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
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
                  value={dateRange.end}
                  onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        {showImport && (
          <label className="cursor-pointer px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Archives
            <input
              type="file"
              accept=".zip"
              onChange={handleImport}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
        )}

        {showExport && (
          <button
            onClick={handleExport}
            disabled={isProcessing || filteredArchives.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export {selectedArchives.length > 0 ? `Selected (${selectedArchives.length})` : 'All'}
          </button>
        )}

        <button
          onClick={handleCleanup}
          disabled={isProcessing}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Cleanup Old Archives
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Archives List */}
      <div className="space-y-3">
        {filteredArchives.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">
              {archives.length === 0
                ? 'No archived sessions yet'
                : 'No archives match your filters'}
            </p>
            <p className="text-sm mt-2">
              {archives.length === 0
                ? 'Archive your chat sessions to free up storage and improve performance'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <>
            {/* List Header */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-t-lg border border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={selectedArchives.length === filteredArchives.length}
                onChange={handleSelectAll}
                className="rounded"
              />
              <span className="flex-1 font-medium text-gray-900 dark:text-white">Title</span>
              <span className="hidden md:block text-sm font-medium text-gray-600 dark:text-gray-400">
                Date
              </span>
              <span className="hidden md:block text-sm font-medium text-gray-600 dark:text-gray-400">
                Size
              </span>
              <span className="w-20 text-sm font-medium text-gray-600 dark:text-gray-400">
                Actions
              </span>
            </div>

            {/* Archive Items */}
            {filteredArchives.map(archive => {
              const savings = calculateSavings(archive);
              const isSelected = selectedArchives.includes(archive.id);

              return (
                <div
                  key={archive.id}
                  className={`p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleArchiveSelect(archive.id)}
                      className="rounded"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {archive.title}
                        </h3>
                        {archive.compressed && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                            Compressed
                          </span>
                        )}
                        {archive.priority === 'high' && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded">
                            High Priority
                          </span>
                        )}
                      </div>

                      {archive.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {archive.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(archive.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(archive.size)}
                        </span>
                        {savings && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="w-3 h-3" />
                            Saved {savings.percentage}%
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(archive.lastAccessed)}
                        </span>
                      </div>

                      {archive.tags && archive.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {archive.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleLoadArchive(archive.id)}
                        disabled={isProcessing}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                        title="Load archive"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArchive(archive.id)}
                        disabled={isProcessing}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                        title="Delete archive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default ArchiveManager;
