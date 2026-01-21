'use client'

import Link from 'next/link'

interface Alert {
  id: string
  type: 'warning' | 'danger' | 'info'
  title: string
  message: string
  link?: string
  linkText?: string
}

interface AlertsPanelProps {
  alerts: Alert[]
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🔔 Alertes</h3>
        <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <span className="text-4xl mb-2 block">✅</span>
            <p>Aucune alerte en cours</p>
            <p className="text-sm mt-1">Tout est en ordre !</p>
          </div>
        </div>
      </div>
    )
  }

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'danger':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
      case 'warning':
        return 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
    }
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'danger':
        return '🚨'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">🔔 Alertes</h3>
        <span className="text-sm font-medium px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded-full">
          {alerts.length}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 ${getAlertStyles(alert.type)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getAlertIcon(alert.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{alert.title}</p>
                <p className="text-sm opacity-80 mt-1">{alert.message}</p>
                {alert.link && (
                  <Link
                    href={alert.link}
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium hover:underline"
                  >
                    {alert.linkText || 'Voir détails'} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
