'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Retouche = Database['public']['Tables']['retouches']['Row'] & {
  projets?: Database['public']['Tables']['projets']['Row']
  defaut_types?: Database['public']['Tables']['defaut_types']['Row']
  created_by_user?: Database['public']['Tables']['users']['Row']
}

interface RetouchesListProps {
  retouches: Retouche[]
  atelierId: string
}

const statusLabels: Record<string, string> = {
  declaree: 'Déclarée',
  en_cours: 'En cours',
  resolue: 'Résolue',
  annulee: 'Annulée',
}

const statusColors: Record<string, string> = {
  declaree: 'bg-red-100 text-red-800',
  en_cours: 'bg-orange-100 text-orange-800',
  resolue: 'bg-green-100 text-green-800',
  annulee: 'bg-gray-100 text-gray-800',
}

export function RetouchesList({ retouches, atelierId }: RetouchesListProps) {
  const router = useRouter()

  if (retouches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-600 text-lg">Aucune retouche déclarée</p>
        <p className="text-gray-500 text-sm mt-2">
          Les retouches apparaîtront ici une fois déclarées sur un projet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/app/retouches/stats"
          className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Voir statistiques
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Projet
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type défaut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {retouches.map((retouche) => (
              <tr key={retouche.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/app/projets/${retouche.projet_id}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {retouche.projets?.name || 'Projet'}
                  </Link>
                  <div className="text-xs text-gray-500">#{retouche.projets?.numero || ''}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {retouche.defaut_types?.name || 'Non spécifié'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900 line-clamp-2">{retouche.description}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {format(new Date(retouche.created_at), 'dd MMM yyyy', { locale: fr })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      statusColors[retouche.status] || statusColors.declaree
                    }`}
                  >
                    {statusLabels[retouche.status] || retouche.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/app/retouches/${retouche.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
