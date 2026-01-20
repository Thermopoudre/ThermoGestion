'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Retouche = Database['public']['Tables']['retouches']['Row'] & {
  projets?: Database['public']['Tables']['projets']['Row']
  defaut_types?: Database['public']['Tables']['defaut_types']['Row']
  created_by_user?: Database['public']['Tables']['users']['Row']
  resolved_by_user?: Database['public']['Tables']['users']['Row']
}

interface RetoucheDetailProps {
  retouche: Retouche
  atelierId: string
  userId: string
}

const statusLabels: Record<string, string> = {
  declaree: 'Déclarée',
  en_cours: 'En cours',
  resolue: 'Résolue',
  annulee: 'Annulée',
}

export function RetoucheDetail({ retouche, atelierId, userId }: RetoucheDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResoudre = async () => {
    if (!confirm('Marquer cette retouche comme résolue ?')) return

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('retouches')
        .update({
          status: 'resolue',
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', retouche.id)

      if (updateError) throw updateError

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const handleAnnuler = async () => {
    if (!confirm('Annuler cette retouche ?')) return

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('retouches')
        .update({
          status: 'annulee',
        })
        .eq('id', retouche.id)

      if (updateError) throw updateError

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'annulation')
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Retouche / NC</h1>
            {retouche.projets && (
              <p className="text-gray-600">
                Projet:{' '}
                <Link
                  href={`/app/projets/${retouche.projet_id}`}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  {retouche.projets.name} (#{retouche.projets.numero})
                </Link>
              </p>
            )}
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              retouche.status === 'resolue'
                ? 'bg-green-100 text-green-800'
                : retouche.status === 'en_cours'
                ? 'bg-orange-100 text-orange-800'
                : retouche.status === 'annulee'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {statusLabels[retouche.status] || retouche.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-600">Date de déclaration</p>
            <p className="font-semibold text-gray-900">
              {format(new Date(retouche.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          {retouche.defaut_types && (
            <div>
              <p className="text-sm text-gray-600">Type de défaut</p>
              <p className="font-semibold text-gray-900">{retouche.defaut_types.name}</p>
            </div>
          )}
          {retouche.resolved_at && (
            <div>
              <p className="text-sm text-gray-600">Date de résolution</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(retouche.resolved_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {retouche.status !== 'resolue' && retouche.status !== 'annulee' && (
          <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleResoudre}
              disabled={loading}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Marquer comme résolue
            </button>
            <button
              onClick={handleAnnuler}
              disabled={loading}
              className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Description du défaut</h2>
        <p className="text-gray-600 whitespace-pre-line">{retouche.description}</p>
      </div>

      {/* Photo */}
      {retouche.photo_url && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Photo du défaut</h2>
          <div className="relative max-w-2xl">
            <Image
              src={retouche.photo_url}
              alt="Photo du défaut"
              width={800}
              height={600}
              className="rounded-lg border border-gray-300"
            />
          </div>
        </div>
      )}

      {/* Action corrective */}
      {retouche.action_corrective && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Action corrective</h2>
          <p className="text-gray-600 whitespace-pre-line">{retouche.action_corrective}</p>
        </div>
      )}

      {/* Informations */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Informations</h2>
        <div className="space-y-2 text-sm text-gray-600">
          {retouche.created_by_user && (
            <p>
              <span className="font-medium">Déclarée par :</span>{' '}
              {retouche.created_by_user.full_name || retouche.created_by_user.email}
            </p>
          )}
          {retouche.resolved_by_user && (
            <p>
              <span className="font-medium">Résolue par :</span>{' '}
              {retouche.resolved_by_user.full_name || retouche.resolved_by_user.email}
            </p>
          )}
          {retouche.step_index !== null && (
            <p>
              <span className="font-medium">Étape :</span> {retouche.step_index + 1}
            </p>
          )}
          {retouche.delai_induit_jours && (
            <p>
              <span className="font-medium">Délai induit :</span> {retouche.delai_induit_jours} jour(s)
            </p>
          )}
        </div>
      </div>

      {/* Retour */}
      <Link
        href="/app/retouches"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour aux retouches
      </Link>
    </div>
  )
}
