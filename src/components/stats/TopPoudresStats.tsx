'use client'

import Link from 'next/link'

interface Poudre {
  id: string
  reference: string
  nom: string | null
  count: number
}

interface TopPoudresStatsProps {
  poudres: Poudre[]
}

export function TopPoudresStats({ poudres }: TopPoudresStatsProps) {
  const maxCount = Math.max(...poudres.map(p => p.count), 1)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">🎨 Top Poudres</h3>

      {poudres.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Aucune donnée disponible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {poudres.map((poudre, index) => (
            <Link
              key={poudre.id}
              href={`/app/poudres/${poudre.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-pink-100 text-pink-700' :
                index === 1 ? 'bg-purple-100 text-purple-700' :
                index === 2 ? 'bg-indigo-100 text-indigo-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{poudre.reference}</p>
                {poudre.nom && (
                  <p className="text-xs text-gray-500 truncate">{poudre.nom}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                      style={{ width: `${(poudre.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-16 text-right">
                    {poudre.count} proj.
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
