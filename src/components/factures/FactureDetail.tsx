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
  const totalHt = facture.total_ht ? Number(facture.total_ht) : 0
  const totalTtc = facture.total_ttc ? Number(facture.total_ttc) : 0
  const tvaRate = facture.tva_rate ? Number(facture.tva_rate) : 20
  const acompte = facture.acompte_amount ? Number(facture.acompte_amount) : 0
  const totalPaye = paiements
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const soldeRestant = totalTtc - totalPaye - acompte
  const paymentLinkUrl = facture.payment_link || null

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Facture {facture.numero}</h1>
            {facture.projets && (
              <p className="text-gray-600 dark:text-gray-400">Projet: {facture.projets.name} (#{facture.projets.numero})</p>
            )}
          </div>
          <div className="flex gap-2">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                facture.status === 'payee'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : facture.status === 'envoyee'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {statusLabels[facture.status] || facture.status}
            </span>
            <span className="px-4 py-2 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-sm font-semibold">
              {typeLabels[facture.type] || facture.type}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {format(new Date(facture.created_at), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
          {facture.due_date && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Échéance</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {format(new Date(facture.due_date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Montant TTC</p>
            <p className="font-bold text-orange-500 dark:text-blue-400 text-xl">
              {totalTtc.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Client */}
      {facture.clients && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Client</h2>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p className="font-semibold text-gray-900 dark:text-white">{facture.clients.full_name}</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Détails</h2>
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Désignation
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Qté
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Prix unitaire HT
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    TVA
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.designation || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                      {item.quantite || 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                      {(Number(item.prix_unitaire_ht) || 0).toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                      {item.tva_rate || tvaRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {(Number(item.total_ht) || 0).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                    Total HT
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                    {totalHt.toFixed(2)} €
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                    TVA ({tvaRate}%)
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                    {(totalTtc - totalHt).toFixed(2)} €
                  </td>
                </tr>
                {acompte > 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                      Acompte
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                      - {acompte.toFixed(2)} €
                    </td>
                  </tr>
                )}
                <tr className="bg-blue-50 dark:bg-blue-900/30">
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-xl text-orange-500 dark:text-blue-400">
                    {acompte > 0 ? 'Solde à payer' : 'Total TTC'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-xl text-orange-500 dark:text-blue-400">
                    {(acompte > 0 ? totalTtc - acompte : totalTtc).toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 italic">
              Facture générée automatiquement - voir le projet associé pour les détails.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total HT</span>
                <span className="font-semibold text-gray-900 dark:text-white">{totalHt.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">TVA ({tvaRate}%)</span>
                <span className="font-semibold text-gray-900 dark:text-white">{(totalTtc - totalHt).toFixed(2)} €</span>
              </div>
              {acompte > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Acompte déduit</span>
                  <span className="font-semibold text-gray-900 dark:text-white">- {acompte.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="font-bold text-orange-500 dark:text-blue-400">{acompte > 0 ? 'Solde à payer' : 'Total TTC'}</span>
                <span className="font-bold text-xl text-orange-500 dark:text-blue-400">{(acompte > 0 ? totalTtc - acompte : totalTtc).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Paiements */}
      {paiements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Paiements</h2>
          <div className="space-y-3">
            {paiements.map((paiement) => (
              <div
                key={paiement.id}
                className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {Number(paiement.amount).toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {paymentMethodLabels[paiement.payment_method] || paiement.payment_method} •{' '}
                    {paiement.paid_at
                      ? format(new Date(paiement.paid_at), 'dd MMMM yyyy', { locale: fr })
                      : 'En attente'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    paiement.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : paiement.status === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
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
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-white">Total payé</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {totalPaye.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
            {soldeRestant > 0 && (
              <div className="flex justify-between items-center mt-2">
                <span className="font-semibold text-gray-900 dark:text-white">Solde restant</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notes</h2>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{facture.notes}</p>
        </div>
      )}

      {/* Lien paiement Stripe */}
      {(facture.stripe_payment_link_id || paymentLinkUrl) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Paiement en ligne</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Exports comptabilité</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href={`/api/factures/export/csv?start_date=${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}&end_date=${new Date().toISOString().split('T')[0]}`}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            📊 Exporter CSV
          </a>
          <a
            href={`/api/factures/export/fec?year=${new Date().getFullYear()}`}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            📁 Exporter FEC
          </a>
        </div>
      </div>

      {/* Retour */}
      <Link
        href="/app/factures"
        className="inline-flex items-center text-orange-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
      >
        ← Retour aux factures
      </Link>
    </div>
  )
}
