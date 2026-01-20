'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface ConvertDevisToProjetProps {
  devis: Devis
  poudres: Poudre[]
  atelierId: string
  userId: string
}

export function ConvertDevisToProjet({ devis, poudres, atelierId, userId }: ConvertDevisToProjetProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: `Projet ${devis.numero}`,
    poudre_id: '',
    couches: 1,
    temp_cuisson: '',
    duree_cuisson: '',
    date_depot: new Date().toISOString().split('T')[0],
    date_promise: '',
    workflow_config: [
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

    try {
      // Générer numéro projet
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
      const numero = `PROJ-${year}-${String(lastNum + 1).padStart(4, '0')}`

      // Créer le projet
      const { data: projet, error: projetError } = await supabase
        .from('projets')
        .insert({
          atelier_id: atelierId,
          client_id: devis.client_id,
          devis_id: devis.id,
          numero,
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
          pieces: devis.items, // Copier les items du devis
          created_by: userId,
        })
        .select()
        .single()

      if (projetError) throw projetError

      // Mettre à jour le devis (statut converted)
      const { error: devisError } = await supabase
        .from('devis')
        .update({ status: 'converted' })
        .eq('id', devis.id)

      if (devisError) throw devisError

      // Journal d'audit
      await supabase.from('audit_logs').insert({
        atelier_id: atelierId,
        user_id: userId,
        action: 'convert',
        table_name: 'projets',
        record_id: projet.id,
        new_data: { from_devis: devis.id, numero, name: formData.name },
      })

      router.push(`/app/projets/${projet.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la conversion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Workflow par défaut :</strong> Le projet utilisera un workflow standard avec 5 étapes.
              Vous pourrez le modifier après création.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:from-green-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Conversion...' : '✓ Convertir en projet'}
            </button>
            <a
              href={`/app/devis/${devis.id}`}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
