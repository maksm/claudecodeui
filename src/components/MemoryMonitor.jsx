import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Trash2,
  RefreshCw,
  X,
  Memory,
  Zap,
  TrendingUp,
  Clock,
  Users,
  Package,
} from 'lucide-react';
import { useMemoryDevTools, useMemoryMonitor } from '../hooks/useMemoryManager';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Memory Monitor Component
 * Provides real-time memory usage monitoring and debugging tools
 * Development-only component with comprehensive memory insights
 */
const MemoryMonitor = ({
  className = '',
  position = 'bottom-right',
  autoOpen = false,
  showToggle = true,
  compact = false,
  ...props
}) => {
  const { theme } = useTheme();
  const { isOpen, setIsOpen, stats, refreshStats, performCleanup, checkLeaks, isDevelopment } =
    useMemoryDevTools();
  const { memoryStatus, memoryUsagePercentage, issues, forceCleanup } = useMemoryMonitor({
    interval: 2000,
    autoStart: isOpen,
  });

  // Auto-open in development if requested
  useEffect(() => {
    if (isDevelopment && autoOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [isDevelopment, autoOpen, isOpen, setIsOpen]);

  // Don't render in production
  if (!isDevelopment) {
    return null;
  }

  // Format bytes to human readable
  const formatBytes = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status color
  const getStatusColor = status => {
    switch (status) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-orange-600 dark:text-orange-400';
      case 'caution':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  // Get status background
  const getStatusBackground = status => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
      case 'warning':
        return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
      case 'caution':
        return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
      default:
        return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    }
  };

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  if (compact) {
    return (
      <div
        className={`memory-monitor-compact ${getPositionClasses()} fixed z-50 ${className}`}
        {...props}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${getStatusBackground(
            memoryStatus
          )} hover:shadow-lg`}
          title={`Memory: ${Math.round(memoryUsagePercentage)}% (${formatBytes(stats?.memoryUsage || 0)})`}
        >
          <Memory className="w-4 h-4" />
          <span className="text-sm font-medium">{Math.round(memoryUsagePercentage)}%</span>
          {issues.length > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
        </button>
      </div>
    );
  }

  return (
    <div className={`memory-monitor ${getPositionClasses()} fixed z-50 ${className}`} {...props}>
      {/* Toggle Button */}
      {showToggle && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all mb-2 ${getStatusBackground(
            memoryStatus
          )} hover:shadow-lg`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">{Math.round(memoryUsagePercentage)}%</span>
          {issues.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
        </button>
      )}

      {/* Monitor Panel */}
      {isOpen && (
        <div className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Memory Monitor</h3>
              {issues.length > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  {issues.length} issues
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={refreshStats}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Refresh stats"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Memory Status */}
          <div
            className={`p-4 border-b border-gray-200 dark:border-gray-700 ${getStatusBackground(memoryStatus)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium capitalize ${getStatusColor(memoryStatus)}`}>
                {memoryStatus} Memory Usage
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {Math.round(memoryUsagePercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  memoryStatus === 'critical'
                    ? 'bg-red-500'
                    : memoryStatus === 'warning'
                      ? 'bg-orange-500'
                      : memoryStatus === 'caution'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(memoryUsagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span>{formatBytes(stats?.memoryUsage || 0)} used</span>
              <span>{formatBytes(stats?.memoryLimit || 0)} limit</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-xs">Components</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats?.activeComponents || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs">Subscriptions</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats?.activeSubscriptions || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Timers</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats?.activeTimers || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Observers</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats?.activeObservers || 0}
              </div>
            </div>
          </div>

          {/* Issues Section */}
          {issues.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">Memory Issues</h4>
              </div>
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm ${
                      issue.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                        : issue.severity === 'high'
                          ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                    }`}
                  >
                    <div className="font-medium capitalize">{issue.type.replace('_', ' ')}</div>
                    <div className="text-xs opacity-75">{issue.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Performance</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Peak Usage</span>
                <span className="text-gray-900 dark:text-white">
                  {formatBytes(stats?.peakUsage || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Cleanup Count</span>
                <span className="text-gray-900 dark:text-white">{stats?.cleanupCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Avg Cleanup Time</span>
                <span className="text-gray-900 dark:text-white">
                  {stats?.averageCleanupTime ? `${Math.round(stats.averageCleanupTime)}ms` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Component Mounts</span>
                <span className="text-gray-900 dark:text-white">{stats?.componentMounts || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Component Unmounts</span>
                <span className="text-gray-900 dark:text-white">
                  {stats?.componentUnmounts || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 flex gap-2">
            <button
              onClick={performCleanup}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Cleanup
            </button>
            <button
              onClick={() => {
                const leaks = checkLeaks();
                alert(
                  `Found ${leaks.length} potential memory leaks:\n\n${leaks.map(l => `• ${l.message}`).join('\n')}`
                );
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              Check Leaks
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryMonitor;
