'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, Scale, TrendingDown, Package } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']
type StockPoudre = Database['public']['Tables']['stock_poudres']['Row']

type PoudreWithStock = Poudre & {
  stock_poudres: StockPoudre[] | null
}

interface StockAlertsProps {
  poudres: PoudreWithStock[]
}

interface StockAlert {
  poudre: PoudreWithStock
  type: 'low_stock' | 'to_weigh' | 'large_ecart'
  priority: 'high' | 'medium' | 'low'
  message: string
}

export function StockAlerts({ poudres }: StockAlertsProps) {
  const alerts = useMemo(() => {
    const result: StockAlert[] = []

    for (const poudre of poudres) {
      const stock = poudre.stock_poudres?.[0]
      const stockTheorique = stock?.stock_theorique_kg ? Number(stock.stock_theorique_kg) : 0
      const stockReel = poudre.stock_reel_kg !== null ? Number(poudre.stock_reel_kg) : null
      const dernierePesee = stock?.dernier_pesee_at ? new Date(stock.dernier_pesee_at) : null

      // Alerte stock bas (< 1kg ou < 20% du théorique)
      if (stockReel !== null && (stockReel < 1 || (stockTheorique > 0 && stockReel < stockTheorique * 0.2))) {
        result.push({
          poudre,
          type: 'low_stock',
          priority: stockReel < 0.5 ? 'high' : 'medium',
          message: `Stock critique : ${stockReel.toFixed(1)} kg restant${stockTheorique > 0 ? ` (théorique: ${stockTheorique.toFixed(1)} kg)` : ''}`,
        })
      }

      // Suggestion de pesée (dernière pesée > 7 jours ou jamais pesé)
      const daysSinceWeigh = dernierePesee
        ? Math.floor((Date.now() - dernierePesee.getTime()) / (1000 * 60 * 60 * 24))
        : null

      if (daysSinceWeigh === null || daysSinceWeigh > 7) {
        result.push({
          poudre,
          type: 'to_weigh',
          priority: daysSinceWeigh === null ? 'medium' : daysSinceWeigh > 14 ? 'high' : 'low',
          message: daysSinceWeigh === null
            ? 'Jamais pesée - Effectuez une première pesée pour activer le suivi'
            : `Dernière pesée il y a ${daysSinceWeigh} jours`,
        })
      }

      // Alerte écart important entre théorique et réel (> 30%)
      if (stockReel !== null && stockTheorique > 0) {
        const ecart = Math.abs(stockTheorique - stockReel) / stockTheorique
        if (ecart > 0.3) {
          result.push({
            poudre,
            type: 'large_ecart',
            priority: ecart > 0.5 ? 'high' : 'medium',
            message: `Écart ${(ecart * 100).toFixed(0)}% entre stock théorique (${stockTheorique.toFixed(1)} kg) et réel (${stockReel.toFixed(1)} kg)`,
          })
        }
      }
    }

    // Trier par priorité
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  }, [poudres])

  if (alerts.length === 0) return null

  const getIcon = (type: StockAlert['type']) => {
    switch (type) {
      case 'low_stock': return <TrendingDown className="w-5 h-5" />
      case 'to_weigh': return <Scale className="w-5 h-5" />
      case 'large_ecart': return <AlertTriangle className="w-5 h-5" />
    }
  }

  const getColors = (priority: StockAlert['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      case 'medium': return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
      case 'low': return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
    }
  }

  const getIconColor = (priority: StockAlert['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400'
      case 'medium': return 'text-amber-600 dark:text-amber-400'
      case 'low': return 'text-blue-600 dark:text-blue-400'
    }
  }

  const getTypeLabel = (type: StockAlert['type']) => {
    switch (type) {
      case 'low_stock': return 'Stock bas'
      case 'to_weigh': return 'À peser'
      case 'large_ecart': return 'Écart stock'
    }
  }

  // Grouper par type
  const toWeigh = alerts.filter(a => a.type === 'to_weigh')
  const lowStock = alerts.filter(a => a.type === 'low_stock')
  const ecarts = alerts.filter(a => a.type === 'large_ecart')

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Package className="w-5 h-5 text-orange-500" />
        Alertes Stock
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({alerts.length} alerte{alerts.length > 1 ? 's' : ''})
        </span>
      </h2>

      {/* Poudres à peser - Section prioritaire */}
      {toWeigh.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Poudres à peser aujourd'hui ({toWeigh.length})
          </h3>
          <div className="space-y-2">
            {toWeigh.slice(0, 5).map((alert) => (
              <Link
                key={`weigh-${alert.poudre.id}`}
                href={`/app/poudres/${alert.poudre.id}/stock`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {alert.poudre.marque} - {alert.poudre.reference}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{alert.message}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                  Peser &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stocks bas */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="font-semibold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Stocks critiques ({lowStock.length})
          </h3>
          <div className="space-y-2">
            {lowStock.slice(0, 5).map((alert) => (
              <Link
                key={`low-${alert.poudre.id}`}
                href={`/app/poudres/${alert.poudre.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${alert.priority === 'high' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {alert.poudre.marque} - {alert.poudre.reference}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{alert.message}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-red-600 dark:text-red-400 shrink-0">
                  Commander &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
