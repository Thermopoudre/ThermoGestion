'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface ClientFormProps {
  atelierId: string
  clientId?: string
  initialData?: {
    full_name?: string
    email?: string
    phone?: string
    address?: string
    type?: 'particulier' | 'professionnel'
    siret?: string
    tags?: string[]
    notes?: string
    facture_trigger?: 'pret' | 'livre'
  }
}

export function ClientForm({ atelierId, clientId, initialData }: ClientFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    type: initialData?.type || ('particulier' as 'particulier' | 'professionnel'),
    siret: initialData?.siret || '',
    tags: initialData?.tags?.join(', ') || '',
    notes: initialData?.notes || '',
    facture_trigger: initialData?.facture_trigger || ('pret' as 'pret' | 'livre'),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const tagsArray = formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
        : []

      const clientData = {
        atelier_id: atelierId,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
        type: formData.type,
        siret: formData.type === 'professionnel' ? (formData.siret || null) : null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        notes: formData.notes || null,
        facture_trigger: formData.facture_trigger,
      }

      if (clientId) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', clientId)

        if (updateError) throw updateError
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('clients')
          .insert(clientData)

        if (insertError) throw insertError
      }

      router.push('/app/clients')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 max-w-2xl w-full mx-auto transition-colors">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="sm:col-span-2">
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nom complet *
            </label>
            <input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="Jean Dupont"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="jean.dupont@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Téléphone
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="06 12 34 56 78"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Adresse
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="123 Rue de la République, 75001 Paris"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type *
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'particulier' | 'professionnel' })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <option value="particulier">Particulier</option>
              <option value="professionnel">Professionnel</option>
            </select>
          </div>

          {formData.type === 'professionnel' && (
            <div>
              <label htmlFor="siret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SIRET
              </label>
              <input
                id="siret"
                type="text"
                value={formData.siret}
                onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="123 456 789 00012"
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags (séparés par des virgules)
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="VIP, Fidèle, Nouveau"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              placeholder="Notes sur le client..."
            />
          </div>

          {/* Préférence de facturation */}
          <div className="sm:col-span-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <label htmlFor="facture_trigger" className="block text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">
              📧 Envoi automatique de la facture
            </label>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              Choisissez quand la facture doit être envoyée automatiquement par email au client.
            </p>
            <select
              id="facture_trigger"
              value={formData.facture_trigger}
              onChange={(e) => setFormData({ ...formData, facture_trigger: e.target.value as 'pret' | 'livre' })}
              className="w-full px-4 py-3 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <option value="pret">🟢 Quand le projet est PRÊT (avant récupération)</option>
              <option value="livre">🔵 Quand le projet est LIVRÉ (après récupération)</option>
            </select>
            <p className="text-xs text-orange-500 dark:text-blue-300 mt-2">
              💡 <strong>Prêt</strong> : Le client reçoit la facture dès que son projet est terminé, avant de venir le chercher.<br/>
              💡 <strong>Livré</strong> : Le client reçoit la facture après avoir récupéré son projet.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-4">
          <a
            href="/app/clients"
            className="w-full sm:w-auto text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </a>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : clientId ? 'Mettre à jour' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  )
}
