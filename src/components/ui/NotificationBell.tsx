'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Alerte {
  id: string
  type: string
  titre: string
  message: string
  lien?: string
  lu: boolean
  created_at: string
}

export function NotificationBell() {
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [nonLues, setNonLues] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Charger les alertes
  const fetchAlertes = async () => {
    try {
      const response = await fetch('/api/alertes')
      if (response.ok) {
        const data = await response.json()
        setAlertes(data.alertes || [])
        setNonLues(data.non_lues || 0)
      }
    } catch (error) {
      console.error('Erreur chargement alertes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/alertes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      })
      if (response.ok) {
        setAlertes(alertes.map(a => ({ ...a, lu: true })))
        setNonLues(0)
      }
    } catch (error) {
      console.error('Erreur mark as read:', error)
    }
  }

  // Marquer une alerte comme lue
  const markAsRead = async (alerteId: string) => {
    try {
      await fetch('/api/alertes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerte_ids: [alerteId] }),
      })
      setAlertes(alertes.map(a => a.id === alerteId ? { ...a, lu: true } : a))
      setNonLues(Math.max(0, nonLues - 1))
    } catch (error) {
      console.error('Erreur mark as read:', error)
    }
  }

  // Charger au montage et toutes les 60 secondes
  useEffect(() => {
    fetchAlertes()
    const interval = setInterval(fetchAlertes, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stock_bas':
        return '📦'
      case 'devis_expiration':
        return '📄'
      case 'facture_impayee':
        return '💰'
      default:
        return '🔔'
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Badge nombre non lues */}
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform bg-red-500 rounded-full">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
            {nonLues > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste des alertes */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Chargement...
              </div>
            ) : alertes.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <span className="text-4xl mb-2 block">🔔</span>
                Aucune notification
              </div>
            ) : (
              alertes.slice(0, 10).map((alerte) => (
                <div
                  key={alerte.id}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!alerte.lu ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {alerte.lien ? (
                    <Link
                      href={alerte.lien}
                      onClick={() => {
                        if (!alerte.lu) markAsRead(alerte.id)
                        setIsOpen(false)
                      }}
                      className="block"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{getTypeIcon(alerte.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!alerte.lu ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {alerte.titre}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {alerte.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {getTimeAgo(alerte.created_at)}
                          </p>
                        </div>
                        {!alerte.lu && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getTypeIcon(alerte.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!alerte.lu ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {alerte.titre}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {alerte.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {getTimeAgo(alerte.created_at)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {alertes.length > 10 && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                + {alertes.length - 10} autres notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
