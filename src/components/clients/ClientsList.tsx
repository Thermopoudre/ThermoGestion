'use client'

import Link from 'next/link'
import { Users, Mail, Phone, Building2, User, ChevronRight, Tag, Upload } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsListProps {
  clients: Client[]
}

export function ClientsList({ clients }: ClientsListProps) {
  if (clients.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
          <Users className="w-10 h-10 text-cyan-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Aucun client</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Ajoutez vos premiers clients pour commencer à gérer vos projets
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/app/clients/new" className="btn-primary">
            <User className="w-5 h-5" />
            Ajouter un client
          </Link>
          <Link href="/app/clients/import" className="btn-secondary">
            <Upload className="w-5 h-5" />
            Importer CSV
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Astuce : <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">N</kbd> + <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">C</kbd> pour créer rapidement
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/app/clients/${client.id}`}
            className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{client.full_name}</h3>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      client.type === 'professionnel'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {client.type === 'professionnel' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {client.type === 'professionnel' ? 'Pro' : 'Part.'}
                  </span>
                </div>
                {client.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {client.email}
                  </p>
                )}
                {client.phone && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {client.phone}
                  </p>
                )}
                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {client.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                    {client.tags.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">+{client.tags.length - 3}</span>
                    )}
                  </div>
                )}
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
                  Nom
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Téléphone
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Ajouté le
                </th>
                <th className="px-4 lg:px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{client.full_name}</div>
                    {client.tags && client.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {client.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                          >
                            {tag}
                          </span>
                        ))}
                        {client.tags.length > 2 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">+{client.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      {client.phone ? (
                        <>
                          <Phone className="w-4 h-4" />
                          {client.phone}
                        </>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.type === 'professionnel'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {client.type === 'professionnel' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      {client.type === 'professionnel' ? 'Professionnel' : 'Particulier'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {new Date(client.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/app/clients/${client.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
