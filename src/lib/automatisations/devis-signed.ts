/**
 * Service d'automatisation pour la signature de devis
 * Gère :
 * - Création automatique du projet
 * - Notification à l'atelier
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Projet = Database['public']['Tables']['projets']['Insert']

interface DevisSignedResult {
  success: boolean
  error?: string
  projetCreated?: boolean
  projetId?: string
  projetNumero?: string
}

/**
 * Workflow déclenché quand un devis est signé
 * Crée automatiquement le projet associé
 */
export async function onDevisSigned(
  supabaseServiceKey: string,
  supabaseUrl: string,
  devisId: string,
  userId: string
): Promise<DevisSignedResult> {
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // 1. Récupérer le devis avec ses détails
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select(`
        *,
        clients (*)
      `)
      .eq('id', devisId)
      .single()

    if (devisError || !devis) {
      return { success: false, error: 'Devis non trouvé' }
    }

    // 2. Vérifier qu'un projet n'existe pas déjà
    const { data: existingProjet } = await supabase
      .from('projets')
      .select('id, numero')
      .eq('devis_id', devisId)
      .single()

    if (existingProjet) {
      return { 
        success: true, 
        projetCreated: false, 
        projetId: existingProjet.id,
        projetNumero: existingProjet.numero,
        error: 'Projet déjà existant'
      }
    }

    // 3. Générer le numéro de projet
    const year = new Date().getFullYear()
    const { data: lastProjet } = await supabase
      .from('projets')
      .select('numero')
      .eq('atelier_id', devis.atelier_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastNum = lastProjet?.numero 
      ? parseInt(lastProjet.numero.split('-')[2] || '0')
      : 0
    const numero = `PROJ-${year}-${String(lastNum + 1).padStart(4, '0')}`

    // 4. Extraire les infos du devis pour créer le projet
    const items = (devis.items as any[]) || []
    
    // Essayer de trouver une poudre par défaut (première poudre de l'atelier)
    const { data: defaultPoudre } = await supabase
      .from('poudres')
      .select('id')
      .eq('atelier_id', devis.atelier_id)
      .limit(1)
      .single()

    // Nom du projet basé sur le devis ou le premier item
    const projetName = items.length > 0 
      ? items[0].designation || `Projet devis ${devis.numero}`
      : `Projet devis ${devis.numero}`

    // 5. Créer le projet
    const projetData: Projet = {
      atelier_id: devis.atelier_id,
      client_id: devis.client_id,
      devis_id: devis.id,
      numero,
      name: projetName,
      status: 'en_cours',
      poudre_id: defaultPoudre?.id || null,
      couches: 1,
      workflow_config: [
        { name: 'Préparation', order: 0 },
        { name: 'Application poudre', order: 1 },
        { name: 'Cuisson', order: 2 },
        { name: 'Contrôle qualité', order: 3 },
        { name: 'Prêt', order: 4 },
      ],
      current_step: 0,
      pieces: items,
      date_depot: new Date().toISOString().split('T')[0],
      auto_created: true,
      created_by: userId,
    }

    const { data: projet, error: projetError } = await supabase
      .from('projets')
      .insert(projetData)
      .select('id, numero')
      .single()

    if (projetError) {
      return { success: false, error: projetError.message }
    }

    // 6. Mettre à jour le devis (statut converted)
    await supabase
      .from('devis')
      .update({ status: 'converted' })
      .eq('id', devisId)

    // 7. Journal d'audit
    await supabase.from('audit_logs').insert({
      atelier_id: devis.atelier_id,
      user_id: userId,
      action: 'auto_create_projet',
      table_name: 'projets',
      record_id: projet.id,
      new_data: { 
        from_devis: devis.numero,
        projet_numero: projet.numero,
        auto_created: true 
      },
    })

    return {
      success: true,
      projetCreated: true,
      projetId: projet.id,
      projetNumero: projet.numero,
    }

  } catch (error: any) {
    console.error('Erreur onDevisSigned:', error)
    return { success: false, error: error.message }
  }
}
