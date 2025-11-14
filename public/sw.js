// Enhanced Service Worker for Claude Code UI PWA
const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `claude-ui-v${CACHE_VERSION}`;

// Cache strategies
const STATIC_CACHE = 'claude-static-v2';
const API_CACHE = 'claude-api-v2';
const RUNTIME_CACHE = 'claude-runtime-v2';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Core CSS and JS
  '/dist/',
  // Essential images and icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = ['/api/projects', '/api/auth/status', '/api/settings'];

// Runtime cache patterns
const RUNTIME_PATTERNS = [
  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i, // Images
  /\.(woff|woff2|ttf|eot)$/i, // Fonts
  /\.(css|js)$/i, // Stylesheets and scripts
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),

      // Pre-warm API cache
      caches.open(API_CACHE).then(cache => {
        console.log('[SW] Initializing API cache');
        return cache.addAll(API_ENDPOINTS.map(url => new Request(url, { method: 'GET' })));
      }),
    ])
  );

  // Force activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== API_CACHE &&
            cacheName !== RUNTIME_CACHE
          ) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// Network utilities
const isOnline = () => navigator.onLine;

const networkFirst = async (request, cacheName = API_CACHE) => {
  try {
    console.log(`[SW] Network-first: ${request.url}`);

    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache the successful response
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log(`[SW] Network failed for ${request.url}, trying cache: ${error.message}`);
  }

  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Return offline fallback for GET requests
  if (request.method === 'GET') {
    return new Response('Offline - No cached version available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  }

  throw new Error('Network request failed and no cache available');
};

const cacheFirst = async (request, cacheName = RUNTIME_CACHE) => {
  console.log(`[SW] Cache-first: ${request.url}`);

  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fallback to network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log(`[SW] Network failed for cache-first request: ${error.message}`);
  }

  // Return offline fallback for static assets
  if (request.method === 'GET' && RUNTIME_PATTERNS.some(pattern => pattern.test(request.url))) {
    return new Response('Asset not available offline', {
      status: 404,
      statusText: 'Not Found',
    });
  }

  throw new Error('Cache miss and network unavailable');
};

const staleWhileRevalidate = async request => {
  console.log(`[SW] Stale-while-revalidate: ${request.url}`);

  // Get cached version immediately
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  // Start network request in background
  const networkPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.log(`[SW] Background fetch failed: ${error.message}`);
    });

  // Return cached version if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // If no cache, wait for network
  return networkPromise;
};

// Determine cache strategy based on request
const getCacheStrategy = request => {
  const url = new URL(request.url);

  // API requests - Network First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    return { strategy: networkFirst, cacheName: API_CACHE };
  }

  // WebSocket connections - No caching
  if (url.pathname.startsWith('/ws/') || request.url.includes('websocket')) {
    return { strategy: null };
  }

  // Static assets - Cache First
  if (
    STATIC_ASSETS.includes(url.pathname) ||
    RUNTIME_PATTERNS.some(pattern => pattern.test(url.pathname))
  ) {
    return { strategy: cacheFirst, cacheName: RUNTIME_CACHE };
  }

  // HTML pages - Stale While Revalidate
  if (request.headers.get('Accept')?.includes('text/html')) {
    return { strategy: staleWhileRevalidate, cacheName: STATIC_CACHE };
  }

  // Default - Network First
  return { strategy: networkFirst, cacheName: RUNTIME_CACHE };
};

// Main fetch event handler
self.addEventListener('fetch', event => {
  const { strategy, cacheName } = getCacheStrategy(event.request);

  // Skip non-GET requests and WebSocket connections
  if (!strategy || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(strategy(event.request, cacheName));
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log(`[SW] Background sync: ${event.tag}`);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline queued actions
      processOfflineQueue()
    );
  }
});

// Push notification handling
self.addEventListener('push', event => {
  console.log('[SW] Push message received');

  const options = {
    body: 'You have new updates in Claude Code UI',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'claude-ui-update',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/action-open.png',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/action-dismiss.png',
      },
    ],
  };

  // Handle custom push data
  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || options.body;
      options.title = data.title || 'Claude Code UI';
      options.data = data.data || {};
    } catch (error) {
      console.log('[SW] Error parsing push data:', error);
    }
  }

  event.waitUntil(self.registration.showNotification(options.title || 'Claude Code UI', options));
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handling for communication with main app
self.addEventListener('message', event => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;

    case 'CACHE_URLS':
      cacheUrls(payload.urls)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case 'CLEAR_CACHE':
      clearCache()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    default:
      console.log(`[SW] Unknown message type: ${type}`);
  }
});

// Utility functions
const cacheUrls = async (urls, cacheName = RUNTIME_CACHE) => {
  const cache = await caches.open(cacheName);
  return cache.addAll(urls.map(url => new Request(url)));
};

const clearCache = async () => {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
};

const processOfflineQueue = async () => {
  // Process queued offline actions
  console.log('[SW] Processing offline queue...');

  try {
    const offlineActions = await getOfflineActions();

    for (const action of offlineActions) {
      try {
        await fetch(action.url, action.options);
        console.log(`[SW] Processed offline action: ${action.type}`);
      } catch (error) {
        console.error(`[SW] Failed to process offline action: ${error.message}`);
      }
    }

    await clearOfflineActions();
  } catch (error) {
    console.error(`[SW] Error processing offline queue: ${error.message}`);
  }
};

const getOfflineActions = async () => {
  // Get queued offline actions from IndexedDB
  return []; // Implement IndexedDB storage for offline actions
};

const clearOfflineActions = async () => {
  // Clear processed offline actions from IndexedDB
  return Promise.resolve();
};

// Periodic sync for cache updates
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'cache-update') {
    event.waitUntil(updateCriticalCache());
  }
});

const updateCriticalCache = async () => {
  try {
    console.log('[SW] Updating critical cache...');

    // Update static assets
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.all(
      STATIC_ASSETS.map(url =>
        fetch(url)
          .then(response => {
            if (response.ok) {
              return staticCache.put(url, response);
            }
          })
          .catch(error => {
            console.log(`[SW] Failed to update ${url}: ${error.message}`);
          })
      )
    );

    // Update API cache
    const apiCache = await caches.open(API_CACHE);
    await Promise.all(
      API_ENDPOINTS.map(url =>
        fetch(new Request(url, { method: 'GET' }))
          .then(response => {
            if (response.ok) {
              return apiCache.put(url, response);
            }
          })
          .catch(error => {
            console.log(`[SW] Failed to update API ${url}: ${error.message}`);
          })
      )
    );

    console.log('[SW] Cache update completed');
  } catch (error) {
    console.error(`[SW] Cache update failed: ${error.message}`);
  }
};

// Error handling
self.addEventListener('error', event => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log(`[SW] Claude Code UI Service Worker v${CACHE_VERSION} loaded`);
