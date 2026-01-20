'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Facture = Database['public']['Tables']['factures']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row']
  projets?: Database['public']['Tables']['projets']['Row']
}

type Atelier = Database['public']['Tables']['ateliers']['Row']
type Paiement = Database['public']['Tables']['paiements']['Row']

interface FactureDetailProps {
  facture: Facture
  atelier: Atelier | null
  paiements: Paiement[]
  atelierId: string
}

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  remboursee: 'Remboursée',
}

const typeLabels: Record<string, string> = {
  acompte: 'Acompte',
  solde: 'Solde',
  complete: 'Complète',
}

const paymentMethodLabels: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  gocardless: 'GoCardless',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

export function FactureDetail({ facture, atelier, paiements, atelierId }: FactureDetailProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = (facture.items as any[]) || []
  const acompte = facture.acompte_amount ? Number(facture.acompte_amount) : 0
  const totalPaye = paiements
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const soldeRestant = Number(facture.total_ttc) - totalPaye - acompte

  const handleEnvoyer = async () => {
    if (!confirm('Envoyer cette facture au client par email ?')) return

    setLoading(true)
    setError(null)

    try {
      // TODO: Implémenter l'envoi email (similaire aux devis)
      const response = await fetch(`/api/factures/${facture.id}/send-email`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi')
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi')
    } finally {
      setLoading(false)
    }
  }

  const handleMarquerPayee = async () => {
    if (!confirm('Marquer cette facture comme payée ?')) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/factures/${facture.id}/mark-paid`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour')
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Facture {facture.numero}</h1>
            {facture.projets && (
              <p className="text-gray-600">Projet: {facture.projets.name} (#{facture.projets.numero})</p>
            )}
          </div>
          <div className="flex gap-2">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                facture.status === 'payee'
                  ? 'bg-green-100 text-green-800'
                  : facture.status === 'envoyee'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {statusLabels[facture.status] || facture.status}
            </span>
            <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold">
              {typeLabels[facture.type] || facture.type}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="font-semibold text-gray-900">
              {format(new Date(facture.created_at), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
          {facture.due_date && (
            <div>
              <p className="text-sm text-gray-600">Échéance</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(facture.due_date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Montant TTC</p>
            <p className="font-bold text-blue-600 text-xl">
              {Number(facture.total_ttc).toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
          <a
            href={`/app/factures/${facture.id}/pdf`}
            target="_blank"
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Télécharger PDF
          </a>
          {facture.status === 'brouillon' && (
            <button
              onClick={handleEnvoyer}
              disabled={loading}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Envoyer au client
            </button>
          )}
          {facture.status === 'envoyee' && facture.payment_status !== 'paid' && (
            <button
              onClick={handleMarquerPayee}
              disabled={loading}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Marquer comme payée
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Client */}
      {facture.clients && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Client</h2>
          <div className="space-y-2 text-gray-600">
            <p className="font-semibold text-gray-900">{facture.clients.full_name}</p>
            {facture.clients.address && <p>{facture.clients.address}</p>}
            {facture.clients.phone && <p>Tél: {facture.clients.phone}</p>}
            {facture.clients.email && <p>Email: {facture.clients.email}</p>}
            {facture.clients.type === 'professionnel' && facture.clients.siret && (
              <p>SIRET: {facture.clients.siret}</p>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Détails</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Désignation
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Qté
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Prix unitaire HT
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                TVA
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total HT
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.designation}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {item.quantite}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {item.prix_unitaire_ht.toFixed(2)} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                  {item.tva_rate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  {item.total_ht.toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900">
                Total HT
              </td>
              <td className="px-6 py-4 text-right font-semibold text-gray-900">
                {Number(facture.total_ht).toFixed(2)} €
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900">
                TVA ({facture.tva_rate}%)
              </td>
              <td className="px-6 py-4 text-right font-semibold text-gray-900">
                {(Number(facture.total_ttc) - Number(facture.total_ht)).toFixed(2)} €
              </td>
            </tr>
            {acompte > 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900">
                  Acompte
                </td>
                <td className="px-6 py-4 text-right font-semibold text-gray-900">
                  - {acompte.toFixed(2)} €
                </td>
              </tr>
            )}
            <tr className="bg-blue-50">
              <td colSpan={4} className="px-6 py-4 text-right font-bold text-xl text-blue-600">
                {acompte > 0 ? 'Solde à payer' : 'Total TTC'}
              </td>
              <td className="px-6 py-4 text-right font-bold text-xl text-blue-600">
                {(acompte > 0 ? Number(facture.total_ttc) - acompte : Number(facture.total_ttc)).toFixed(2)}{' '}
                €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Paiements */}
      {paiements.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Paiements</h2>
          <div className="space-y-3">
            {paiements.map((paiement) => (
              <div
                key={paiement.id}
                className="flex justify-between items-center p-4 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {Number(paiement.amount).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {paymentMethodLabels[paiement.payment_method] || paiement.payment_method} •{' '}
                    {paiement.paid_at
                      ? format(new Date(paiement.paid_at), 'dd MMMM yyyy', { locale: fr })
                      : 'En attente'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    paiement.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : paiement.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {paiement.status === 'completed'
                    ? 'Payé'
                    : paiement.status === 'failed'
                    ? 'Échoué'
                    : 'En attente'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total payé</span>
              <span className="text-lg font-bold text-green-600">
                {totalPaye.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
            {soldeRestant > 0 && (
              <div className="flex justify-between items-center mt-2">
                <span className="font-semibold text-gray-900">Solde restant</span>
                <span className="text-lg font-bold text-red-600">
                  {soldeRestant.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {facture.notes && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
          <p className="text-gray-600 whitespace-pre-line">{facture.notes}</p>
        </div>
      )}

      {/* Lien paiement Stripe */}
      {(facture.stripe_payment_link_id || paymentLinkUrl) && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Paiement en ligne</h2>
          <p className="text-gray-600 mb-4">
            Un lien de paiement Stripe a été généré pour cette facture.
          </p>
          <a
            href={paymentLinkUrl || `https://buy.stripe.com/${facture.stripe_payment_link_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Accéder au lien de paiement →
          </a>
        </div>
      )}

      {/* Exports */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Exports comptabilité</h2>
        <div className="flex gap-4">
          <a
            href={`/api/factures/export/csv?start_date=${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}&end_date=${new Date().toISOString().split('T')[0]}`}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Exporter CSV
          </a>
          <a
            href={`/api/factures/export/fec?year=${new Date().getFullYear()}`}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Exporter FEC
          </a>
        </div>
      </div>

      {/* Retour */}
      <Link
        href="/app/factures"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour aux factures
      </Link>
    </div>
  )
}
