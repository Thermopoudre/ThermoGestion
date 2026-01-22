'use client'

import { useState, useEffect } from 'react'
import CommandPalette from '@/components/ui/CommandPalette'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts'
import { ToastProvider } from '@/components/ui/Toast'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // Global Cmd+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ToastProvider>
      {/* Keyboard shortcuts handler */}
      <KeyboardShortcuts onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
      
      {/* Command palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
      />

      {/* Breadcrumbs - affiché sous la nav */}
      <div className="container mx-auto px-4 py-2">
        <Breadcrumbs />
      </div>

      {/* Main content */}
      <div className="pb-24">
        {children}
      </div>

      {/* Floating action button */}
      <FloatingActionButton />
    </ToastProvider>
  )
}
