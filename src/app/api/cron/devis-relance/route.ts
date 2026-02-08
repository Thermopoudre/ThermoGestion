import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * API Cron - Relance automatique des devis non signés
 * 
 * Conditions de relance :
 * - Devis envoyé depuis plus de 7 jours sans réponse
 * - Maximum 3 relances par devis
 * - Espacement minimum de 5 jours entre chaque relance
 * 
 * À appeler via un cron Vercel toutes les 24h
 * vercel.json : { "crons": [{ "path": "/api/cron/devis-relance", "schedule": "0 9 * * *" }] }
 */

const RELANCE_DELAY_DAYS = 7    // Première relance après 7 jours
const RELANCE_INTERVAL_DAYS = 5 // Intervalle entre les relances
const MAX_RELANCES = 3          // Maximum 3 relances

export async function GET(request: Request) {
  try {
    // Vérifier le secret d'autorisation (cron Vercel)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    
    // Calculer la date limite pour la première relance
    const firstRelanceDate = new Date(now)
    firstRelanceDate.setDate(firstRelanceDate.getDate() - RELANCE_DELAY_DAYS)

    // Récupérer les devis éligibles à une relance
    const { data: devisToRelance, error: fetchError } = await supabase
      .from('devis')
      .select(`
        id,
        numero,
        client_id,
        atelier_id,
        total_ttc,
        relance_count,
        last_relance_at,
        sent_at,
        created_at,
        clients (
          id,
          full_name,
          email
        ),
        ateliers (
          id,
          name,
          email
        )
      `)
      .in('status', ['envoye', 'sent'])
      .is('signed_at', null)
      .lt('relance_count', MAX_RELANCES)

    if (fetchError) {
      console.error('Erreur récupération devis relance:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!devisToRelance || devisToRelance.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Aucun devis à relancer',
        relanced: 0 
      })
    }

    let relancedCount = 0
    const errors: string[] = []

    for (const devis of devisToRelance) {
      const sentDate = new Date(devis.sent_at || devis.created_at)
      const lastRelance = devis.last_relance_at ? new Date(devis.last_relance_at) : null
      const relanceCount = devis.relance_count || 0
      const client = devis.clients as { id: string; full_name: string; email: string } | null
      const atelier = devis.ateliers as { id: string; name: string; email: string } | null

      if (!client?.email || !atelier) continue

      // Vérifier si éligible
      let eligible = false

      if (relanceCount === 0) {
        // Première relance : envoyé depuis plus de RELANCE_DELAY_DAYS
        eligible = sentDate <= firstRelanceDate
      } else if (lastRelance) {
        // Relances suivantes : dernier rappel depuis plus de RELANCE_INTERVAL_DAYS
        const intervalDate = new Date(now)
        intervalDate.setDate(intervalDate.getDate() - RELANCE_INTERVAL_DAYS)
        eligible = lastRelance <= intervalDate
      }

      if (!eligible) continue

      try {
        // Créer une notification de relance dans la file d'attente email
        await supabase.from('email_queue').insert({
          atelier_id: devis.atelier_id,
          to_email: client.email,
          to_name: client.full_name,
          subject: `Rappel : Devis ${devis.numero} en attente de validation`,
          template: 'devis_relance',
          variables: {
            client_name: client.full_name,
            devis_numero: devis.numero,
            devis_total: Number(devis.total_ttc).toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            }),
            atelier_name: atelier.name,
            relance_number: relanceCount + 1,
            devis_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devis.id}`,
          },
          status: 'pending',
        })

        // Mettre à jour le compteur de relances
        await supabase
          .from('devis')
          .update({
            relance_count: relanceCount + 1,
            last_relance_at: now.toISOString(),
          })
          .eq('id', devis.id)

        // Audit log
        await supabase.from('audit_logs').insert({
          atelier_id: devis.atelier_id,
          action: 'devis_relance',
          table_name: 'devis',
          record_id: devis.id,
          new_data: {
            relance_number: relanceCount + 1,
            client_email: client.email,
          },
        })

        relancedCount++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
        errors.push(`Devis ${devis.numero}: ${errorMsg}`)
        console.error(`Erreur relance devis ${devis.numero}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${relancedCount} devis relancé(s)`,
      relanced: relancedCount,
      total_eligible: devisToRelance.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error('Erreur cron devis-relance:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'exécution du cron' },
      { status: 500 }
    )
  }
}
