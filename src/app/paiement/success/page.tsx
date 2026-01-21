'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const factureId = searchParams.get('facture')

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <span className="text-5xl">✅</span>
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-4">
          Paiement réussi !
        </h1>
        
        <p className="text-gray-600 mb-6">
          Merci pour votre paiement. Vous allez recevoir une confirmation par email.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
          <p className="text-green-800 text-sm">
            💰 Votre facture est maintenant marquée comme payée.
          </p>
        </div>

        <div className="space-y-3">
          {factureId && (
            <Link
              href={`/app/factures/${factureId}`}
              className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all"
            >
              Voir la facture
            </Link>
          )}
          <Link
            href="/client/projets"
            className="block w-full bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Mes projets
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          Une question ? Contactez votre atelier directement.
        </p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
