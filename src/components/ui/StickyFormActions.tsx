'use client'

import { ReactNode, useEffect, useState } from 'react'

interface StickyFormActionsProps {
  children: ReactNode
  isVisible?: boolean
  showOnMobileOnly?: boolean
}

export function StickyFormActions({ 
  children, 
  isVisible = true,
  showOnMobileOnly = true 
}: StickyFormActionsProps) {
  const [isScrolledPastFooter, setIsScrolledPastFooter] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Check if we've scrolled past the normal form footer position
      const scrolled = window.scrollY > 200
      setIsScrolledPastFooter(scrolled)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible) return null

  return (
    <>
      {/* Spacer for sticky bar */}
      <div className={`h-20 ${showOnMobileOnly ? 'md:hidden' : ''}`} />
      
      {/* Sticky action bar */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 z-40
          bg-white dark:bg-gray-900 
          border-t border-gray-200 dark:border-gray-700
          shadow-[0_-4px_20px_rgba(0,0,0,0.1)]
          px-4 py-3 safe-area-inset-bottom
          transition-transform duration-300
          ${showOnMobileOnly ? 'md:hidden' : ''}
          ${isScrolledPastFooter ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          {children}
        </div>
      </div>
    </>
  )
}

// Auto-save status indicator
interface AutoSaveStatusProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved?: Date | null
}

export function AutoSaveStatus({ status, lastSaved }: AutoSaveStatusProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-orange-600 dark:text-orange-400">Enregistrement...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-green-600 dark:text-green-400">
            Enregistré {lastSaved && `à ${formatTime(lastSaved)}`}
          </span>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-600 dark:text-red-400">Erreur de sauvegarde</span>
        </>
      )}
      {status === 'idle' && lastSaved && (
        <>
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
          <span className="text-gray-500">Modifié</span>
        </>
      )}
    </div>
  )
}
