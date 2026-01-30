// ThermoGestion Service Worker
// Version 1.0.0

const CACHE_NAME = 'thermogestion-v1';
const OFFLINE_URL = '/offline';

// Resources to cache immediately on install
const PRECACHE_RESOURCES = [
  '/',
  '/app/dashboard',
  '/offline',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fallback to cache
  networkFirst: [
    '/api/',
    '/app/',
  ],
  // Cache first, fallback to network
  cacheFirst: [
    '/icons/',
    '/images/',
    '/_next/static/',
    '/fonts/',
  ],
  // Stale while revalidate
  staleWhileRevalidate: [
    '/status',
    '/securite',
    '/api-docs',
  ],
};

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Determine cache strategy
  let strategy = 'networkFirst'; // Default
  
  for (const [strat, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => url.pathname.startsWith(pattern))) {
      strategy = strat;
      break;
    }
  }
  
  event.respondWith(handleFetch(request, strategy));
});

// Handle fetch with different strategies
async function handleFetch(request, strategy) {
  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'networkFirst':
      return networkFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    default:
      return networkFirst(request);
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
});

// Sync pending data when back online
async function syncPendingData() {
  console.log('[SW] Syncing pending data...');
  
  // Get pending data from IndexedDB
  const pendingData = await getPendingDataFromDB();
  
  for (const item of pendingData) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      
      if (response.ok) {
        await removePendingDataFromDB(item.id);
        console.log('[SW] Synced:', item.id);
      }
    } catch (error) {
      console.error('[SW] Sync failed for:', item.id, error);
    }
  }
}

// Helper function - would need IndexedDB implementation
async function getPendingDataFromDB() {
  // Placeholder - implement with IndexedDB
  return [];
}

async function removePendingDataFromDB(id) {
  // Placeholder - implement with IndexedDB
  console.log('[SW] Removed from pending:', id);
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = { title: 'ThermoGestion', body: 'Nouvelle notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/app/dashboard',
    },
    actions: data.actions || [],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if a window is already open
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});

// Periodic sync for background updates
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'update-dashboard') {
    event.waitUntil(updateDashboardCache());
  }
});

async function updateDashboardCache() {
  console.log('[SW] Updating dashboard cache...');
  
  try {
    const response = await fetch('/api/dashboard-data');
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/api/dashboard-data', response);
    }
  } catch (error) {
    console.error('[SW] Dashboard cache update failed:', error);
  }
}

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
    );
  }
});

console.log('[SW] Service Worker loaded');
