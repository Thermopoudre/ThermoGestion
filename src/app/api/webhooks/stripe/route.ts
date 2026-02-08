import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'
import { notifyFacturePaid } from '@/lib/notifications/triggers'

// Initialiser Stripe seulement si la clé est disponible (évite les erreurs en build)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    })
  : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

// ─── Handler des événements ABONNEMENT SaaS ───

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const atelierId = subscription.metadata?.atelier_id
  const plan = subscription.metadata?.plan || 'pro'

  if (!atelierId) {
    console.warn('Subscription sans atelier_id dans metadata:', subscription.id)
    return
  }

  // Mettre à jour l'atelier avec le plan actif
  await supabase
    .from('ateliers')
    .update({
      plan: plan,
      stripe_subscription_id: subscription.id,
      subscription_status: 'active',
    })
    .eq('id', atelierId)

  // Créer/mettre à jour la table subscriptions
  const item = subscription.items.data[0]
  await supabase.from('subscriptions').upsert({
    atelier_id: atelierId,
    stripe_subscription_id: subscription.id,
    plan: plan,
    status: 'active',
    price_monthly: item ? (item.price.unit_amount || 0) / 100 : 0,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  }, { onConflict: 'atelier_id' })

  // Audit log
  await supabase.from('audit_logs').insert({
    atelier_id: atelierId,
    action: 'subscription_created',
    table_name: 'subscriptions',
    record_id: subscription.id,
    new_data: { plan, status: 'active' },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const atelierId = subscription.metadata?.atelier_id

  if (!atelierId) return

  const status = subscription.status === 'active' ? 'active'
    : subscription.status === 'past_due' ? 'past_due'
    : subscription.status === 'canceled' ? 'cancelled'
    : subscription.status

  const plan = subscription.metadata?.plan || 'pro'
  const item = subscription.items.data[0]

  // Mettre à jour l'atelier
  await supabase
    .from('ateliers')
    .update({
      plan: subscription.status === 'canceled' ? 'lite' : plan,
      subscription_status: status,
    })
    .eq('id', atelierId)

  // Mettre à jour subscription
  await supabase.from('subscriptions').upsert({
    atelier_id: atelierId,
    stripe_subscription_id: subscription.id,
    plan: plan,
    status: status,
    price_monthly: item ? (item.price.unit_amount || 0) / 100 : 0,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  }, { onConflict: 'atelier_id' })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const atelierId = subscription.metadata?.atelier_id

  if (!atelierId) return

  // Downgrade vers le plan gratuit/lite
  await supabase
    .from('ateliers')
    .update({
      plan: 'lite',
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
    })
    .eq('id', atelierId)

  await supabase.from('subscriptions').update({
    status: 'cancelled',
    cancel_at_period_end: false,
  }).eq('atelier_id', atelierId)

  // Audit
  await supabase.from('audit_logs').insert({
    atelier_id: atelierId,
    action: 'subscription_cancelled',
    table_name: 'subscriptions',
    record_id: subscription.id,
    new_data: { plan: 'lite', status: 'cancelled' },
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createAdminClient()
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) return

  // Trouver l'atelier par stripe_customer_id
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!atelier) return

  // Créer la facture SaaS interne
  await supabase.from('saas_invoices').insert({
    atelier_id: atelier.id,
    stripe_invoice_id: invoice.id,
    numero: invoice.number || `INV-${Date.now()}`,
    amount_ht: (invoice.subtotal || 0) / 100,
    amount_tva: ((invoice.tax || 0)) / 100,
    amount_ttc: (invoice.total || 0) / 100,
    status: 'paid',
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    pdf_url: invoice.invoice_pdf || null,
    hosted_url: invoice.hosted_invoice_url || null,
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createAdminClient()
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) return

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!atelier) return

  // Marquer l'abonnement en retard de paiement
  await supabase
    .from('ateliers')
    .update({ subscription_status: 'past_due' })
    .eq('id', atelier.id)

  await supabase.from('subscriptions').update({
    status: 'past_due',
  }).eq('atelier_id', atelier.id)

  // Créer une alerte
  await supabase.from('alertes').insert({
    atelier_id: atelier.id,
    type: 'payment_failed',
    titre: '⚠️ Échec de paiement de votre abonnement',
    message: 'Le paiement de votre abonnement ThermoGestion a échoué. Veuillez mettre à jour votre moyen de paiement.',
    lien: '/app/parametres/abonnement',
  })
}

// ─── Endpoint principal ───

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Erreur vérification webhook Stripe:', message)
      return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Traiter les événements
    switch (event.type) {
      // ─── ABONNEMENTS SaaS ───
      case 'customer.subscription.created': {
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // Ne traiter que les factures d'abonnement SaaS (pas les factures clients)
        if (invoice.subscription) {
          await handleInvoicePaid(invoice)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await handleInvoicePaymentFailed(invoice)
        }
        break
      }

      // ─── PAIEMENTS CLIENTS (factures atelier) ───
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

        // Si c'est un checkout d'abonnement SaaS, il est déjà géré par subscription.created
        if (session.mode === 'subscription') {
          break
        }

        // Sinon, c'est un paiement de facture client
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

      // ─── REMBOURSEMENTS ───
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = typeof charge.payment_intent === 'string' 
          ? charge.payment_intent 
          : charge.payment_intent?.id

        if (paymentIntentId) {
          // Chercher la facture liée
          const { data: facture } = await supabase
            .from('factures')
            .select('id, numero, atelier_id, client_id, total_ttc')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()

          if (facture) {
            const refundAmount = (charge.amount_refunded || 0) / 100
            const isFullRefund = refundAmount >= Number(facture.total_ttc)

            // Mettre à jour le statut de la facture
            await supabase
              .from('factures')
              .update({
                status: isFullRefund ? 'remboursee' : 'payee',
                payment_status: isFullRefund ? 'refunded' : 'partial',
                updated_at: new Date().toISOString(),
              })
              .eq('id', facture.id)

            // Créer une alerte pour l'atelier
            await supabase.from('alertes').insert({
              atelier_id: facture.atelier_id,
              type: 'remboursement',
              titre: `💸 Remboursement ${isFullRefund ? 'total' : 'partiel'} - ${facture.numero}`,
              message: `Remboursement de ${refundAmount.toFixed(2)} € effectué sur la facture ${facture.numero}`,
              lien: `/app/factures/${facture.id}`,
              data: { facture_id: facture.id, montant_rembourse: refundAmount },
            })

            // Log d'audit
            await supabase.from('audit_logs').insert({
              atelier_id: facture.atelier_id,
              action: 'stripe_refund',
              entity_type: 'facture',
              entity_id: facture.id,
              details: {
                facture_numero: facture.numero,
                montant_rembourse: refundAmount,
                remboursement_total: isFullRefund,
                charge_id: charge.id,
              },
            })
          }
        }
        break
      }

      // ─── LITIGES / DISPUTES ───
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = typeof dispute.charge === 'string' 
          ? dispute.charge 
          : dispute.charge?.id

        if (chargeId && stripe) {
          // Récupérer la charge pour trouver le payment_intent
          try {
            const charge = await stripe.charges.retrieve(chargeId)
            const paymentIntentId = typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id

            if (paymentIntentId) {
              const { data: facture } = await supabase
                .from('factures')
                .select('id, numero, atelier_id, total_ttc')
                .eq('stripe_payment_intent_id', paymentIntentId)
                .single()

              if (facture) {
                // Créer une alerte URGENTE
                await supabase.from('alertes').insert({
                  atelier_id: facture.atelier_id,
                  type: 'litige_stripe',
                  titre: `⚠️ LITIGE Stripe - ${facture.numero}`,
                  message: `Un litige a été ouvert par le client pour la facture ${facture.numero} (${Number(facture.total_ttc).toFixed(2)} €). Raison : ${dispute.reason || 'non spécifiée'}. Vous devez répondre rapidement via le dashboard Stripe.`,
                  lien: `/app/factures/${facture.id}`,
                  data: {
                    facture_id: facture.id,
                    dispute_id: dispute.id,
                    reason: dispute.reason,
                    amount: (dispute.amount || 0) / 100,
                  },
                })

                // Log d'audit
                await supabase.from('audit_logs').insert({
                  atelier_id: facture.atelier_id,
                  action: 'stripe_dispute',
                  entity_type: 'facture',
                  entity_id: facture.id,
                  details: {
                    facture_numero: facture.numero,
                    dispute_id: dispute.id,
                    reason: dispute.reason,
                    amount: (dispute.amount || 0) / 100,
                    status: dispute.status,
                  },
                })
              }
            }
          } catch (err) {
            console.error('Erreur traitement dispute:', err)
          }
        }
        break
      }

      default:
        console.log(`Événement Stripe non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    console.error('Erreur webhook Stripe:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
