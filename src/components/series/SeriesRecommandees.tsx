'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row'] & {
  poudres?: Database['public']['Tables']['poudres']['Row']
}

type Serie = Database['public']['Tables']['series']['Row'] & {
  poudres?: Database['public']['Tables']['poudres']['Row']
}

interface SeriesRecommandeesProps {
  projets: Projet[]
  series: Serie[]
  atelierId: string
}

interface GroupePoudre {
  poudre_id: string
  poudre: Database['public']['Tables']['poudres']['Row']
  projets: Projet[]
  total_pieces: number
  urgence_max: Date | null
}

export function SeriesRecommandees({ projets, series, atelierId }: SeriesRecommandeesProps) {
  const router = useRouter()

  // Grouper les projets par poudre STRICTEMENT identique
  // Règle PLAN.md §2.3 : même référence + même type + même finition + même RAL + mêmes couches
  // RAL 7016 brillant ≠ RAL 7016 mat → regroupement interdit
  const groupesPoudres = useMemo(() => {
    const groupes = new Map<string, GroupePoudre>()

    projets.forEach((projet) => {
      if (!projet.poudre_id || !projet.poudres) return

      const poudre = projet.poudres
      // Clé STRICTE : référence + type + finition + RAL + couches
      // Garantit qu'aucune poudre incompatible ne soit regroupée
      const cle = [
        projet.poudre_id,
        poudre.type || 'unknown',
        poudre.finition || 'unknown',
        poudre.ral || 'no-ral',
        projet.couches || 1,
        projet.primaire ? 'primaire' : 'no-primaire',
        projet.vernis ? 'vernis' : 'no-vernis',
      ].join('__')

      if (!groupes.has(cle)) {
        groupes.set(cle, {
          poudre_id: projet.poudre_id,
          poudre: poudre,
          projets: [],
          total_pieces: 0,
          urgence_max: null,
        })
      }

      const groupe = groupes.get(cle)!
      groupe.projets.push(projet)
      groupe.total_pieces += 1 // TODO: Compter les pièces réelles si disponible

      // Calculer l'urgence max (date promise la plus proche)
      if (projet.date_promise) {
        const datePromise = new Date(projet.date_promise)
        if (!groupe.urgence_max || datePromise < groupe.urgence_max) {
          groupe.urgence_max = datePromise
        }
      }
    })

    return Array.from(groupes.values()).sort((a, b) => {
      // Trier par urgence (dates les plus proches en premier)
      if (a.urgence_max && b.urgence_max) {
        return a.urgence_max.getTime() - b.urgence_max.getTime()
      }
      if (a.urgence_max) return -1
      if (b.urgence_max) return 1
      return 0
    })
  }, [projets])

  const handleCreateSerie = (groupe: GroupePoudre) => {
    router.push(`/app/series/new?poudre_id=${groupe.poudre_id}&projets=${groupe.projets.map(p => p.id).join(',')}`)
  }

  return (
    <div className="space-y-8">
      {/* Séries existantes */}
      {series.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Séries en cours</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {series.map((serie) => (
              <Link
                key={serie.id}
                href={`/app/series/${serie.id}`}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Série #{serie.numero}</h3>
                    {serie.poudres && (
                      <p className="text-sm text-gray-600">
                        {serie.poudres.reference} - {serie.poudres.finition}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      serie.status === 'terminee'
                        ? 'bg-green-100 text-green-800'
                        : serie.status === 'en_cuisson'
                        ? 'bg-orange-100 text-orange-800'
                        : serie.status === 'en_cours'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {serie.status === 'terminee'
                      ? 'Terminée'
                      : serie.status === 'en_cuisson'
                      ? 'En cuisson'
                      : serie.status === 'en_cours'
                      ? 'En cours'
                      : 'En attente'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{serie.projets_ids.length} projet(s)</p>
                  {serie.date_cuisson && (
                    <p>Cuisson: {format(new Date(serie.date_cuisson), 'dd MMMM yyyy', { locale: fr })}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Séries recommandées */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Séries recommandées</h2>
        {groupesPoudres.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 text-lg">Aucune série recommandée pour le moment</p>
            <p className="text-gray-500 text-sm mt-2">
              Les séries apparaîtront ici lorsque vous aurez des projets avec la même poudre
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupesPoudres.map((groupe, index) => (
              <div
                key={groupe.poudre_id}
                className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {groupe.poudre.reference}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Finition:</span> {groupe.poudre.finition}
                    </p>
                    <p>
                      <span className="font-medium">Type:</span> {groupe.poudre.type}
                    </p>
                    {groupe.poudre.ral && (
                      <p>
                        <span className="font-medium">RAL:</span> {groupe.poudre.ral}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Couches:</span> {groupe.projets[0]?.couches || 1}
                    </p>
                  </div>
                </div>

                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    {groupe.projets.length} projet(s) • {groupe.total_pieces} pièce(s)
                  </p>
                  {groupe.urgence_max && (
                    <p className="text-xs text-blue-700">
                      Date promise la plus proche:{' '}
                      {format(groupe.urgence_max, 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleCreateSerie(groupe)}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all"
                >
                  Créer une série
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
