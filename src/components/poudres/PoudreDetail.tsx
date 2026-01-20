'use client'

import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']
type StockPoudre = Database['public']['Tables']['stock_poudres']['Row']

interface PoudreDetailProps {
  poudre: Poudre & {
    stock_poudres: StockPoudre[] | null
  }
}

export function PoudreDetail({ poudre }: PoudreDetailProps) {
  const stock = poudre.stock_poudres?.[0]
  const stockTheorique = stock?.stock_theorique_kg ? Number(stock.stock_theorique_kg) : 0
  const stockReel = stock?.stock_reel_kg ? Number(stock.stock_reel_kg) : null

  return (
    <div className="space-y-6">
      {/* Informations principales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Marque</label>
            <p className="text-gray-900 font-medium">{poudre.marque}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Référence</label>
            <p className="text-gray-900 font-medium">{poudre.reference}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
            <p className="text-gray-900">{poudre.type}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Finition</label>
            <p className="text-gray-900">{poudre.finition}</p>
          </div>
          {poudre.ral && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">RAL</label>
              <p className="text-gray-900">{poudre.ral}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Source</label>
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
          </div>
        </div>
      </div>

      {/* Caractéristiques techniques */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Caractéristiques techniques</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {poudre.densite && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Densité</label>
              <p className="text-gray-900">{Number(poudre.densite).toFixed(2)} g/cm³</p>
            </div>
          )}
          {poudre.epaisseur_conseillee && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Épaisseur conseillée</label>
              <p className="text-gray-900">{Number(poudre.epaisseur_conseillee).toFixed(0)} µm</p>
            </div>
          )}
          {poudre.consommation_m2 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Consommation</label>
              <p className="text-gray-900">{Number(poudre.consommation_m2).toFixed(2)} kg/m²</p>
            </div>
          )}
          {poudre.temp_cuisson && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Température cuisson</label>
              <p className="text-gray-900">{poudre.temp_cuisson} °C</p>
            </div>
          )}
          {poudre.duree_cuisson && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Durée cuisson</label>
              <p className="text-gray-900">{poudre.duree_cuisson} min</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Stock</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-600 mb-2">Stock théorique</label>
            <p className="text-3xl font-black text-blue-600">{stockTheorique.toFixed(2)} kg</p>
          </div>
          <div className={`border rounded-lg p-6 ${stockReel !== null ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <label className="block text-sm font-medium text-gray-600 mb-2">Stock réel</label>
            <p className={`text-3xl font-black ${stockReel !== null ? 'text-green-600' : 'text-gray-400'}`}>
              {stockReel !== null ? `${stockReel.toFixed(2)} kg` : 'Non pesé'}
            </p>
          </div>
          <div>
            <Link
              href={`/app/poudres/${poudre.id}/stock`}
              className="block w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-center"
            >
              Gérer le stock
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
