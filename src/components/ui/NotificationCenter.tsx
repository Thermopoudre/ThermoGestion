'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  Bell, X, Check, CheckCheck, Trash2, 
  Package, FileText, Receipt, AlertTriangle, 
  MessageSquare, Clock, Users
} from 'lucide-react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  created_at: string
}

const notificationIcons: Record<string, typeof Package> = {
  projet: Package,
  devis: FileText,
  facture: Receipt,
  alert: AlertTriangle,
  message: MessageSquare,
  reminder: Clock,
  client: Users,
}

const notificationColors: Record<string, string> = {
  projet: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  devis: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  facture: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  alert: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  message: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  reminder: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  client: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
}

export function NotificationCenter() {
  const supabase = createClientComponentClient()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.read).length

  const loadNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadNotifications])

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = async (id: string) => {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id)

    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'À l\'instant'
    if (minutes < 60) return `Il y a ${minutes}min`
    if (hours < 24) return `Il y a ${hours}h`
    if (days < 7) return `Il y a ${days}j`
    return date.toLocaleDateString('fr-FR')
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Tout lire
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div className="overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map(notification => {
                    const Icon = notificationIcons[notification.type] || Bell
                    const colorClass = notificationColors[notification.type] || 'bg-gray-100 text-gray-600'

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          !notification.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>

                              {/* Unread indicator */}
                              {!notification.read && (
                                <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                {formatTime(notification.created_at)}
                              </span>

                              <div className="flex items-center gap-1">
                                {notification.link && (
                                  <Link
                                    href={notification.link}
                                    onClick={() => {
                                      markAsRead(notification.id)
                                      setIsOpen(false)
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                                  >
                                    <span className="text-xs">Voir →</span>
                                  </Link>
                                )}
                                {!notification.read && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                                    title="Marquer comme lu"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
                <Link
                  href="/app/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 font-medium"
                >
                  Voir toutes les notifications
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
