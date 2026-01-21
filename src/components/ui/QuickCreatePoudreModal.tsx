'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateModal } from './QuickCreateModal'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']

interface QuickCreatePoudreModalProps {
  isOpen: boolean
  onClose: () => void
  atelierId: string
  onPoudreCreated: (poudre: Poudre) => void
}

export function QuickCreatePoudreModal({ isOpen, onClose, atelierId, onPoudreCreated }: QuickCreatePoudreModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    marque: '',
    reference: '',
    type: 'Polyester',
    ral: '',
    finition: 'mat',
    prix_kg: '25',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: newPoudre, error: insertError } = await supabase
        .from('poudres')
        .insert({
          atelier_id: atelierId,
          marque: formData.marque,
          reference: formData.reference,
          type: formData.type,
          ral: formData.ral || null,
          finition: formData.finition,
          prix_kg: parseFloat(formData.prix_kg) || 25,
          source: 'manual',
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Créer un stock initial à zéro
      await supabase.from('stock_poudres').insert({
        atelier_id: atelierId,
        poudre_id: newPoudre.id,
        stock_theorique_kg: 0,
        stock_reel_kg: 0,
      })

      // Reset form
      setFormData({ marque: '', reference: '', type: 'Polyester', ral: '', finition: 'mat', prix_kg: '25' })
      
      // Notify parent and close
      onPoudreCreated(newPoudre)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"

  return (
    <QuickCreateModal isOpen={isOpen} onClose={onClose} title="Création rapide - Poudre">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="qc_marque" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Marque *
            </label>
            <input
              id="qc_marque"
              type="text"
              value={formData.marque}
              onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
              required
              className={inputClasses}
              placeholder="Thermopoudre"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="qc_reference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Référence *
            </label>
            <input
              id="qc_reference"
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              required
              className={inputClasses}
              placeholder="EP-1234"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="qc_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type *
            </label>
            <input
              id="qc_type"
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
              className={inputClasses}
              placeholder="Polyester, Époxy..."
            />
          </div>

          <div>
            <label htmlFor="qc_ral" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              RAL
            </label>
            <input
              id="qc_ral"
              type="text"
              value={formData.ral}
              onChange={(e) => setFormData({ ...formData, ral: e.target.value })}
              className={inputClasses}
              placeholder="9010"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="qc_finition" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Finition *
            </label>
            <select
              id="qc_finition"
              value={formData.finition}
              onChange={(e) => setFormData({ ...formData, finition: e.target.value })}
              className={inputClasses}
            >
              <option value="mat">Mat</option>
              <option value="satin">Satin</option>
              <option value="brillant">Brillant</option>
              <option value="texture">Texture</option>
              <option value="metallic">Métallique</option>
            </select>
          </div>

          <div>
            <label htmlFor="qc_prix_kg" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              💰 Prix (€/kg) *
            </label>
            <input
              id="qc_prix_kg"
              type="number"
              step="0.01"
              min="0"
              value={formData.prix_kg}
              onChange={(e) => setFormData({ ...formData, prix_kg: e.target.value })}
              required
              className="w-full px-4 py-3 border border-orange-300 dark:border-orange-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50 dark:bg-orange-900/20 text-gray-900 dark:text-white"
              placeholder="25.00"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-4 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Création...' : '+ Créer'}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 Vous pourrez compléter les caractéristiques techniques plus tard
        </p>
      </form>
    </QuickCreateModal>
  )
}
