'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateModal } from './QuickCreateModal'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']

interface QuickCreateClientModalProps {
  isOpen: boolean
  onClose: () => void
  atelierId: string
  onClientCreated: (client: Client) => void
}

export function QuickCreateClientModal({ isOpen, onClose, atelierId, onClientCreated }: QuickCreateClientModalProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    type: 'particulier' as 'particulier' | 'professionnel',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          atelier_id: atelierId,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone || null,
          type: formData.type,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Reset form
      setFormData({ full_name: '', email: '', phone: '', type: 'particulier' })
      
      // Notify parent and close
      onClientCreated(newClient)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"

  return (
    <QuickCreateModal isOpen={isOpen} onClose={onClose} title="Création rapide - Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="qc_full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nom complet *
          </label>
          <input
            id="qc_full_name"
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
            className={inputClasses}
            placeholder="Jean Dupont"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="qc_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email *
          </label>
          <input
            id="qc_email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className={inputClasses}
            placeholder="jean.dupont@example.com"
          />
        </div>

        <div>
          <label htmlFor="qc_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Téléphone
          </label>
          <input
            id="qc_phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className={inputClasses}
            placeholder="06 12 34 56 78"
          />
        </div>

        <div>
          <label htmlFor="qc_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type
          </label>
          <select
            id="qc_type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'particulier' | 'professionnel' })}
            className={inputClasses}
          >
            <option value="particulier">Particulier</option>
            <option value="professionnel">Professionnel</option>
          </select>
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
          💡 Vous pourrez compléter les informations plus tard dans la fiche client
        </p>
      </form>
    </QuickCreateModal>
  )
}
