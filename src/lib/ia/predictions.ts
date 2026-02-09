/**
 * IA Prédictive — ThermoGestion
 * 
 * Fonctionnalités:
 * 1. Prédiction de délais de production
 * 2. Détection d'anomalies (stock, production)
 * 3. Recommandation de prix
 * 4. Score de risque client (impayés)
 */

import { createServerClient } from '@/lib/supabase/server'

// ==========================================
// Prédiction de délais
// ==========================================

interface DelaiPrediction {
  jours_estimes: number
  intervalle_confiance: { min: number; max: number }
  facteurs: string[]
}

/**
 * Prédit le délai de production d'un projet basé sur l'historique
 */
export async function predictDelai(
  atelierId: string,
  pieces_count: number,
  surface_m2: number,
  type_finition: string
): Promise<DelaiPrediction> {
  const supabase = await createServerClient()
  
  // Récupérer les projets similaires terminés
  const { data: historique } = await supabase
    .from('projets')
    .select('created_at, date_depot, date_promise, pieces_count, surface_m2, status')
    .eq('atelier_id', atelierId)
    .eq('status', 'livre')
    .not('date_depot', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!historique || historique.length < 5) {
    // Pas assez de données, estimation par défaut
    const base = Math.ceil(pieces_count * 0.5 + surface_m2 * 0.3)
    return {
      jours_estimes: Math.max(base, 3),
      intervalle_confiance: { min: Math.max(base - 2, 2), max: base + 3 },
      facteurs: ['Estimation par défaut (peu de données historiques)'],
    }
  }

  // Calculer les durées réelles des projets passés
  const durees = historique.map(p => {
    const depot = new Date(p.date_depot!)
    const fin = new Date(p.date_promise || p.created_at)
    return Math.ceil((fin.getTime() - depot.getTime()) / (1000 * 60 * 60 * 24))
  }).filter(d => d > 0 && d < 90)

  // Moyenne et écart type
  const mean = durees.reduce((a, b) => a + b, 0) / durees.length
  const stddev = Math.sqrt(durees.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durees.length)

  // Ajustements basés sur la complexité
  let ajustement = 0
  const facteurs: string[] = []

  if (pieces_count > 20) {
    ajustement += 2
    facteurs.push(`Volume élevé: ${pieces_count} pièces (+2j)`)
  }
  if (surface_m2 > 10) {
    ajustement += 1
    facteurs.push(`Grande surface: ${surface_m2}m² (+1j)`)
  }
  if (type_finition === 'metallise' || type_finition === 'texture') {
    ajustement += 1
    facteurs.push(`Finition spéciale: ${type_finition} (+1j)`)
  }

  const estim = Math.round(mean + ajustement)

  return {
    jours_estimes: Math.max(estim, 2),
    intervalle_confiance: {
      min: Math.max(Math.round(mean - stddev + ajustement), 2),
      max: Math.round(mean + stddev + ajustement + 1),
    },
    facteurs: [
      `Basé sur ${durees.length} projets similaires (moy: ${mean.toFixed(1)}j)`,
      ...facteurs,
    ],
  }
}

// ==========================================
// Détection d'anomalies
// ==========================================

interface Anomalie {
  type: 'stock' | 'production' | 'qualite' | 'paiement'
  severite: 'info' | 'warning' | 'critical'
  message: string
  donnees?: Record<string, any>
}

/**
 * Détecte les anomalies dans l'atelier
 */
export async function detectAnomalies(atelierId: string): Promise<Anomalie[]> {
  const supabase = await createServerClient()
  const anomalies: Anomalie[] = []

  // 1. Anomalie stock: poudres sous le seuil
  const { data: poudres } = await supabase
    .from('poudres')
    .select('nom, stock_kg, seuil_alerte_kg')
    .eq('atelier_id', atelierId)

  poudres?.forEach(p => {
    if (p.stock_kg <= 0) {
      anomalies.push({
        type: 'stock',
        severite: 'critical',
        message: `Rupture de stock: ${p.nom} (0 kg)`,
        donnees: { poudre: p.nom, stock: p.stock_kg },
      })
    } else if (p.seuil_alerte_kg && p.stock_kg <= p.seuil_alerte_kg) {
      anomalies.push({
        type: 'stock',
        severite: 'warning',
        message: `Stock bas: ${p.nom} (${p.stock_kg} kg / seuil ${p.seuil_alerte_kg} kg)`,
        donnees: { poudre: p.nom, stock: p.stock_kg, seuil: p.seuil_alerte_kg },
      })
    }
  })

  // 2. Anomalie production: projets en retard
  const today = new Date().toISOString().split('T')[0]
  const { data: projetsRetard } = await supabase
    .from('projets')
    .select('numero, date_promise, status')
    .eq('atelier_id', atelierId)
    .lt('date_promise', today)
    .not('status', 'in', '("livre","annule")')

  if (projetsRetard && projetsRetard.length > 0) {
    anomalies.push({
      type: 'production',
      severite: projetsRetard.length > 3 ? 'critical' : 'warning',
      message: `${projetsRetard.length} projet(s) en retard de livraison`,
      donnees: { projets: projetsRetard.map(p => p.numero) },
    })
  }

  // 3. Anomalie paiement: factures impayées > 30 jours
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data: facturesImpayees } = await supabase
    .from('factures')
    .select('numero, total_ttc, date_echeance')
    .eq('atelier_id', atelierId)
    .eq('status', 'emise')
    .lt('date_echeance', thirtyDaysAgo.toISOString().split('T')[0])

  if (facturesImpayees && facturesImpayees.length > 0) {
    const totalImpayes = facturesImpayees.reduce((acc, f) => acc + (f.total_ttc || 0), 0)
    anomalies.push({
      type: 'paiement',
      severite: totalImpayes > 5000 ? 'critical' : 'warning',
      message: `${facturesImpayees.length} facture(s) impayée(s) > 30 jours (${totalImpayes.toFixed(0)} EUR)`,
      donnees: { montant: totalImpayes, factures: facturesImpayees.map(f => f.numero) },
    })
  }

  return anomalies
}

// ==========================================
// Recommandation de prix
// ==========================================

interface PrixRecommandation {
  prix_suggere_m2: number
  prix_min: number
  prix_max: number
  base: string
  ajustements: string[]
}

/**
 * Recommande un prix basé sur l'historique des devis acceptés
 */
export async function recommendPrix(
  atelierId: string,
  surface_m2: number,
  finition: string,
  urgent: boolean
): Promise<PrixRecommandation> {
  const supabase = await createServerClient()
  
  // Historique des devis signés
  const { data: devisAcceptes } = await supabase
    .from('devis')
    .select('total_ht, lignes')
    .eq('atelier_id', atelierId)
    .eq('status', 'signe')
    .order('created_at', { ascending: false })
    .limit(50)

  let prixMoyenM2 = 35 // Valeur par défaut
  const ajustements: string[] = []

  if (devisAcceptes && devisAcceptes.length >= 5) {
    // Extraire les prix/m2 des devis
    const prixM2List: number[] = []
    devisAcceptes.forEach((d: any) => {
      const lignes = d.lignes || []
      lignes.forEach((l: any) => {
        if (l.surface_m2 && l.surface_m2 > 0 && l.prix_unitaire) {
          prixM2List.push(l.prix_unitaire)
        }
      })
    })

    if (prixM2List.length > 0) {
      prixMoyenM2 = prixM2List.reduce((a, b) => a + b, 0) / prixM2List.length
      ajustements.push(`Basé sur ${prixM2List.length} lignes de devis acceptés`)
    }
  }

  // Ajustements finition
  const finitionMultiplier: Record<string, number> = {
    mat: 1,
    brillant: 1,
    satin: 1.05,
    texture: 1.1,
    metallise: 1.2,
  }
  const mult = finitionMultiplier[finition] || 1
  if (mult > 1) {
    ajustements.push(`Majoration finition ${finition}: +${((mult - 1) * 100).toFixed(0)}%`)
  }

  // Ajustement volume
  let volumeDiscount = 1
  if (surface_m2 > 20) {
    volumeDiscount = 0.9
    ajustements.push('Remise volume > 20m²: -10%')
  } else if (surface_m2 > 50) {
    volumeDiscount = 0.85
    ajustements.push('Remise volume > 50m²: -15%')
  }

  // Ajustement urgence
  let urgenceMult = 1
  if (urgent) {
    urgenceMult = 1.3
    ajustements.push('Majoration urgence: +30%')
  }

  const prix = prixMoyenM2 * mult * volumeDiscount * urgenceMult

  return {
    prix_suggere_m2: Math.round(prix * 100) / 100,
    prix_min: Math.round(prix * 0.85 * 100) / 100,
    prix_max: Math.round(prix * 1.15 * 100) / 100,
    base: `Prix moyen historique: ${prixMoyenM2.toFixed(2)} EUR/m²`,
    ajustements,
  }
}

// ==========================================
// Score de risque client
// ==========================================

interface RisqueClient {
  score: number // 0-100 (100 = fiable)
  niveau: 'faible' | 'moyen' | 'eleve'
  facteurs: string[]
}

/**
 * Calcule un score de risque d'impayé pour un client
 */
export async function scoreRisqueClient(
  atelierId: string,
  clientId: string
): Promise<RisqueClient> {
  const supabase = await createServerClient()
  
  let score = 100
  const facteurs: string[] = []

  // 1. Historique paiements
  const { data: factures } = await supabase
    .from('factures')
    .select('status, date_echeance, paid_at, total_ttc')
    .eq('atelier_id', atelierId)
    .eq('client_id', clientId)

  if (!factures || factures.length === 0) {
    return { score: 50, niveau: 'moyen', facteurs: ['Nouveau client - pas d\'historique'] }
  }

  const totalFactures = factures.length
  const payees = factures.filter(f => f.status === 'payee')
  const impayees = factures.filter(f => f.status === 'emise' && f.date_echeance && new Date(f.date_echeance) < new Date())

  // Taux de paiement
  const tauxPaiement = payees.length / totalFactures
  if (tauxPaiement < 0.8) {
    score -= 30
    facteurs.push(`Taux de paiement faible: ${(tauxPaiement * 100).toFixed(0)}%`)
  } else if (tauxPaiement >= 0.95) {
    facteurs.push(`Excellent taux de paiement: ${(tauxPaiement * 100).toFixed(0)}%`)
  }

  // Retards de paiement
  let totalRetardJours = 0
  payees.forEach(f => {
    if (f.paid_at && f.date_echeance) {
      const retard = Math.max(0, (new Date(f.paid_at).getTime() - new Date(f.date_echeance).getTime()) / (1000 * 60 * 60 * 24))
      totalRetardJours += retard
    }
  })
  const retardMoyen = payees.length > 0 ? totalRetardJours / payees.length : 0
  
  if (retardMoyen > 15) {
    score -= 20
    facteurs.push(`Retard moyen de paiement: ${retardMoyen.toFixed(0)} jours`)
  } else if (retardMoyen > 7) {
    score -= 10
    facteurs.push(`Retard moyen: ${retardMoyen.toFixed(0)} jours`)
  }

  // Impayés en cours
  if (impayees.length > 0) {
    const montantImpayes = impayees.reduce((acc, f) => acc + (f.total_ttc || 0), 0)
    score -= Math.min(impayees.length * 10, 30)
    facteurs.push(`${impayees.length} facture(s) impayée(s) (${montantImpayes.toFixed(0)} EUR)`)
  }

  // Ancienneté
  if (totalFactures > 10) {
    score = Math.min(score + 10, 100)
    facteurs.push(`Client fidèle: ${totalFactures} factures`)
  }

  score = Math.max(score, 0)
  const niveau = score >= 70 ? 'faible' : score >= 40 ? 'moyen' : 'eleve'

  return { score, niveau, facteurs }
}
