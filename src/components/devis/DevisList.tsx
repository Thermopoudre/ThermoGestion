'use client'

import Link from 'next/link'
import { FileText, User, Calendar, CheckCircle2, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Client = Database['public']['Tables']['clients']['Row']

interface DevisListProps {
  devis: (Devis & {
    clients: Client | null
  })[]
}

// Map internal status to StatusBadge status
const statusMap: Record<string, string> = {
  brouillon: 'draft',
  draft: 'draft',
  envoye: 'sent',
  sent: 'sent',
  accepte: 'signed',
  signed: 'signed',
  refuse: 'refused',
  refused: 'refused',
  expire: 'expired',
  expired: 'expired',
  converted: 'signed',
}

export function DevisList({ devis }: DevisListProps) {
  if (devis.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
          <FileText className="w-10 h-10 text-purple-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Aucun devis</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Créez votre premier devis pour commencer à facturer vos clients
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/app/devis/new" className="btn-primary">
            <FileText className="w-5 h-5" />
            Créer un devis
          </Link>
          <Link href="/app/devis/templates" className="btn-secondary">
            Voir les modèles
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Astuce : <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">N</kbd> + <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">D</kbd> pour créer rapidement
        </p>
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
                : devi.status === 'envoye' || devi.status === 'sent'
                  ? 'border-l-blue-500'
                  : 'border-l-purple-500'
            } p-4 hover:shadow-md transition-all active:scale-[0.99]`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Header: Numéro + Montant */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400">
                    #{devi.numero}
                  </span>
                  <span className="font-bold text-lg text-orange-600 dark:text-orange-400 tabular-nums">
                    {formatCurrency(Number(devi.total_ttc))}
                  </span>
                </div>
                
                {/* Client */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {devi.clients?.full_name || 'Client supprimé'}
                </p>
                
                {/* Badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={statusMap[devi.status] || 'draft'} type="devis" size="sm" />
                  {devi.signed_at ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Signé
                    </span>
                  ) : null}
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
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
                  Numéro
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Total TTC
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Signature
                </th>
                <th className="px-4 lg:px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {devis.map((devi) => (
                <tr key={devi.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">#{devi.numero}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {devi.clients?.full_name || 'Client supprimé'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 hidden lg:block">{devi.clients?.email}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={statusMap[devi.status] || 'draft'} type="devis" size="sm" />
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(Number(devi.total_ttc))}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    {devi.signed_at ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Signé
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/app/devis/${devi.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
