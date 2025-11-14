import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import SessionArchiveService from '../services/sessionArchive';

/**
 * React hook for session archive functionality
 * Provides session compression, archiving, and storage management
 * Includes export/import capabilities and storage optimization
 */
export const useSessionArchive = (options = {}) => {
  const {
    maxArchiveSize = 50 * 1024 * 1024,
    enableCompression = true,
    maxStoredArchives = 100,
    autoCleanup = true
  } = options;

  // Archive service instance
  const archiveService = useMemo(() => {
    return new SessionArchiveService({
      maxArchiveSize,
      enableCompression,
      maxStoredArchives
    });
  }, [maxArchiveSize, enableCompression, maxStoredArchives]);

  // State
  const [archives, setArchives] = useState([]);
  const [stats, setStats] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  // Refs
  const archiveServiceRef = useRef(archiveService);

  // Update refs when props change
  useEffect(() => {
    archiveServiceRef.current = archiveService;
  }, [archiveService]);

  // Load archives on mount
  useEffect(() => {
    refreshArchives();
    refreshStats();

    // Setup periodic stats update
    const interval = setInterval(() => {
      refreshStats();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
      archiveServiceRef.current.destroy();
    };
  }, []);

  // Refresh archives list
  const refreshArchives = useCallback(async (filters = {}) => {
    try {
      const result = archiveServiceRef.current.listArchives(filters);
      setArchives(result.archives);
      return result;
    } catch (err) {
      console.error('Failed to refresh archives:', err);
      setError(err.message);
    }
  }, []);

  // Refresh statistics
  const refreshStats = useCallback(() => {
    try {
      const currentStats = archiveServiceRef.current.getStats();
      setStats(currentStats);
    } catch (err) {
      console.error('Failed to refresh stats:', err);
      setError(err.message);
    }
  }, []);

  // Archive a session
  const archiveSession = useCallback(async (sessionData, archiveOptions = {}) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress({ stage: 'preparing', progress: 0 });

      const result = await archiveServiceRef.current.archiveSession(sessionData, {
        ...archiveOptions,
        onProgress: (stage, progressValue) => {
          setProgress({ stage, progress: progressValue });
        }
      });

      // Refresh archives list
      await refreshArchives();
      refreshStats();

      setProgress(null);
      return result;

    } catch (err) {
      console.error('Failed to archive session:', err);
      setError(err.message);
      setProgress(null);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshArchives, refreshStats]);

  // Load an archived session
  const loadArchive = useCallback(async (archiveId, loadOptions = {}) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress({ stage: 'loading', progress: 0 });

      const result = await archiveServiceRef.current.loadArchive(archiveId, {
        ...loadOptions,
        onProgress: (stage, progressValue) => {
          setProgress({ stage, progress: progressValue });
        }
      });

      setProgress(null);
      return result;

    } catch (err) {
      console.error('Failed to load archive:', err);
      setError(err.message);
      setProgress(null);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Delete an archive
  const deleteArchive = useCallback(async (archiveId) => {
    try {
      setIsProcessing(true);
      setError(null);

      await archiveServiceRef.current.deleteArchive(archiveId);

      // Refresh archives list
      await refreshArchives();
      refreshStats();

    } catch (err) {
      console.error('Failed to delete archive:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshArchives, refreshStats]);

  // Create export package
  const createExportPackage = useCallback(async (archiveIds = [], format = 'zip') => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress({ stage: 'creating', progress: 0 });

      const result = await archiveServiceRef.current.createExportPackage(archiveIds, format);

      setProgress(null);
      return result;

    } catch (err) {
      console.error('Failed to create export package:', err);
      setError(err.message);
      setProgress(null);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Import export package
  const importExportPackage = useCallback(async (file, importOptions = {}) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress({ stage: 'importing', progress: 0 });

      const result = await archiveServiceRef.current.importExportPackage(file, {
        ...importOptions,
        onProgress: (stage, progressValue) => {
          setProgress({ stage, progress: progressValue });
        }
      });

      // Refresh archives list
      await refreshArchives();
      refreshStats();

      setProgress(null);
      return result;

    } catch (err) {
      console.error('Failed to import export package:', err);
      setError(err.message);
      setProgress(null);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshArchives, refreshStats]);

  // Search archives
  const searchArchives = useCallback((query, filters = {}) => {
    const searchFilters = {
      ...filters,
      // Add title and description search
      title: query
    };

    return archiveServiceRef.current.listArchives(searchFilters);
  }, []);

  // Filter archives by tags
  const filterByTags = useCallback((tags) => {
    return archiveServiceRef.current.listArchives({ tags });
  }, []);

  // Filter archives by date range
  const filterByDateRange = useCallback((startDate, endDate) => {
    return archiveServiceRef.current.listArchives({
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString()
    });
  }, []);

  // Get archive by ID
  const getArchiveById = useCallback((archiveId) => {
    return archives.find(a => a.id === archiveId);
  }, [archives]);

  // Batch operations
  const batchDeleteArchives = useCallback(async (archiveIds) => {
    try {
      setIsProcessing(true);
      setError(null);

      const results = [];
      for (const archiveId of archiveIds) {
        try {
          await archiveServiceRef.current.deleteArchive(archiveId);
          results.push({ archiveId, success: true });
        } catch (err) {
          results.push({ archiveId, success: false, error: err.message });
        }
      }

      // Refresh archives list
      await refreshArchives();
      refreshStats();

      return results;

    } catch (err) {
      console.error('Failed to batch delete archives:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshArchives, refreshStats]);

  // Get storage information
  const getStorageInfo = useCallback(() => {
    return archiveServiceRef.current.getStats();
  }, []);

  // Cleanup old archives
  const cleanupArchives = useCallback(async () => {
    try {
      setIsProcessing(true);
      setError(null);

      await archiveServiceRef.current.cleanupOldArchives();

      // Refresh archives list
      await refreshArchives();
      refreshStats();

    } catch (err) {
      console.error('Failed to cleanup archives:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshArchives, refreshStats]);

  // Format file size
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Format date
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  }, []);

  // Calculate compression savings
  const calculateSavings = useCallback((archive) => {
    if (!archive.compressed || !archive.originalSize) return null;
    const saved = archive.originalSize - archive.size;
    const percentage = ((saved / archive.originalSize) * 100).toFixed(1);
    return {
      bytes: saved,
      percentage: parseFloat(percentage),
      formatted: formatFileSize(saved)
    };
  }, [formatFileSize]);

  // Get archive tags
  const getAllTags = useCallback(() => {
    const tagSet = new Set();
    archives.forEach(archive => {
      archive.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [archives]);

  // Get archive statistics
  const getArchiveStats = useCallback(() => {
    const totalArchives = archives.length;
    const totalSize = archives.reduce((sum, a) => sum + a.size, 0);
    const totalOriginalSize = archives.reduce((sum, a) => sum + (a.originalSize || a.size), 0);
    const compressedArchives = archives.filter(a => a.compressed).length;
    const averageSize = totalArchives > 0 ? totalSize / totalArchives : 0;

    return {
      totalArchives,
      totalSize,
      totalOriginalSize,
      averageSize,
      compressedArchives,
      compressionRate: totalArchives > 0 ? compressedArchives / totalArchives : 0,
      compressionRatio: totalOriginalSize > 0 ? totalOriginalSize / totalSize : 1,
      tags: getAllTags()
    };
  }, [archives, getAllTags]);

  // Memoized return value
  const archiveState = useMemo(() => ({
    // Data
    archives,
    stats,
    error,
    isProcessing,
    progress,

    // Actions
    archiveSession,
    loadArchive,
    deleteArchive,
    createExportPackage,
    importExportPackage,

    // Search and filter
    searchArchives,
    filterByTags,
    filterByDateRange,
    refreshArchives,
    getArchiveById,

    // Batch operations
    batchDeleteArchives,

    // Management
    getStorageInfo,
    cleanupArchives,

    // Utilities
    formatFileSize,
    formatDate,
    calculateSavings,
    getAllTags,
    getArchiveStats,

    // Derived state
    hasArchives: archives.length > 0,
    totalArchives: archives.length,
    isStorageOptimized: stats?.compressionRate > 0.5,
    needsCleanup: stats?.totalArchives > maxStoredArchives * 0.8
  }), [
    archives,
    stats,
    error,
    isProcessing,
    progress,
    archiveSession,
    loadArchive,
    deleteArchive,
    createExportPackage,
    importExportPackage,
    searchArchives,
    filterByTags,
    filterByDateRange,
    refreshArchives,
    getArchiveById,
    batchDeleteArchives,
    getStorageInfo,
    cleanupArchives,
    formatFileSize,
    formatDate,
    calculateSavings,
    getAllTags,
    getArchiveStats,
    maxStoredArchives
  ]);

  return archiveState;
};

export default useSessionArchive;