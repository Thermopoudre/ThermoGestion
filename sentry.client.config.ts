import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ajuster le taux d'échantillonnage en production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  
  // Capture les replays en production pour le debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Activer uniquement si le DSN est configuré
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ne pas envoyer les données personnelles
  beforeSend(event) {
    // Retirer les données sensibles (emails, tokens)
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  },

  // Ignorer certaines erreurs de bruit
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error exception captured',
    'Load failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
  ],
})
