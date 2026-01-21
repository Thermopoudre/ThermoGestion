'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Client = Database['public']['Tables']['clients']['Row']

interface DevisListProps {
  devis: (Devis & {
    clients: Client | null
  })[]
}

const statusColors: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  envoye: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  accepte: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  refuse: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  expire: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
}

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  converted: 'Converti',
}

export function DevisList({ devis }: DevisListProps) {
  if (devis.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun devis</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Commencez par créer votre premier devis
        </p>
        <Link
          href="/app/devis/new"
          className="inline-block bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Créer un devis
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {devis.map((devi) => (
          <Link
            key={devi.id}
            href={`/app/devis/${devi.id}`}
            className={`block bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${
              devi.signed_at 
                ? 'border-l-green-500' 
                : devi.status === 'envoye'
                  ? 'border-l-blue-500'
                  : 'border-l-gray-300 dark:border-l-gray-600'
            } p-4 hover:shadow-md transition-shadow active:bg-gray-50 dark:active:bg-gray-700`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Header: Numéro + Montant */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                    #{devi.numero}
                  </span>
                  <span className="font-bold text-lg text-orange-500 dark:text-blue-400">
                    {Number(devi.total_ttc).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </span>
                </div>
                
                {/* Client */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  👤 {devi.clients?.full_name || 'Client supprimé'}
                </p>
                
                {/* Badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[devi.status] || statusColors.brouillon}`}>
                    {statusLabels[devi.status] || devi.status}
                  </span>
                  {devi.signed_at ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      ✓ Signé
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Non signé</span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    📅 {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  Numéro
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Total TTC
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Signature
                </th>
                <th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {devis.map((devi) => (
                <tr key={devi.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">#{devi.numero}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {devi.clients?.full_name || 'Client supprimé'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 hidden lg:block">{devi.clients?.email}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[devi.status] || statusColors.brouillon}`}>
                      {statusLabels[devi.status] || devi.status}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {Number(devi.total_ttc).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    {devi.signed_at ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        ✓ Signé
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Non signé</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/app/devis/${devi.id}`}
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
