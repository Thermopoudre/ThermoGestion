'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface KeyboardShortcutsProps {
  onOpenCommandPalette: () => void
}

export default function KeyboardShortcuts({ onOpenCommandPalette }: KeyboardShortcutsProps) {
  const router = useRouter()
  const [keyBuffer, setKeyBuffer] = useState<string[]>([])

  useEffect(() => {
    // Clear buffer after 1 second of inactivity
    const timer = setTimeout(() => setKeyBuffer([]), 1000)
    return () => clearTimeout(timer)
  }, [keyBuffer])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si dans un input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Cmd/Ctrl + K - Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }

      // Escape - Close any modal
      if (e.key === 'Escape') {
        return
      }

      // Single key shortcuts (sans modifier)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toUpperCase()
        const newBuffer = [...keyBuffer, key].slice(-2)
        setKeyBuffer(newBuffer)

        // Check for 2-key combos
        const combo = newBuffer.join(' ')
        
        // Navigation shortcuts (G + key)
        const navShortcuts: Record<string, string> = {
          'G D': '/app/dashboard',
          'G P': '/app/projets',
          'G E': '/app/devis',
          'G C': '/app/clients',
          'G F': '/app/factures',
          'G O': '/app/poudres',
          'G L': '/app/planning',
          'G S': '/app/stats',
          'G ,': '/app/parametres',
        }

        if (navShortcuts[combo]) {
          e.preventDefault()
          router.push(navShortcuts[combo])
          setKeyBuffer([])
          return
        }

        // Create shortcuts (N + key)
        const createShortcuts: Record<string, string> = {
          'N P': '/app/projets/new',
          'N D': '/app/devis/new',
          'N C': '/app/clients/new',
          'N F': '/app/factures/new',
          'N O': '/app/poudres/new',
        }

        if (createShortcuts[combo]) {
          e.preventDefault()
          router.push(createShortcuts[combo])
          setKeyBuffer([])
          return
        }

        // Single key shortcuts
        if (key === '?' && newBuffer.length === 1) {
          // Show help
          onOpenCommandPalette()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, onOpenCommandPalette, keyBuffer])

  return null
}

// Composant d'aide pour les raccourcis
export function ShortcutsHelp() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Navigation (G + touche)</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <ShortcutItem keys={['G', 'D']} label="Dashboard" />
          <ShortcutItem keys={['G', 'P']} label="Projets" />
          <ShortcutItem keys={['G', 'E']} label="Devis" />
          <ShortcutItem keys={['G', 'C']} label="Clients" />
          <ShortcutItem keys={['G', 'F']} label="Factures" />
          <ShortcutItem keys={['G', 'O']} label="Poudres" />
          <ShortcutItem keys={['G', 'L']} label="Planning" />
          <ShortcutItem keys={['G', 'S']} label="Stats" />
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Création (N + touche)</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <ShortcutItem keys={['N', 'P']} label="Nouveau projet" />
          <ShortcutItem keys={['N', 'D']} label="Nouveau devis" />
          <ShortcutItem keys={['N', 'C']} label="Nouveau client" />
          <ShortcutItem keys={['N', 'F']} label="Nouvelle facture" />
          <ShortcutItem keys={['N', 'O']} label="Nouvelle poudre" />
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Global</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <ShortcutItem keys={['⌘', 'K']} label="Palette de commandes" />
          <ShortcutItem keys={['?']} label="Aide" />
          <ShortcutItem keys={['Esc']} label="Fermer" />
        </div>
      </div>
    </div>
  )
}

function ShortcutItem({ keys, label }: { keys: string[], label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd 
            key={i} 
            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}
