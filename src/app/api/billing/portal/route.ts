import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createPortalSession } from '@/lib/stripe/billing'

/**
 * POST /api/billing/portal
 * Crée une session Stripe Customer Portal pour gérer l'abonnement.
 * Permet à l'atelier de : modifier moyen de paiement, consulter factures, annuler.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Seuls owner et admin peuvent accéder au portail billing
    if (!['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 })
    }

    // Récupérer le stripe_customer_id de l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('stripe_customer_id')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif. Souscrivez d\'abord à un plan.' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createPortalSession({
      stripeCustomerId: atelier.stripe_customer_id,
      returnUrl: `${appUrl}/app/parametres/abonnement`,
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Stripe non configuré' },
        { status: 503 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    console.error('Erreur portal billing:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
