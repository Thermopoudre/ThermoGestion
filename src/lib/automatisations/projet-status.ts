/**
 * Service d'automatisation pour les changements de statut de projet
 * Gère :
 * - Création automatique de facture (selon préférence client)
 * - Mise à jour du stock de poudre
 * - Notifications
 * - Synchronisation workflow ↔ statut
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']
type Facture = Database['public']['Tables']['factures']['Insert']

// Mapping workflow step → statut projet
export const WORKFLOW_STATUS_MAP: Record<number, string> = {
  0: 'en_cours',      // Préparation
  1: 'en_cours',      // Application poudre
  2: 'en_cuisson',    // Cuisson
  3: 'qc',            // Contrôle qualité
  4: 'pret',          // Prêt
}

// Mapping inverse statut → workflow step
export const STATUS_WORKFLOW_MAP: Record<string, number> = {
  'devis': 0,
  'en_cours': 1,
  'en_cuisson': 2,
  'qc': 3,
  'pret': 4,
  'livre': 4,
  'annule': 0,
}

interface StatusChangeResult {
  success: boolean
  error?: string
  factureCreated?: boolean
  factureId?: string
  stockUpdated?: boolean
  notificationSent?: boolean
}

/**
 * Change le statut d'un projet avec toutes les automatisations
 */
export async function changeProjetStatus(
  supabaseServiceKey: string,
  supabaseUrl: string,
  projetId: string,
  newStatus: string,
  userId: string
): Promise<StatusChangeResult> {
  // Client avec service key pour bypass RLS
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // 1. Récupérer le projet avec ses relations
    const { data: projet, error: projetError } = await supabase
      .from('projets')
      .select(`
        *,
        clients (*),
        poudres (*),
        devis (*)
      `)
      .eq('id', projetId)
      .single()

    if (projetError || !projet) {
      return { success: false, error: 'Projet non trouvé' }
    }

    const oldStatus = projet.status
    const client = projet.clients as Client
    const poudre = projet.poudres as Poudre | null

    // 2. Mettre à jour le statut du projet
    const updateData: any = { 
      status: newStatus,
      current_step: STATUS_WORKFLOW_MAP[newStatus] ?? projet.current_step
    }

    // Si livré, enregistrer la date
    if (newStatus === 'livre') {
      updateData.date_livre = new Date().toISOString().split('T')[0]
    }

    const { error: updateError } = await supabase
      .from('projets')
      .update(updateData)
      .eq('id', projetId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    const result: StatusChangeResult = { success: true }

    // 3. Décrémenter le stock si passage à "en_cuisson"
    if (newStatus === 'en_cuisson' && oldStatus !== 'en_cuisson' && poudre) {
      const stockResult = await decrementStock(supabase, projet, poudre, userId)
      result.stockUpdated = stockResult.success
    }

    // 4. Créer facture si nécessaire
    // Par défaut, facture_trigger = 'pret' si non défini
    const clientFactureTrigger = client.facture_trigger || 'pret'
    const shouldCreateFacture = 
      (newStatus === 'pret' && clientFactureTrigger === 'pret') ||
      (newStatus === 'livre' && clientFactureTrigger === 'livre')

    // Vérifier qu'une facture n'existe pas déjà pour ce projet
    if (shouldCreateFacture) {
      const { data: existingFacture } = await supabase
        .from('factures')
        .select('id')
        .eq('projet_id', projetId)
        .single()

      if (!existingFacture) {
        const factureResult = await createAutoFacture(supabase, projet, client, userId)
        result.factureCreated = factureResult.success
        result.factureId = factureResult.factureId
      }
    }

    // 5. Journal d'audit
    await supabase.from('audit_logs').insert({
      atelier_id: projet.atelier_id,
      user_id: userId,
      action: 'status_change',
      table_name: 'projets',
      record_id: projetId,
      old_data: { status: oldStatus },
      new_data: { status: newStatus, auto_facture: result.factureCreated },
    })

    return result

  } catch (error: any) {
    console.error('Erreur changeProjetStatus:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Décrémente le stock de poudre lors du passage en cuisson
 */
async function decrementStock(
  supabase: any,
  projet: any,
  poudre: Poudre,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Calculer la quantité de poudre utilisée
    // Formule simplifiée : surface × couches × consommation kg/m²
    
    const items = projet.pieces || projet.devis?.items || []
    let totalSurfaceM2 = 0
    
    for (const item of items) {
      if (item.surface_m2) {
        totalSurfaceM2 += item.surface_m2 * (item.quantite || 1)
      } else if (item.longueur && item.largeur) {
        // Calcul surface en m² (dimensions en mm)
        const surfaceM2 = (item.longueur * item.largeur) / 1000000
        totalSurfaceM2 += surfaceM2 * (item.quantite || 1)
      }
    }

    // Si pas de surface calculable, utiliser une estimation par défaut
    // ou la quantité stockée dans le projet
    let quantiteUtilisee = projet.poudre_quantite_kg || 0
    
    if (quantiteUtilisee === 0 && totalSurfaceM2 > 0) {
      // Consommation estimée : surface × couches × consommation kg/m²
      const consommationKgM2 = (poudre as any).consommation_kg_m2 || 0.12 // défaut 120g/m²
      const couches = projet.couches || 1
      quantiteUtilisee = totalSurfaceM2 * couches * consommationKgM2
    }

    // Si toujours 0, utiliser une valeur minimum (0.5 kg par projet)
    if (quantiteUtilisee <= 0) {
      quantiteUtilisee = 0.5 // Minimum 500g par projet
    }

    // Récupérer le stock actuel directement depuis la table poudres
    const stockAvant = poudre.stock_reel_kg || 0
    const stockApres = Math.max(0, stockAvant - quantiteUtilisee)

    // Mettre à jour le stock directement dans la table poudres
    const { error: updateError } = await supabase
      .from('poudres')
      .update({ stock_reel_kg: stockApres })
      .eq('id', poudre.id)

    if (updateError) {
      console.error('Erreur mise à jour stock poudre:', updateError)
      return { success: false, error: updateError.message }
    }

    // Enregistrer le mouvement de stock pour traçabilité
    await supabase.from('stock_mouvements').insert({
      atelier_id: projet.atelier_id,
      poudre_id: poudre.id,
      projet_id: projet.id,
      type: 'sortie',
      quantite: quantiteUtilisee,
      quantite_avant: stockAvant,
      quantite_apres: stockApres,
      motif: `Cuisson projet ${projet.numero}`,
      created_by: userId,
    })

    // Marquer le projet comme ayant eu son stock décrémenté
    await supabase
      .from('projets')
      .update({ auto_stock_decremented_at: new Date().toISOString() })
      .eq('id', projet.id)

    console.log(`Stock poudre ${poudre.reference}: ${stockAvant} → ${stockApres} kg (-${quantiteUtilisee.toFixed(3)} kg)`)

    return { success: true }

  } catch (error: any) {
    console.error('Erreur decrementStock:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Crée automatiquement une facture pour un projet terminé
 */
async function createAutoFacture(
  supabase: any,
  projet: any,
  client: Client,
  userId: string
): Promise<{ success: boolean; factureId?: string; error?: string }> {
  try {
    // Générer le numéro de facture via la fonction SQL
    const { data: numeroData, error: numeroError } = await supabase.rpc('generate_facture_numero', {
      p_atelier_id: projet.atelier_id,
    })
    
    let numero = numeroData
    if (numeroError || !numero) {
      // Fallback : générer manuellement
      const year = new Date().getFullYear()
      const { data: lastFacture } = await supabase
        .from('factures')
        .select('numero')
        .eq('atelier_id', projet.atelier_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastNum = lastFacture?.numero 
        ? parseInt(lastFacture.numero.split('-')[2] || '0')
        : 0
      numero = `FACT-${year}-${String(lastNum + 1).padStart(4, '0')}`
    }

    // Récupérer les items du devis si disponible
    const devis = projet.devis as any
    const items = devis?.items || projet.pieces || []
    
    // Calculer le total si pas de devis
    let totalHt = devis?.total_ht || 0
    let totalTtc = devis?.total_ttc || 0
    
    if (totalHt === 0 && items.length > 0) {
      // Calculer depuis les items
      for (const item of items) {
        const itemTotal = (item.total_ht || item.prix_ht || 0) * (item.quantite || 1)
        totalHt += itemTotal
      }
      totalTtc = totalHt * 1.2 // TVA 20%
    }

    // Si toujours 0, mettre une valeur par défaut (à modifier manuellement)
    if (totalHt === 0) {
      totalHt = 0
      totalTtc = 0
    }

    // Date d'échéance : 30 jours par défaut
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    // Créer la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert({
        atelier_id: projet.atelier_id,
        client_id: client.id,
        projet_id: projet.id,
        numero,
        type: 'complete',
        items,
        total_ht: totalHt,
        total_ttc: totalTtc,
        tva_rate: 20,
        status: 'brouillon',
        payment_status: 'unpaid',
        auto_created: true,
        created_by: userId,
        due_date: dueDate.toISOString().split('T')[0],
        notes: `Facture générée automatiquement pour le projet ${projet.numero}`,
      })
      .select('id, numero')
      .single()

    if (factureError) {
      console.error('Erreur création facture auto:', factureError)
      return { success: false, error: factureError.message }
    }

    // Marquer le projet comme ayant eu sa facture créée
    await supabase
      .from('projets')
      .update({ auto_facture_created_at: new Date().toISOString() })
      .eq('id', projet.id)

    console.log(`Facture ${numero} créée automatiquement pour projet ${projet.numero}`)

    return { success: true, factureId: facture.id }

  } catch (error: any) {
    console.error('Erreur createAutoFacture:', error)
    return { success: false, error: error.message }
  }
}
