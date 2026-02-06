'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Search, Command, ArrowRight, Plus, User, FileText, Package,
  Palette, Calculator, BarChart2, Settings, Home, Calendar,
  Clock, X, Keyboard, Zap, Users, Receipt, Columns,
  Layers, Camera, MessageSquare, Pen, Gift, Activity, Monitor
} from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  type: 'action' | 'navigation' | 'search-result'
  category: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

const navigationCommands: Omit<CommandItem, 'action'>[] = [
  { id: 'nav-dashboard', type: 'navigation', category: 'Navigation', title: 'Dashboard', icon: <Home className="w-4 h-4" />, shortcut: 'G D' },
  { id: 'nav-projets', type: 'navigation', category: 'Navigation', title: 'Projets', icon: <Package className="w-4 h-4" />, shortcut: 'G P' },
  { id: 'nav-devis', type: 'navigation', category: 'Navigation', title: 'Devis', icon: <FileText className="w-4 h-4" />, shortcut: 'G E' },
  { id: 'nav-clients', type: 'navigation', category: 'Navigation', title: 'Clients', icon: <Users className="w-4 h-4" />, shortcut: 'G C' },
  { id: 'nav-factures', type: 'navigation', category: 'Navigation', title: 'Factures', icon: <Receipt className="w-4 h-4" />, shortcut: 'G F' },
  { id: 'nav-poudres', type: 'navigation', category: 'Navigation', title: 'Poudres', icon: <Palette className="w-4 h-4" />, shortcut: 'G O' },
  { id: 'nav-planning', type: 'navigation', category: 'Navigation', title: 'Planning', icon: <Calendar className="w-4 h-4" />, shortcut: 'G L' },
  { id: 'nav-stats', type: 'navigation', category: 'Navigation', title: 'Statistiques', icon: <BarChart2 className="w-4 h-4" />, shortcut: 'G S' },
  { id: 'nav-kanban', type: 'navigation', category: 'Production', title: 'Vue Kanban', icon: <Columns className="w-4 h-4" />, shortcut: 'G K' },
  { id: 'nav-batching', type: 'navigation', category: 'Production', title: 'Batching couleurs', icon: <Layers className="w-4 h-4" /> },
  { id: 'nav-atelier', type: 'navigation', category: 'Production', title: 'Mode Atelier', icon: <Monitor className="w-4 h-4" /> },
  { id: 'nav-series', type: 'navigation', category: 'Production', title: 'Séries', icon: <Package className="w-4 h-4" /> },
  { id: 'nav-retouches', type: 'navigation', category: 'Production', title: 'Retouches', icon: <Activity className="w-4 h-4" /> },
  { id: 'nav-ral', type: 'navigation', category: 'Outils', title: 'Nuancier RAL', icon: <Palette className="w-4 h-4" /> },
  { id: 'nav-photos', type: 'navigation', category: 'Outils', title: 'Photos', icon: <Camera className="w-4 h-4" /> },
  { id: 'nav-signature', type: 'navigation', category: 'Outils', title: 'Signatures', icon: <Pen className="w-4 h-4" /> },
  { id: 'nav-chat', type: 'navigation', category: 'Communication', title: 'Messages', icon: <MessageSquare className="w-4 h-4" />, shortcut: 'G M' },
  { id: 'nav-fidelite', type: 'navigation', category: 'Communication', title: 'Programme fidélité', icon: <Gift className="w-4 h-4" /> },
  { id: 'nav-equipe', type: 'navigation', category: 'Réglages', title: 'Équipe', icon: <Users className="w-4 h-4" /> },
  { id: 'nav-activite', type: 'navigation', category: 'Réglages', title: 'Activité', icon: <Activity className="w-4 h-4" /> },
  { id: 'nav-parametres', type: 'navigation', category: 'Réglages', title: 'Paramètres', icon: <Settings className="w-4 h-4" />, shortcut: 'G ,' },
]

const actionCommands: Omit<CommandItem, 'action'>[] = [
  { id: 'new-projet', type: 'action', category: 'Créer', title: 'Nouveau projet', icon: <Plus className="w-4 h-4" />, shortcut: 'N P' },
  { id: 'new-devis', type: 'action', category: 'Créer', title: 'Nouveau devis', icon: <Plus className="w-4 h-4" />, shortcut: 'N D' },
  { id: 'new-client', type: 'action', category: 'Créer', title: 'Nouveau client', icon: <Plus className="w-4 h-4" />, shortcut: 'N C' },
  { id: 'new-facture', type: 'action', category: 'Créer', title: 'Nouvelle facture', icon: <Plus className="w-4 h-4" />, shortcut: 'N F' },
  { id: 'new-poudre', type: 'action', category: 'Créer', title: 'Nouvelle poudre', icon: <Plus className="w-4 h-4" />, shortcut: 'N O' },
  { id: 'calculator', type: 'action', category: 'Outils', title: 'Calculateur de prix', icon: <Calculator className="w-4 h-4" /> },
]

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<CommandItem[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Routes mapping
  const routes: Record<string, string> = {
    'nav-dashboard': '/app/dashboard',
    'nav-projets': '/app/projets',
    'nav-devis': '/app/devis',
    'nav-clients': '/app/clients',
    'nav-factures': '/app/factures',
    'nav-poudres': '/app/poudres',
    'nav-planning': '/app/planning',
    'nav-stats': '/app/stats',
    'nav-kanban': '/app/kanban',
    'nav-batching': '/app/batching',
    'nav-atelier': '/app/atelier',
    'nav-series': '/app/series',
    'nav-retouches': '/app/retouches',
    'nav-ral': '/app/ral',
    'nav-photos': '/app/photos',
    'nav-signature': '/app/signature',
    'nav-chat': '/app/chat',
    'nav-fidelite': '/app/fidelite',
    'nav-equipe': '/app/equipe',
    'nav-activite': '/app/activite',
    'nav-parametres': '/app/parametres',
    'new-projet': '/app/projets/new',
    'new-devis': '/app/devis/new',
    'new-client': '/app/clients/new',
    'new-facture': '/app/factures/new',
    'new-poudre': '/app/poudres/new',
    'calculator': '/app/calculateur',
  }

  // Build commands with actions
  const staticCommands = useMemo<CommandItem[]>(() => {
    const allCommands = [...actionCommands, ...navigationCommands]
    return allCommands.map(cmd => ({
      ...cmd,
      action: () => {
        if (routes[cmd.id]) {
          router.push(routes[cmd.id])
        }
        onClose()
      }
    }))
  }, [router, onClose])

  // Search database
  const searchDatabase = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const results: CommandItem[] = []

    try {
      // Search clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(3)

      clients?.forEach(client => {
        results.push({
          id: `client-${client.id}`,
          type: 'search-result',
          category: 'Clients',
          title: client.full_name,
          subtitle: client.email,
          icon: <User className="w-4 h-4" />,
          action: () => {
            router.push(`/app/clients/${client.id}`)
            onClose()
          }
        })
      })

      // Search projets
      const { data: projets } = await supabase
        .from('projets')
        .select('id, numero, name')
        .or(`numero.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(3)

      projets?.forEach(projet => {
        results.push({
          id: `projet-${projet.id}`,
          type: 'search-result',
          category: 'Projets',
          title: projet.numero,
          subtitle: projet.name,
          icon: <Package className="w-4 h-4" />,
          action: () => {
            router.push(`/app/projets/${projet.id}`)
            onClose()
          }
        })
      })

      // Search devis
      const { data: devis } = await supabase
        .from('devis')
        .select('id, numero')
        .ilike('numero', `%${searchQuery}%`)
        .limit(3)

      devis?.forEach(d => {
        results.push({
          id: `devis-${d.id}`,
          type: 'search-result',
          category: 'Devis',
          title: d.numero,
          icon: <FileText className="w-4 h-4" />,
          action: () => {
            router.push(`/app/devis/${d.id}`)
            onClose()
          }
        })
      })

      // Search poudres
      const { data: poudres } = await supabase
        .from('poudres')
        .select('id, reference, ral')
        .or(`reference.ilike.%${searchQuery}%,ral.ilike.%${searchQuery}%`)
        .limit(3)

      poudres?.forEach(p => {
        results.push({
          id: `poudre-${p.id}`,
          type: 'search-result',
          category: 'Poudres',
          title: p.reference,
          subtitle: p.ral ? `RAL ${p.ral}` : undefined,
          icon: <Palette className="w-4 h-4" />,
          action: () => {
            router.push(`/app/poudres/${p.id}`)
            onClose()
          }
        })
      })
    } catch (error) {
      console.error('Search error:', error)
    }

    setSearchResults(results)
    setIsSearching(false)
  }, [supabase, router, onClose])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchDatabase(query)
      } else {
        setSearchResults([])
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query, searchDatabase])

  // Filter static commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return staticCommands
    const lowerQuery = query.toLowerCase()
    return staticCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    )
  }, [query, staticCommands])

  // All visible items
  const allItems = useMemo(() => {
    return [...searchResults, ...filteredCommands]
  }, [searchResults, filteredCommands])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    allItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    })
    return groups
  }, [allItems])

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allItems])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % allItems.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + allItems.length) % allItems.length)
        break
      case 'Enter':
        e.preventDefault()
        if (allItems[selectedIndex]) {
          allItems[selectedIndex].action()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [allItems, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="flex items-start justify-center pt-[15vh]">
        <div
          className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher ou taper une commande..."
              className="flex-1 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
              <Command className="w-3 h-3" />K
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-gray-500">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : allItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun résultat trouvé</p>
                <p className="text-sm mt-1">Essayez une autre recherche</p>
              </div>
            ) : (
              Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    {category}
                  </div>
                  {items.map((item, index) => {
                    const globalIndex = allItems.indexOf(item)
                    const isSelected = globalIndex === selectedIndex

                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-orange-50 dark:bg-orange-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isSelected 
                            ? 'bg-orange-100 dark:bg-orange-800 text-orange-600' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${isSelected ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-sm text-gray-500 truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.shortcut && (
                          <kbd className="hidden sm:block px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                            {item.shortcut}
                          </kbd>
                        )}
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-orange-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd>
                naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
                sélectionner
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">esc</kbd>
                fermer
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              <span>Raccourcis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
