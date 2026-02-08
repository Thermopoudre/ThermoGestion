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
    const updateData: Record<string, string | number | null> = { 
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
    // Protection double exécution via flag auto_stock_decremented_at
    if (newStatus === 'en_cuisson' && oldStatus !== 'en_cuisson' && poudre && !projet.auto_stock_decremented_at) {
      const stockResult = await decrementStock(supabase, projet, poudre, userId)
      result.stockUpdated = stockResult.success
    }

    // 4. Créer facture si nécessaire (protection double exécution via auto_facture_created_at)
    // Par défaut, facture_trigger = 'pret' si non défini
    const clientFactureTrigger = client.facture_trigger || 'pret'
    const shouldCreateFacture = 
      !projet.auto_facture_created_at &&
      ((newStatus === 'pret' && clientFactureTrigger === 'pret') ||
      (newStatus === 'livre' && clientFactureTrigger === 'livre'))

    // Vérifier si le projet a déjà une facture d'acompte (montant_acompte > 0)
    const hasAcompte = (projet.montant_acompte || 0) > 0
    
    // Vérifier qu'une facture de solde ou complete n'existe pas déjà
    if (shouldCreateFacture) {
      const { data: existingFacture } = await supabase
        .from('factures')
        .select('id, type')
        .eq('projet_id', projetId)
        .in('type', ['complete', 'solde'])
        .single()

      if (!existingFacture) {
        // Créer facture de solde si acompte existe, sinon facture complète
        const factureResult = await createAutoFacture(
          supabase, 
          projet, 
          client, 
          userId,
          hasAcompte ? 'solde' : 'complete'
        )
        result.factureCreated = factureResult.success
        result.factureId = factureResult.factureId
        
        // Mettre à jour la ref sur le projet si c'est une facture de solde
        if (factureResult.success && hasAcompte) {
          await supabase
            .from('projets')
            .update({ facture_solde_id: factureResult.factureId })
            .eq('id', projetId)
        }
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

  } catch (error: unknown) {
    console.error('Erreur changeProjetStatus:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' }
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

    // Décrément atomique via fonction RPC (évite les race conditions)
    let stockAvant = poudre.stock_reel_kg || 0
    let stockApres = Math.max(0, stockAvant - quantiteUtilisee)

    const { data: stockResult, error: rpcError } = await supabase
      .rpc('decrement_poudre_stock', {
        p_poudre_id: poudre.id,
        p_quantite: quantiteUtilisee,
      })

    if (rpcError) {
      // Fallback : mise à jour directe si la RPC échoue
      console.warn('RPC decrement_poudre_stock indisponible, fallback direct:', rpcError.message)
      const { error: updateError } = await supabase
        .from('poudres')
        .update({ stock_reel_kg: stockApres })
        .eq('id', poudre.id)

      if (updateError) {
        console.error('Erreur mise à jour stock poudre:', updateError)
        return { success: false, error: updateError.message }
      }
    } else if (stockResult && stockResult.length > 0) {
      // Utiliser les valeurs retournées par la RPC (valeurs réelles atomiques)
      stockAvant = stockResult[0].stock_avant
      stockApres = stockResult[0].stock_apres
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

    // Stock updated for poudre

    return { success: true }

  } catch (error: any) {
    console.error('Erreur decrementStock:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Crée automatiquement une facture pour un projet terminé
 * @param factureType - 'complete' pour facture complète, 'solde' pour facture de solde (si acompte existe)
 */
async function createAutoFacture(
  supabase: any,
  projet: any,
  client: Client,
  userId: string,
  factureType: 'complete' | 'solde' = 'complete'
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

    // Pour une facture de solde, soustraire l'acompte
    let soldeHt = totalHt
    let soldeTtc = totalTtc
    let acompteAmount = 0
    let devisNumero = devis?.numero
    
    if (factureType === 'solde') {
      acompteAmount = projet.montant_acompte || 0
      // Récupérer les infos de la facture d'acompte
      if (projet.facture_acompte_id) {
        const { data: factureAcompte } = await supabase
          .from('factures')
          .select('total_ttc, total_ht, devis_numero')
          .eq('id', projet.facture_acompte_id)
          .single()
        
        if (factureAcompte) {
          acompteAmount = factureAcompte.total_ttc || acompteAmount
          devisNumero = factureAcompte.devis_numero || devisNumero
        }
      }
      
      // Calculer le solde restant
      const tvaRate = devis?.tva_rate || 20
      const acompteHt = acompteAmount / (1 + tvaRate / 100)
      soldeHt = totalHt - acompteHt
      soldeTtc = totalTtc - acompteAmount
    }

    // Si toujours 0, mettre une valeur par défaut
    if (soldeHt < 0) soldeHt = 0
    if (soldeTtc < 0) soldeTtc = 0

    // Date d'échéance : 30 jours par défaut
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    // Préparer les items pour la facture
    let factureItems = items
    let notes = `Facture générée automatiquement pour le projet ${projet.numero}`
    
    if (factureType === 'solde') {
      factureItems = [{
        designation: `Solde projet ${projet.numero}`,
        description: devisNumero 
          ? `Solde de commande - Devis ${devisNumero}\nAcompte déjà versé : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(acompteAmount)} TTC`
          : `Solde de commande - Projet ${projet.name}`,
        quantite: 1,
        prix_unitaire: soldeHt,
        total_ht: soldeHt,
      }]
      notes = `Facture de solde pour le projet ${projet.numero}.\nMontant total : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalTtc)} TTC\nAcompte versé : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(acompteAmount)} TTC\nSolde dû : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(soldeTtc)} TTC`
    }

    // Créer la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert({
        atelier_id: projet.atelier_id,
        client_id: client.id,
        projet_id: projet.id,
        devis_id: devis?.id,
        devis_numero: devisNumero,
        numero,
        type: factureType,
        items: factureItems,
        total_ht: factureType === 'solde' ? soldeHt : totalHt,
        total_ttc: factureType === 'solde' ? soldeTtc : totalTtc,
        tva_rate: devis?.tva_rate || 20,
        acompte_amount: factureType === 'solde' ? acompteAmount : null,
        status: 'brouillon',
        payment_status: 'unpaid',
        auto_created: true,
        created_by: userId,
        due_date: dueDate.toISOString().split('T')[0],
        notes,
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
      .update({ 
        auto_facture_created_at: new Date().toISOString(),
        montant_facture: factureType === 'solde' ? soldeTtc : totalTtc,
      })
      .eq('id', projet.id)

    // Auto-generated invoice created

    return { success: true, factureId: facture.id }

  } catch (error: any) {
    console.error('Erreur createAutoFacture:', error)
    return { success: false, error: error.message }
  }
}
