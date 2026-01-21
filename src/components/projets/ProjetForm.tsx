'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateClientModal } from '@/components/ui/QuickCreateClientModal'
import { QuickCreatePoudreModal } from '@/components/ui/QuickCreatePoudreModal'
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

export function ProjetForm({ atelierId, userId, clients: initialClients, poudres: initialPoudres, projetId, initialData }: ProjetFormProps) {
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

  const inputClasses = "w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors text-sm sm:text-base"

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Informations générales</h2>
          <div className="space-y-4 sm:space-y-6">
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nom du projet *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className={inputClasses}
                placeholder="Ex: Jantes BMW série 3"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="sm:col-span-2 md:col-span-1">
                <label htmlFor="poudre_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Poudre utilisée
                </label>
                <div className="flex gap-2">
                  <select
                    id="poudre_id"
                    value={formData.poudre_id}
                    onChange={(e) => setFormData({ ...formData, poudre_id: e.target.value })}
                    className={`${inputClasses} flex-1`}
                  >
                    <option value="">Sélectionner une poudre</option>
                    {poudres.map(poudre => (
                      <option key={poudre.id} value={poudre.id}>
                        {poudre.marque} {poudre.reference} - {poudre.finition}
                        {poudre.ral && ` (RAL ${poudre.ral})`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowPoudreModal(true)}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 text-sm font-medium whitespace-nowrap"
                    title="Créer une nouvelle poudre"
                  >
                    <span>+</span>
                    <span className="hidden sm:inline">Nouveau</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="couches" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nb de couches *
                </label>
                <input
                  id="couches"
                  type="number"
                  min="1"
                  max="3"
                  value={formData.couches}
                  onChange={(e) => setFormData({ ...formData, couches: parseInt(e.target.value) || 1 })}
                  required
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="temp_cuisson" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Température (°C)
                </label>
                <input
                  id="temp_cuisson"
                  type="number"
                  step="1"
                  value={formData.temp_cuisson}
                  onChange={(e) => setFormData({ ...formData, temp_cuisson: e.target.value })}
                  className={inputClasses}
                  placeholder="200"
                />
              </div>

              <div>
                <label htmlFor="duree_cuisson" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Durée (min)
                </label>
                <input
                  id="duree_cuisson"
                  type="number"
                  step="1"
                  value={formData.duree_cuisson}
                  onChange={(e) => setFormData({ ...formData, duree_cuisson: e.target.value })}
                  className={inputClasses}
                  placeholder="15"
                />
              </div>

              <div>
                <label htmlFor="date_depot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date dépôt
                </label>
                <input
                  id="date_depot"
                  type="date"
                  value={formData.date_depot}
                  onChange={(e) => setFormData({ ...formData, date_depot: e.target.value })}
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="date_promise" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date promise
                </label>
                <input
                  id="date_promise"
                  type="date"
                  value={formData.date_promise}
                  onChange={(e) => setFormData({ ...formData, date_promise: e.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <a
            href="/app/projets"
            className="w-full sm:w-auto text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </a>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : projetId ? 'Mettre à jour' : 'Créer le projet'}
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
        onClose={() => setShowPoudreModal(false)}
        atelierId={atelierId}
        onPoudreCreated={(newPoudre) => {
          setPoudres([...poudres, newPoudre])
          setFormData({ ...formData, poudre_id: newPoudre.id })
        }}
      />
    </div>
  )
}
