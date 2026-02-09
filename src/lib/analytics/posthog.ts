/**
 * Product Analytics — PostHog Integration
 * Documentation: https://posthog.com/docs
 * 
 * Variables d'environnement:
 * - NEXT_PUBLIC_POSTHOG_KEY
 * - NEXT_PUBLIC_POSTHOG_HOST (default: https://eu.posthog.com)
 */

type PostHogClient = {
  capture: (event: string, properties?: Record<string, any>) => void
  identify: (distinctId: string, properties?: Record<string, any>) => void
  group: (type: string, key: string, properties?: Record<string, any>) => void
  reset: () => void
  isFeatureEnabled: (flag: string) => boolean | undefined
}

let posthogInstance: PostHogClient | null = null

/**
 * Initialise PostHog côté client
 */
export function initPostHog(): PostHogClient | null {
  if (typeof window === 'undefined') return null
  
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    console.debug('[Analytics] PostHog non configuré')
    return null
  }

  // Lazy import pour ne pas bloquer le bundle
  if (!posthogInstance) {
    try {
      // PostHog sera chargé dynamiquement
      posthogInstance = {
        capture: (event, properties) => {
          if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.capture(event, properties)
          }
        },
        identify: (distinctId, properties) => {
          if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.identify(distinctId, properties)
          }
        },
        group: (type, key, properties) => {
          if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.group(type, key, properties)
          }
        },
        reset: () => {
          if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.reset()
          }
        },
        isFeatureEnabled: (flag) => {
          if (typeof window !== 'undefined' && (window as any).posthog) {
            return (window as any).posthog.isFeatureEnabled(flag)
          }
          return undefined
        },
      }
    } catch {
      return null
    }
  }

  return posthogInstance
}

/**
 * Script PostHog à injecter dans le <head>
 */
export function getPostHogScript(): string {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com'
  
  if (!key) return ''

  return `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${key}', {api_host: '${host}', capture_pageview: true, capture_pageleave: true, autocapture: true});
  `
}

/**
 * Événements métier prédéfinis pour le thermolaquage
 */
export const ANALYTICS_EVENTS = {
  // Projets
  PROJECT_CREATED: 'project_created',
  PROJECT_STATUS_CHANGED: 'project_status_changed',
  PROJECT_COMPLETED: 'project_completed',
  PROJECT_QUALITY_CHECK: 'project_quality_check',
  
  // Devis
  QUOTE_CREATED: 'quote_created',
  QUOTE_SENT: 'quote_sent',
  QUOTE_SIGNED: 'quote_signed',
  QUOTE_REFUSED: 'quote_refused',
  QUOTE_EXPIRED: 'quote_expired',
  
  // Factures
  INVOICE_CREATED: 'invoice_created',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_OVERDUE: 'invoice_overdue',
  
  // Fonctionnalités
  FEATURE_USED: 'feature_used',
  BATCHING_STARTED: 'batching_started',
  LABEL_PRINTED: 'label_printed',
  MAINTENANCE_COMPLETED: 'maintenance_completed',
  STOCK_ALERT: 'stock_alert',
  EXPORT_GENERATED: 'export_generated',
  
  // Commercial
  FOLLOW_UP_SENT: 'follow_up_sent',
  CLIENT_PRICING_SET: 'client_pricing_set',
  PUBLIC_QUOTE_REQUEST: 'public_quote_request',
  
  // Engagement
  USER_LOGIN: 'user_login',
  USER_ONBOARDING_COMPLETE: 'user_onboarding_complete',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
} as const

/**
 * Tracker un événement métier
 */
export function trackEvent(
  event: string, 
  properties?: Record<string, any>
): void {
  const ph = initPostHog()
  if (ph) {
    ph.capture(event, {
      ...properties,
      timestamp: new Date().toISOString(),
      source: 'web',
    })
  }
}

/**
 * Identifier un utilisateur
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, any>
): void {
  const ph = initPostHog()
  if (ph) {
    ph.identify(userId, properties)
  }
}

/**
 * Associer un utilisateur à un atelier (group analytics)
 */
export function setUserAtelier(
  atelierId: string,
  properties?: Record<string, any>
): void {
  const ph = initPostHog()
  if (ph) {
    ph.group('atelier', atelierId, properties)
  }
}
