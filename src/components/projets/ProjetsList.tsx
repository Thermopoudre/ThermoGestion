'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface ProjetsListProps {
  projets: (Projet & {
    clients: Client | null
    poudres: Poudre | null
  })[]
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_cuisson: 'bg-orange-100 text-orange-800',
  qc: 'bg-yellow-100 text-yellow-800',
  pret: 'bg-green-100 text-green-800',
  livre: 'bg-purple-100 text-purple-800',
  annule: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  devis: 'Devis',
  en_cours: 'En cours',
  en_cuisson: 'En cuisson',
  qc: 'Contrôle qualité',
  pret: 'Prêt',
  livre: 'Livré',
  annule: 'Annulé',
}

export function ProjetsList({ projets }: ProjetsListProps) {
  if (projets.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun projet</h3>
        <p className="text-gray-600 mb-6">
          Commencez par créer votre premier projet ou convertir un devis
        </p>
        <Link
          href="/app/projets/new"
          className="inline-block bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Créer un projet
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Numéro / Nom
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Poudre
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Date promise
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Photos
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projets.map((projet) => (
              <tr key={projet.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">#{projet.numero}</div>
                  <div className="text-sm text-gray-600">{projet.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {projet.clients?.full_name || 'Client supprimé'}
                  </div>
                  <div className="text-sm text-gray-600">{projet.clients?.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {projet.poudres ? (
                    <div className="text-sm text-gray-900">
                      {projet.poudres.marque} {projet.poudres.reference}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Non définie</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[projet.status] || statusColors.en_cours}`}>
                    {statusLabels[projet.status] || projet.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {projet.date_promise ? (
                    <div className="text-sm text-gray-900">
                      {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {projet.photos_count || 0} photo{projet.photos_count !== 1 ? 's' : ''}
                  </div>
                  {projet.photos_size_mb && Number(projet.photos_size_mb) > 0 && (
                    <div className="text-xs text-gray-500">
                      {(Number(projet.photos_size_mb) / 1024).toFixed(2)} GB
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/app/projets/${projet.id}`}
                    className="text-blue-600 hover:text-blue-900 transition-colors"
                  >
                    Voir →
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
