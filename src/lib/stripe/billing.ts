import Stripe from 'stripe'

/**
 * Instance Stripe singleton pour le billing SaaS.
 * Retourne null si la clé n'est pas configurée (évite les erreurs en dev/build).
 */
function createStripeInstance(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  })
}

let _stripe: Stripe | null | undefined
export function getStripe(): Stripe | null {
  if (_stripe === undefined) {
    _stripe = createStripeInstance()
  }
  return _stripe
}

/**
 * Plans SaaS disponibles.
 */
export const PLANS = {
  trial: {
    name: 'Essai gratuit',
    features: ['Toutes les fonctionnalités Pro', '30 jours gratuits', 'Support email'],
    priceMonthly: 0,
  },
  lite: {
    name: 'Plan Lite',
    features: [
      'Gestion clients (CRM)',
      'Devis & factures',
      'Suivi projets',
      'Stock basique',
      '20 Go stockage photos',
      'Support email',
    ],
    priceMonthly: 29,
  },
  pro: {
    name: 'Plan Pro',
    features: [
      'Tout le Plan Lite',
      'Séries & regroupement optimisé',
      'Stock intelligent (pesées, écarts)',
      'Reporting avancé',
      'Retouches & non-conformités',
      'Portail client',
      'Templates devis personnalisables',
      'Intégrations (Stripe Connect, email)',
      'Support prioritaire',
    ],
    priceMonthly: 49,
  },
} as const

export type PlanType = keyof typeof PLANS

/**
 * Récupère le Stripe Price ID pour un plan donné.
 */
export function getStripePriceId(plan: 'lite' | 'pro'): string | null {
  if (plan === 'lite') return process.env.STRIPE_PRICE_LITE || null
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO || null
  return null
}

/**
 * Crée ou récupère un Stripe Customer pour un atelier.
 */
export async function getOrCreateStripeCustomer(
  atelierId: string,
  email: string,
  atelierName: string,
  existingStripeCustomerId?: string | null
): Promise<string | null> {
  const stripe = getStripe()
  if (!stripe) return null

  // Si un customer ID existe déjà, le retourner
  if (existingStripeCustomerId) {
    try {
      await stripe.customers.retrieve(existingStripeCustomerId)
      return existingStripeCustomerId
    } catch {
      // Customer supprimé côté Stripe, on en recrée un
    }
  }

  // Créer un nouveau customer
  const customer = await stripe.customers.create({
    email,
    name: atelierName,
    metadata: {
      atelier_id: atelierId,
    },
  })

  return customer.id
}

/**
 * Crée une session Stripe Checkout pour un abonnement SaaS.
 */
export async function createCheckoutSession(params: {
  stripeCustomerId: string
  plan: 'lite' | 'pro'
  atelierId: string
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const priceId = getStripePriceId(params.plan)
  if (!priceId) {
    throw new Error(`Prix Stripe non configuré pour le plan ${params.plan}`)
  }

  const session = await stripe.checkout.sessions.create({
    customer: params.stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      atelier_id: params.atelierId,
      plan: params.plan,
    },
    subscription_data: {
      metadata: {
        atelier_id: params.atelierId,
        plan: params.plan,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
  })

  return session
}

/**
 * Crée une session Stripe Customer Portal pour gérer l'abonnement.
 */
export async function createPortalSession(params: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<Stripe.BillingPortal.Session | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  })

  return session
}

/**
 * Annule un abonnement Stripe (fin de période en cours).
 */
export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  return subscription
}
