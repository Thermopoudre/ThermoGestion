'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']
type StockPoudre = Database['public']['Tables']['stock_poudres']['Row']

interface PoudresListProps {
  poudres: (Poudre & {
    stock_poudres: StockPoudre[] | null
  })[]
}

export function PoudresList({ poudres }: PoudresListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterFinition, setFilterFinition] = useState<string>('all')

  // Extraire les options de filtre depuis les données
  const filterOptions = useMemo(() => {
    const types = [...new Set(poudres.map(p => p.type).filter(Boolean))]
    const finitions = [...new Set(poudres.map(p => p.finition).filter(Boolean))]
    return { types, finitions }
  }, [poudres])

  const filteredPoudres = useMemo(() => {
    let result = poudres

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.reference?.toLowerCase().includes(q) ||
        p.marque?.toLowerCase().includes(q) ||
        p.ral?.toLowerCase().includes(q)
      )
    }

    if (filterType !== 'all') {
      result = result.filter(p => p.type === filterType)
    }

    if (filterFinition !== 'all') {
      result = result.filter(p => p.finition === filterFinition)
    }

    return result
  }, [poudres, searchQuery, filterType, filterFinition])

  const {
    currentPage, totalPages, totalItems, itemsPerPage,
    paginatedItems: paginatedPoudres, setCurrentPage, setItemsPerPage,
  } = usePagination(filteredPoudres, 25)

  if (poudres.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
          <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Aucune poudre</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Ajoutez vos premières poudres au catalogue pour commencer à gérer votre stock et calculer les consommations
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app/poudres/new"
            className="btn-primary"
          >
            + Ajouter une poudre
          </Link>
          <Link
            href="/app/poudres/import"
            className="btn-secondary"
          >
            Importer CSV
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Astuce : Importez votre catalogue existant via un fichier CSV pour gagner du temps
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Barre de filtres */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par référence, marque, RAL..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            className="w-full pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            aria-label="Rechercher une poudre"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Effacer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
          aria-label="Filtrer par type"
        >
          <option value="all">Tous les types</option>
          {filterOptions.types.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterFinition}
          onChange={(e) => { setFilterFinition(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
          aria-label="Filtrer par finition"
        >
          <option value="all">Toutes les finitions</option>
          {filterOptions.finitions.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {filteredPoudres.length === 0 && poudres.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Aucune poudre ne correspond à vos critères</p>
          <button onClick={() => { setSearchQuery(''); setFilterType('all'); setFilterFinition('all') }} className="mt-2 text-orange-500 hover:text-orange-600 text-sm font-medium">
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* Vue mobile - Cartes */}
      <div className="md:hidden space-y-3">
        {paginatedPoudres.map((poudre) => {
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
                  className="text-sm text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
                >
                  Stock
                </Link>
                <Link
                  href={`/app/poudres/${poudre.id}`}
                  className="text-sm text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
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
              {paginatedPoudres.map((poudre) => {
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
                          className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                        >
                          Stock
                        </Link>
                        <Link
                          href={`/app/poudres/${poudre.id}`}
                          className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
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

      {/* Pagination */}
      {filteredPoudres.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      )}
    </>
  )
}
