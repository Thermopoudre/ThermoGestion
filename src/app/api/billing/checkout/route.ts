import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createCheckoutSession, getOrCreateStripeCustomer } from '@/lib/stripe/billing'

/**
 * POST /api/billing/checkout
 * Crée une session Stripe Checkout pour un abonnement SaaS (Lite ou Pro).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer l'utilisateur et son atelier
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Seuls owner et admin peuvent changer le plan
    if (!['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 })
    }

    const body = await request.json()
    const { plan } = body

    if (!plan || !['lite', 'pro'].includes(plan)) {
      return NextResponse.json(
        { error: 'Plan invalide. Valeurs acceptées : lite, pro' },
        { status: 400 }
      )
    }

    // Récupérer l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('id, name, email, stripe_customer_id')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Créer ou récupérer le Stripe Customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      atelier.id,
      atelier.email || user.email || '',
      atelier.name,
      atelier.stripe_customer_id
    )

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'Stripe non configuré. Contactez le support.' },
        { status: 503 }
      )
    }

    // Sauvegarder le customer ID si nouveau
    if (stripeCustomerId !== atelier.stripe_customer_id) {
      await supabase
        .from('ateliers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', atelier.id)
    }

    // Créer la session Checkout
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createCheckoutSession({
      stripeCustomerId,
      plan,
      atelierId: atelier.id,
      successUrl: `${appUrl}/app/parametres/abonnement?success=true&plan=${plan}`,
      cancelUrl: `${appUrl}/app/parametres/abonnement?cancelled=true`,
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    console.error('Erreur checkout billing:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
