import { useState, useEffect, useCallback, useRef } from 'react';

export const usePWA = (options = {}) => {
  const {
    onInstallPrompt = null,
    onUpdateAvailable = null,
    onAppInstalled = null,
    checkInterval = 60000 // Check for updates every minute
  } = options;

  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [registration, setRegistration] = useState(null);

  const deferredPrompt = useRef(null);
  const updateIntervalRef = useRef(null);

  // Check if PWA is installed
  const checkInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator.standalone === true);
    const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches;
    const isPWAInstalled = isStandalone || isInWebAppiOS || isInWebAppChrome;

    setIsInstalled(isPWAInstalled);
    return isPWAInstalled;
  }, []);

  // Handle install prompt
  const handleBeforeInstallPrompt = useCallback((event) => {
    event.preventDefault();
    deferredPrompt.current = event;
    setIsInstallable(true);

    if (onInstallPrompt) {
      onInstallPrompt(event);
    }
  }, [onInstallPrompt]);

  // Handle app installed
  const handleAppInstalled = useCallback(() => {
    setIsInstalled(true);
    setIsInstallable(false);
    deferredPrompt.current = null;

    if (onAppInstalled) {
      onAppInstalled();
    }
  }, [onAppInstalled]);

  // Handle service worker update
  const handleSWUpdate = useCallback((newRegistration) => {
    setIsUpdateAvailable(true);
    setRegistration(newRegistration);

    if (onUpdateAvailable) {
      onUpdateAvailable(newRegistration);
    }
  }, [onUpdateAvailable]);

  // Install PWA
  const install = useCallback(async () => {
    if (!deferredPrompt.current) {
      console.log('PWA install prompt not available');
      return false;
    }

    try {
      const result = await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA installation accepted');
        setIsInstalled(true);
      } else {
        console.log('PWA installation dismissed');
      }

      deferredPrompt.current = null;
      setIsInstallable(false);

      return result === 'accepted';
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    }
  }, []);

  // Skip waiting for service worker
  const skipWaiting = useCallback(() => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  // Apply service worker update
  const applyUpdate = useCallback(async () => {
    if (!registration) return false;

    try {
      await skipWaiting();

      // Reload the page to apply the update
      window.location.reload();

      return true;
    } catch (error) {
      console.error('Failed to apply PWA update:', error);
      return false;
    }
  }, [registration, skipWaiting]);

  // Get service worker version
  const getSWVersion = useCallback(async () => {
    if (!registration) return null;

    try {
      const messageChannel = new MessageChannel();
      const versionPromise = new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };
      });

      registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
      return await versionPromise;
    } catch (error) {
      console.error('Failed to get SW version:', error);
      return null;
    }
  }, [registration]);

  // Cache URLs
  const cacheUrls = useCallback(async (urls) => {
    if (!registration) return false;

    try {
      const messageChannel = new MessageChannel();
      const resultPromise = new Promise((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            resolve(true);
          } else {
            reject(new Error(event.data.error));
          }
        };
      });

      registration.active.postMessage({
        type: 'CACHE_URLS',
        payload: { urls }
      }, [messageChannel.port2]);

      return await resultPromise;
    } catch (error) {
      console.error('Failed to cache URLs:', error);
      return false;
    }
  }, [registration]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (!registration) return false;

    try {
      const messageChannel = new MessageChannel();
      const resultPromise = new Promise((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            resolve(true);
          } else {
            reject(new Error(event.data.error));
          }
        };
      });

      registration.active.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
      return await resultPromise;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }, [registration]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!registration) return;

    try {
      await registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }, [registration]);

  // Handle online/offline status
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    console.log('App is online');
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    console.log('App is offline');
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      const newRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', newRegistration);

      // Handle updates
      newRegistration.addEventListener('updatefound', () => {
        const newWorker = newRegistration.installing;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            handleSWUpdate(newRegistration);
          }
        });
      });

      setRegistration(newRegistration);

      // Check if this is the first load
      if (!navigator.serviceWorker.controller) {
        console.log('First load - no SW controller yet');
      }

      return newRegistration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, [handleSWUpdate]);

  // Initialize PWA
  const initialize = useCallback(async () => {
    // Check installed status
    checkInstalled();

    // Register service worker
    await registerServiceWorker();

    // Start update checking interval
    updateIntervalRef.current = setInterval(() => {
      checkForUpdates();
    }, checkInterval);

    console.log('PWA initialized');
  }, [checkInstalled, registerServiceWorker, checkForUpdates, checkInterval]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installation
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize on mount
    initialize();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, [handleBeforeInstallPrompt, handleAppInstalled, handleOnline, handleOffline, initialize, cleanup]);

  // Handle service worker controller change (page refresh)
  useEffect(() => {
    const handleControllerChange = () => {
      console.log('Service Worker controller changed - reloading page');
      window.location.reload();
    };

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return {
    // State
    isInstallable,
    isInstalled,
    isUpdateAvailable,
    isOnline,
    registration,

    // Actions
    install,
    skipWaiting,
    applyUpdate,

    // Utilities
    getSWVersion,
    cacheUrls,
    clearCache,
    checkForUpdates,
    checkInstalled,

    // PWA capabilities
    supportsServiceWorker: 'serviceWorker' in navigator,
    supportsBeforeInstallPrompt: 'beforeinstallprompt' in window,
    supportsShareAPI: 'share' in navigator,
    supportsWakeLock: 'wakeLock' in navigator,

    // Browser compatibility
    isStandalone: checkInstalled(),
    isPWA: checkInstalled()
  };
};

export default usePWA;