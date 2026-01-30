'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCcw, Home, MessageSquare } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="text-[150px] font-black text-gray-200 dark:text-gray-800 leading-none">
            500
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Nous sommes désolés, quelque chose s'est mal passé. Notre équipe a été notifiée.
        </p>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-left">
            <p className="text-sm font-mono text-red-800 dark:text-red-300 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
          >
            <RefreshCcw className="w-5 h-5" />
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-5 h-5" />
            Accueil
          </Link>
        </div>

        {/* Support */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Le problème persiste ?
          </p>
          <Link
            href="/app/support"
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium"
          >
            <MessageSquare className="w-4 h-4" />
            Contacter le support
          </Link>
        </div>
      </div>
    </div>
  )
}
