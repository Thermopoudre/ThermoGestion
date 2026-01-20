'use client'

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Image from 'next/image'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row'] & {
  devis?: Database['public']['Tables']['devis']['Row']
  photos?: Database['public']['Tables']['photos']['Row'][]
}

type Atelier = Database['public']['Tables']['ateliers']['Row'] | null

interface ProjetClientDetailProps {
  projet: Projet
  atelier: Atelier
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

export function ProjetClientDetail({ projet, atelier }: ProjetClientDetailProps) {
  const photosAvant = projet.photos?.filter((p) => p.type === 'avant') || []
  const photosApres = projet.photos?.filter((p) => p.type === 'apres') || []
  const photosEtape = projet.photos?.filter((p) => p.type === 'etape') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{projet.name}</h1>
            {projet.devis && (
              <p className="text-gray-600">Devis #{projet.devis.numero}</p>
            )}
          </div>
          <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
            {statusLabels[projet.status] || projet.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {projet.date_depot && (
            <div>
              <p className="text-sm text-gray-600">Date de dépôt</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(projet.date_depot), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          {projet.date_promise && (
            <div>
              <p className="text-sm text-gray-600">Date promise</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(projet.date_promise), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          {projet.devis && (
            <div>
              <p className="text-sm text-gray-600">Montant TTC</p>
              <p className="font-bold text-blue-600 text-xl">
                {Number(projet.devis.total_ttc).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      {projet.devis && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Documents</h2>
          <div className="space-y-3">
            <Link
              href={`/app/devis/${projet.devis.id}/pdf`}
              target="_blank"
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">Devis #{projet.devis.numero}</p>
                <p className="text-sm text-gray-600">
                  {projet.devis.signed_at
                    ? `Signé le ${format(new Date(projet.devis.signed_at), 'dd MMMM yyyy', { locale: fr })}`
                    : 'Non signé'}
                </p>
              </div>
              <span className="text-blue-600">Télécharger PDF →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Photos */}
      {(photosAvant.length > 0 || photosApres.length > 0 || photosEtape.length > 0) && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Photos</h2>
          
          {photosAvant.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Avant</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photosAvant.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={photo.url}
                      alt="Photo avant"
                      fill
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {photosEtape.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Étapes</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photosEtape.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={photo.url}
                      alt="Photo étape"
                      fill
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {photosApres.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Après</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photosApres.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={photo.url}
                      alt="Photo après"
                      fill
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact atelier */}
      {atelier && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
          <div className="space-y-2 text-gray-600">
            <p className="font-semibold text-gray-900">{atelier.name}</p>
            {atelier.address && <p>{atelier.address}</p>}
            {atelier.phone && <p>Tél: {atelier.phone}</p>}
            {atelier.email && (
              <p>
                Email:{' '}
                <a href={`mailto:${atelier.email}`} className="text-blue-600 hover:text-blue-700">
                  {atelier.email}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Retour */}
      <Link
        href="/client/projets"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour à mes projets
      </Link>
    </div>
  )
}
