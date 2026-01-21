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
  devis: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  en_cuisson: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  qc: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  pret: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  livre: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const statusLabels: Record<string, string> = {
  devis: 'Devis',
  en_cours: 'En cours',
  en_cuisson: '🔥 Cuisson',
  qc: '✓ Contrôle',
  pret: '✅ Prêt',
  livre: '📦 Livré',
  annule: '❌ Annulé',
}

export function ProjetsList({ projets }: ProjetsListProps) {
  if (projets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun projet</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Commencez par créer votre premier projet ou convertir un devis
        </p>
        <Link
          href="/app/projets/new"
          className="inline-block bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Créer un projet
        </Link>
      </div>
    )
  }

  // Vérifier si un projet est en retard
  const isLate = (projet: Projet) => {
    if (!projet.date_promise) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const promiseDate = new Date(projet.date_promise)
    return promiseDate < today && !['livre', 'annule'].includes(projet.status)
  }

  return (
    <>
      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {projets.map((projet) => (
          <Link
            key={projet.id}
            href={`/app/projets/${projet.id}`}
            className={`block bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${
              isLate(projet) 
                ? 'border-l-red-500' 
                : projet.status === 'pret' 
                  ? 'border-l-green-500' 
                  : 'border-l-blue-500'
            } p-4 hover:shadow-md transition-shadow active:bg-gray-50 dark:active:bg-gray-700`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Header: Numéro + Statut */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-orange-500 dark:text-blue-400">
                    #{projet.numero}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[projet.status] || statusColors.en_cours}`}>
                    {statusLabels[projet.status] || projet.status}
                  </span>
                  {isLate(projet) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                      ⚠️ Retard
                    </span>
                  )}
                </div>
                
                {/* Nom du projet */}
                <h3 className="font-semibold text-gray-900 dark:text-white mt-1 truncate">
                  {projet.name}
                </h3>
                
                {/* Client */}
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  👤 {projet.clients?.full_name || 'Client supprimé'}
                </p>
                
                {/* Infos supplémentaires */}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  {projet.poudres && (
                    <span className="flex items-center gap-1">
                      🎨 {projet.poudres.reference}
                    </span>
                  )}
                  {projet.date_promise && (
                    <span className={`flex items-center gap-1 ${isLate(projet) ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                      📅 {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {(projet.photos_count || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      📷 {projet.photos_count}
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Vue desktop - Tableau */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Numéro / Nom
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Poudre
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Date promise
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                  Photos
                </th>
                <th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {projets.map((projet) => (
                <tr 
                  key={projet.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isLate(projet) ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">#{projet.numero}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{projet.name}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {projet.clients?.full_name || 'Client supprimé'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 hidden lg:block">{projet.clients?.email}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    {projet.poudres ? (
                      <div className="text-sm text-gray-900 dark:text-white">
                        {projet.poudres.marque} {projet.poudres.reference}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Non définie</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[projet.status] || statusColors.en_cours}`}>
                        {statusLabels[projet.status] || projet.status}
                      </span>
                      {isLate(projet) && (
                        <span className="text-red-500" title="En retard">⚠️</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    {projet.date_promise ? (
                      <div className={`text-sm ${isLate(projet) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-900 dark:text-white'}`}>
                        {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {projet.photos_count || 0} photo{projet.photos_count !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/app/projets/${projet.id}`}
                      className="text-orange-500 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
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
    </>
  )
}
