import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// API pour traiter les relances automatiques (appelé par cron job)
// Relance factures impayées (J+7, J+14, J+30)
// Relance devis non signés (J+3, J+7)
export async function GET(request: Request) {
  // Vérifier le secret pour sécuriser l'endpoint
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET || process.env.EMAIL_QUEUE_SECRET_KEY
  
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const now = new Date()
  const results: any[] = []

  try {
    // =========================================
    // 1. RELANCES FACTURES IMPAYÉES
    // =========================================
    const { data: facturesImpayees } = await supabase
      .from('factures')
      .select(`
        id, 
        numero, 
        total_ttc, 
        created_at, 
        due_date,
        atelier_id,
        client_id,
        relance_count,
        last_relance_at,
        clients(email, full_name)
      `)
      .eq('payment_status', 'unpaid')
      .not('status', 'eq', 'annulee')

    for (const facture of facturesImpayees || []) {
      const createdAt = new Date(facture.created_at)
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const relanceCount = facture.relance_count || 0
      const lastRelance = facture.last_relance_at ? new Date(facture.last_relance_at) : null
      const daysSinceLastRelance = lastRelance 
        ? Math.floor((now.getTime() - lastRelance.getTime()) / (1000 * 60 * 60 * 24))
        : daysSinceCreation

      // Logique de relance: J+7, J+14, J+30
      let shouldRelance = false
      let relanceType = ''

      if (relanceCount === 0 && daysSinceCreation >= 7) {
        shouldRelance = true
        relanceType = 'premiere_relance'
      } else if (relanceCount === 1 && daysSinceLastRelance >= 7) {
        shouldRelance = true
        relanceType = 'deuxieme_relance'
      } else if (relanceCount === 2 && daysSinceLastRelance >= 16) {
        shouldRelance = true
        relanceType = 'derniere_relance'
      }

      if (shouldRelance && (facture.clients as any)?.email) {
        // Ajouter à la queue d'emails
        await supabase.from('email_queue').insert({
          atelier_id: facture.atelier_id,
          to_email: (facture.clients as any).email,
          to_name: (facture.clients as any).full_name,
          subject: `Rappel : Facture ${facture.numero} en attente de paiement`,
          template: 'relance_facture',
          variables: {
            numero: facture.numero,
            montant: Number(facture.total_ttc).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
            relance_type: relanceType,
            client_name: (facture.clients as any).full_name,
          },
          priority: relanceCount >= 2 ? 'high' : 'normal',
        })

        // Mettre à jour le compteur de relances
        await supabase
          .from('factures')
          .update({
            relance_count: relanceCount + 1,
            last_relance_at: now.toISOString(),
          })
          .eq('id', facture.id)

        results.push({
          type: 'facture',
          id: facture.id,
          numero: facture.numero,
          relance_type: relanceType,
        })
      }
    }

    // =========================================
    // 2. RELANCES DEVIS NON SIGNÉS
    // =========================================
    const { data: devisEnAttente } = await supabase
      .from('devis')
      .select(`
        id,
        numero,
        total_ttc,
        created_at,
        valid_until,
        atelier_id,
        client_id,
        relance_count,
        last_relance_at,
        clients(email, full_name)
      `)
      .in('status', ['brouillon', 'envoye'])
      .is('signed_at', null)

    for (const devis of devisEnAttente || []) {
      const createdAt = new Date(devis.created_at)
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const relanceCount = devis.relance_count || 0
      const lastRelance = devis.last_relance_at ? new Date(devis.last_relance_at) : null
      const daysSinceLastRelance = lastRelance 
        ? Math.floor((now.getTime() - lastRelance.getTime()) / (1000 * 60 * 60 * 24))
        : daysSinceCreation

      // Vérifier si le devis n'est pas expiré
      if (devis.valid_until && new Date(devis.valid_until) < now) {
        continue // Devis expiré, pas de relance
      }

      // Logique de relance: J+3, J+7
      let shouldRelance = false
      let relanceType = ''

      if (relanceCount === 0 && daysSinceCreation >= 3) {
        shouldRelance = true
        relanceType = 'premiere_relance_devis'
      } else if (relanceCount === 1 && daysSinceLastRelance >= 4) {
        shouldRelance = true
        relanceType = 'deuxieme_relance_devis'
      }

      if (shouldRelance && (devis.clients as any)?.email) {
        // Ajouter à la queue d'emails
        await supabase.from('email_queue').insert({
          atelier_id: devis.atelier_id,
          to_email: (devis.clients as any).email,
          to_name: (devis.clients as any).full_name,
          subject: `Rappel : Devis ${devis.numero} en attente de signature`,
          template: 'relance_devis',
          variables: {
            numero: devis.numero,
            montant: Number(devis.total_ttc).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
            relance_type: relanceType,
            client_name: (devis.clients as any).full_name,
            valid_until: devis.valid_until ? new Date(devis.valid_until).toLocaleDateString('fr-FR') : null,
          },
          priority: 'normal',
        })

        // Mettre à jour le compteur de relances
        await supabase
          .from('devis')
          .update({
            relance_count: relanceCount + 1,
            last_relance_at: now.toISOString(),
          })
          .eq('id', devis.id)

        results.push({
          type: 'devis',
          id: devis.id,
          numero: devis.numero,
          relance_type: relanceType,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} relance(s) planifiée(s)`,
      results,
    })

  } catch (error: any) {
    console.error('Erreur traitement relances:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
