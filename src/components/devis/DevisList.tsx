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
  brouillon: 'bg-gray-100 text-gray-800',
  envoye: 'bg-blue-100 text-blue-800',
  accepte: 'bg-green-100 text-green-800',
  refuse: 'bg-red-100 text-red-800',
  expire: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-purple-100 text-purple-800',
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
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun devis</h3>
        <p className="text-gray-600 mb-6">
          Commencez par créer votre premier devis
        </p>
        <Link
          href="/app/devis/new"
          className="inline-block bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Créer un devis
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
                Numéro
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Total TTC
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Signature
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {devis.map((devi) => (
              <tr key={devi.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">#{devi.numero}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {devi.clients?.full_name || 'Client supprimé'}
                  </div>
                  <div className="text-sm text-gray-600">{devi.clients?.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[devi.status] || statusColors.brouillon}`}>
                    {statusLabels[devi.status] || devi.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900">
                    {Number(devi.total_ttc).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {devi.signed_at ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Signé
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Non signé</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-4">
                    {devi.pdf_url && (
                      <a
                        href={devi.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        PDF
                      </a>
                    )}
                    <Link
                      href={`/app/devis/${devi.id}`}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                    >
                      Voir →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
