'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']
type StockPoudre = Database['public']['Tables']['stock_poudres']['Row']

interface PoudresListProps {
  poudres: (Poudre & {
    stock_poudres: StockPoudre[] | null
  })[]
}

export function PoudresList({ poudres }: PoudresListProps) {
  if (poudres.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucune poudre</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Commencez par ajouter votre première poudre au catalogue
        </p>
        <Link
          href="/app/poudres/new"
          className="inline-block bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Ajouter une poudre
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {poudres.map((poudre) => {
          const stock = poudre.stock_poudres?.[0]
          const stockTheorique = stock?.stock_theorique_kg ? Number(stock.stock_theorique_kg) : 0
          const stockReel = poudre.stock_reel_kg !== null ? Number(poudre.stock_reel_kg) : (stock?.stock_reel_kg ? Number(stock.stock_reel_kg) : null)
          const isLowStock = stockReel !== null && stockReel < 1
          
          return (
            <div
              key={poudre.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${
                isLowStock 
                  ? 'border-l-red-500' 
                  : stockReel !== null && stockReel < stockTheorique * 0.5
                    ? 'border-l-yellow-500'
                    : 'border-l-blue-500'
              } p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header: Marque + Référence */}
                  <div className="flex items-center gap-2">
                    {poudre.ral && (
                      <div 
                        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 shrink-0"
                        style={{ backgroundColor: `#${poudre.ral.replace('RAL', '')}` }}
                        title={poudre.ral}
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">
                        {poudre.marque}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{poudre.reference}</p>
                    </div>
                  </div>
                  
                  {/* Infos */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {poudre.type} • {poudre.finition}
                    </span>
                    {poudre.ral && (
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {poudre.ral}
                      </span>
                    )}
                  </div>
                  
                  {/* Stock */}
                  <div className="flex items-center gap-3 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Stock théo: </span>
                      <span className="font-medium text-gray-900 dark:text-white">{stockTheorique.toFixed(1)} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Réel: </span>
                      <span className={`font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {stockReel !== null ? `${stockReel.toFixed(1)} kg` : '-'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Source badge */}
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        poudre.source === 'thermopoudre'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : poudre.source === 'concurrent'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {poudre.source === 'thermopoudre'
                        ? 'Thermopoudre'
                        : poudre.source === 'concurrent'
                        ? 'Concurrent'
                        : 'Manuel'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/app/poudres/${poudre.id}/stock`}
                  className="text-sm text-cyan-600 hover:text-cyan-900 dark:text-orange-400 dark:hover:text-cyan-300 font-medium"
                >
                  Stock
                </Link>
                <Link
                  href={`/app/poudres/${poudre.id}`}
                  className="text-sm text-orange-500 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Voir →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vue desktop - Tableau */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Marque / Référence
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Type / Finition
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  RAL
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Stock théo.
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Stock réel
                </th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Source
                </th>
                <th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {poudres.map((poudre) => {
                const stock = poudre.stock_poudres?.[0]
                const stockTheorique = stock?.stock_theorique_kg ? Number(stock.stock_theorique_kg) : 0
                const stockReel = poudre.stock_reel_kg !== null ? Number(poudre.stock_reel_kg) : (stock?.stock_reel_kg ? Number(stock.stock_reel_kg) : null)
                
                return (
                  <tr key={poudre.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{poudre.marque}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{poudre.reference}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{poudre.type}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{poudre.finition}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white">{poudre.ral || '-'}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {stockTheorique.toFixed(2)} kg
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {stockReel !== null ? `${stockReel.toFixed(2)} kg` : '-'}
                      </div>
                      {stockReel !== null && stockReel < stockTheorique * 0.5 && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">⚠️ Écart important</div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          poudre.source === 'thermopoudre'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : poudre.source === 'concurrent'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {poudre.source === 'thermopoudre'
                          ? 'Thermopoudre'
                          : poudre.source === 'concurrent'
                          ? 'Concurrent'
                          : 'Manuel'}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-4">
                        <Link
                          href={`/app/poudres/${poudre.id}/stock`}
                          className="text-cyan-600 hover:text-cyan-900 dark:text-orange-400 dark:hover:text-cyan-300 transition-colors"
                        >
                          Stock
                        </Link>
                        <Link
                          href={`/app/poudres/${poudre.id}`}
                          className="text-orange-500 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          Voir →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
