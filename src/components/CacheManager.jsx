import React, { useState } from 'react';
import { Database, Zap, BarChart3, Download, Upload, Trash2, RefreshCw, Settings, Clock, HardDrive, TrendingUp, Play, Pause } from 'lucide-react';
import { useSessionCache, useCacheMonitor, useSessionPreloader } from '../hooks/useSessionCache';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Cache Manager Component
 * Provides UI for monitoring and managing session cache
 * Development and debugging tool for cache performance
 */
const CacheManager = ({
  className = '',
  compact = false,
  showControls = true,
  sessionIds = [],
  currentSessionId = null,
  sessionLoader = null,
  ...props
}) => {
  const { theme } = useTheme();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preloadEnabled, setPreloadEnabled] = useState(true);

  // Use cache hooks
  const sessionCache = useSessionCache({
    maxCacheSize: 100,
    enableBackgroundLoading: true
  });

  const { stats, getCacheHealth, formatCacheSize, cacheHitRate, memoryUsage, backgroundLoading } = useCacheMonitor(3000);

  const { preloadAdjacent, warmCache, getPreloadStatus } = useSessionPreloader(
    sessionIds,
    currentSessionId,
    sessionLoader
  );

  // Cache operations
  const handleClearCache = () => {
    if (window.confirm('Are you sure you want to clear all cached sessions?')) {
      sessionCache.clearCache();
    }
  };

  const handleWarmCache = async () => {
    if (!sessionIds.length || !sessionLoader) {
      alert('Session IDs and loader are required for cache warming');
      return;
    }

    try {
      await warmCache([currentSessionId, ...sessionIds.slice(0, 5)], currentSessionId);
      alert('Cache warming completed');
    } catch (error) {
      alert('Cache warming failed: ' + error.message);
    }
  };

  const handlePreloadAdjacent = () => {
    if (!sessionIds.length || !currentSessionId || !sessionLoader) {
      alert('Session IDs, current session, and loader are required for preloading');
      return;
    }

    preloadAdjacent();
  };

  const handleExportCache = () => {
    try {
      const exportData = sessionCache.exportCache();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-cache-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleImportCache = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            sessionCache.importCache(importData);
            alert('Cache imported successfully');
          } catch (error) {
            alert('Import failed: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Get health color
  const getHealthColor = (health) => {
    switch (health) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-blue-600 dark:text-blue-400';
      case 'fair': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Get health background
  const getHealthBackground = (health) => {
    switch (health) {
      case 'excellent': return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
      case 'good': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700';
      case 'fair': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
      case 'poor': return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
      default: return 'bg-gray-100 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700';
    }
  };

  if (compact) {
    return (
      <div className={`cache-manager-compact ${className}`} {...props}>
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Cache: {stats?.cacheSize || 0}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>{Math.round(cacheHitRate)}%</span>
          </div>

          {backgroundLoading && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Zap className="w-4 h-4 animate-pulse" />
              <span>Loading</span>
            </div>
          )}

          <div className="flex-1" />

          <button
            onClick={handleClearCache}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Clear cache"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cache-manager ${className}`} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Session Cache</h3>
          {backgroundLoading && (
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Zap className="w-3 h-3 animate-pulse" />
              <span className="text-xs">Background Loading</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Advanced settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearCache}
            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            title="Clear cache"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cache Stats */}
      <div className="p-4 space-y-4">
        {/* Health Status */}
        <div className={`p-3 rounded-lg border ${getHealthBackground(getCacheHealth())}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium text-gray-900 dark:text-white">Cache Health</span>
            </div>
            <span className={`text-sm font-medium capitalize ${getHealthColor(getCacheHealth())}`}>
              {getCacheHealth()}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.cacheSize || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Sessions</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(cacheHitRate)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Hit Rate</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCacheSize(memoryUsage)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Memory</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.backgroundLoadQueue || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Queue</div>
          </div>
        </div>

        {/* Performance Metrics */}
        {showAdvanced && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Performance Metrics</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Cache Hits</span>
                <span className="text-gray-900 dark:text-white">{stats?.hits || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Cache Misses</span>
                <span className="text-gray-900 dark:text-white">{stats?.misses || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Background Loads</span>
                <span className="text-gray-900 dark:text-white">{stats?.backgroundLoads || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Evictions</span>
                <span className="text-gray-900 dark:text-white">{stats?.evictions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Avg Load Time</span>
                <span className="text-gray-900 dark:text-white">
                  {stats?.averageLoadTime ? `${Math.round(stats.averageLoadTime)}ms` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Memory Usage</span>
                <span className="text-gray-900 dark:text-white">
                  {stats?.memoryUsagePercentage ? `${Math.round(stats.memoryUsagePercentage)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {showControls && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleWarmCache}
              disabled={!sessionIds.length || !sessionLoader}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Zap className="w-4 h-4" />
              Warm Cache
            </button>

            <button
              onClick={handlePreloadAdjacent}
              disabled={!sessionIds.length || !currentSessionId || !sessionLoader}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Play className="w-4 h-4" />
              Preload Adjacent
            </button>

            <button
              onClick={handleExportCache}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={handleImportCache}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>

            <button
              onClick={() => setPreloadEnabled(!preloadEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                preloadEnabled
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {preloadEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              Auto-Preload
            </button>
          </div>
        )}

        {/* Cached Sessions List */}
        {showAdvanced && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Cached Sessions</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessionCache.getCachedSessionIds().length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No cached sessions</p>
                </div>
              ) : (
                sessionCache.getCachedSessionIds().map(sessionId => {
                  const metadata = sessionCache.getSessionMetadata(sessionId);
                  const preloadStatus = getPreloadStatus(sessionId);

                  return (
                    <div
                      key={sessionId}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {sessionId}
                          </span>
                          {sessionId === currentSessionId && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-xs rounded">
                              Current
                            </span>
                          )}
                          {preloadStatus !== 'not-preloaded' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs rounded">
                              {preloadStatus}
                            </span>
                          )}
                          {metadata?.isStale && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 text-xs rounded">
                              Stale
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {metadata?.cachedAt ? new Date(metadata.cachedAt).toLocaleTimeString() : 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {metadata?.size ? formatCacheSize(metadata.size) : 'Unknown'}
                          </span>
                          {metadata?.accessCount > 0 && (
                            <span>Accessed {metadata.accessCount}x</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => sessionCache.invalidateSession(sessionId)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          title="Invalidate"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => sessionCache.removeSession(sessionId)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CacheManager;