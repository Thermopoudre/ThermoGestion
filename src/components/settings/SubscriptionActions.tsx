'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, Settings } from 'lucide-react'

interface SubscriptionActionsProps {
  currentPlan: string
  hasStripeCustomer: boolean
  isTrial: boolean
  isTrialExpired: boolean
  cancelAtPeriodEnd: boolean
}

export function SubscriptionActions({
  currentPlan,
  hasStripeCustomer,
  isTrial,
  isTrialExpired,
  cancelAtPeriodEnd,
}: SubscriptionActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCheckout(plan: 'lite' | 'pro') {
    setLoading(plan)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du paiement')
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    setError('')
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'accès au portail')
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Bouton Upgrade vers Pro */}
        {(isTrial || isTrialExpired || currentPlan === 'lite') && (
          <button
            onClick={() => handleCheckout('pro')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'pro' ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            {currentPlan === 'lite' ? 'Passer au Plan Pro - 49 €/mois' : 'Souscrire au Plan Pro - 49 €/mois'}
          </button>
        )}

        {/* Bouton Souscrire Lite (seulement si trial ou expiré) */}
        {(isTrial || isTrialExpired) && (
          <button
            onClick={() => handleCheckout('lite')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-6 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'lite' ? (
              <span className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            Souscrire au Plan Lite - 29 €/mois
          </button>
        )}

        {/* Bouton Gérer mon abonnement (Stripe Portal) */}
        {hasStripeCustomer && !isTrial && (
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-3 px-6 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'portal' ? (
              <span className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full" />
            ) : (
              <Settings className="w-5 h-5" />
            )}
            Gérer mon abonnement
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Info annulation */}
      {cancelAtPeriodEnd && (
        <p className="mt-3 text-sm text-orange-600 dark:text-orange-400">
          Votre abonnement sera annulé à la fin de la période en cours. 
          Vous pouvez le réactiver depuis le portail de gestion.
        </p>
      )}
    </div>
  )
}
