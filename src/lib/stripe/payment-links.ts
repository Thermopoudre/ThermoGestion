// Utilitaires pour créer des liens de paiement Stripe

import Stripe from 'stripe'
import type { Database } from '@/types/database.types'

type Facture = Database['public']['Tables']['factures']['Row']

// Initialiser Stripe
let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY non configurée')
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    })
  }
  return stripeInstance
}

/**
 * Créer un lien de paiement Stripe pour une facture
 */
export async function createPaymentLink(
  facture: Facture,
  amount: number, // Montant à payer (peut être différent du total si acompte)
  description?: string
): Promise<{ success: boolean; paymentLinkId?: string; paymentLinkUrl?: string; error?: string }> {
  try {
    const stripe = getStripeClient()

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Facture ${facture.numero}`,
              description: description || `Paiement facture ${facture.numero}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe utilise les centimes
          },
          quantity: 1,
        },
      ],
      metadata: {
        facture_id: facture.id,
        facture_numero: facture.numero,
        type: facture.type,
      },
    })

    return {
      success: true,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    }
  } catch (error: any) {
    console.error('Erreur création lien paiement Stripe:', error)
    return {
      success: false,
      error: error.message || 'Erreur lors de la création du lien de paiement',
    }
  }
}

/**
 * Créer un lien de paiement pour acompte
 */
export async function createAcomptePaymentLink(
  facture: Facture,
  acompteAmount: number
): Promise<{ success: boolean; paymentLinkId?: string; paymentLinkUrl?: string; error?: string }> {
  return createPaymentLink(
    facture,
    acompteAmount,
    `Acompte facture ${facture.numero}`
  )
}

/**
 * Créer un lien de paiement pour solde
 */
export async function createSoldePaymentLink(
  facture: Facture,
  soldeAmount: number
): Promise<{ success: boolean; paymentLinkId?: string; paymentLinkUrl?: string; error?: string }> {
  return createPaymentLink(
    facture,
    soldeAmount,
    `Solde facture ${facture.numero}`
  )
}
