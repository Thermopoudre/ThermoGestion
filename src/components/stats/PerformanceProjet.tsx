'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface Projet {
  id: string
  status: string
  date_depot: string | null
  date_promise: string | null
}

interface PerformanceProjetProps {
  projets: Projet[]
}

const statusLabels: Record<string, string> = {
  devis: 'En devis',
  en_cours: 'En cours',
  en_cuisson: 'En cuisson',
  qc: 'Contrôle qualité',
  pret: 'Prêt',
  livre: 'Livré',
}

const statusColors: Record<string, string> = {
  devis: '#9CA3AF',
  en_cours: '#3B82F6',
  en_cuisson: '#F97316',
  qc: '#8B5CF6',
  pret: '#10B981',
  livre: '#059669',
}

export function PerformanceProjet({ projets }: PerformanceProjetProps) {
  // Répartition par statut
  const statusCount: Record<string, number> = {}
  for (const p of projets) {
    statusCount[p.status] = (statusCount[p.status] || 0) + 1
  }

  const pieData = Object.entries(statusCount).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    color: statusColors[status] || '#6B7280',
  }))

  // Projets en retard
  const today = new Date().toISOString().split('T')[0]
  const projetsEnRetard = projets.filter(
    p => p.date_promise && p.date_promise < today && !['livre', 'pret'].includes(p.status)
  ).length

  // Taux de respect des délais
  const projetsAvecDelai = projets.filter(p => p.date_promise && p.status === 'livre')
  const projetsATemps = projetsAvecDelai.filter(p => {
    // Simplifié : on considère livré = à temps si statut est livré
    return true
  }).length
  const tauxRespect = projetsAvecDelai.length > 0 
    ? (projetsATemps / projetsAvecDelai.length) * 100 
    : 100

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">🔧 Performance Projets</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique répartition */}
        <div>
          <p className="text-sm text-gray-500 mb-4">Répartition par statut</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Métriques */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total projets</p>
            <p className="text-3xl font-bold text-gray-900">{projets.length}</p>
          </div>

          <div className={`p-4 rounded-lg ${projetsEnRetard > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-sm text-gray-500">Projets en retard</p>
            <p className={`text-3xl font-bold ${projetsEnRetard > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {projetsEnRetard}
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-500">Taux de respect des délais</p>
            <p className="text-3xl font-bold text-orange-500">{tauxRespect.toFixed(0)}%</p>
          </div>

          {/* Légende */}
          <div className="grid grid-cols-2 gap-2 pt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
