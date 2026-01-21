'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateModal } from './QuickCreateModal'
import type { Database } from '@/types/database.types'

type DefautType = Database['public']['Tables']['defaut_types']['Row']

interface QuickCreateDefautTypeModalProps {
  isOpen: boolean
  onClose: () => void
  atelierId: string
  onDefautTypeCreated: (defautType: DefautType) => void
}

export function QuickCreateDefautTypeModal({ isOpen, onClose, atelierId, onDefautTypeCreated }: QuickCreateDefautTypeModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
  })

  const categories = [
    'Préparation',
    'Application',
    'Cuisson',
    'Finition',
    'Autre',
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: newDefautType, error: insertError } = await supabase
        .from('defaut_types')
        .insert({
          atelier_id: atelierId,
          name: formData.name,
          category: formData.category || null,
          description: formData.description || null,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Reset form
      setFormData({ name: '', category: '', description: '' })
      
      // Notify parent and close
      onDefautTypeCreated(newDefautType)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"

  return (
    <QuickCreateModal isOpen={isOpen} onClose={onClose} title="Création rapide - Type de défaut">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="qc_defaut_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nom du défaut *
          </label>
          <input
            id="qc_defaut_name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={inputClasses}
            placeholder="Ex: Coulure, Grain, Manque de poudre..."
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="qc_defaut_category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Catégorie
          </label>
          <select
            id="qc_defaut_category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className={inputClasses}
          >
            <option value="">Aucune catégorie</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="qc_defaut_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="qc_defaut_description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className={inputClasses}
            placeholder="Description du type de défaut..."
          />
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
          💡 Ce type sera disponible pour les futures déclarations de retouche
        </p>
      </form>
    </QuickCreateModal>
  )
}
