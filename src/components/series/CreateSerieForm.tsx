'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row'] | null
type Projet = Database['public']['Tables']['projets']['Row'] & {
  poudres?: Database['public']['Tables']['poudres']['Row']
}

interface CreateSerieFormProps {
  atelierId: string
  poudre: Poudre
  projetsDisponibles: Projet[]
  projetsSelectionnes: Projet[]
}

export function CreateSerieForm({
  atelierId,
  poudre,
  projetsDisponibles,
  projetsSelectionnes: initialSelectionnes,
}: CreateSerieFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [selectedProjets, setSelectedProjets] = useState<string[]>(
    initialSelectionnes.map((p) => p.id)
  )
  const [dateCuisson, setDateCuisson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggleProjet = (projetId: string) => {
    setSelectedProjets((prev) =>
      prev.includes(projetId)
        ? prev.filter((id) => id !== projetId)
        : [...prev, projetId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (selectedProjets.length === 0) {
      setError('Sélectionnez au moins un projet')
      setLoading(false)
      return
    }

    if (!poudre) {
      setError('Poudre non sélectionnée')
      setLoading(false)
      return
    }

    try {
      // Générer un numéro de série
      const { data: lastSerie } = await supabase
        .from('series')
        .select('numero')
        .eq('atelier_id', atelierId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let numeroSerie = 'SER-001'
      if (lastSerie?.numero) {
        const match = lastSerie.numero.match(/SER-(\d+)/)
        if (match) {
          const num = parseInt(match[1]) + 1
          numeroSerie = `SER-${num.toString().padStart(3, '0')}`
        }
      }

      // Créer la série
      const { data: serie, error: serieError } = await supabase
        .from('series')
        .insert({
          atelier_id: atelierId,
          poudre_id: poudre.id,
          numero: numeroSerie,
          projets_ids: selectedProjets,
          date_cuisson: dateCuisson || null,
          status: 'en_attente',
        })
        .select('id')
        .single()

      if (serieError) throw serieError

      // Mettre à jour le statut des projets (optionnel, selon workflow)
      // Pour MVP, on laisse les projets dans leur statut actuel

      router.push(`/app/series/${serie.id}`)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la série')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Info poudre */}
        {poudre && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Poudre sélectionnée</h3>
            <div className="text-sm text-blue-800">
              <p>
                <strong>Référence:</strong> {poudre.reference}
              </p>
              <p>
                <strong>Finition:</strong> {poudre.finition} • <strong>Type:</strong> {poudre.type}
              </p>
              {poudre.ral && (
                <p>
                  <strong>RAL:</strong> {poudre.ral}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Date de cuisson */}
        <div>
          <label htmlFor="dateCuisson" className="block text-sm font-medium text-gray-700 mb-2">
            Date de cuisson prévue (optionnel)
          </label>
          <input
            id="dateCuisson"
            type="date"
            value={dateCuisson}
            onChange={(e) => setDateCuisson(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sélection projets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Projets à inclure ({selectedProjets.length} sélectionné(s))
          </label>
          <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
            {projetsDisponibles.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun projet disponible</p>
            ) : (
              projetsDisponibles.map((projet) => (
                <label
                  key={projet.id}
                  className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjets.includes(projet.id)}
                    onChange={() => handleToggleProjet(projet.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{projet.name}</p>
                    <p className="text-sm text-gray-600">#{projet.numero}</p>
                    {projet.date_promise && (
                      <p className="text-xs text-gray-500">
                        Date promise: {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading || selectedProjets.length === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Création...' : 'Créer la série'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </form>
  )
}
