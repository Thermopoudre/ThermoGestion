'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Atelier = Database['public']['Tables']['ateliers']['Row']

interface DevisDetailProps {
  devis: Devis & {
    clients: Client | null
  }
  atelier: Atelier | null
}

interface DevisItem {
  designation: string
  longueur: number
  largeur: number
  hauteur?: number
  quantite: number
  surface_m2: number
  couches: number
  cout_poudre: number
  cout_mo: number
  cout_consommables: number
  total_ht: number
}

export function DevisDetail({ devis, atelier }: DevisDetailProps) {
  const items = (devis.items as any) as DevisItem[] || []
  
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

  return (
    <div className="space-y-6">
      {/* Informations générales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Statut</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[devis.status] || statusColors.brouillon}`}>
              {statusLabels[devis.status] || devis.status}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
            <p className="text-gray-900">{new Date(devis.created_at).toLocaleDateString('fr-FR')}</p>
          </div>
          {devis.signed_at && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Signature</label>
              <p className="text-gray-900">
                ✓ Signé le {new Date(devis.signed_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Client */}
      {devis.clients && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nom</label>
              <p className="text-gray-900">{devis.clients.full_name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <p className="text-gray-900">{devis.clients.email}</p>
            </div>
            {devis.clients.phone && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone</label>
                <p className="text-gray-900">{devis.clients.phone}</p>
              </div>
            )}
            {devis.clients.address && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Adresse</label>
                <p className="text-gray-900">{devis.clients.address}</p>
              </div>
            )}
            {devis.clients.type === 'professionnel' && devis.clients.siret && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">SIRET</label>
                <p className="text-gray-900">{devis.clients.siret}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Détails</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Désignation</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Dimensions</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Qté</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Surface</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Couches</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.designation}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.longueur} × {item.largeur}
                    {item.hauteur && ` × ${item.hauteur}`} mm
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.quantite}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.surface_m2.toFixed(2)} m²</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.couches}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {item.total_ht.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Total HT
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  {Number(devis.total_ht).toFixed(2)} €
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  TVA ({devis.tva_rate}%)
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  {(Number(devis.total_ttc) - Number(devis.total_ht)).toFixed(2)} €
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="px-4 py-3 text-lg font-black text-gray-900 text-right">
                  Total TTC
                </td>
                <td className="px-4 py-3 text-lg font-black text-orange-500 text-right">
                  {Number(devis.total_ttc).toFixed(2)} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-4">
          {devis.status === 'brouillon' && (
            <>
              <Link
                href={`/app/devis/${devis.id}/edit`}
                className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
              >
                Modifier
              </Link>
              <Link
                href={`/app/devis/${devis.id}/send`}
                className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
              >
                Envoyer au client
              </Link>
              <Link
                href={`/app/devis/${devis.id}/convert`}
                className="bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:from-green-500 hover:to-emerald-400 transition-all"
              >
                Convertir en projet
              </Link>
            </>
          )}
          {!devis.signed_at && devis.status === 'envoye' && (
            <Link
              href={`/app/devis/${devis.id}/sign`}
              className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-500 hover:to-pink-400 transition-all"
            >
              Signer le devis
            </Link>
          )}
          {devis.status === 'accepte' && (
            <Link
              href={`/app/devis/${devis.id}/convert`}
              className="bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:from-green-500 hover:to-emerald-400 transition-all"
            >
              Convertir en projet
            </Link>
          )}
          <a
            href={`/app/devis/${devis.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:from-gray-500 hover:to-gray-600 transition-all"
          >
            📄 Télécharger PDF
          </a>
        </div>
      </div>
    </div>
  )
}
