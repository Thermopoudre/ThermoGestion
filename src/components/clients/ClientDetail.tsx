'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Projet = Database['public']['Tables']['projets']['Row']
type Devis = Database['public']['Tables']['devis']['Row']

interface ClientDetailProps {
  client: Client
  projets: Projet[]
  devis: Devis[]
}

export function ClientDetail({ client, projets, devis }: ClientDetailProps) {
  return (
    <div className="space-y-6">
      {/* Informations principales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <p className="text-gray-900">{client.email}</p>
          </div>
          {client.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone</label>
              <p className="text-gray-900">{client.phone}</p>
            </div>
          )}
          {client.address && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Adresse</label>
              <p className="text-gray-900">{client.address}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                client.type === 'professionnel'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {client.type === 'professionnel' ? 'Professionnel' : 'Particulier'}
            </span>
            {client.siret && (
              <p className="text-gray-900 mt-1">SIRET: {client.siret}</p>
            )}
          </div>
          {client.tags && client.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {client.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {client.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-600 mb-2">Notes</label>
            <p className="text-gray-900 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Projets */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Projets récents</h2>
          <Link
            href={`/app/projets?client=${client.id}`}
            className="text-orange-500 hover:text-blue-700 text-sm font-medium"
          >
            Voir tous →
          </Link>
        </div>
        {projets.length === 0 ? (
          <p className="text-gray-600">Aucun projet pour ce client</p>
        ) : (
          <div className="space-y-3">
            {projets.map((projet) => (
              <Link
                key={projet.id}
                href={`/app/projets/${projet.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{projet.name}</p>
                    <p className="text-sm text-gray-600">#{projet.numero}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600">{projet.status}</span>
                    {projet.date_promise && (
                      <p className="text-xs text-gray-500 mt-1">
                        Livraison: {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Devis */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Devis récents</h2>
          <Link
            href={`/app/devis?client=${client.id}`}
            className="text-orange-500 hover:text-blue-700 text-sm font-medium"
          >
            Voir tous →
          </Link>
        </div>
        {devis.length === 0 ? (
          <p className="text-gray-600">Aucun devis pour ce client</p>
        ) : (
          <div className="space-y-3">
            {devis.map((devi) => (
              <Link
                key={devi.id}
                href={`/app/devis/${devi.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">#{devi.numero}</p>
                    <p className="text-sm text-gray-600">{devi.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {Number(devi.total_ttc).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(devi.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
