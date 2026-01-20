// Service Worker pour notifications push

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'ThermoGestion'
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo-icon.svg',
    badge: data.badge || '/logo-icon.svg',
    data: data.data || {},
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    )
  }
})
