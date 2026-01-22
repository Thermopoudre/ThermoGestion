'use client'

import { useState, useEffect } from 'react'
import { Plus, X, FileText, Package, User, Receipt, Palette, Calendar, QrCode } from 'lucide-react'
import Link from 'next/link'

interface FloatingActionButtonProps {
  className?: string
}

const actions = [
  { href: '/app/projets/new', icon: Package, label: 'Projet', color: 'bg-blue-500 hover:bg-blue-600' },
  { href: '/app/devis/new', icon: FileText, label: 'Devis', color: 'bg-purple-500 hover:bg-purple-600' },
  { href: '/app/clients/new', icon: User, label: 'Client', color: 'bg-green-500 hover:bg-green-600' },
  { href: '/app/factures/new', icon: Receipt, label: 'Facture', color: 'bg-amber-500 hover:bg-amber-600' },
  { href: '/app/poudres/new', icon: Palette, label: 'Poudre', color: 'bg-pink-500 hover:bg-pink-600' },
]

export default function FloatingActionButton({ className = '' }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Cacher le FAB lors du scroll vers le bas
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
        setIsOpen(false)
      } else {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Container */}
      <div 
        className={`fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        } ${className}`}
      >
        {/* Actions menu */}
        <div className={`flex flex-col items-end gap-2 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          {actions.map((action, index) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`flex items-center gap-3 pl-4 pr-3 py-2 ${action.color} text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200`}
                style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
                onClick={() => setIsOpen(false)}
              >
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full">
                  <Icon className="w-5 h-5" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
            isOpen 
              ? 'bg-gray-800 dark:bg-gray-200 rotate-45' 
              : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 hover:shadow-xl hover:scale-110'
          }`}
          aria-label={isOpen ? 'Fermer le menu' : 'Créer nouveau'}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white dark:text-gray-800" />
          ) : (
            <Plus className="w-7 h-7 text-white" />
          )}
        </button>

        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute right-16 bottom-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Créer nouveau
            <div className="absolute top-1/2 right-0 transform translate-x-1 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
          </div>
        )}
      </div>
    </>
  )
}
