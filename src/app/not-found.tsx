import Link from 'next/link'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="text-[150px] font-black text-gray-200 dark:text-gray-800 leading-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
              <span className="text-4xl">🔍</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Page introuvable
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Oups ! La page que vous recherchez n'existe pas ou a été déplacée.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
          >
            <Home className="w-5 h-5" />
            Accueil
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
        </div>

        {/* Help */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Vous cherchez peut-être :
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/dashboard" className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
              Dashboard
            </Link>
            <Link href="/app/devis" className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
              Devis
            </Link>
            <Link href="/app/projets" className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
              Projets
            </Link>
            <Link href="/app/aide" className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
              Aide
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
