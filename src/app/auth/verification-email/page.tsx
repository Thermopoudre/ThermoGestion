'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerificationEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          Vérifiez votre email
        </h1>
        
        <p className="text-gray-600 mb-6">
          {email ? (
            <>
              Un email de vérification a été envoyé à <strong>{email}</strong>
            </>
          ) : (
            'Un email de vérification a été envoyé à votre adresse email'
          )}
        </p>
        
        <p className="text-sm text-gray-500 mb-6">
          Cliquez sur le lien dans l'email pour vérifier votre compte et commencer votre essai gratuit de 30 jours.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 <strong>Astuce :</strong> Vérifiez votre dossier spam si vous ne recevez pas l'email dans quelques minutes.
          </p>
        </div>

        <Link
          href="/auth/login"
          className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-center"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
