'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Database } from '@/types/database.types'

type Facture = Database['public']['Tables']['factures']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row']
  projets?: Database['public']['Tables']['projets']['Row']
}

interface FacturesListProps {
  factures: Facture[]
}

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  remboursee: 'Remboursée',
}

const statusColors: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  envoyee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  payee: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  remboursee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const typeLabels: Record<string, string> = {
  acompte: 'Acompte',
  solde: 'Solde',
  complete: 'Complète',
}

export function FacturesList({ factures }: FacturesListProps) {
  if (factures.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📄</span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Aucune facture pour le moment</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Créez votre première facture</p>
        <Link
          href="/app/factures/new"
          className="inline-block mt-6 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Nouvelle facture
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {factures.map((facture) => (
          <Link
            key={facture.id}
            href={`/app/factures/${facture.id}`}
            className={`block bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${
              facture.payment_status === 'paid' 
                ? 'border-l-green-500' 
                : facture.status === 'envoyee'
                  ? 'border-l-blue-500'
                  : 'border-l-gray-300 dark:border-l-gray-600'
            } p-4 hover:shadow-md transition-shadow active:bg-gray-50 dark:active:bg-gray-700`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Header: Numéro + Montant */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                    {facture.numero}
                  </span>
                  <span className="font-bold text-lg text-orange-500 dark:text-blue-400">
                    {Number(facture.total_ttc || 0).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </span>
                </div>
                
                {/* Client */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  👤 {facture.clients?.full_name || '-'}
                </p>
                
                {/* Badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[facture.status] || statusColors.brouillon
                  }`}>
                    {statusLabels[facture.status] || facture.status}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    facture.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : facture.payment_status === 'partial'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    {facture.payment_status === 'paid'
                      ? '✓ Payé'
                      : facture.payment_status === 'partial'
                      ? '⏳ Partiel'
                      : '⚠️ Impayé'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    📅 {format(new Date(facture.created_at), 'dd/MM/yy', { locale: fr })}
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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Numéro
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Type
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Montant TTC
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Statut
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Paiement
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {factures.map((facture) => (
                <tr key={facture.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{facture.numero}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{facture.clients?.full_name || '-'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">{facture.clients?.email || ''}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                      {typeLabels[facture.type] || facture.type}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(facture.created_at), 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {Number(facture.total_ttc || 0).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        statusColors[facture.status] || statusColors.brouillon
                      }`}
                    >
                      {statusLabels[facture.status] || facture.status}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        facture.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : facture.payment_status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                      }`}
                    >
                      {facture.payment_status === 'paid'
                        ? '✓ Payé'
                        : facture.payment_status === 'partial'
                        ? 'Partiel'
                        : 'Impayé'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/app/factures/${facture.id}`}
                      className="text-orange-500 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      Voir
                    </Link>
                    <a
                      href={`/app/factures/${facture.id}/pdf`}
                      target="_blank"
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      PDF
                    </a>
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
