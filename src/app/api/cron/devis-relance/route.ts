import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Paramètres par défaut de relance
const DEFAULT_RELANCE_SETTINGS = {
  delai_premiere_relance_jours: 7, // 7 jours après envoi
  delai_entre_relances_jours: 5, // 5 jours entre chaque relance
  max_relances: 3, // Maximum 3 relances
  actif: true,
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const supabase = await createServerClient()
    const now = new Date()

    // Récupérer tous les ateliers avec leurs paramètres
    const { data: ateliers, error: ateliersError } = await supabase
      .from('ateliers')
      .select('id, name, email, settings')

    if (ateliersError) {
      console.error('Erreur récupération ateliers:', ateliersError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    let relancesEnvoyees = 0
    let alertesCreees = 0

    for (const atelier of ateliers || []) {
      // Récupérer les paramètres de relance de l'atelier
      const relanceSettings = {
        ...DEFAULT_RELANCE_SETTINGS,
        ...(atelier.settings?.devis_relance || {}),
      }

      if (!relanceSettings.actif) continue

      // Récupérer les devis envoyés mais non signés qui peuvent être relancés
      const { data: devisARelancer, error: devisError } = await supabase
        .from('devis')
        .select(`
          *,
          clients (
            id,
            full_name,
            email
          )
        `)
        .eq('atelier_id', atelier.id)
        .eq('status', 'envoye')
        .is('signed_at', null)
        .eq('relance_desactivee', false)
        .lt('relance_count', relanceSettings.max_relances)

      if (devisError) {
        console.error('Erreur récupération devis:', devisError)
        continue
      }

      for (const devis of devisARelancer || []) {
        // Calculer si une relance est due
        const dateEnvoi = new Date(devis.sent_at || devis.created_at)
        const derniereRelance = devis.derniere_relance_at ? new Date(devis.derniere_relance_at) : null

        let dateProchainRelance: Date

        if (devis.relance_count === 0) {
          // Première relance
          dateProchainRelance = new Date(dateEnvoi)
          dateProchainRelance.setDate(dateProchainRelance.getDate() + relanceSettings.delai_premiere_relance_jours)
        } else {
          // Relances suivantes
          dateProchainRelance = new Date(derniereRelance!)
          dateProchainRelance.setDate(dateProchainRelance.getDate() + relanceSettings.delai_entre_relances_jours)
        }

        // Vérifier si la relance est due
        if (now < dateProchainRelance) continue

        // Créer une alerte pour rappeler de relancer le client
        const { error: alerteError } = await supabase
          .from('alertes')
          .insert({
            atelier_id: atelier.id,
            type: 'devis_relance',
            titre: `Relance devis ${devis.numero}`,
            message: `Le devis ${devis.numero} pour ${devis.clients?.full_name || 'client'} n'a pas été signé depuis ${Math.floor((now.getTime() - dateEnvoi.getTime()) / 86400000)} jours. Relance ${devis.relance_count + 1}/${relanceSettings.max_relances}.`,
            lien: `/app/devis/${devis.id}/send`,
            data: {
              devis_id: devis.id,
              client_id: devis.client_id,
              relance_numero: devis.relance_count + 1,
            },
          })

        if (alerteError) {
          console.error('Erreur création alerte relance:', alerteError)
          continue
        }

        // Mettre à jour le compteur de relances
        await supabase
          .from('devis')
          .update({
            relance_count: devis.relance_count + 1,
            derniere_relance_at: now.toISOString(),
          })
          .eq('id', devis.id)

        alertesCreees++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${alertesCreees} alerte(s) de relance créée(s)`,
      alertes_creees: alertesCreees,
    })
  } catch (error) {
    console.error('Erreur cron devis relance:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
