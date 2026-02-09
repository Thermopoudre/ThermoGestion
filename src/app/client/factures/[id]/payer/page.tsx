'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { 
  CreditCard, Shield, Lock, ArrowLeft, CheckCircle, 
  Building2, AlertTriangle
} from 'lucide-react'

export default function ClientFacturePayerPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePayByLink() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/factures/${params.id}/payment-link`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la création du lien de paiement')
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('Aucun lien de paiement généré')
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Factures', href: '/client/factures' },
        { label: 'Paiement' },
      ]} />

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Paiement de facture
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Choisissez votre mode de paiement sécurisé
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Paiement en ligne */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-2 border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Paiement par carte bancaire</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Paiement sécurisé via Stripe. Accepte Visa, Mastercard, et plus.
              </p>
            </div>
          </div>
          
          <button
            onClick={handlePayByLink}
            disabled={loading}
            className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Redirection en cours...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Payer maintenant
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> SSL 256 bits
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> PCI-DSS
            </span>
          </div>
        </div>

        {/* Virement */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Virement bancaire</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Effectuez un virement sur le compte de l'atelier. Merci d'indiquer le numéro de facture en référence.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium mb-2">Contactez votre atelier pour obtenir les coordonnées bancaires (RIB/IBAN).</p>
            <p className="text-gray-500 dark:text-gray-400">
              Le paiement sera validé manuellement à réception du virement.
            </p>
          </div>
        </div>
      </div>

      {/* Retour */}
      <div className="mt-8 text-center">
        <Link 
          href={`/client/factures/${params.id}`}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la facture
        </Link>
      </div>
    </div>
  )
}
