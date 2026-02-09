import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Intégration Pennylane API
 * Documentation: https://pennylane.com/api/docs
 * 
 * Endpoints:
 * - GET: Vérifier la connexion Pennylane
 * - POST: Synchroniser les factures vers Pennylane
 */

const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v1'

async function getPennylaneToken(atelierId: string): Promise<string | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('ateliers')
    .select('integrations')
    .eq('id', atelierId)
    .single()
  
  return (data?.integrations as any)?.pennylane_token || null
}

// GET - Vérifier la connexion
export async function GET(request: NextRequest) {
  try {
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

    const token = await getPennylaneToken(userData.atelier_id)
    
    if (!token) {
      return NextResponse.json({ 
        connected: false, 
        message: 'Aucun token Pennylane configuré. Ajoutez votre clé API dans Paramètres > Intégrations.' 
      })
    }

    // Vérifier le token en appelant l'API Pennylane
    const response = await fetch(`${PENNYLANE_API_URL}/company`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const company = await response.json()
      return NextResponse.json({ 
        connected: true, 
        company: company.company?.name || 'Entreprise Pennylane',
        message: 'Connexion Pennylane active'
      })
    } else {
      return NextResponse.json({ 
        connected: false, 
        message: 'Token Pennylane invalide ou expiré' 
      })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Synchroniser les factures
export async function POST(request: NextRequest) {
  try {
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

    const token = await getPennylaneToken(userData.atelier_id)
    if (!token) {
      return NextResponse.json({ error: 'Token Pennylane non configuré' }, { status: 400 })
    }

    const body = await request.json()
    const { action, facture_ids } = body

    if (action === 'sync_invoices') {
      // Récupérer les factures à synchroniser
      const { data: factures } = await supabase
        .from('factures')
        .select(`
          id, numero, total_ht, total_ttc, tva_amount, date_facture, date_echeance, status,
          clients(full_name, email, adresse, ville, code_postal, pays, siret)
        `)
        .eq('atelier_id', userData.atelier_id)
        .in('id', facture_ids || [])

      if (!factures || factures.length === 0) {
        return NextResponse.json({ error: 'Aucune facture à synchroniser' }, { status: 400 })
      }

      const results = []
      for (const facture of factures) {
        const client = facture.clients as any

        // Format Pennylane
        const pennylaneInvoice = {
          invoice: {
            date: facture.date_facture,
            deadline: facture.date_echeance,
            external_id: facture.numero,
            currency: 'EUR',
            customer: {
              name: client?.full_name || 'Client',
              email: client?.email,
              address: client?.adresse,
              postal_code: client?.code_postal,
              city: client?.ville,
              country_alpha2: 'FR',
              reg_no: client?.siret,
            },
            line_items: [
              {
                label: `Facture ${facture.numero} - Prestations thermolaquage`,
                quantity: 1,
                unit: 'unit',
                amount: facture.total_ht,
                vat_rate: 'FR_200', // TVA 20%
              }
            ],
          }
        }

        try {
          const response = await fetch(`${PENNYLANE_API_URL}/customer_invoices`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pennylaneInvoice),
          })

          if (response.ok) {
            const result = await response.json()
            results.push({ 
              facture_id: facture.id, 
              numero: facture.numero, 
              status: 'success',
              pennylane_id: result.invoice?.id 
            })
          } else {
            const error = await response.text()
            results.push({ 
              facture_id: facture.id, 
              numero: facture.numero, 
              status: 'error', 
              error 
            })
          }
        } catch (err) {
          results.push({ 
            facture_id: facture.id, 
            numero: facture.numero, 
            status: 'error', 
            error: 'Erreur réseau' 
          })
        }
      }

      return NextResponse.json({
        synced: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error').length,
        details: results,
      })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
