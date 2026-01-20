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
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Aucune poudre</h3>
        <p className="text-gray-600 mb-6">
          Commencez par ajouter votre première poudre au catalogue
        </p>
        <Link
          href="/app/poudres/new"
          className="inline-block bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Ajouter une poudre
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Marque / Référence
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Type / Finition
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                RAL
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Stock théorique
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Stock réel
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {poudres.map((poudre) => {
              const stock = poudre.stock_poudres?.[0]
              const stockTheorique = stock?.stock_theorique_kg ? Number(stock.stock_theorique_kg) : 0
              const stockReel = stock?.stock_reel_kg ? Number(stock.stock_reel_kg) : null
              
              return (
                <tr key={poudre.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{poudre.marque}</div>
                    <div className="text-sm text-gray-600">{poudre.reference}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{poudre.type}</div>
                    <div className="text-sm text-gray-600">{poudre.finition}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{poudre.ral || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {stockTheorique.toFixed(2)} kg
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {stockReel !== null ? `${stockReel.toFixed(2)} kg` : '-'}
                    </div>
                    {stockReel !== null && stockReel < stockTheorique * 0.5 && (
                      <div className="text-xs text-yellow-600 mt-1">⚠️ Écart important</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        poudre.source === 'thermopoudre'
                          ? 'bg-blue-100 text-blue-800'
                          : poudre.source === 'concurrent'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {poudre.source === 'thermopoudre'
                        ? 'Thermopoudre'
                        : poudre.source === 'concurrent'
                        ? 'Concurrent'
                        : 'Manuel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-4">
                      <Link
                        href={`/app/poudres/${poudre.id}/stock`}
                        className="text-cyan-600 hover:text-cyan-900 transition-colors"
                      >
                        Stock
                      </Link>
                      <Link
                        href={`/app/poudres/${poudre.id}`}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
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
  )
}
