import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe Connect - Créer un compte connecté pour l'atelier
// Doc: https://stripe.com/docs/connect/standard-accounts

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
  : null

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe non configuré. Contactez le support.' },
        { status: 503 }
      )
    }

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Charger l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('id, name, email, stripe_account_id')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'

    let accountId = atelier.stripe_account_id

    // Créer un compte Stripe Connect si pas déjà fait
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'FR',
        email: atelier.email || undefined,
        business_profile: {
          name: atelier.name,
        },
        metadata: {
          atelier_id: atelier.id,
        },
      })

      accountId = account.id

      // Sauvegarder l'ID du compte
      await supabase
        .from('ateliers')
        .update({
          stripe_account_id: accountId,
          stripe_account_status: 'onboarding',
        })
        .eq('id', atelier.id)
    }

    // Créer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/app/parametres/integrations?stripe=refresh`,
      return_url: `${baseUrl}/app/parametres/integrations?stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({
      url: accountLink.url,
    })
  } catch (error: any) {
    console.error('Erreur Stripe Connect:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la connexion Stripe' },
      { status: 500 }
    )
  }
}
