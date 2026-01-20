'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database.types'

interface RetouchesStatsProps {
  stats: {
    total_projets: number
    projets_avec_nc: number
    taux_nc: number
    total_retouches: number
  } | null
  causes: Array<{
    defaut_type_id: string
    defaut_name: string
    count: number
    percentage: number
  }>
  atelierId: string
}

export function RetouchesStats({ stats, causes, atelierId }: RetouchesStatsProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Statistiques globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Taux de NC</p>
            <p className="text-4xl font-bold text-red-600">{Number(stats.taux_nc).toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.projets_avec_nc} projet(s) avec NC sur {stats.total_projets}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Total retouches</p>
            <p className="text-4xl font-bold text-gray-900">{stats.total_retouches}</p>
            <p className="text-xs text-gray-500 mt-2">Derniers 30 jours</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Projets avec NC</p>
            <p className="text-4xl font-bold text-orange-600">{stats.projets_avec_nc}</p>
            <p className="text-xs text-gray-500 mt-2">Sur {stats.total_projets} projets</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Total projets</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total_projets}</p>
            <p className="text-xs text-gray-500 mt-2">Derniers 30 jours</p>
          </div>
        </div>
      )}

      {/* Causes principales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Causes principales de retouches</h2>
        {causes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
        ) : (
          <div className="space-y-4">
            {causes.map((cause, index) => (
              <div key={cause.defaut_type_id} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-semibold text-gray-900">{cause.defaut_name}</p>
                    <p className="text-sm text-gray-600">
                      {cause.count} occurrence(s) • {Number(cause.percentage).toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${cause.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retour */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour
      </button>
    </div>
  )
}
