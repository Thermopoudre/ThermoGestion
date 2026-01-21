'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface PoudreFormProps {
  atelierId: string
  poudreId?: string
  initialData?: {
    marque?: string
    reference?: string
    type?: string
    ral?: string
    finition?: string
    densite?: number
    epaisseur_conseillee?: number
    consommation_m2?: number
    temp_cuisson?: number
    duree_cuisson?: number
    source?: 'manual' | 'thermopoudre' | 'concurrent'
    stock_initial_kg?: number
  }
}

export function PoudreForm({ atelierId, poudreId, initialData }: PoudreFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    marque: initialData?.marque || '',
    reference: initialData?.reference || '',
    type: initialData?.type || '',
    ral: initialData?.ral || '',
    finition: initialData?.finition || 'mat',
    densite: initialData?.densite?.toString() || '',
    epaisseur_conseillee: initialData?.epaisseur_conseillee?.toString() || '',
    consommation_m2: initialData?.consommation_m2?.toString() || '',
    temp_cuisson: initialData?.temp_cuisson?.toString() || '',
    duree_cuisson: initialData?.duree_cuisson?.toString() || '',
    source: initialData?.source || ('manual' as 'manual' | 'thermopoudre' | 'concurrent'),
    stock_initial_kg: initialData?.stock_initial_kg?.toString() || '0',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const poudreData = {
        atelier_id: atelierId,
        marque: formData.marque,
        reference: formData.reference,
        type: formData.type,
        ral: formData.ral || null,
        finition: formData.finition,
        densite: formData.densite ? parseFloat(formData.densite) : null,
        epaisseur_conseillee: formData.epaisseur_conseillee ? parseFloat(formData.epaisseur_conseillee) : null,
        consommation_m2: formData.consommation_m2 ? parseFloat(formData.consommation_m2) : null,
        temp_cuisson: formData.temp_cuisson ? parseInt(formData.temp_cuisson) : null,
        duree_cuisson: formData.duree_cuisson ? parseInt(formData.duree_cuisson) : null,
        source: formData.source,
      }

      let newPoudreId = poudreId

      if (poudreId) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('poudres')
          .update(poudreData)
          .eq('id', poudreId)

        if (updateError) throw updateError
      } else {
        // Création
        const { data: newPoudre, error: insertError } = await supabase
          .from('poudres')
          .insert(poudreData)
          .select()
          .single()

        if (insertError) throw insertError
        newPoudreId = newPoudre.id

        // Créer le stock initial
        const stockInitial = parseFloat(formData.stock_initial_kg) || 0
        if (stockInitial > 0) {
          const { error: stockError } = await supabase
            .from('stock_poudres')
            .insert({
              atelier_id: atelierId,
              poudre_id: newPoudreId,
              stock_theorique_kg: stockInitial,
              stock_reel_kg: stockInitial,
            })

          if (stockError) {
            console.error('Erreur création stock:', stockError)
            // Ne pas bloquer si le stock échoue
          }
        } else {
          // Créer un stock à zéro quand même
          await supabase.from('stock_poudres').insert({
            atelier_id: atelierId,
            poudre_id: newPoudreId,
            stock_theorique_kg: 0,
          })
        }
      }

      router.push(`/app/poudres${newPoudreId ? `/${newPoudreId}` : ''}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="marque" className="block text-sm font-medium text-gray-700 mb-2">
              Marque *
            </label>
            <input
              id="marque"
              type="text"
              value={formData.marque}
              onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Thermopoudre"
            />
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
              Référence *
            </label>
            <input
              id="reference"
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="EP-1234"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
              Type *
            </label>
            <input
              id="type"
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Époxy, Polyester, etc."
            />
          </div>

          <div>
            <label htmlFor="finition" className="block text-sm font-medium text-gray-700 mb-2">
              Finition *
            </label>
            <select
              id="finition"
              value={formData.finition}
              onChange={(e) => setFormData({ ...formData, finition: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="mat">Mat</option>
              <option value="satin">Satin</option>
              <option value="brillant">Brillant</option>
              <option value="texture">Texture</option>
              <option value="metallic">Métallique</option>
            </select>
          </div>

          <div>
            <label htmlFor="ral" className="block text-sm font-medium text-gray-700 mb-2">
              RAL
            </label>
            <input
              id="ral"
              type="text"
              value={formData.ral}
              onChange={(e) => setFormData({ ...formData, ral: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="RAL 9010"
            />
          </div>

          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
            <select
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="manual">Manuel</option>
              <option value="thermopoudre">Thermopoudre</option>
              <option value="concurrent">Concurrent</option>
            </select>
          </div>

          <div>
            <label htmlFor="densite" className="block text-sm font-medium text-gray-700 mb-2">
              Densité (g/cm³)
            </label>
            <input
              id="densite"
              type="number"
              step="0.01"
              value={formData.densite}
              onChange={(e) => setFormData({ ...formData, densite: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1.5"
            />
          </div>

          <div>
            <label htmlFor="epaisseur_conseillee" className="block text-sm font-medium text-gray-700 mb-2">
              Épaisseur conseillée (µm)
            </label>
            <input
              id="epaisseur_conseillee"
              type="number"
              step="1"
              value={formData.epaisseur_conseillee}
              onChange={(e) => setFormData({ ...formData, epaisseur_conseillee: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="60"
            />
          </div>

          <div>
            <label htmlFor="consommation_m2" className="block text-sm font-medium text-gray-700 mb-2">
              Consommation (kg/m²)
            </label>
            <input
              id="consommation_m2"
              type="number"
              step="0.01"
              value={formData.consommation_m2}
              onChange={(e) => setFormData({ ...formData, consommation_m2: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.15"
            />
          </div>

          <div>
            <label htmlFor="temp_cuisson" className="block text-sm font-medium text-gray-700 mb-2">
              Température cuisson (°C)
            </label>
            <input
              id="temp_cuisson"
              type="number"
              step="1"
              value={formData.temp_cuisson}
              onChange={(e) => setFormData({ ...formData, temp_cuisson: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="200"
            />
          </div>

          <div>
            <label htmlFor="duree_cuisson" className="block text-sm font-medium text-gray-700 mb-2">
              Durée cuisson (min)
            </label>
            <input
              id="duree_cuisson"
              type="number"
              step="1"
              value={formData.duree_cuisson}
              onChange={(e) => setFormData({ ...formData, duree_cuisson: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="15"
            />
          </div>

          {!poudreId && (
            <div className="md:col-span-2">
              <label htmlFor="stock_initial_kg" className="block text-sm font-medium text-gray-700 mb-2">
                Stock initial (kg) - Optionnel
              </label>
              <input
                id="stock_initial_kg"
                type="number"
                step="0.01"
                value={formData.stock_initial_kg}
                onChange={(e) => setFormData({ ...formData, stock_initial_kg: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : poudreId ? 'Mettre à jour' : 'Créer la poudre'}
          </button>
          <a
            href="/app/poudres"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </form>
    </div>
  )
}
