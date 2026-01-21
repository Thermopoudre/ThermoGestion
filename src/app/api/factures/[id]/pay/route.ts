import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialiser Stripe seulement si la clé est disponible
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
    })
  : null

// Créer une session de paiement Stripe pour une facture
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier que Stripe est configuré
    if (!stripe) {
      return NextResponse.json(
        { error: 'Paiement en ligne non configuré. Contactez l\'atelier.' },
        { status: 503 }
      )
    }

    const supabase = await createServerClient()

    // Récupérer la facture avec client et atelier
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        clients (
          id,
          full_name,
          email
        ),
        ateliers (
          id,
          name,
          stripe_account_id
        )
      `)
      .eq('id', params.id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Vérifier que la facture n'est pas déjà payée
    if (facture.status === 'payee') {
      return NextResponse.json({ error: 'Facture déjà payée' }, { status: 400 })
    }

    // Vérifier qu'on a un email client
    const client = facture.clients as any
    if (!client?.email) {
      return NextResponse.json({ error: 'Email client manquant' }, { status: 400 })
    }

    const atelier = facture.ateliers as any
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'

    // Vérifier que l'atelier a connecté son compte Stripe
    if (!atelier?.stripe_account_id) {
      return NextResponse.json(
        { error: 'L\'atelier n\'a pas encore configuré le paiement en ligne. Contactez-les.' },
        { status: 400 }
      )
    }

    // Générer le token public pour la facture si pas déjà fait
    let publicToken = facture.public_token
    if (!publicToken) {
      publicToken = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
      await supabase
        .from('factures')
        .update({ public_token: publicToken })
        .eq('id', facture.id)
    }

    // Créer la session Stripe Checkout avec Stripe Connect
    // Le paiement ira directement sur le compte de l'atelier
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'payment',
      customer_email: client.email,
      client_reference_id: facture.id,
      metadata: {
        facture_id: facture.id,
        facture_numero: facture.numero,
        atelier_id: facture.atelier_id,
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(Number(facture.total_ttc) * 100), // Stripe utilise les centimes
            product_data: {
              name: `Facture ${facture.numero}`,
              description: `${atelier?.name || 'Atelier'} - Prestation thermolaquage`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/paiement/success?session_id={CHECKOUT_SESSION_ID}&facture=${facture.id}`,
      cancel_url: `${baseUrl}/paiement/cancel?facture=${facture.id}`,
      // Expire dans 30 minutes
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, {
      // Stripe Connect: envoyer le paiement directement au compte de l'atelier
      stripeAccount: atelier.stripe_account_id,
    })

    // Sauvegarder l'ID de session pour référence
    await supabase
      .from('factures')
      .update({ 
        stripe_session_id: session.id,
        payment_initiated_at: new Date().toISOString(),
      })
      .eq('id', facture.id)

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    })
  } catch (error: any) {
    console.error('Erreur création session paiement:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du paiement' },
      { status: 500 }
    )
  }
}
