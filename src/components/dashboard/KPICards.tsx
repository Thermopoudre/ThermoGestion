'use client'

import Link from 'next/link'

interface KPICardsProps {
  caMonth: number
  caLastMonth: number
  facturesImpayees: number
  montantImpaye: number
  projetsEnCours: number
  projetsEnRetard: number
  devisEnAttente: number
  tauxConversion: number
}

export function KPICards({
  caMonth,
  caLastMonth,
  facturesImpayees,
  montantImpaye,
  projetsEnCours,
  projetsEnRetard,
  devisEnAttente,
  tauxConversion,
}: KPICardsProps) {
  const caEvolution = caLastMonth > 0 ? ((caMonth - caLastMonth) / caLastMonth) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CA du mois */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
            <span className="text-2xl">💰</span>
          </div>
          <span className={`text-sm font-medium px-2 py-1 rounded-full ${
            caEvolution >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
          }`}>
            {caEvolution >= 0 ? '↑' : '↓'} {Math.abs(caEvolution).toFixed(1)}%
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">CA du mois</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {caMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          vs {caLastMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} mois dernier
        </p>
      </div>

      {/* Factures impayées */}
      <Link href="/app/factures?status=unpaid" className="block">
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
          facturesImpayees > 0 ? 'border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
              facturesImpayees > 0 ? 'bg-gradient-to-br from-red-400 to-rose-500 shadow-red-500/30' : 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-400/30'
            }`}>
              <span className="text-2xl">📄</span>
            </div>
            {facturesImpayees > 0 && (
              <span className="text-sm font-medium px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                ⚠️ Action
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Factures impayées</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{facturesImpayees}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {montantImpaye.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </Link>

      {/* Projets en cours - Style thermolaquage */}
      <Link href="/app/projets" className="block">
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
          projetsEnRetard > 0 ? 'border-orange-200 dark:border-orange-900/50' : 'border-gray-100 dark:border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <span className="text-2xl">🔥</span>
            </div>
            {projetsEnRetard > 0 && (
              <span className="text-sm font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
                {projetsEnRetard} retard
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Projets en cours</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{projetsEnCours}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {projetsEnRetard > 0 ? `${projetsEnRetard} en retard` : 'Tous à jour ✓'}
          </p>
        </div>
      </Link>

      {/* Devis en attente */}
      <Link href="/app/devis?status=pending" className="block">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-2xl">📝</span>
            </div>
            <span className="text-sm font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
              {tauxConversion.toFixed(0)}% conv.
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Devis en attente</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{devisEnAttente}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Conversion: {tauxConversion.toFixed(1)}%
          </p>
        </div>
      </Link>
    </div>
  )
}
