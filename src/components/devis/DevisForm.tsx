'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateClientModal } from '@/components/ui/QuickCreateClientModal'
import { QuickCreatePoudreModal } from '@/components/ui/QuickCreatePoudreModal'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

// Couche de poudre pour un item
interface Couche {
  id: string
  poudre_id?: string
  type: 'primaire' | 'base' | 'vernis' | 'autre'
}

interface DevisItem {
  id: string
  designation: string
  longueur: number
  largeur: number
  hauteur?: number
  quantite: number
  surface_m2: number
  couches: Couche[] // Multi-couches avec poudres différentes
  cout_poudre_revient: number // Coût de revient poudre
  cout_poudre_vente: number // Coût de vente poudre (avec marge)
  cout_mo_revient: number // Coût de revient MO
  cout_mo_vente: number // Coût de vente MO (avec marge)
  cout_consommables: number
  total_revient: number // Prix de revient total
  total_ht: number // Prix de vente HT
}

interface AtelierSettings {
  taux_mo_heure: number
  temps_mo_m2: number
  cout_consommables_m2: number
  marge_poudre_pct: number
  marge_mo_pct: number
  tva_rate: number
}

interface DevisFormProps {
  atelierId: string
  userId: string
  clients: Client[]
  poudres: Poudre[]
  devisId?: string
  initialData?: any
  atelierSettings?: AtelierSettings
}

const defaultSettings: AtelierSettings = {
  taux_mo_heure: 35,
  temps_mo_m2: 0.15,
  cout_consommables_m2: 2,
  marge_poudre_pct: 30,
  marge_mo_pct: 50,
  tva_rate: 20,
}

export function DevisForm({ 
  atelierId, 
  userId, 
  clients: initialClients, 
  poudres: initialPoudres, 
  devisId, 
  initialData,
  atelierSettings 
}: DevisFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Liste dynamique des clients et poudres
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [poudres, setPoudres] = useState<Poudre[]>(initialPoudres)
  
  // Modals de création rapide
  const [showClientModal, setShowClientModal] = useState(false)
  const [showPoudreModal, setShowPoudreModal] = useState(false)
  const [currentItemIdForPoudre, setCurrentItemIdForPoudre] = useState<string | null>(null)
  const [currentCoucheIdForPoudre, setCurrentCoucheIdForPoudre] = useState<string | null>(null)
  
  // Paramètres de calcul (depuis atelier - lecture seule)
  const params = atelierSettings || defaultSettings
  
  // Système de remise
  const [remise, setRemise] = useState({
    type: 'pourcentage' as 'pourcentage' | 'montant',
    valeur: 0,
  })

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const localStorageKey = `devis_draft_${atelierId}_${devisId || 'new'}`

  // Charger le brouillon depuis localStorage au démarrage (seulement pour nouveaux devis)
  const getInitialFormData = () => {
    if (initialData) {
      return {
        client_id: initialData.client_id || '',
        numero: initialData.numero || '',
        items: initialData.items || ([] as DevisItem[]),
        notes: initialData.notes || '',
      }
    }
    
    // Essayer de charger depuis localStorage pour les nouveaux devis
    if (typeof window !== 'undefined' && !devisId) {
      try {
        const saved = localStorage.getItem(localStorageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            client_id: parsed.client_id || '',
            numero: parsed.numero || '',
            items: parsed.items || ([] as DevisItem[]),
            notes: parsed.notes || '',
          }
        }
      } catch (e) {
        console.warn('Erreur lecture brouillon localStorage:', e)
      }
    }
    
    return {
      client_id: '',
      numero: '',
      items: [] as DevisItem[],
      notes: '',
    }
  }

  const [formData, setFormData] = useState(getInitialFormData)

  // Auto-save vers localStorage avec debounce
  useEffect(() => {
    // Ne pas sauvegarder si pas de données
    if (!formData.client_id && formData.items.length === 0 && !formData.notes) {
      return
    }

    // Debounce: attendre 2 secondes après la dernière modification
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    setAutoSaveStatus('saving')

    autoSaveTimeoutRef.current = setTimeout(() => {
      try {
        // Sauvegarder dans localStorage
        localStorage.setItem(localStorageKey, JSON.stringify({
          client_id: formData.client_id,
          items: formData.items,
          notes: formData.notes,
          remise: remise,
          savedAt: new Date().toISOString(),
        }))
        setAutoSaveStatus('saved')
        setLastSaved(new Date())
        
        // Remettre à idle après 3 secondes
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      } catch (e) {
        console.error('Erreur auto-save:', e)
        setAutoSaveStatus('error')
      }
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [formData, remise, localStorageKey])

  // Nettoyer le brouillon après sauvegarde réussie
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(localStorageKey)
    } catch (e) {
      console.warn('Erreur suppression brouillon:', e)
    }
  }, [localStorageKey])

  // Calculer surface d'une pièce
  const calculateSurface = (longueur: number, largeur: number, hauteur?: number, quantite: number = 1): number => {
    if (hauteur) {
      // Surface totale d'un parallélépipède
      return quantite * 2 * (longueur * largeur + longueur * hauteur + largeur * hauteur) / 1000000
    }
    // Surface rectangle (2 faces)
    return quantite * 2 * (longueur * largeur) / 1000000
  }

  // Calculer coûts pour un item avec multi-couches
  const calculateItemCosts = (item: DevisItem): Partial<DevisItem> => {
    const surface = calculateSurface(item.longueur, item.largeur, item.hauteur, item.quantite)
    
    // Calcul poudre pour toutes les couches
    let coutPoudreRevient = 0
    let coutPoudreVente = 0
    
    item.couches.forEach(couche => {
      const poudre = poudres.find(p => p.id === couche.poudre_id)
      if (poudre) {
        // Utiliser le rendement si disponible, sinon consommation, sinon défaut
        let consommationM2 = 0.15
        if (poudre.rendement_m2_kg && Number(poudre.rendement_m2_kg) > 0) {
          consommationM2 = 1 / Number(poudre.rendement_m2_kg)
        } else if (poudre.consommation_m2) {
          consommationM2 = Number(poudre.consommation_m2)
        }
        
        const prixPoudreKg = poudre.prix_kg ? Number(poudre.prix_kg) : 25
        const coutCoucheRevient = surface * consommationM2 * prixPoudreKg
        const coutCoucheVente = coutCoucheRevient * (1 + params.marge_poudre_pct / 100)
        
        coutPoudreRevient += coutCoucheRevient
        coutPoudreVente += coutCoucheVente
      }
    })
    
    // Coût main d'œuvre (multiplié par nombre de couches)
    const nbCouches = item.couches.length || 1
    const tempsMo = surface * params.temps_mo_m2 * nbCouches
    const coutMoRevient = tempsMo * params.taux_mo_heure
    const coutMoVente = coutMoRevient * (1 + params.marge_mo_pct / 100)
    
    // Coût consommables
    const coutConsommables = surface * params.cout_consommables_m2 * nbCouches
    
    // Totaux
    const totalRevient = coutPoudreRevient + coutMoRevient + coutConsommables
    const totalHt = coutPoudreVente + coutMoVente + coutConsommables
    
    return {
      surface_m2: surface,
      cout_poudre_revient: coutPoudreRevient,
      cout_poudre_vente: coutPoudreVente,
      cout_mo_revient: coutMoRevient,
      cout_mo_vente: coutMoVente,
      cout_consommables: coutConsommables,
      total_revient: totalRevient,
      total_ht: totalHt,
    }
  }

  // Ajouter un item
  const addItem = () => {
    const newItem: DevisItem = {
      id: `item-${Date.now()}`,
      designation: '',
      longueur: 0,
      largeur: 0,
      hauteur: undefined,
      quantite: 1,
      surface_m2: 0,
      couches: [{ id: `couche-${Date.now()}`, type: 'base' }],
      cout_poudre_revient: 0,
      cout_poudre_vente: 0,
      cout_mo_revient: 0,
      cout_mo_vente: 0,
      cout_consommables: 0,
      total_revient: 0,
      total_ht: 0,
    }
    setFormData({ ...formData, items: [...formData.items, newItem] })
  }

  // Supprimer un item
  const removeItem = (itemId: string) => {
    setFormData({ ...formData, items: formData.items.filter(item => item.id !== itemId) })
  }

  // Ajouter une couche à un item
  const addCouche = (itemId: string) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId) {
        const newCouche: Couche = {
          id: `couche-${Date.now()}`,
          type: 'autre',
        }
        const updatedItem = { ...item, couches: [...item.couches, newCouche] }
        const costs = calculateItemCosts(updatedItem)
        return { ...updatedItem, ...costs }
      }
      return item
    })
    setFormData({ ...formData, items: updatedItems })
  }

  // Supprimer une couche
  const removeCouche = (itemId: string, coucheId: string) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId && item.couches.length > 1) {
        const updatedItem = { ...item, couches: item.couches.filter(c => c.id !== coucheId) }
        const costs = calculateItemCosts(updatedItem)
        return { ...updatedItem, ...costs }
      }
      return item
    })
    setFormData({ ...formData, items: updatedItems })
  }

  // Mettre à jour une couche
  const updateCouche = (itemId: string, coucheId: string, updates: Partial<Couche>) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId) {
        const updatedCouches = item.couches.map(couche => 
          couche.id === coucheId ? { ...couche, ...updates } : couche
        )
        const updatedItem = { ...item, couches: updatedCouches }
        const costs = calculateItemCosts(updatedItem)
        return { ...updatedItem, ...costs }
      }
      return item
    })
    setFormData({ ...formData, items: updatedItems })
  }

  // Mettre à jour un item
  const updateItem = (itemId: string, updates: Partial<DevisItem>) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates }
        // Recalculer si dimensions ou quantité changent
        if (updates.longueur !== undefined || updates.largeur !== undefined || 
            updates.hauteur !== undefined || updates.quantite !== undefined) {
          const costs = calculateItemCosts(updatedItem)
          return { ...updatedItem, ...costs }
        }
        return updatedItem
      }
      return item
    })
    setFormData({ ...formData, items: updatedItems })
  }

  // Calculer totaux avec remise
  const calculateTotals = () => {
    const totalRevient = formData.items.reduce((sum, item) => sum + item.total_revient, 0)
    let totalHtBrut = formData.items.reduce((sum, item) => sum + item.total_ht, 0)
    
    // Appliquer la remise
    let montantRemise = 0
    if (remise.type === 'pourcentage' && remise.valeur > 0) {
      montantRemise = totalHtBrut * (remise.valeur / 100)
    } else if (remise.type === 'montant' && remise.valeur > 0) {
      montantRemise = remise.valeur
    }
    
    const totalHt = Math.max(0, totalHtBrut - montantRemise)
    const totalTtc = totalHt * (1 + params.tva_rate / 100)
    const margeEuros = totalHt - totalRevient
    const margePct = totalRevient > 0 ? (margeEuros / totalRevient) * 100 : 0
    
    return { totalRevient, totalHtBrut, montantRemise, totalHt, totalTtc, margeEuros, margePct }
  }

  const totals = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.client_id) {
      setError('Veuillez sélectionner un client')
      setLoading(false)
      return
    }

    if (formData.items.length === 0) {
      setError('Veuillez ajouter au moins un item')
      setLoading(false)
      return
    }

    try {
      // Générer numéro si nouveau devis
      let numero = formData.numero || initialData?.numero
      if (!numero && !devisId) {
        const { data: devisData, count: devisCount } = await supabase
          .from('devis')
          .select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelierId)

        const year = new Date().getFullYear()
        const nextNum = (devisCount || 0) + 1
        numero = `DEV-${year}-${String(nextNum).padStart(4, '0')}`
      }

      const devisData = {
        atelier_id: atelierId,
        client_id: formData.client_id,
        numero: numero || formData.numero,
        status: 'brouillon',
        total_ht: totals.totalHt,
        total_ttc: totals.totalTtc,
        tva_rate: params.tva_rate,
        items: formData.items,
        remise: remise,
        total_revient: totals.totalRevient,
        marge_pct: totals.margePct,
        created_by: userId,
      }

      if (devisId) {
        const { error: updateError } = await supabase
          .from('devis')
          .update(devisData)
          .eq('id', devisId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('devis')
          .insert(devisData)

        if (insertError) throw insertError
      }

      // Nettoyer le brouillon après sauvegarde réussie
      clearDraft()
      
      router.push('/app/devis')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors text-sm"
  const readOnlyClasses = "w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed text-sm"

  const typeCoucheLabels: Record<Couche['type'], string> = {
    primaire: '🛡️ Primaire',
    base: '🎨 Base/Couleur',
    vernis: '✨ Vernis',
    autre: '📦 Autre',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Auto-save status */}
        {!devisId && (
          <div className="flex items-center justify-end gap-2 text-xs">
            {autoSaveStatus === 'saving' && (
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sauvegarde automatique...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                ✓ Brouillon sauvegardé
                {lastSaved && ` à ${lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                ⚠️ Erreur de sauvegarde
              </span>
            )}
          </div>
        )}

        {/* Informations générales */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Informations générales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client *
              </label>
              <div className="flex gap-2">
                <select
                  id="client_id"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                  className={`${inputClasses} flex-1`}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} ({client.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowClientModal(true)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 text-sm font-medium whitespace-nowrap"
                  title="Créer un nouveau client"
                >
                  <span>+</span>
                  <span className="hidden sm:inline">Nouveau</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                TVA (%)
              </label>
              <input
                type="number"
                value={params.tva_rate}
                readOnly
                className={readOnlyClasses}
                title="Configuré dans les paramètres atelier"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Défini dans Paramètres</p>
            </div>
          </div>
        </div>

        {/* Paramètres de calcul (lecture seule) */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-lg p-4 sm:p-6 transition-colors border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300">Paramètres atelier</h2>
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">🔒 Lecture seule</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Ces paramètres sont définis dans <a href="/app/parametres" className="text-blue-600 hover:underline">Paramètres Atelier</a>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Taux MO</label>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{params.taux_mo_heure} €/h</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Temps/m²</label>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{params.temps_mo_m2} h</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Marge poudre</label>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">{params.marge_poudre_pct}%</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Marge MO</label>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">{params.marge_mo_pct}%</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">Conso.</label>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{params.cout_consommables_m2} €/m²</p>
            </div>
          </div>
        </div>

        {/* Items avec multi-couches */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Pièces / Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="w-full sm:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + Ajouter un item
            </button>
          </div>

          {formData.items.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">Aucun item. Cliquez sur "Ajouter un item" pour commencer.</p>
          ) : (
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Item #{index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-4">
                    <div className="col-span-2 sm:col-span-5">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Désignation *</label>
                      <input
                        type="text"
                        value={item.designation}
                        onChange={(e) => updateItem(item.id, { designation: e.target.value })}
                        required
                        className={inputClasses}
                        placeholder="Ex: Jante avant droite"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Long. (mm) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.longueur || ''}
                        onChange={(e) => updateItem(item.id, { longueur: parseFloat(e.target.value) || 0 })}
                        required
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Larg. (mm) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.largeur || ''}
                        onChange={(e) => updateItem(item.id, { largeur: parseFloat(e.target.value) || 0 })}
                        required
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Haut. (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.hauteur || ''}
                        onChange={(e) => updateItem(item.id, { hauteur: parseFloat(e.target.value) || undefined })}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantité *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={item.quantite || 1}
                        onChange={(e) => updateItem(item.id, { quantite: parseInt(e.target.value) || 1 })}
                        required
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Surface</label>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{item.surface_m2.toFixed(3)} m²</p>
                    </div>
                  </div>

                  {/* Couches de poudre */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">🎨 Couches de poudre ({item.couches.length})</h4>
                      <button
                        type="button"
                        onClick={() => addCouche(item.id)}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        + Ajouter couche
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {item.couches.map((couche, coucheIndex) => (
                        <div key={couche.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                          <span className="text-xs font-bold text-gray-500 w-6">{coucheIndex + 1}.</span>
                          
                          <select
                            value={couche.type}
                            onChange={(e) => updateCouche(item.id, couche.id, { type: e.target.value as Couche['type'] })}
                            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="primaire">🛡️ Primaire</option>
                            <option value="base">🎨 Base</option>
                            <option value="vernis">✨ Vernis</option>
                            <option value="autre">📦 Autre</option>
                          </select>
                          
                          <select
                            value={couche.poudre_id || ''}
                            onChange={(e) => updateCouche(item.id, couche.id, { poudre_id: e.target.value || undefined })}
                            className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">-- Sélectionner poudre --</option>
                            {poudres.map(poudre => (
                              <option key={poudre.id} value={poudre.id}>
                                {poudre.marque} {poudre.reference} - {poudre.finition}
                                {poudre.ral && ` (${poudre.ral})`}
                                {poudre.prix_kg && ` - ${poudre.prix_kg}€/kg`}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentItemIdForPoudre(item.id)
                              setCurrentCoucheIdForPoudre(couche.id)
                              setShowPoudreModal(true)
                            }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                            title="Créer une nouvelle poudre"
                          >
                            +
                          </button>
                          
                          {item.couches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCouche(item.id, couche.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Résultats calcul item */}
                  <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Poudre (revient)</span>
                      <p className="font-bold text-gray-600 dark:text-gray-400">{item.cout_poudre_revient.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">MO (revient)</span>
                      <p className="font-bold text-gray-600 dark:text-gray-400">{item.cout_mo_revient.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Prix revient</span>
                      <p className="font-bold text-gray-700 dark:text-gray-300">{item.total_revient.toFixed(2)} €</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                      <span className="text-orange-600 dark:text-orange-400 block">Prix vente HT</span>
                      <p className="font-bold text-orange-600 dark:text-orange-400 text-base">{item.total_ht.toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remise */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">🏷️ Remise</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <select
                value={remise.type}
                onChange={(e) => setRemise({ ...remise, type: e.target.value as 'pourcentage' | 'montant' })}
                className={inputClasses}
              >
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="montant">Montant fixe (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {remise.type === 'pourcentage' ? 'Pourcentage' : 'Montant'}
              </label>
              <input
                type="number"
                step={remise.type === 'pourcentage' ? '0.1' : '0.01'}
                min="0"
                max={remise.type === 'pourcentage' ? '100' : undefined}
                value={remise.valeur || ''}
                onChange={(e) => setRemise({ ...remise, valeur: parseFloat(e.target.value) || 0 })}
                className={inputClasses}
                placeholder={remise.type === 'pourcentage' ? '10' : '50'}
              />
            </div>
            {remise.valeur > 0 && (
              <div className="text-sm">
                <span className="text-gray-500">Remise appliquée: </span>
                <span className="font-bold text-green-600">-{totals.montantRemise.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Totaux et Rentabilité */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">📊 Synthèse et Rentabilité</h2>
          
          {/* Prix de revient */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Coût revient total</label>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{totals.totalRevient.toFixed(2)} €</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prix vente brut</label>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{totals.totalHtBrut.toFixed(2)} €</p>
            </div>
            {remise.valeur > 0 && (
              <div>
                <label className="block text-xs font-medium text-green-600 dark:text-green-400 mb-1">Remise</label>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">-{totals.montantRemise.toFixed(2)} €</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Marge brute</label>
              <p className={`text-lg font-bold ${totals.margeEuros >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.margeEuros.toFixed(2)} € ({totals.margePct.toFixed(1)}%)
              </p>
            </div>
          </div>
          
          {/* Totaux finaux */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total HT</label>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {totals.totalHt.toFixed(2)} €
              </p>
            </div>
            <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <label className="block text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">Total TTC ({params.tva_rate}%)</label>
              <p className="text-2xl sm:text-3xl font-black text-orange-600 dark:text-orange-400">
                {totals.totalTtc.toFixed(2)} €
              </p>
            </div>
          </div>
          
          {/* Alerte marge négative */}
          {totals.margeEuros < 0 && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                ⚠️ Attention: La marge est négative ! Vérifiez vos prix ou ajustez les paramètres dans Paramètres Atelier.
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className={inputClasses}
            placeholder="Notes internes..."
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <a
            href="/app/devis"
            className="w-full sm:w-auto text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </a>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : devisId ? 'Mettre à jour' : 'Enregistrer le devis'}
          </button>
        </div>
      </form>

      {/* Modals de création rapide */}
      <QuickCreateClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        atelierId={atelierId}
        onClientCreated={(newClient) => {
          setClients([...clients, newClient])
          setFormData({ ...formData, client_id: newClient.id })
        }}
      />

      <QuickCreatePoudreModal
        isOpen={showPoudreModal}
        onClose={() => {
          setShowPoudreModal(false)
          setCurrentItemIdForPoudre(null)
          setCurrentCoucheIdForPoudre(null)
        }}
        atelierId={atelierId}
        onPoudreCreated={(newPoudre) => {
          setPoudres([...poudres, newPoudre])
          // Si on a un item et une couche en cours, leur assigner la nouvelle poudre
          if (currentItemIdForPoudre && currentCoucheIdForPoudre) {
            updateCouche(currentItemIdForPoudre, currentCoucheIdForPoudre, { poudre_id: newPoudre.id })
          }
        }}
      />
    </div>
  )
}
