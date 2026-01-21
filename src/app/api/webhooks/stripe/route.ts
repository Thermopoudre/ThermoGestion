import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { notifyFacturePaid } from '@/lib/notifications/triggers'

// Initialiser Stripe seulement si la clé est disponible (évite les erreurs en build)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia' as any,
    })
  : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(request: Request) {
  try {
    // Si Stripe n'est pas configuré, retourner une erreur
    if (!stripe) {
      console.warn('Stripe webhook called but STRIPE_SECRET_KEY is not configured')
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Erreur vérification webhook Stripe:', err)
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Traiter les événements
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Chercher la facture liée
        const { data: facture } = await supabase
          .from('factures')
          .select('*, ateliers(id)')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single()

        if (facture) {
          // Mettre à jour le statut de la facture
          await supabase
            .from('factures')
            .update({
              status: 'payee',
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', facture.id)

          // Créer l'enregistrement de paiement
          await supabase.from('paiements').insert({
            atelier_id: facture.atelier_id,
            facture_id: facture.id,
            client_id: facture.client_id,
            type: 'complete',
            amount: Number(facture.total_ttc),
            payment_method: 'stripe',
            stripe_payment_intent_id: paymentIntent.id,
            status: 'completed',
            paid_at: new Date().toISOString(),
          })

          // Notifier les utilisateurs
          if (facture.ateliers) {
            await notifyFacturePaid(facture.atelier_id, facture)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Chercher la facture liée
        const { data: facture } = await supabase
          .from('factures')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single()

        if (facture) {
          // Mettre à jour le statut
          await supabase
            .from('factures')
            .update({
              payment_status: 'unpaid',
            })
            .eq('id', facture.id)
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        let facture = null

        // Chercher la facture par metadata (nouveau flow)
        if (session.metadata?.facture_id) {
          const { data } = await supabase
            .from('factures')
            .select('*, ateliers(id)')
            .eq('id', session.metadata.facture_id)
            .single()
          facture = data
        }
        // Ou par Payment Link (ancien flow)
        else if (session.payment_link) {
          const { data } = await supabase
            .from('factures')
            .select('*, ateliers(id)')
            .eq('stripe_payment_link_id', session.payment_link)
            .single()
          facture = data
        }
        // Ou par client_reference_id
        else if (session.client_reference_id) {
          const { data } = await supabase
            .from('factures')
            .select('*, ateliers(id)')
            .eq('id', session.client_reference_id)
            .single()
          facture = data
        }

        if (facture && session.payment_status === 'paid') {
          // Mettre à jour le statut
          await supabase
            .from('factures')
            .update({
              status: 'payee',
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', facture.id)

          // Créer l'enregistrement de paiement
          await supabase.from('paiements').insert({
            atelier_id: facture.atelier_id,
            facture_id: facture.id,
            client_id: facture.client_id,
            type: 'complete',
            amount: Number(facture.total_ttc),
            payment_method: 'stripe',
            stripe_payment_intent_id: session.payment_intent as string,
            status: 'completed',
            paid_at: new Date().toISOString(),
          })

          // Créer une alerte pour l'atelier
          await supabase.from('alertes').insert({
            atelier_id: facture.atelier_id,
            type: 'paiement_recu',
            titre: `💰 Paiement reçu - ${facture.numero}`,
            message: `La facture ${facture.numero} a été payée en ligne (${Number(facture.total_ttc).toFixed(2)} €)`,
            lien: `/app/factures/${facture.id}`,
            data: { facture_id: facture.id, montant: facture.total_ttc },
          })

          // Notifier
          if (facture.ateliers) {
            await notifyFacturePaid(facture.atelier_id, facture)
          }
        }
        break
      }

      default:
        console.log(`Événement non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Erreur webhook Stripe:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement du webhook' },
      { status: 500 }
    )
  }
}
