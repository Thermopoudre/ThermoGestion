'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, MailX } from 'lucide-react'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('no-token')
      return
    }

    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(res => {
        if (res.ok) {
          setStatus('success')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <MailX className="w-16 h-16 mx-auto text-gray-400" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-blue-500 animate-spin" />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Désinscription en cours...</h1>
            <p className="text-gray-500">Veuillez patienter.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Désinscription confirmée</h1>
            <p className="text-gray-500 mb-6">
              Vous ne recevrez plus d&apos;emails marketing de notre part.
              Les emails transactionnels (factures, devis, suivi de projets) continueront d&apos;être envoyés.
            </p>
            <p className="text-xs text-gray-400">
              Conformément au RGPD (art. 21), votre demande a été prise en compte immédiatement.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Erreur</h1>
            <p className="text-gray-500 mb-6">
              Une erreur est survenue lors de la désinscription.
              Veuillez contacter directement l&apos;atelier pour demander votre désinscription.
            </p>
          </>
        )}

        {status === 'no-token' && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Lien invalide</h1>
            <p className="text-gray-500">
              Ce lien de désinscription est invalide ou a expiré.
              Utilisez le lien présent dans le dernier email reçu.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  )
}
