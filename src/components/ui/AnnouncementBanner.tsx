'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Sparkles, Gift, AlertTriangle, Info, ArrowRight } from 'lucide-react'

interface Announcement {
  id: string
  type: 'feature' | 'promo' | 'warning' | 'info'
  title: string
  description?: string
  link?: string
  linkText?: string
  dismissible: boolean
  expiresAt?: string
}

// In production, this would come from the database
const announcements: Announcement[] = [
  {
    id: 'new-feature-jan-2026',
    type: 'feature',
    title: 'Nouveau : Programme de parrainage',
    description: 'Gagnez 1 mois gratuit pour chaque confrère parrainé !',
    link: '/app/parrainage',
    linkText: 'En savoir plus',
    dismissible: true,
  },
]

export function AnnouncementBanner() {
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    // Load dismissed announcements from localStorage
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]')
    setDismissed(dismissedIds)

    // Find first non-dismissed, non-expired announcement
    const active = announcements.find(a => {
      if (dismissedIds.includes(a.id)) return false
      if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false
      return true
    })

    setCurrentAnnouncement(active || null)
  }, [])

  function dismiss() {
    if (!currentAnnouncement) return
    
    const newDismissed = [...dismissed, currentAnnouncement.id]
    setDismissed(newDismissed)
    localStorage.setItem('dismissed_announcements', JSON.stringify(newDismissed))
    
    // Find next announcement
    const next = announcements.find(a => {
      if (newDismissed.includes(a.id)) return false
      if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false
      return true
    })
    setCurrentAnnouncement(next || null)
  }

  if (!currentAnnouncement) return null

  const config = {
    feature: {
      bg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
      icon: Sparkles,
    },
    promo: {
      bg: 'bg-gradient-to-r from-orange-500 to-red-500',
      icon: Gift,
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      icon: Info,
    },
  }

  const { bg, icon: Icon } = config[currentAnnouncement.type]

  return (
    <div className={`${bg} text-white px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium truncate">{currentAnnouncement.title}</span>
            {currentAnnouncement.description && (
              <span className="hidden sm:inline text-white/80 truncate">
                — {currentAnnouncement.description}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          {currentAnnouncement.link && (
            <Link
              href={currentAnnouncement.link}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
            >
              {currentAnnouncement.linkText || 'Voir'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {currentAnnouncement.dismissible && (
            <button
              onClick={dismiss}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
