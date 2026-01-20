'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface ProjetFormProps {
  atelierId: string
  userId: string
  clients: Client[]
  poudres: Poudre[]
  projetId?: string
  initialData?: any
}

export function ProjetForm({ atelierId, userId, clients, poudres, projetId, initialData }: ProjetFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || '',
    name: initialData?.name || '',
    poudre_id: initialData?.poudre_id || '',
    couches: initialData?.couches || 1,
    temp_cuisson: initialData?.temp_cuisson?.toString() || '',
    duree_cuisson: initialData?.duree_cuisson?.toString() || '',
    date_depot: initialData?.date_depot || new Date().toISOString().split('T')[0],
    date_promise: initialData?.date_promise || '',
    workflow_config: initialData?.workflow_config || [
      { name: 'Préparation', order: 0 },
      { name: 'Application poudre', order: 1 },
      { name: 'Cuisson', order: 2 },
      { name: 'Contrôle qualité', order: 3 },
      { name: 'Prêt', order: 4 },
    ],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.client_id) {
      setError('Veuillez sélectionner un client')
      setLoading(false)
      return
    }

    try {
      // Générer numéro si nouveau projet
      let numero = ''
      if (!projetId) {
        const { data: lastProjet } = await supabase
          .from('projets')
          .select('numero')
          .eq('atelier_id', atelierId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const year = new Date().getFullYear()
        const lastNum = lastProjet?.numero 
          ? parseInt(lastProjet.numero.split('-')[2] || '0')
          : 0
        numero = `PROJ-${year}-${String(lastNum + 1).padStart(4, '0')}`
      }

      const projetData = {
        atelier_id: atelierId,
        client_id: formData.client_id,
        numero: numero || initialData?.numero,
        name: formData.name,
        status: 'en_cours',
        poudre_id: formData.poudre_id || null,
        couches: formData.couches,
        temp_cuisson: formData.temp_cuisson ? parseInt(formData.temp_cuisson) : null,
        duree_cuisson: formData.duree_cuisson ? parseInt(formData.duree_cuisson) : null,
        date_depot: formData.date_depot || null,
        date_promise: formData.date_promise || null,
        workflow_config: formData.workflow_config,
        current_step: 0,
        pieces: [],
        created_by: userId,
      }

      if (projetId) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('projets')
          .update(projetData)
          .eq('id', projetId)

        if (updateError) throw updateError
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('projets')
          .insert(projetData)

        if (insertError) throw insertError
      }

      router.push('/app/projets')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Informations générales</h2>
          <div className="space-y-6">
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nom du projet *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Jantes BMW série 3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="poudre_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Poudre utilisée
                </label>
                <select
                  id="poudre_id"
                  value={formData.poudre_id}
                  onChange={(e) => setFormData({ ...formData, poudre_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une poudre</option>
                  {poudres.map(poudre => (
                    <option key={poudre.id} value={poudre.id}>
                      {poudre.marque} {poudre.reference} - {poudre.finition}
                      {poudre.ral && ` (RAL ${poudre.ral})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="couches" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de couches *
                </label>
                <input
                  id="couches"
                  type="number"
                  min="1"
                  max="3"
                  value={formData.couches}
                  onChange={(e) => setFormData({ ...formData, couches: parseInt(e.target.value) || 1 })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

              <div>
                <label htmlFor="date_depot" className="block text-sm font-medium text-gray-700 mb-2">
                  Date dépôt
                </label>
                <input
                  id="date_depot"
                  type="date"
                  value={formData.date_depot}
                  onChange={(e) => setFormData({ ...formData, date_depot: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="date_promise" className="block text-sm font-medium text-gray-700 mb-2">
                  Date promise (livraison)
                </label>
                <input
                  id="date_promise"
                  type="date"
                  value={formData.date_promise}
                  onChange={(e) => setFormData({ ...formData, date_promise: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : projetId ? 'Mettre à jour' : 'Créer le projet'}
          </button>
          <a
            href="/app/projets"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </form>
    </div>
  )
}
