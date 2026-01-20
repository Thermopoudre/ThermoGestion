'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
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

export function DevisForm({ atelierId, userId, clients, poudres, devisId, initialData }: DevisFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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

  return (
    <div className="max-w-6xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Informations générales */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Informations générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <select
                id="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner un client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} ({client.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tva_rate" className="block text-sm font-medium text-gray-700 mb-2">
                TVA (%)
              </label>
              <input
                id="tva_rate"
                type="number"
                step="0.1"
                value={params.tva_rate}
                onChange={(e) => setParams({ ...params, tva_rate: parseFloat(e.target.value) || 20 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Paramètres de calcul */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Paramètres de calcul</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Prix poudre (€/kg)</label>
              <input
                type="number"
                step="0.01"
                value={params.prix_poudre_kg}
                onChange={(e) => setParams({ ...params, prix_poudre_kg: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Taux MO (€/h)</label>
              <input
                type="number"
                step="0.01"
                value={params.taux_mo_heure}
                onChange={(e) => setParams({ ...params, taux_mo_heure: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Marge poudre (%)</label>
              <input
                type="number"
                step="0.1"
                value={params.marge_poudre_pct}
                onChange={(e) => setParams({ ...params, marge_poudre_pct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Marge MO (%)</label>
              <input
                type="number"
                step="0.1"
                value={params.marge_mo_pct}
                onChange={(e) => setParams({ ...params, marge_mo_pct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Pièces / Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + Ajouter un item
            </button>
          </div>

          {formData.items.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Aucun item. Cliquez sur "Ajouter un item" pour commencer.</p>
          ) : (
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Item #{index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Désignation *</label>
                      <input
                        type="text"
                        value={item.designation}
                        onChange={(e) => updateItem(item.id, { designation: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Jante avant droite"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Longueur (mm) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.longueur || ''}
                        onChange={(e) => updateItem(item.id, { longueur: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Largeur (mm) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.largeur || ''}
                        onChange={(e) => updateItem(item.id, { largeur: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hauteur (mm) - Optionnel</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.hauteur || ''}
                        onChange={(e) => updateItem(item.id, { hauteur: parseFloat(e.target.value) || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={item.quantite || 1}
                        onChange={(e) => updateItem(item.id, { quantite: parseInt(e.target.value) || 1 })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Poudre</label>
                      <select
                        value={item.poudre_id || ''}
                        onChange={(e) => updateItem(item.id, { poudre_id: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Aucune</option>
                        {poudres.map(poudre => (
                          <option key={poudre.id} value={poudre.id}>
                            {poudre.marque} {poudre.reference} - {poudre.finition}
                            {poudre.ral && ` (RAL ${poudre.ral})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Couches *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="3"
                        value={item.couches || 1}
                        onChange={(e) => updateItem(item.id, { couches: parseInt(e.target.value) || 1 })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* Résultats calcul */}
                  <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Surface:</span>
                      <p className="font-bold text-gray-900">{item.surface_m2.toFixed(2)} m²</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Poudre:</span>
                      <p className="font-bold text-gray-900">{item.cout_poudre.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-600">M.O.:</span>
                      <p className="font-bold text-gray-900">{item.cout_mo.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Consommables:</span>
                      <p className="font-bold text-gray-900">{item.cout_consommables.toFixed(2)} €</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total HT:</span>
                      <p className="font-bold text-blue-600">{item.total_ht.toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totaux */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Totaux</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Total HT</label>
              <p className="text-3xl font-black text-gray-900">
                {totalHt.toFixed(2)} €
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Total TTC (TVA {params.tva_rate}%)</label>
              <p className="text-3xl font-black text-blue-600">
                {totalTtc.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Notes internes..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : devisId ? 'Mettre à jour' : 'Enregistrer le devis'}
          </button>
          <a
            href="/app/devis"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </form>
    </div>
  )
}
