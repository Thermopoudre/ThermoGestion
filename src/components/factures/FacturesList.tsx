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
  brouillon: 'bg-gray-100 text-gray-800',
  envoyee: 'bg-blue-100 text-blue-800',
  payee: 'bg-green-100 text-green-800',
  remboursee: 'bg-red-100 text-red-800',
}

const typeLabels: Record<string, string> = {
  acompte: 'Acompte',
  solde: 'Solde',
  complete: 'Complète',
}

export function FacturesList({ factures }: FacturesListProps) {
  if (factures.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-600 text-lg">Aucune facture pour le moment</p>
        <p className="text-gray-500 text-sm mt-2">Créez votre première facture</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Numéro
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Montant TTC
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Paiement
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {factures.map((facture) => (
            <tr key={facture.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900">{facture.numero}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{facture.clients?.full_name || '-'}</div>
                <div className="text-xs text-gray-500">{facture.clients?.email || ''}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                  {typeLabels[facture.type] || facture.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {format(new Date(facture.created_at), 'dd MMM yyyy', { locale: fr })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900">
                  {Number(facture.total_ttc).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    statusColors[facture.status] || statusColors.brouillon
                  }`}
                >
                  {statusLabels[facture.status] || facture.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    facture.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : facture.payment_status === 'partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {facture.payment_status === 'paid'
                    ? 'Payé'
                    : facture.payment_status === 'partial'
                    ? 'Partiel'
                    : 'Impayé'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/app/factures/${facture.id}`}
                  className="text-blue-600 hover:text-blue-900 mr-4"
                >
                  Voir
                </Link>
                <a
                  href={`/app/factures/${facture.id}/pdf`}
                  target="_blank"
                  className="text-gray-600 hover:text-gray-900"
                >
                  PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
