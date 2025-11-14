/* global Worker, MutationObserver, ResizeObserver */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getMemoryManager } from '../services/memoryManager';

/**
 * React hooks for memory management
 * Provides automatic cleanup and memory leak prevention for React components
 */

/**
 * Main hook for memory management
 */
export const useMemoryManager = (options = {}) => {
  const memoryManager = useMemo(() => getMemoryManager(options), [options]);

  return {
    memoryManager,
    registerComponent: useCallback((componentId, component, metadata) => {
      return memoryManager.registerComponent(componentId, component, metadata);
    }, [memoryManager]),
    registerSubscription: useCallback((subscription, componentId, metadata) => {
      return memoryManager.registerSubscription(subscription, componentId, metadata);
    }, [memoryManager]),
    registerTimer: useCallback((timerId, componentId, type, metadata) => {
      return memoryManager.registerTimer(timerId, componentId, type, metadata);
    }, [memoryManager]),
    registerObserver: useCallback((observer, componentId, metadata) => {
      return memoryManager.registerObserver(observer, componentId, metadata);
    }, [memoryManager]),
    registerEventListener: useCallback((target, type, handler, componentId, options) => {
      return memoryManager.registerEventListener(target, type, handler, componentId, options);
    }, [memoryManager]),
    getMemoryStats: useCallback(() => {
      return memoryManager.getMemoryStats();
    }, [memoryManager]),
    checkForMemoryLeaks: useCallback(() => {
      return memoryManager.checkForMemoryLeaks();
    }, [memoryManager])
  };
};

/**
 * Hook for automatic component cleanup
 */
export const useMemoryCleanup = (componentId, metadata = {}) => {
  const { memoryManager, registerComponent } = useMemoryManager();
  const cleanupRef = useRef([]);

  // Register component on mount
  useEffect(() => {
    if (componentId) {
      registerComponent(componentId, null, metadata);
    }
  }, [componentId, registerComponent, metadata]);

  // Register cleanup function
  const registerCleanup = useCallback((cleanupFn) => {
    cleanupRef.current.push(cleanupFn);
    return cleanupRef.current.length - 1;
  }, []);

  // Perform cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanupFn, index) => {
        try {
          cleanupFn();
        } catch (error) {
          console.warn(`Cleanup function ${index} failed:`, error);
        }
      });
      cleanupRef.current = [];

      // Unregister component
      if (componentId) {
        memoryManager.unregisterComponent(componentId);
      }
    };
  }, [componentId, memoryManager]);

  return {
    registerCleanup,
    addCleanup: registerCleanup
  };
};

/**
 * Hook for managing timers with automatic cleanup
 */
export const useManagedTimer = (componentId) => {
  const { memoryManager, registerTimer } = useMemoryManager();
  const timersRef = useRef(new Set());

  // Create managed timeout
  const setTimeout = useCallback((callback, delay, ...args) => {
    const timerId = window.setTimeout(() => {
      callback(...args);
      timersRef.current.delete(timerId);
    }, delay);

    timersRef.current.add(timerId);
    registerTimer(timerId, componentId, 'timeout');

    return timerId;
  }, [componentId, registerTimer]);

  // Create managed interval
  const setInterval = useCallback((callback, delay, ...args) => {
    const timerId = window.setInterval(callback, delay, ...args);

    timersRef.current.add(timerId);
    registerTimer(timerId, componentId, 'interval');

    return timerId;
  }, [componentId, registerTimer]);

  // Clear managed timeout
  const clearTimeout = useCallback((timerId) => {
    window.clearTimeout(timerId);
    timersRef.current.delete(timerId);
  }, []);

  // Clear managed interval
  const clearInterval = useCallback((timerId) => {
    window.clearInterval(timerId);
    timersRef.current.delete(timerId);
  }, []);

  // Cleanup all timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timerId => {
      if (timerId.toString().includes('.')) {
        window.clearInterval(timerId);
      } else {
        window.clearTimeout(timerId);
      }
    });
    timersRef.current.clear();
  }, []);

  return {
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    clearAllTimers
  };
};

/**
 * Hook for managing event listeners with automatic cleanup
 */
export const useManagedEventListener = (componentId) => {
  const { memoryManager, registerEventListener } = useMemoryManager();
  const listenersRef = useRef(new Set());

  // Add managed event listener
  const addEventListener = useCallback((target, type, handler, options) => {
    const listenerId = registerEventListener(target, type, handler, componentId, options);
    listenersRef.current.add(listenerId);
    return listenerId;
  }, [componentId, registerEventListener]);

  // Remove managed event listener
  const removeEventListener = useCallback((target, listenerId) => {
    memoryManager.removeEventListener(target, listenerId);
    listenersRef.current.delete(listenerId);
  }, [memoryManager]);

  // Cleanup all listeners
  const removeAllListeners = useCallback(() => {
    listenersRef.current.forEach(listenerId => {
      // Find the target for this listener
      memoryManager.eventListeners.forEach((listeners, target) => {
        const listener = listeners.find(l => l.id === listenerId);
        if (listener) {
          target.removeEventListener(listener.type, listener.handler);
        }
      });
    });
    listenersRef.current.clear();
  }, [memoryManager]);

  return {
    addEventListener,
    removeEventListener,
    removeAllListeners
  };
};

/**
 * Hook for managing observers with automatic cleanup
 */
export const useManagedObserver = (componentId) => {
  const { memoryManager, registerObserver } = useMemoryManager();
  const observersRef = useRef(new Set());

  // Create managed IntersectionObserver
  const useIntersectionObserver = useCallback((callback, options) => {
    const observer = new IntersectionObserver(callback, options);
    const observerId = registerObserver(observer, componentId, { type: 'intersection' });
    observersRef.current.add(observerId);
    return { observer, id: observerId };
  }, [componentId, registerObserver]);

  // Create managed MutationObserver
  const useMutationObserver = useCallback((callback, options) => {
    const observer = new MutationObserver(callback, options);
    const observerId = registerObserver(observer, componentId, { type: 'mutation' });
    observersRef.current.add(observerId);
    return { observer, id: observerId };
  }, [componentId, registerObserver]);

  // Create managed ResizeObserver
  const useResizeObserver = useCallback((callback) => {
    const observer = new ResizeObserver(callback);
    const observerId = registerObserver(observer, componentId, { type: 'resize' });
    observersRef.current.add(observerId);
    return { observer, id: observerId };
  }, [componentId, registerObserver]);

  // Disconnect observer
  const disconnectObserver = useCallback((observerId) => {
    memoryManager.disconnectObserver(observerId);
    observersRef.current.delete(observerId);
  }, [memoryManager]);

  // Disconnect all observers
  const disconnectAllObservers = useCallback(() => {
    observersRef.current.forEach(observerId => {
      memoryManager.disconnectObserver(observerId);
    });
    observersRef.current.clear();
  }, [memoryManager]);

  return {
    useIntersectionObserver,
    useMutationObserver,
    useResizeObserver,
    disconnectObserver,
    disconnectAllObservers
  };
};

/**
 * Hook for managing web workers with automatic cleanup
 */
export const useManagedWebWorker = (componentId) => {
  const { memoryManager, registerWebWorker } = useMemoryManager();
  const workersRef = useRef(new Set());

  // Terminate worker
  const terminateWorker = useCallback((workerId) => {
    memoryManager.unregisterWebWorker(workerId);
    workersRef.current.delete(workerId);
  }, [memoryManager]);

  // Create managed web worker
  const createWorker = useCallback((workerScript, options = {}) => {
    const worker = new Worker(workerScript, options);
    const workerId = registerWebWorker(worker, componentId, options);
    workersRef.current.add(workerId);

    // Handle worker errors
    worker.onerror = (error) => {
      console.error('Web worker error:', error);
      terminateWorker(workerId);
    };

    return { worker, id: workerId };
  }, [componentId, registerWebWorker, terminateWorker]);

  // Terminate all workers
  const terminateAllWorkers = useCallback(() => {
    workersRef.current.forEach(workerId => {
      memoryManager.unregisterWebWorker(workerId);
    });
    workersRef.current.clear();
  }, [memoryManager]);

  return {
    createWorker,
    terminateWorker,
    terminateAllWorkers
  };
};

/**
 * Hook for memory monitoring and debugging
 */
export const useMemoryMonitor = (options = {}) => {
  const { memoryManager } = useMemoryManager();
  const [stats, setStats] = useState(null);
  const [issues, setIssues] = useState([]);
  const intervalRef = useRef(null);

  const { interval = 5000, autoStart = true } = options;

  // Update stats
  const updateStats = useCallback(() => {
    const currentStats = memoryManager.getMemoryStats();
    setStats(currentStats);

    const currentIssues = memoryManager.checkForMemoryLeaks();
    setIssues(currentIssues);

    return { stats: currentStats, issues: currentIssues };
  }, [memoryManager]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(updateStats, interval);
    updateStats(); // Initial update
  }, [updateStats, interval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Force cleanup
  const forceCleanup = useCallback(() => {
    memoryManager.performAutoCleanup();
    updateStats();
  }, [memoryManager, updateStats]);

  // Start monitoring on mount if auto-start is enabled
  useEffect(() => {
    if (autoStart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStart, startMonitoring, stopMonitoring]);

  // Calculate memory usage percentage
  const memoryUsagePercentage = useMemo(() => {
    if (!stats) return 0;
    return stats.memoryUsage && stats.memoryLimit
      ? (stats.memoryUsage / stats.memoryLimit) * 100
      : 0;
  }, [stats]);

  // Determine memory status
  const memoryStatus = useMemo(() => {
    if (!stats) return 'unknown';

    const percentage = memoryUsagePercentage;
    if (percentage > 90) return 'critical';
    if (percentage > 75) return 'warning';
    if (percentage > 60) return 'caution';
    return 'normal';
  }, [memoryUsagePercentage, stats]);

  return {
    stats,
    issues,
    memoryUsagePercentage,
    memoryStatus,
    updateStats,
    startMonitoring,
    stopMonitoring,
    forceCleanup
  };
};

/**
 * Hook for subscription management (RxJS-like)
 */
export const useManagedSubscription = (componentId) => {
  const { memoryManager, registerSubscription } = useMemoryManager();
  const subscriptionsRef = useRef(new Set());

  // Subscribe and track
  const subscribe = useCallback((observable, onNext, onError, onComplete) => {
    const subscription = observable.subscribe({
      next: onNext,
      error: onError,
      complete: onComplete
    });

    const subscriptionId = registerSubscription(subscription, componentId);
    subscriptionsRef.current.add(subscriptionId);

    return subscriptionId;
  }, [componentId, registerSubscription]);

  // Unsubscribe
  const unsubscribe = useCallback((subscriptionId) => {
    memoryManager.unsubscribe(subscriptionId);
    subscriptionsRef.current.delete(subscriptionId);
  }, [memoryManager]);

  // Unsubscribe all
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach(subscriptionId => {
      memoryManager.unsubscribe(subscriptionId);
    });
    subscriptionsRef.current.clear();
  }, [memoryManager]);

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll
  };
};

/**
 * Dev tools hook for memory management
 */
export const useMemoryDevTools = () => {
  const { memoryManager } = useMemoryManager();
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);

  const refreshStats = useCallback(() => {
    setStats(memoryManager.getMemoryStats());
  }, [memoryManager]);

  const performCleanup = useCallback(() => {
    memoryManager.performAutoCleanup();
    refreshStats();
  }, [memoryManager, refreshStats]);

  const checkLeaks = useCallback(() => {
    return memoryManager.checkForMemoryLeaks();
  }, [memoryManager]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshStats();
    }
  }, [refreshStats]);

  return {
    isOpen,
    setIsOpen,
    stats,
    refreshStats,
    performCleanup,
    checkLeaks,
    isDevelopment: process.env.NODE_ENV === 'development'
  };
};

export default useMemoryManager;