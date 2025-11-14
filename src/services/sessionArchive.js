import pako from 'pako';
import JSZip from 'jszip';

/**
 * Session Archive Service
 * Handles session compression, archiving, and storage management
 * Provides efficient storage and retrieval of large chat sessions
 */
class SessionArchiveService {
  constructor(options = {}) {
    // Configuration
    this.maxArchiveSize = options.maxArchiveSize || 50 * 1024 * 1024; // 50MB
    this.compressionLevel = options.compressionLevel || 6;
    this.maxStoredArchives = options.maxStoredArchives || 100;
    this.enableCompression = options.enableCompression !== false;
    this.enableEncryption = options.enableEncryption || false;
    this.storageKey = options.storageKey || 'claude-sessions-archives';

    // Storage management
    this.storage = this.initStorage();
    this.metadata = this.loadMetadata();

    // Performance tracking
    this.metrics = {
      archivesCreated: 0,
      archivesLoaded: 0,
      totalCompressionTime: 0,
      totalDecompressionTime: 0,
      averageCompressionRatio: 0,
      storageUsed: 0
    };

    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldArchives();
    }, 300000); // Every 5 minutes
  }

  /**
   * Initialize storage based on environment
   */
  initStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        get: (key) => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
        remove: (key) => localStorage.removeItem(key),
        clear: () => localStorage.clear(),
        keys: () => Object.keys(localStorage)
      };
    } else if (typeof window !== 'undefined' && window.sessionStorage) {
      return {
        get: (key) => sessionStorage.getItem(key),
        set: (key, value) => sessionStorage.setItem(key, value),
        remove: (key) => sessionStorage.removeItem(key),
        clear: () => sessionStorage.clear(),
        keys: () => Object.keys(sessionStorage)
      };
    } else {
      // Memory fallback
      const memoryStore = new Map();
      return {
        get: (key) => memoryStore.get(key) || null,
        set: (key, value) => memoryStore.set(key, value),
        remove: (key) => memoryStore.delete(key),
        clear: () => memoryStore.clear(),
        keys: () => Array.from(memoryStore.keys())
      };
    }
  }

  /**
   * Load archive metadata
   */
  loadMetadata() {
    try {
      const metadataJson = this.storage.get(`${this.storageKey}-metadata`);
      return metadataJson ? JSON.parse(metadataJson) : {
        archives: [],
        version: '1.0.0',
        created: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to load archive metadata:', error);
      return { archives: [], version: '1.0.0', created: new Date().toISOString() };
    }
  }

  /**
   * Save archive metadata
   */
  saveMetadata() {
    try {
      this.storage.set(`${this.storageKey}-metadata`, JSON.stringify(this.metadata));
    } catch (error) {
      console.error('Failed to save archive metadata:', error);
    }
  }

  /**
   * Archive a session with messages and metadata
   */
  async archiveSession(sessionData, options = {}) {
    const {
      sessionId,
      title,
      description,
      tags = [],
      priority = 'normal',
      includeFiles = true,
      customMetadata = {}
    } = options;

    if (!sessionId || !sessionData) {
      throw new Error('Session ID and session data are required');
    }

    const startTime = performance.now();

    try {
      // Prepare session data for archiving
      const archiveData = {
        sessionId,
        title: title || `Session ${sessionId}`,
        description: description || '',
        tags,
        priority,
        messages: sessionData.messages || [],
        metadata: {
          ...sessionData.metadata,
          ...customMetadata,
          messageCount: sessionData.messages?.length || 0,
          createdAt: new Date().toISOString(),
          version: '1.0.0'
        },
        files: includeFiles ? (sessionData.files || []) : [],
        settings: sessionData.settings || {},
        stats: {
          messageCount: sessionData.messages?.length || 0,
          fileCount: (sessionData.files || []).length,
          totalSize: this.calculateDataSize(sessionData),
          archivedAt: new Date().toISOString()
        }
      };

      // Serialize data
      const serializedData = JSON.stringify(archiveData);

      // Compress if enabled
      let finalData = serializedData;
      let compressed = false;
      let originalSize = serializedData.length;

      if (this.enableCompression) {
        try {
          const compressedData = pako.gzip(serializedData, {
            level: this.compressionLevel,
            to: 'string'
          });

          // Only use compression if it actually reduces size
          if (compressedData.length < originalSize * 0.9) {
            finalData = compressedData;
            compressed = true;
          }
        } catch (compressionError) {
          console.warn('Compression failed, using uncompressed data:', compressionError);
        }
      }

      // Create archive record
      const archiveId = this.generateArchiveId(sessionId);
      const archiveKey = `${this.storageKey}-${archiveId}`;

      const archiveRecord = {
        id: archiveId,
        sessionId,
        title: archiveData.title,
        description: archiveData.description,
        tags,
        priority,
        compressed,
        size: finalData.length,
        originalSize,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        version: '1.0.0',
        stats: archiveData.stats
      };

      // Check storage limits
      await this.ensureStorageSpace(finalData.length);

      // Store archive data
      this.storage.set(archiveKey, finalData);

      // Update metadata
      this.metadata.archives.push(archiveRecord);
      this.saveMetadata();

      // Update metrics
      const compressionTime = performance.now() - startTime;
      this.metrics.archivesCreated++;
      this.metrics.totalCompressionTime += compressionTime;
      this.updateStorageMetrics();

      const compressionRatio = compressed ? originalSize / finalData.length : 1;
      this.updateCompressionRatio(compressionRatio);

      console.log(`Session archived: ${sessionId} (${finalData.length} bytes, ${Math.round(compressionTime)}ms)`);

      return {
        success: true,
        archiveId,
        archiveRecord,
        compressionRatio,
        processingTime: compressionTime
      };

    } catch (error) {
      console.error('Failed to archive session:', error);
      throw error;
    }
  }

  /**
   * Load and decompress an archived session
   */
  async loadArchive(archiveId, options = {}) {
    const {
      includeFiles = true,
      validateData = true
    } = options;

    if (!archiveId) {
      throw new Error('Archive ID is required');
    }

    const startTime = performance.now();

    try {
      const archiveKey = `${this.storageKey}-${archiveId}`;
      const compressedData = this.storage.get(archiveKey);

      if (!compressedData) {
        throw new Error(`Archive ${archiveId} not found`);
      }

      // Get archive metadata
      const archiveRecord = this.metadata.archives.find(a => a.id === archiveId);
      if (!archiveRecord) {
        throw new Error(`Archive metadata for ${archiveId} not found`);
      }

      // Decompress if needed
      let decompressedData = compressedData;
      if (archiveRecord.compressed) {
        try {
          decompressedData = pako.ungzip(compressedData, { to: 'string' });
        } catch (decompressionError) {
          throw new Error(`Failed to decompress archive ${archiveId}: ${decompressionError.message}`);
        }
      }

      // Parse session data
      let sessionData;
      try {
        sessionData = JSON.parse(decompressedData);
      } catch (parseError) {
        throw new Error(`Failed to parse archive data: ${parseError.message}`);
      }

      // Validate data if requested
      if (validateData) {
        this.validateSessionData(sessionData);
      }

      // Filter files if not requested
      if (!includeFiles && sessionData.files) {
        sessionData.files = [];
      }

      // Update last accessed time
      archiveRecord.lastAccessed = new Date().toISOString();
      this.saveMetadata();

      // Update metrics
      const decompressionTime = performance.now() - startTime;
      this.metrics.archivesLoaded++;
      this.metrics.totalDecompressionTime += decompressionTime;

      console.log(`Archive loaded: ${archiveId} (${Math.round(decompressionTime)}ms)`);

      return {
        success: true,
        sessionData,
        archiveRecord,
        processingTime: decompressionTime
      };

    } catch (error) {
      console.error('Failed to load archive:', error);
      throw error;
    }
  }

  /**
   * Create export package with multiple archives
   */
  async createExportPackage(archiveIds = [], format = 'zip') {
    if (format !== 'zip') {
      throw new Error('Only ZIP export format is currently supported');
    }

    try {
      const zip = new JSZip();
      const exportManifest = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        archiveIds,
        totalArchives: archiveIds.length
      };

      // Add metadata
      zip.file('manifest.json', JSON.stringify(exportManifest, null, 2));

      // Add archives
      for (const archiveId of archiveIds) {
        const archiveKey = `${this.storageKey}-${archiveId}`;
        const archiveData = this.storage.get(archiveKey);

        if (archiveData) {
          zip.file(`archives/${archiveId}.json`, archiveData);

          // Add archive metadata
          const archiveRecord = this.metadata.archives.find(a => a.id === archiveId);
          if (archiveRecord) {
            zip.file(`metadata/${archiveId}.json`, JSON.stringify(archiveRecord, null, 2));
          }
        }
      }

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      return {
        success: true,
        blob: zipBlob,
        filename: `claude-sessions-export-${new Date().toISOString().split('T')[0]}.zip`,
        size: zipBlob.size,
        archiveCount: archiveIds.length
      };

    } catch (error) {
      console.error('Failed to create export package:', error);
      throw error;
    }
  }

  /**
   * Import archives from export package
   */
  async importExportPackage(zipBlob, options = {}) {
    const {
      overwriteExisting = false,
      validateData = true
    } = options;

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipBlob);

      // Read manifest
      const manifestFile = zipContent.file('manifest.json');
      if (!manifestFile) {
        throw new Error('Invalid export package: missing manifest.json');
      }

      const manifest = JSON.parse(await manifestFile.async('string'));

      // Import archives
      const importResults = [];
      for (const archiveId of manifest.archiveIds) {
        try {
          const archiveFile = zipContent.file(`archives/${archiveId}.json`);
          const metadataFile = zipContent.file(`metadata/${archiveId}.json`);

          if (archiveFile) {
            const archiveData = await archiveFile.async('string');
            const archiveRecord = metadataFile
              ? JSON.parse(await metadataFile.async('string'))
              : null;

            // Check for existing archive
            const existingIndex = this.metadata.archives.findIndex(a => a.id === archiveId);
            if (existingIndex >= 0 && !overwriteExisting) {
              importResults.push({
                archiveId,
                success: false,
                error: 'Archive already exists'
              });
              continue;
            }

            // Store archive
            const archiveKey = `${this.storageKey}-${archiveId}`;
            this.storage.set(archiveKey, archiveData);

            // Update metadata
            if (archiveRecord) {
              if (existingIndex >= 0) {
                this.metadata.archives[existingIndex] = archiveRecord;
              } else {
                this.metadata.archives.push(archiveRecord);
              }
            }

            importResults.push({
              archiveId,
              success: true
            });
          }
        } catch (error) {
          importResults.push({
            archiveId,
            success: false,
            error: error.message
          });
        }
      }

      // Save updated metadata
      this.saveMetadata();
      this.updateStorageMetrics();

      return {
        success: true,
        results: importResults,
        imported: importResults.filter(r => r.success).length,
        failed: importResults.filter(r => !r.success).length
      };

    } catch (error) {
      console.error('Failed to import export package:', error);
      throw error;
    }
  }

  /**
   * List all archived sessions
   */
  listArchives(filters = {}) {
    let archives = [...this.metadata.archives];

    // Apply filters
    if (filters.sessionId) {
      archives = archives.filter(a => a.sessionId === filters.sessionId);
    }

    if (filters.tags && filters.tags.length > 0) {
      archives = archives.filter(a =>
        filters.tags.some(tag => a.tags.includes(tag))
      );
    }

    if (filters.priority) {
      archives = archives.filter(a => a.priority === filters.priority);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      archives = archives.filter(a => new Date(a.createdAt) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      archives = archives.filter(a => new Date(a.createdAt) <= toDate);
    }

    // Sort
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    archives.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'createdAt' || sortBy === 'lastAccessed') {
        comparison = new Date(a[sortBy]) - new Date(b[sortBy]);
      } else if (sortBy === 'size') {
        comparison = a.size - b.size;
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return {
      archives,
      total: archives.length,
      totalSize: archives.reduce((sum, a) => sum + a.size, 0)
    };
  }

  /**
   * Delete archive
   */
  deleteArchive(archiveId) {
    try {
      const archiveKey = `${this.storageKey}-${archiveId}`;
      this.storage.remove(archiveKey);

      // Remove from metadata
      this.metadata.archives = this.metadata.archives.filter(a => a.id !== archiveId);
      this.saveMetadata();

      this.updateStorageMetrics();

      console.log(`Archive deleted: ${archiveId}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete archive:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    const totalArchives = this.metadata.archives.length;
    const totalSize = this.metadata.archives.reduce((sum, a) => sum + a.size, 0);
    const totalOriginalSize = this.metadata.archives.reduce((sum, a) => sum + (a.originalSize || a.size), 0);
    const compressedArchives = this.metadata.archives.filter(a => a.compressed).length;

    return {
      totalArchives,
      totalSize,
      totalOriginalSize,
      averageSize: totalArchives > 0 ? totalSize / totalArchives : 0,
      compressionRatio: totalOriginalSize > 0 ? totalOriginalSize / totalSize : 1,
      compressedArchives,
      compressionRate: totalArchives > 0 ? compressedArchives / totalArchives : 0,
      metrics: { ...this.metrics },
      storageQuota: this.getStorageQuota()
    };
  }

  /**
   * Cleanup old archives based on storage limits
   */
  async cleanupOldArchives() {
    try {
      const archives = [...this.metadata.archives].sort((a, b) =>
        new Date(a.lastAccessed) - new Date(b.lastAccessed)
      );

      let removedCount = 0;
      let freedSpace = 0;

      // Remove oldest archives if we exceed limits
      while (archives.length > this.maxStoredArchives) {
        const oldestArchive = archives.shift();
        try {
          await this.deleteArchive(oldestArchive.id);
          removedCount++;
          freedSpace += oldestArchive.size;
        } catch (error) {
          console.warn(`Failed to delete archive ${oldestArchive.id}:`, error);
          break;
        }
      }

      if (removedCount > 0) {
        console.log(`Cleanup completed: removed ${removedCount} archives, freed ${freedSpace} bytes`);
      }

    } catch (error) {
      console.error('Archive cleanup failed:', error);
    }
  }

  /**
   * Utility functions
   */
  generateArchiveId(sessionId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sessionId}-${timestamp}-${random}`;
  }

  calculateDataSize(sessionData) {
    return JSON.stringify(sessionData).length;
  }

  validateSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Invalid session data format');
    }

    if (!sessionData.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!Array.isArray(sessionData.messages)) {
      throw new Error('Messages array is required');
    }

    return true;
  }

  updateStorageMetrics() {
    this.metrics.storageUsed = this.metadata.archives.reduce((sum, a) => sum + a.size, 0);
  }

  updateCompressionRatio(ratio) {
    const totalArchives = this.metrics.archivesCreated;
    this.metrics.averageCompressionRatio =
      (this.metrics.averageCompressionRatio * (totalArchives - 1) + ratio) / totalArchives;
  }

  getStorageQuota() {
    if (typeof window !== 'undefined' && window.navigator?.storage) {
      try {
        return {
          used: this.metrics.storageUsed,
          available: 'unknown',
          quota: 'unknown'
        };
      } catch (error) {
        return { used: this.metrics.storageUsed, available: 'unknown', quota: 'unknown' };
      }
    }
    return { used: this.metrics.storageUsed, available: 'N/A', quota: 'N/A' };
  }

  async ensureStorageSpace(requiredSize) {
    const stats = this.getStats();

    // Simple storage limit check
    if (stats.metrics.storageUsed + requiredSize > this.maxArchiveSize) {
      await this.cleanupOldArchives();

      // Check again after cleanup
      const newStats = this.getStats();
      if (newStats.metrics.storageUsed + requiredSize > this.maxArchiveSize) {
        throw new Error('Insufficient storage space. Consider deleting old archives or increasing storage limits.');
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default SessionArchiveService;