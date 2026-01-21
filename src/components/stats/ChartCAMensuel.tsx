'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartCAMensuelProps {
  data: Record<string, number>
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export function ChartCAMensuel({ data }: ChartCAMensuelProps) {
  const chartData = Object.entries(data).map(([key, value]) => {
    const [year, month] = key.split('-')
    return {
      month: monthNames[parseInt(month) - 1],
      ca: value,
    }
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const total = Object.values(data).reduce((sum, v) => sum + v, 0)
  const average = total / 12

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">📈 Chiffre d'affaires mensuel</h3>
          <p className="text-sm text-gray-500">Évolution sur l'année</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Moyenne mensuelle</p>
          <p className="text-lg font-bold text-orange-500">{formatCurrency(average)}</p>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'CA']}
              contentStyle={{ 
                borderRadius: '8px', 
                border: '1px solid #E5E7EB',
              }}
            />
            <Bar 
              dataKey="ca" 
              fill="#3B82F6" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
