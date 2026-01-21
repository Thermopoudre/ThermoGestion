'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row'] & {
  devis?: Database['public']['Tables']['devis']['Row']
}

interface ProjetsClientListProps {
  projets: Projet[]
}

const statusLabels: Record<string, string> = {
  devis: 'Devis',
  en_cours: 'En cours',
  en_cuisson: 'En cuisson',
  qc: 'Contrôle qualité',
  pret: 'Prêt',
  livre: 'Livré',
  annule: 'Annulé',
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_cuisson: 'bg-orange-100 text-orange-800',
  qc: 'bg-purple-100 text-purple-800',
  pret: 'bg-green-100 text-green-800',
  livre: 'bg-green-200 text-green-900',
  annule: 'bg-red-100 text-red-800',
}

export function ProjetsClientList({ projets }: ProjetsClientListProps) {
  if (projets.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-600 text-lg">Aucun projet pour le moment</p>
        <p className="text-gray-500 text-sm mt-2">Vos projets apparaîtront ici une fois créés</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projets.map((projet) => (
        <Link
          key={projet.id}
          href={`/client/projets/${projet.id}`}
          className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{projet.name}</h3>
              {projet.devis && (
                <p className="text-sm text-gray-600">Devis #{projet.devis.numero}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                statusColors[projet.status] || statusColors.devis
              }`}
            >
              {statusLabels[projet.status] || projet.status}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            {projet.date_depot && (
              <p>
                <span className="font-medium">Déposé le :</span>{' '}
                {format(new Date(projet.date_depot), 'dd MMMM yyyy', { locale: fr })}
              </p>
            )}
            {projet.date_promise && (
              <p>
                <span className="font-medium">Date promise :</span>{' '}
                {format(new Date(projet.date_promise), 'dd MMMM yyyy', { locale: fr })}
              </p>
            )}
            {projet.devis && (
              <p className="pt-2 border-t border-gray-200">
                <span className="font-medium">Montant :</span>{' '}
                <span className="text-orange-500 font-bold">
                  {Number(projet.devis.total_ttc).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="text-orange-500 text-sm font-medium hover:text-blue-700">
              Voir les détails →
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
