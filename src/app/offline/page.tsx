'use client'

import { WifiOff, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto">
            <WifiOff className="w-16 h-16 text-white" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded-full blur-sm"></div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Vous êtes hors ligne
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Vérifiez votre connexion internet et réessayez. 
          Certaines fonctionnalités sont disponibles hors ligne.
        </p>

        {/* Offline Features */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8 shadow-lg text-left">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">
            Disponible hors ligne :
          </h2>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Consulter vos données en cache
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Créer des brouillons de devis
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Voir le planning
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orange-500">~</span>
              Les modifications seront synchronisées au retour
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
          >
            <RefreshCcw className="w-5 h-5" />
            Réessayer
          </button>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-5 h-5" />
            Dashboard (cache)
          </Link>
        </div>

        {/* Status */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Hors ligne</span>
        </div>
      </div>
    </div>
  )
}
