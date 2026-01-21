'use client'

import { useState } from 'react'

interface PayNowButtonProps {
  factureId: string
  montantTtc: number
  disabled?: boolean
  className?: string
}

export function PayNowButton({ factureId, montantTtc, disabled, className }: PayNowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/factures/${factureId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du paiement')
      }

      // Rediriger vers Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePay}
        disabled={loading || disabled}
        className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${className || ''}`}
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span>
            Chargement...
          </>
        ) : (
          <>
            <span>💳</span>
            Payer {montantTtc.toFixed(2)} € maintenant
          </>
        )}
      </button>
      
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
        <span>🔒</span>
        Paiement sécurisé par Stripe
      </p>
    </div>
  )
}
