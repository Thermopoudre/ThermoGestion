'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Serie = Database['public']['Tables']['series']['Row'] & {
  poudres?: Database['public']['Tables']['poudres']['Row']
}

type Projet = Database['public']['Tables']['projets']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row']
}

interface SerieDetailProps {
  serie: Serie
  projets: Projet[]
}

export function SerieDetail({ serie, projets }: SerieDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLancerSerie = async () => {
    if (!confirm('Lancer cette série en production ?')) return

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('series')
        .update({ status: 'en_cours' })
        .eq('id', serie.id)

      if (updateError) throw updateError

      // Mettre à jour le statut des projets (optionnel selon workflow)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors du lancement')
    } finally {
      setLoading(false)
    }
  }

  const handleCloturerSerie = async () => {
    if (!confirm('Clôturer cette série ?')) return

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('series')
        .update({ status: 'terminee' })
        .eq('id', serie.id)

      if (updateError) throw updateError

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la clôture')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Série #{serie.numero}</h1>
            {serie.poudres && (
              <p className="text-gray-600">
                {serie.poudres.reference} - {serie.poudres.finition}
              </p>
            )}
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-600">Date de création</p>
            <p className="font-semibold text-gray-900">
              {format(new Date(serie.created_at), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
          {serie.date_cuisson && (
            <div>
              <p className="text-sm text-gray-600">Date de cuisson</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(serie.date_cuisson), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Nombre de projets</p>
            <p className="font-semibold text-gray-900">{projets.length}</p>
          </div>
        </div>

        {/* Actions */}
        {serie.status === 'en_attente' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleLancerSerie}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lancer la série
            </button>
          </div>
        )}

        {(serie.status === 'en_cours' || serie.status === 'en_cuisson') && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleCloturerSerie}
              disabled={loading}
              className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clôturer la série
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Projets */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Projets de la série</h2>
        <div className="space-y-3">
          {projets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun projet dans cette série</p>
          ) : (
            projets.map((projet) => (
              <Link
                key={projet.id}
                href={`/app/projets/${projet.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{projet.name}</p>
                    <p className="text-sm text-gray-600">#{projet.numero}</p>
                    {projet.clients && (
                      <p className="text-sm text-gray-600">Client: {projet.clients.full_name}</p>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {projet.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Retour */}
      <Link
        href="/app/series"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour aux séries
      </Link>
    </div>
  )
}
