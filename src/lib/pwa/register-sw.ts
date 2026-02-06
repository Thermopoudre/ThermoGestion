// Service Worker Registration

export async function registerServiceWorker() {
  if (typeof window === 'undefined') return
  
  if (!('serviceWorker' in navigator)) {
    // Service workers not supported
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })

    // SW registered

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        // New SW installing
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            // New version available
            showUpdateNotification(registration)
          }
        })
      }
    })

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Controller changed
      window.location.reload()
    })

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
  }
}

// Show update notification
function showUpdateNotification(registration: ServiceWorkerRegistration) {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-slide-up'
  
  notification.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="font-bold text-gray-900 dark:text-white">Mise à jour disponible</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Une nouvelle version de ThermoGestion est disponible.
        </p>
        <div class="flex gap-2 mt-3">
          <button id="pwa-update-btn" class="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600">
            Mettre à jour
          </button>
          <button id="pwa-dismiss-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(notification)
  
  // Handle update button click
  document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    notification.remove()
  })
  
  // Handle dismiss button click
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
    notification.remove()
  })
}

// Unregister service worker
export async function unregisterServiceWorker() {
  if (typeof window === 'undefined') return
  
  if (!('serviceWorker' in navigator)) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  
  for (const registration of registrations) {
    await registration.unregister()
    // SW unregistered
  }
}

// Check if app is installed as PWA
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false
  
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  
  if (!navigator.storage || !navigator.storage.persist) {
    // Persistent storage not supported
    return false
  }

  const isPersisted = await navigator.storage.persisted()
  
  if (isPersisted) {
    // Storage already persisted
    return true
  }

  const result = await navigator.storage.persist()
  // Persistent storage result
  
  return result
}

// Get storage estimate
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof window === 'undefined') return null
  
  if (!navigator.storage || !navigator.storage.estimate) {
    return null
  }

  const estimate = await navigator.storage.estimate()
  
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  }
}

// Clear all cached data
export async function clearCache(): Promise<void> {
  if (typeof window === 'undefined') return
  
  const cacheNames = await caches.keys()
  
  for (const cacheName of cacheNames) {
    await caches.delete(cacheName)
  }
  
  // Cache cleared
}

// Background sync registration
export async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    // Background sync not supported
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await (registration as any).sync.register(tag)
    // Background sync registered
    return true
  } catch (error) {
    console.error('[PWA] Background sync registration failed:', error)
    return false
  }
}
