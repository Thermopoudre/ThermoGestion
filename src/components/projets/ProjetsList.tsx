'use client'

import Link from 'next/link'
import { Package, User, Palette, Calendar, Camera, ChevronRight, AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
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

export function ProjetsList({ projets }: ProjetsListProps) {
  if (projets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
          <Package className="w-10 h-10 text-orange-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Aucun projet</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Commencez par créer votre premier projet ou convertir un devis existant
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app/projets/new"
            className="btn-primary"
          >
            <Package className="w-5 h-5" />
            Créer un projet
          </Link>
          <Link
            href="/app/devis"
            className="btn-secondary"
          >
            Voir les devis
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Astuce : Appuyez sur <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">N</kbd> puis <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">P</kbd> pour créer rapidement
        </p>
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
                  : 'border-l-orange-500'
            } p-4 hover:shadow-md transition-all active:scale-[0.99]`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Header: Numéro + Statut */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                    #{projet.numero}
                  </span>
                  <StatusBadge status={projet.status} type="projet" size="sm" />
                  {isLate(projet) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      Retard
                    </span>
                  )}
                </div>
                
                {/* Nom du projet */}
                <h3 className="font-semibold text-gray-900 dark:text-white mt-1.5 truncate">
                  {projet.name}
                </h3>
                
                {/* Client */}
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5" />
                  {projet.clients?.full_name || 'Client supprimé'}
                </p>
                
                {/* Infos supplémentaires */}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  {projet.poudres && (
                    <span className="flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5" />
                      {projet.poudres.reference}
                    </span>
                  )}
                  {projet.date_promise && (
                    <span className={`flex items-center gap-1 ${isLate(projet) ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {(projet.photos_count || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      {projet.photos_count}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* Vue desktop - Tableau */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
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
                <th className="px-4 lg:px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {projets.map((projet) => (
                <tr 
                  key={projet.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
                    isLate(projet) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">#{projet.numero}</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">{projet.name}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {projet.clients?.full_name || 'Client supprimé'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 hidden lg:block">{projet.clients?.email}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    {projet.poudres ? (
                      <div className="text-sm text-gray-900 dark:text-white">
                        {projet.poudres.marque} {projet.poudres.reference}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={projet.status} type="projet" size="sm" />
                      {isLate(projet) && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    {projet.date_promise ? (
                      <div className={`text-sm flex items-center gap-1.5 ${isLate(projet) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        <Calendar className="w-4 h-4" />
                        {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Camera className="w-4 h-4" />
                      {projet.photos_count || 0}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/app/projets/${projet.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Voir
                      <ChevronRight className="w-4 h-4" />
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
