'use client'

import Link from 'next/link'

interface TopClient {
  id: string
  name: string
  ca: number
  projets: number
}

interface TopClientsProps {
  clients: TopClient[]
}

export function TopClients({ clients }: TopClientsProps) {
  const maxCA = clients.length > 0 ? Math.max(...clients.map(c => c.ca)) : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">👑 Top Clients</h3>
        <Link href="/app/clients" className="text-sm text-blue-600 hover:underline">
          Voir tous
        </Link>
      </div>
      
      {clients.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-sm">Aucun client avec CA</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client, index) => (
            <Link
              key={client.id}
              href={`/app/clients/${client.id}`}
              className="block group"
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-orange-600 transition-colors">
                    {client.name}
                  </p>
                  <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full mt-1">
                    <div
                      className="absolute h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${maxCA > 0 ? (client.ca / maxCA) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {client.ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {client.projets} projet{client.projets > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
