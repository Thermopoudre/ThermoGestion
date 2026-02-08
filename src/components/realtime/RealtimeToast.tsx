'use client'

import { useEffect, useState } from 'react'
import { useRealtime } from './RealtimeProvider'
import { X, Package, FileText, CreditCard, MessageSquare, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Toast {
  id: string
  title: string
  message: string
  type: string
  link?: string
}

const typeIcons = {
  projet_status: Package,
  nouveau_devis: FileText,
  facture_payee: CreditCard,
  nouveau_message: MessageSquare,
  stock_bas: AlertTriangle,
}

const typeColors = {
  projet_status: 'bg-blue-500',
  nouveau_devis: 'bg-green-500',
  facture_payee: 'bg-emerald-500',
  nouveau_message: 'bg-orange-500',
  stock_bas: 'bg-red-500',
}

export function RealtimeToast() {
  const { events } = useRealtime()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lastEventCount, setLastEventCount] = useState(0)

  useEffect(() => {
    if (events.length > lastEventCount && lastEventCount > 0) {
      const newEvents = events.slice(0, events.length - lastEventCount)
      const newToasts = newEvents.map(e => ({
        id: e.id,
        title: e.title,
        message: e.message,
        type: e.type,
        link: e.link,
      }))
      setToasts(prev => [...newToasts, ...prev].slice(0, 3))

      // Auto-dismiss after 5s
      newToasts.forEach(toast => {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, 5000)
      })
    }
    setLastEventCount(events.length)
  }, [events.length])

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => {
        const Icon = typeIcons[toast.type as keyof typeof typeIcons] || Package
        const colorClass = typeColors[toast.type as keyof typeof typeColors] || 'bg-gray-500'

        const content = (
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 ${colorClass} rounded-full flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-sm">{toast.title}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{toast.message}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissToast(toast.id) }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )

        return toast.link ? (
          <Link
            key={toast.id}
            href={toast.link}
            className="block bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-slide-in hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            onClick={() => dismissToast(toast.id)}
          >
            {content}
          </Link>
        ) : (
          <div
            key={toast.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-slide-in"
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
