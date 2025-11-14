/**
 * Memory Manager Service
 * Provides comprehensive memory leak prevention and cleanup
 * Monitors memory usage, manages subscriptions, and prevents common React memory issues
 */
class MemoryManager {
  constructor(options = {}) {
    // Configuration
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
    this.cleanupInterval = options.cleanupInterval || 30000; // 30 seconds
    this.enableMonitoring = options.enableMonitoring !== false;
    this.enableAutoCleanup = options.enableAutoCleanup !== false;

    // Tracking
    this.subscriptions = new Set();
    this.timers = new Set();
    this.observers = new Set();
    this.eventListeners = new Map();
    this.components = new Map();
    this.webWorkers = new Set();

    // Memory monitoring
    this.memoryStats = {
      peakUsage: 0,
      currentUsage: 0,
      cleanupCount: 0,
      leakCount: 0,
      lastCleanup: null,
    };

    // Performance monitoring
    this.performanceMetrics = {
      componentMounts: 0,
      componentUnmounts: 0,
      averageCleanupTime: 0,
      memoryGrowthRate: 0,
    };

    // Initialize monitoring
    if (this.enableMonitoring) {
      this.initMemoryMonitoring();
      this.startCleanupInterval();
    }

    // Dev tools
    if (process.env.NODE_ENV === 'development') {
      this.initDevTools();
    }
  }

  /**
   * Initialize memory monitoring
   */
  initMemoryMonitoring() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      this.monitorMemory();
    }
  }

  /**
   * Monitor memory usage
   */
  monitorMemory() {
    const updateMemoryStats = () => {
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        this.memoryStats.currentUsage = memory.usedJSHeapSize;

        if (memory.usedJSHeapSize > this.memoryStats.peakUsage) {
          this.memoryStats.peakUsage = memory.usedJSHeapSize;
        }

        // Check for potential memory leaks
        if (memory.usedJSHeapSize > this.maxMemoryUsage) {
          this.handleMemoryPressure();
        }
      }
    };

    // Update memory stats every 5 seconds
    setInterval(updateMemoryStats, 5000);
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.performAutoCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Register a component for memory tracking
   */
  registerComponent(componentId, component, metadata = {}) {
    const registration = {
      id: componentId,
      component,
      metadata,
      registeredAt: Date.now(),
      mountCount: 0,
      unmountCount: 0,
    };

    this.components.set(componentId, registration);
    this.performanceMetrics.componentMounts++;

    // Add cleanup function to component
    if (component && typeof component === 'object') {
      component._memoryManagerCleanup = () => {
        this.unregisterComponent(componentId);
      };
    }

    return registration;
  }

  /**
   * Unregister component and cleanup its resources
   */
  unregisterComponent(componentId) {
    const registration = this.components.get(componentId);
    if (registration) {
      registration.unmountCount++;
      this.performanceMetrics.componentUnmounts++;

      // Cleanup component-specific resources
      this.cleanupComponentResources(componentId);

      this.components.delete(componentId);
    }
  }

  /**
   * Cleanup component-specific resources
   */
  cleanupComponentResources(componentId) {
    const prefix = `${componentId}:`;

    // Cleanup timers
    this.timers.forEach(timer => {
      if (timer.componentId === componentId) {
        this.clearTimer(timer.id);
      }
    });

    // Cleanup subscriptions
    this.subscriptions.forEach(subscription => {
      if (subscription.componentId === componentId) {
        this.unsubscribe(subscription.id);
      }
    });

    // Cleanup observers
    this.observers.forEach(observer => {
      if (observer.componentId === componentId) {
        this.disconnectObserver(observer.id);
      }
    });

    // Cleanup event listeners
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach(listener => {
        if (listener.componentId === componentId) {
          target.removeEventListener(listener.type, listener.handler);
        }
      });
    });
  }

  /**
   * Register a subscription for tracking
   */
  registerSubscription(subscription, componentId, metadata = {}) {
    const subscriptionId = this.generateId();
    const registration = {
      id: subscriptionId,
      subscription,
      componentId,
      metadata,
      registeredAt: Date.now(),
    };

    this.subscriptions.add(registration);

    // Add cleanup method to subscription if it exists
    if (subscription && typeof subscription.unsubscribe === 'function') {
      const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
      subscription.unsubscribe = () => {
        this.unsubscribe(subscriptionId);
        return originalUnsubscribe();
      };
    }

    return subscriptionId;
  }

  /**
   * Unregister and cleanup a subscription
   */
  unsubscribe(subscriptionId) {
    const registration = this.findSubscriptionById(subscriptionId);
    if (registration) {
      try {
        if (
          registration.subscription &&
          typeof registration.subscription.unsubscribe === 'function'
        ) {
          registration.subscription.unsubscribe();
        } else if (registration.subscription && typeof registration.subscription === 'function') {
          // Handle RxJS subscriptions
          registration.subscription.unsubscribe();
        }
      } catch (error) {
        console.warn('Failed to unsubscribe:', error);
      }

      this.subscriptions.delete(registration);
    }
  }

  /**
   * Register a timer for tracking
   */
  registerTimer(timerId, componentId, type = 'timeout', metadata = {}) {
    const registration = {
      id: timerId,
      componentId,
      type,
      metadata,
      registeredAt: Date.now(),
    };

    this.timers.add(registration);
    return registration;
  }

  /**
   * Clear a tracked timer
   */
  clearTimer(timerId) {
    const registration = this.findTimerById(timerId);
    if (registration) {
      try {
        if (registration.type === 'timeout') {
          clearTimeout(timerId);
        } else if (registration.type === 'interval') {
          clearInterval(timerId);
        }
      } catch (error) {
        console.warn('Failed to clear timer:', error);
      }

      this.timers.delete(registration);
    }
  }

  /**
   * Register an observer for tracking
   */
  registerObserver(observer, componentId, metadata = {}) {
    const observerId = this.generateId();
    const registration = {
      id: observerId,
      observer,
      componentId,
      metadata,
      registeredAt: Date.now(),
    };

    this.observers.add(registration);

    // Add cleanup method to observer
    if (observer && typeof observer.disconnect === 'function') {
      const originalDisconnect = observer.disconnect.bind(observer);
      observer.disconnect = () => {
        this.disconnectObserver(observerId);
        return originalDisconnect();
      };
    }

    return observerId;
  }

  /**
   * Disconnect and cleanup an observer
   */
  disconnectObserver(observerId) {
    const registration = this.findObserverById(observerId);
    if (registration) {
      try {
        if (registration.observer && typeof registration.observer.disconnect === 'function') {
          registration.observer.disconnect();
        }
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }

      this.observers.delete(registration);
    }
  }

  /**
   * Register an event listener for tracking
   */
  registerEventListener(target, type, handler, componentId, options = {}) {
    const listenerId = this.generateId();
    const registration = {
      id: listenerId,
      target,
      type,
      handler,
      componentId,
      options,
      registeredAt: Date.now(),
    };

    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, []);
    }

    this.eventListeners.get(target).push(registration);

    // Add event listener
    target.addEventListener(type, handler, options);

    return listenerId;
  }

  /**
   * Remove an event listener
   */
  removeEventListener(target, listenerId) {
    const listeners = this.eventListeners.get(target);
    if (listeners) {
      const registration = listeners.find(l => l.id === listenerId);
      if (registration) {
        try {
          target.removeEventListener(registration.type, registration.handler, registration.options);
        } catch (error) {
          console.warn('Failed to remove event listener:', error);
        }

        const index = listeners.indexOf(registration);
        listeners.splice(index, 1);

        if (listeners.length === 0) {
          this.eventListeners.delete(target);
        }
      }
    }
  }

  /**
   * Register a web worker for tracking
   */
  registerWebWorker(worker, componentId, metadata = {}) {
    const workerId = this.generateId();
    const registration = {
      id: workerId,
      worker,
      componentId,
      metadata,
      registeredAt: Date.now(),
    };

    this.webWorkers.add(registration);

    // Handle worker termination
    if (worker && typeof worker.terminate === 'function') {
      const originalTerminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        this.unregisterWebWorker(workerId);
        return originalTerminate();
      };
    }

    return workerId;
  }

  /**
   * Unregister and cleanup a web worker
   */
  unregisterWebWorker(workerId) {
    const registration = this.findWebWorkerById(workerId);
    if (registration) {
      try {
        if (registration.worker && typeof registration.worker.terminate === 'function') {
          registration.worker.terminate();
        }
      } catch (error) {
        console.warn('Failed to terminate web worker:', error);
      }

      this.webWorkers.delete(registration);
    }
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure() {
    console.warn('Memory pressure detected, performing emergency cleanup');

    // Force garbage collection if available
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }

    // Perform immediate cleanup
    this.performEmergencyCleanup();

    this.memoryStats.leakCount++;

    // Consider redirecting to less memory-intensive view
    this.memoryStats.lastCleanup = Date.now();
  }

  /**
   * Perform automatic cleanup
   */
  performAutoCleanup() {
    const startTime = performance.now();

    try {
      // Cleanup expired timers
      this.cleanupExpiredTimers();

      // Cleanup orphaned subscriptions
      this.cleanupOrphanedSubscriptions();

      // Cleanup disconnected observers
      this.cleanupDisconnectedObservers();

      // Cleanup weak event listeners
      this.cleanupWeakEventListeners();

      // Force garbage collection if available
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }

      this.memoryStats.cleanupCount++;
      this.memoryStats.lastCleanup = Date.now();

      // Update performance metrics
      const cleanupTime = performance.now() - startTime;
      this.updateCleanupMetrics(cleanupTime);
    } catch (error) {
      console.error('Auto cleanup failed:', error);
    }
  }

  /**
   * Perform emergency cleanup
   */
  performEmergencyCleanup() {
    // Clear all timers
    this.timers.forEach(timer => {
      this.clearTimer(timer.id);
    });

    // Unsubscribe all subscriptions
    this.subscriptions.forEach(subscription => {
      this.unsubscribe(subscription.id);
    });

    // Disconnect all observers
    this.observers.forEach(observer => {
      this.disconnectObserver(observer.id);
    });

    // Remove all event listeners
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach(listener => {
        target.removeEventListener(listener.type, listener.handler);
      });
    });
    this.eventListeners.clear();

    // Terminate all web workers
    this.webWorkers.forEach(worker => {
      this.unregisterWebWorker(worker.id);
    });
  }

  /**
   * Cleanup methods
   */
  cleanupExpiredTimers() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    this.timers.forEach(timer => {
      if (now - timer.registeredAt > maxAge) {
        console.warn('Cleaning up expired timer:', timer.id);
        this.clearTimer(timer.id);
      }
    });
  }

  cleanupOrphanedSubscriptions() {
    this.subscriptions.forEach(subscription => {
      if (subscription.componentId && !this.components.has(subscription.componentId)) {
        console.warn('Cleaning up orphaned subscription:', subscription.id);
        this.unsubscribe(subscription.id);
      }
    });
  }

  cleanupDisconnectedObservers() {
    this.observers.forEach(observer => {
      if (observer.componentId && !this.components.has(observer.componentId)) {
        console.warn('Cleaning up orphaned observer:', observer.id);
        this.disconnectObserver(observer.id);
      }
    });
  }

  cleanupWeakEventListeners() {
    this.eventListeners.forEach((listeners, target) => {
      if (target && !target.isConnected && !target.document) {
        console.warn('Cleaning up weak event listeners for:', target);
        listeners.forEach(listener => {
          this.removeEventListener(target, listener.id);
        });
      }
    });
  }

  /**
   * Find helpers
   */
  findSubscriptionById(id) {
    return Array.from(this.subscriptions).find(s => s.id === id);
  }

  findTimerById(id) {
    return Array.from(this.timers).find(t => t.id === id);
  }

  findObserverById(id) {
    return Array.from(this.observers).find(o => o.id === id);
  }

  findWebWorkerById(id) {
    return Array.from(this.webWorkers).find(w => w.id === id);
  }

  /**
   * Update cleanup metrics
   */
  updateCleanupMetrics(cleanupTime) {
    const totalCleanups = this.memoryStats.cleanupCount;
    this.performanceMetrics.averageCleanupTime =
      (this.performanceMetrics.averageCleanupTime * (totalCleanups - 1) + cleanupTime) /
      totalCleanups;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    const activeComponents = this.components.size;
    const activeSubscriptions = this.subscriptions.size;
    const activeTimers = this.timers.size;
    const activeObservers = this.observers.size;
    const activeWorkers = this.webWorkers.size;

    return {
      ...this.memoryStats,
      ...this.performanceMetrics,
      activeComponents,
      activeSubscriptions,
      activeTimers,
      activeObservers,
      activeWorkers,
      memoryUsage: window.performance?.memory?.usedJSHeapSize || 0,
      memoryLimit: window.performance?.memory?.jsHeapSizeLimit || 0,
    };
  }

  /**
   * Check for memory leaks
   */
  checkForMemoryLeaks() {
    const stats = this.getMemoryStats();
    const issues = [];

    // Check for unusual subscription count
    if (stats.activeSubscriptions > stats.activeComponents * 10) {
      issues.push({
        type: 'subscription_leak',
        severity: 'high',
        message: `Too many subscriptions (${stats.activeSubscriptions}) for ${stats.activeComponents} components`,
      });
    }

    // Check for unusual timer count
    if (stats.activeTimers > stats.activeComponents * 5) {
      issues.push({
        type: 'timer_leak',
        severity: 'medium',
        message: `Too many active timers (${stats.activeTimers}) for ${stats.activeComponents} components`,
      });
    }

    // Check for unusual observer count
    if (stats.activeObservers > stats.activeComponents * 3) {
      issues.push({
        type: 'observer_leak',
        severity: 'medium',
        message: `Too many observers (${stats.activeObservers}) for ${stats.activeComponents} components`,
      });
    }

    // Check memory growth
    if (stats.memoryUsage > this.maxMemoryUsage) {
      issues.push({
        type: 'memory_pressure',
        severity: 'critical',
        message: `Memory usage (${Math.round(stats.memoryUsage / 1024 / 1024)}MB) exceeds limit`,
      });
    }

    return issues;
  }

  /**
   * Initialize development tools
   */
  initDevTools() {
    if (typeof window !== 'undefined') {
      window.memoryManager = this;

      // Add console commands
      window.mm = {
        stats: () => this.getMemoryStats(),
        check: () => this.checkForMemoryLeaks(),
        cleanup: () => this.performAutoCleanup(),
        emergency: () => this.performEmergencyCleanup(),
      };

      console.log('Memory Manager dev tools available via window.mm');
    }
  }

  /**
   * Utility methods
   */
  generateId() {
    return `mm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy memory manager and cleanup all resources
   */
  destroy() {
    // Clear cleanup interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Perform final cleanup
    this.performEmergencyCleanup();

    // Clear all references
    this.components.clear();
    this.subscriptions.clear();
    this.timers.clear();
    this.observers.clear();
    this.eventListeners.clear();
    this.webWorkers.clear();

    // Remove dev tools
    if (typeof window !== 'undefined' && window.mm) {
      delete window.mm;
      delete window.memoryManager;
    }
  }
}

// Create singleton instance
let memoryManagerInstance = null;

export const getMemoryManager = (options = {}) => {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(options);
  }
  return memoryManagerInstance;
};

export default MemoryManager;
