'use client'

interface DashboardStatsProps {
  clients: number
  projets: number
  devis: number
  storageUsed: number
  storageQuota: number
}

export function DashboardStats({ clients, projets, devis, storageUsed, storageQuota }: DashboardStatsProps) {
  const storagePercentage = (storageUsed / storageQuota) * 100
  const storageColor = storagePercentage > 90 ? 'red' : storagePercentage > 75 ? 'yellow' : 'green'

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Clients</h3>
        <p className="text-3xl font-black text-orange-500 mb-1">{clients}</p>
        <p className="text-sm text-gray-600">Clients actifs</p>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-6 border border-cyan-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Projets</h3>
        <p className="text-3xl font-black text-cyan-600 mb-1">{projets}</p>
        <p className="text-sm text-gray-600">Projets en cours</p>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Devis</h3>
        <p className="text-3xl font-black text-green-600 mb-1">{devis}</p>
        <p className="text-sm text-gray-600">Devis créés</p>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Stockage</h3>
        <p className="text-2xl font-black text-purple-600 mb-1">
          {storageUsed.toFixed(2)} / {storageQuota} GB
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className={`h-2 rounded-full transition-all ${
              storageColor === 'red'
                ? 'bg-red-500'
                : storageColor === 'yellow'
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(storagePercentage, 100)}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {storagePercentage.toFixed(1)}% utilisé
        </p>
      </div>
    </div>
  )
}
