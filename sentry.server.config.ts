import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ne pas capturer les données sensibles
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    // Masquer les IPs
    if (event.user) {
      delete event.user.ip_address
    }
    return event
  },
})
