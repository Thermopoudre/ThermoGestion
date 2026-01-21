'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Project {
  id: string
  numero: string
  name: string
  client_name: string
  status: string
  date_promise?: string
  poudre_reference?: string
  isLate: boolean
}

interface ProjectsOverviewProps {
  projetsEnRetard: Project[]
  projetsAVenir: Project[]
}

const statusLabels: Record<string, string> = {
  devis: 'Devis',
  en_cours: 'En cours',
  en_cuisson: 'En cuisson',
  qc: 'Contrôle qualité',
  pret: 'Prêt',
  livre: 'Livré',
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-700',
  en_cours: 'bg-blue-100 text-blue-700',
  en_cuisson: 'bg-orange-100 text-orange-700',
  qc: 'bg-purple-100 text-purple-700',
  pret: 'bg-green-100 text-green-700',
  livre: 'bg-emerald-100 text-emerald-700',
}

export function ProjectsOverview({ projetsEnRetard, projetsAVenir }: ProjectsOverviewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Projets en retard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            🚨 Projets en retard
          </h3>
          <span className={`text-sm font-medium px-2 py-1 rounded-full ${
            projetsEnRetard.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {projetsEnRetard.length}
          </span>
        </div>

        {projetsEnRetard.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="text-center">
              <span className="text-4xl mb-2 block">🎉</span>
              <p>Aucun projet en retard !</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {projetsEnRetard.map((projet) => (
              <Link
                key={projet.id}
                href={`/app/projets/${projet.id}`}
                className="block p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{projet.numero}</p>
                    <p className="text-sm text-gray-600">{projet.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{projet.client_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[projet.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabels[projet.status] || projet.status}
                    </span>
                    {projet.date_promise && (
                      <p className="text-xs text-red-600 mt-2 font-medium">
                        Prévu le {new Date(projet.date_promise).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Projets à livrer bientôt */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            📅 À livrer bientôt
          </h3>
          <Link href="/app/projets" className="text-sm text-orange-500 hover:underline">
            Voir tout →
          </Link>
        </div>

        {projetsAVenir.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="text-center">
              <span className="text-4xl mb-2 block">📭</span>
              <p>Aucun projet à venir</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {projetsAVenir.map((projet) => (
              <Link
                key={projet.id}
                href={`/app/projets/${projet.id}`}
                className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{projet.numero}</p>
                    <p className="text-sm text-gray-600">{projet.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{projet.client_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[projet.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabels[projet.status] || projet.status}
                    </span>
                    {projet.date_promise && (
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDistanceToNow(new Date(projet.date_promise), { 
                          addSuffix: true,
                          locale: fr 
                        })}
                      </p>
                    )}
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
