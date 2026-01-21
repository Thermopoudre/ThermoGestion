'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface PoudreData {
  name: string
  reference: string
  count: number
  color: string
}

interface TopPoudresProps {
  data: PoudreData[]
}

// Palette thermolaquage - tons chauds
const COLORS = ['#f97316', '#dc2626', '#facc15', '#ea580c', '#ef4444', '#fb923c', '#fbbf24', '#f87171']

export function TopPoudres({ data }: TopPoudresProps) {
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }))

  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">🎨 Top Poudres</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Poudres les plus utilisées</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <span className="text-4xl mb-2 block">🎨</span>
            <p>Aucune donnée disponible</p>
            <p className="text-sm mt-1">Créez des projets avec des poudres</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="w-full sm:w-1/2 h-[180px] sm:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataWithColors}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {dataWithColors.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} projets (${((value / total) * 100).toFixed(1)}%)`, '']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    background: 'white',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full sm:w-1/2 space-y-2">
            {dataWithColors.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-4 h-4 rounded-md flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={item.reference}>
                    {item.reference}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white ml-2">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
