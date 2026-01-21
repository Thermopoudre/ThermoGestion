'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateClientModal } from '@/components/ui/QuickCreateClientModal'
import { QuickCreatePoudreModal } from '@/components/ui/QuickCreatePoudreModal'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface DevisItem {
  id: string
  designation: string
  longueur: number
  largeur: number
  hauteur?: number
  quantite: number
  surface_m2: number
  poudre_id?: string
  couches: number
  cout_poudre: number
  cout_mo: number
  cout_consommables: number
  marge: number
  total_ht: number
}

interface DevisFormProps {
  atelierId: string
  userId: string
  clients: Client[]
  poudres: Poudre[]
  devisId?: string
  initialData?: any
}

export function DevisForm({ atelierId, userId, clients: initialClients, poudres: initialPoudres, devisId, initialData }: DevisFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Liste dynamique des clients et poudres (peut être mise à jour via création rapide)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [poudres, setPoudres] = useState<Poudre[]>(initialPoudres)
  
  // Modals de création rapide
  const [showClientModal, setShowClientModal] = useState(false)
  const [showPoudreModal, setShowPoudreModal] = useState(false)
  const [currentItemIdForPoudre, setCurrentItemIdForPoudre] = useState<string | null>(null)
  
  // Paramètres de calcul (avec valeurs par défaut)
  const [params, setParams] = useState({
    prix_poudre_kg: 25, // €/kg par défaut
    taux_mo_heure: 35, // €/h
    temps_mo_m2: 0.15, // heures/m²
    cout_consommables_m2: 2, // €/m²
    marge_poudre_pct: 30, // %
    marge_mo_pct: 50, // %
    marge_forfait: 0, // €
    tva_rate: 20, // %
  })

  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || '',
    numero: initialData?.numero || '',
    items: initialData?.items || ([] as DevisItem[]),
    notes: initialData?.notes || '',
  })

  // Calculer surface d'une pièce
  const calculateSurface = (longueur: number, largeur: number, hauteur?: number, quantite: number = 1): number => {
    if (hauteur) {
      // Surface totale d'un parallélépipède
      return quantite * 2 * (longueur * largeur + longueur * hauteur + largeur * hauteur) / 1000000 // conversion mm² -> m²
    }
    // Surface rectangle (2 faces)
    return quantite * 2 * (longueur * largeur) / 1000000 // conversion mm² -> m²
  }

  // Calculer coûts pour un item
  const calculateItemCosts = (item: DevisItem, poudre?: Poudre): Partial<DevisItem> => {
    const surface = calculateSurface(item.longueur, item.largeur, item.hauteur, item.quantite)
    
    // Coût poudre (consommation * prix * marge)
    const consommationM2 = poudre?.consommation_m2 ? Number(poudre.consommation_m2) : 0.15 // kg/m² par défaut
    const coutPoudreBrut = surface * consommationM2 * params.prix_poudre_kg
    const coutPoudre = coutPoudreBrut * (1 + params.marge_poudre_pct / 100)
    
    // Coût main d'œuvre
    const tempsMo = surface * params.temps_mo_m2
    const coutMoBrut = tempsMo * params.taux_mo_heure
    const coutMo = coutMoBrut * (1 + params.marge_mo_pct / 100)
    
    // Coût consommables
    const coutConsommables = surface * params.cout_consommables_m2
    
    // Total HT (avec marge forfait par item si besoin)
    const totalHt = (coutPoudre + coutMo + coutConsommables) * item.couches + params.marge_forfait / (formData.items.length || 1)
    
    return {
      surface_m2: surface,
      cout_poudre: coutPoudre * item.couches,
      cout_mo: coutMo * item.couches,
      cout_consommables: coutConsommables * item.couches,
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
      couches: 1,
      cout_poudre: 0,
      cout_mo: 0,
      cout_consommables: 0,
      marge: 0,
      total_ht: 0,
    }
    setFormData({ ...formData, items: [...formData.items, newItem] })
  }

  // Supprimer un item
  const removeItem = (itemId: string) => {
    setFormData({ ...formData, items: formData.items.filter(item => item.id !== itemId) })
  }

  // Mettre à jour un item
  const updateItem = (itemId: string, updates: Partial<DevisItem>) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates }
        // Recalculer si dimensions ou quantité changent
        if (updates.longueur !== undefined || updates.largeur !== undefined || 
            updates.hauteur !== undefined || updates.quantite !== undefined || 
            updates.couches !== undefined || updates.poudre_id !== undefined) {
          const poudre = poudres.find(p => p.id === updatedItem.poudre_id)
          const costs = calculateItemCosts(updatedItem, poudre)
          return { ...updatedItem, ...costs }
        }
        return updatedItem
      }
      return item
    })
    setFormData({ ...formData, items: updatedItems })
  }

  // Calculer totaux
  const calculateTotals = () => {
    const totalHt = formData.items.reduce((sum, item) => sum + item.total_ht, 0)
    const totalTtc = totalHt * (1 + params.tva_rate / 100)
    return { totalHt, totalTtc }
  }

  const { totalHt, totalTtc } = calculateTotals()

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
        const { data: lastDevis } = await supabase
          .from('devis')
          .select('numero')
          .eq('atelier_id', atelierId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Format: DEV-YYYY-NNNN
        const year = new Date().getFullYear()
        const lastNum = lastDevis?.numero 
          ? parseInt(lastDevis.numero.split('-')[2] || '0')
          : 0
        numero = `DEV-${year}-${String(lastNum + 1).padStart(4, '0')}`
      }

      const devisData = {
        atelier_id: atelierId,
        client_id: formData.client_id,
        numero: numero || formData.numero,
        status: 'brouillon',
        total_ht: totalHt,
        total_ttc: totalTtc,
        tva_rate: params.tva_rate,
        items: formData.items,
        created_by: userId,
      }

      if (devisId) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('devis')
          .update(devisData)
          .eq('id', devisId)

        if (updateError) throw updateError
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('devis')
          .insert(devisData)

        if (insertError) throw insertError
      }

      router.push('/app/devis')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors text-sm"

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
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
              <label htmlFor="tva_rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                TVA (%)
              </label>
              <input
                id="tva_rate"
                type="number"
                step="0.1"
                value={params.tva_rate}
                onChange={(e) => setParams({ ...params, tva_rate: parseFloat(e.target.value) || 20 })}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Paramètres de calcul */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Paramètres de calcul</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Prix poudre (€/kg)</label>
              <input
                type="number"
                step="0.01"
                value={params.prix_poudre_kg}
                onChange={(e) => setParams({ ...params, prix_poudre_kg: parseFloat(e.target.value) || 0 })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Taux MO (€/h)</label>
              <input
                type="number"
                step="0.01"
                value={params.taux_mo_heure}
                onChange={(e) => setParams({ ...params, taux_mo_heure: parseFloat(e.target.value) || 0 })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Marge poudre (%)</label>
              <input
                type="number"
                step="0.1"
                value={params.marge_poudre_pct}
                onChange={(e) => setParams({ ...params, marge_poudre_pct: parseFloat(e.target.value) || 0 })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Marge MO (%)</label>
              <input
                type="number"
                step="0.1"
                value={params.marge_mo_pct}
                onChange={(e) => setParams({ ...params, marge_mo_pct: parseFloat(e.target.value) || 0 })}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Items */}
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                    <div className="col-span-2 sm:col-span-3">
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

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Poudre</label>
                      <div className="flex gap-1">
                        <select
                          value={item.poudre_id || ''}
                          onChange={(e) => updateItem(item.id, { poudre_id: e.target.value || undefined })}
                          className={`${inputClasses} flex-1`}
                        >
                          <option value="">Aucune</option>
                          {poudres.map(poudre => (
                            <option key={poudre.id} value={poudre.id}>
                              {poudre.marque} {poudre.reference} - {poudre.finition}
                              {poudre.ral && ` (RAL ${poudre.ral})`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentItemIdForPoudre(item.id)
                            setShowPoudreModal(true)
                          }}
                          className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-bold"
                          title="Créer une nouvelle poudre"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Couches *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="3"
                        value={item.couches || 1}
                        onChange={(e) => updateItem(item.id, { couches: parseInt(e.target.value) || 1 })}
                        required
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  {/* Résultats calcul */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-300 dark:border-gray-600 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 block">Surface</span>
                      <p className="font-bold text-gray-900 dark:text-white">{item.surface_m2.toFixed(2)} m²</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 block">Poudre</span>
                      <p className="font-bold text-gray-900 dark:text-white">{item.cout_poudre.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 block">M.O.</span>
                      <p className="font-bold text-gray-900 dark:text-white">{item.cout_mo.toFixed(2)} €</p>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-gray-600 dark:text-gray-400 block">Conso.</span>
                      <p className="font-bold text-gray-900 dark:text-white">{item.cout_consommables.toFixed(2)} €</p>
                    </div>
                    <div className="col-span-3 sm:col-span-1 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400 block">Total HT</span>
                      <p className="font-bold text-orange-500 dark:text-blue-400 text-base sm:text-sm">{item.total_ht.toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totaux */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Totaux</h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">Total HT</label>
              <p className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {totalHt.toFixed(2)} €
              </p>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">Total TTC ({params.tva_rate}%)</label>
              <p className="text-xl sm:text-3xl font-black text-orange-500 dark:text-blue-400">
                {totalTtc.toFixed(2)} €
              </p>
            </div>
          </div>
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
        }}
        atelierId={atelierId}
        onPoudreCreated={(newPoudre) => {
          setPoudres([...poudres, newPoudre])
          // Si on a un item en cours, lui assigner la nouvelle poudre
          if (currentItemIdForPoudre) {
            updateItem(currentItemIdForPoudre, { poudre_id: newPoudre.id })
          }
        }}
      />
    </div>
  )
}
