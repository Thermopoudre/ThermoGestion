import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Intégration GoCardless pour paiements SEPA
 * Documentation: https://developer.gocardless.com/
 * 
 * Endpoints:
 * - GET: Vérifier la connexion et lister les mandats
 * - POST: Créer un mandat SEPA ou un paiement
 */

const GOCARDLESS_API_URL = process.env.GOCARDLESS_SANDBOX 
  ? 'https://api-sandbox.gocardless.com'
  : 'https://api.gocardless.com'

async function getGoCardlessToken(atelierId: string): Promise<string | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('ateliers')
    .select('integrations')
    .eq('id', atelierId)
    .single()

  return (data?.integrations as any)?.gocardless_token || null
}

// GET - Statut connexion + mandats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.id).single()
    if (!userData?.atelier_id) return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })

    const token = await getGoCardlessToken(userData.atelier_id)

    if (!token) {
      return NextResponse.json({
        connected: false,
        message: 'Aucun token GoCardless configuré. Ajoutez votre clé API dans Paramètres > Intégrations.',
        setup_url: 'https://manage.gocardless.com/developers/access-tokens',
      })
    }

    // Vérifier la connexion
    const response = await fetch(`${GOCARDLESS_API_URL}/creditors`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'GoCardless-Version': '2015-07-06',
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      const creditor = data.creditors?.[0]
      return NextResponse.json({
        connected: true,
        creditor_name: creditor?.name || 'Compte GoCardless',
        scheme: creditor?.scheme_identifiers?.[0]?.name || 'SEPA',
      })
    }

    return NextResponse.json({ connected: false, message: 'Token GoCardless invalide' })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Actions SEPA
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.id).single()
    if (!userData?.atelier_id) return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })

    const token = await getGoCardlessToken(userData.atelier_id)
    if (!token) return NextResponse.json({ error: 'Token GoCardless non configuré' }, { status: 400 })

    const body = await request.json()
    const { action } = body

    if (action === 'create_mandate_link') {
      // Créer un lien de mandat SEPA pour un client
      const { client_email, client_name, description } = body

      // 1. Créer le customer
      const customerRes = await fetch(`${GOCARDLESS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customers: {
            email: client_email,
            given_name: client_name.split(' ')[0] || client_name,
            family_name: client_name.split(' ').slice(1).join(' ') || '',
            country_code: 'FR',
          }
        }),
      })

      if (!customerRes.ok) {
        const err = await customerRes.text()
        return NextResponse.json({ error: `Erreur création client: ${err}` }, { status: 400 })
      }

      const customer = await customerRes.json()
      const customerId = customer.customers?.id

      // 2. Créer le redirect flow pour le mandat
      const redirectRes = await fetch(`${GOCARDLESS_API_URL}/redirect_flows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect_flows: {
            description: description || 'Mandat de prélèvement SEPA - Thermolaquage',
            session_token: `tg-${userData.atelier_id}-${Date.now()}`,
            success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.fr'}/app/parametres/paiement?sepa=success`,
            scheme: 'sepa_core',
          }
        }),
      })

      if (redirectRes.ok) {
        const redirect = await redirectRes.json()
        return NextResponse.json({
          mandate_url: redirect.redirect_flows?.redirect_url,
          flow_id: redirect.redirect_flows?.id,
        })
      }

      return NextResponse.json({ error: 'Erreur création mandat' }, { status: 400 })
    }

    if (action === 'create_payment') {
      // Créer un paiement SEPA
      const { mandate_id, amount_cents, description, facture_id } = body

      const paymentRes = await fetch(`${GOCARDLESS_API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payments: {
            amount: amount_cents, // En centimes
            currency: 'EUR',
            description: description || 'Facture thermolaquage',
            metadata: {
              facture_id: facture_id,
              atelier_id: userData.atelier_id,
            },
            links: {
              mandate: mandate_id,
            },
          }
        }),
      })

      if (paymentRes.ok) {
        const payment = await paymentRes.json()
        return NextResponse.json({
          payment_id: payment.payments?.id,
          status: payment.payments?.status,
          charge_date: payment.payments?.charge_date,
        })
      }

      const err = await paymentRes.text()
      return NextResponse.json({ error: `Erreur paiement: ${err}` }, { status: 400 })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
