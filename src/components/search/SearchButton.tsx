'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface SearchResult {
  id: string
  type: 'client' | 'projet' | 'devis' | 'facture' | 'poudre'
  title: string
  subtitle?: string
  link: string
}

const typeLabels: Record<string, string> = {
  client: '👤 Client',
  projet: '🔧 Projet',
  devis: '📝 Devis',
  facture: '📄 Facture',
  poudre: '🎨 Poudre',
}

const typeColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  projet: 'bg-green-100 text-green-700',
  devis: 'bg-purple-100 text-purple-700',
  facture: 'bg-orange-100 text-orange-700',
  poudre: 'bg-pink-100 text-pink-700',
}

export function SearchButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  // Raccourci clavier Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input quand modal s'ouvre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Recherche
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const searchResults: SearchResult[] = []

    try {
      // Recherche clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(5)

      for (const c of clients || []) {
        searchResults.push({
          id: c.id,
          type: 'client',
          title: c.full_name,
          subtitle: c.email,
          link: `/app/clients/${c.id}`,
        })
      }

      // Recherche projets
      const { data: projets } = await supabase
        .from('projets')
        .select('id, numero, name')
        .or(`numero.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(5)

      for (const p of projets || []) {
        searchResults.push({
          id: p.id,
          type: 'projet',
          title: p.numero,
          subtitle: p.name,
          link: `/app/projets/${p.id}`,
        })
      }

      // Recherche devis
      const { data: devis } = await supabase
        .from('devis')
        .select('id, numero')
        .ilike('numero', `%${searchQuery}%`)
        .limit(5)

      for (const d of devis || []) {
        searchResults.push({
          id: d.id,
          type: 'devis',
          title: d.numero,
          link: `/app/devis/${d.id}`,
        })
      }

      // Recherche factures
      const { data: factures } = await supabase
        .from('factures')
        .select('id, numero')
        .ilike('numero', `%${searchQuery}%`)
        .limit(5)

      for (const f of factures || []) {
        searchResults.push({
          id: f.id,
          type: 'facture',
          title: f.numero,
          link: `/app/factures/${f.id}`,
        })
      }

      // Recherche poudres
      const { data: poudres } = await supabase
        .from('poudres')
        .select('id, reference, nom')
        .or(`reference.ilike.%${searchQuery}%,nom.ilike.%${searchQuery}%`)
        .limit(5)

      for (const p of poudres || []) {
        searchResults.push({
          id: p.id,
          type: 'poudre',
          title: p.reference,
          subtitle: p.nom || undefined,
          link: `/app/poudres/${p.id}`,
        })
      }

      setResults(searchResults)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Erreur recherche:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Debounce de recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, search])

  // Navigation clavier dans les résultats
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      router.push(results[selectedIndex].link)
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <>
      {/* Bouton de recherche */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Rechercher</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-200 rounded">⌘K</kbd>
      </button>

      {/* Modal de recherche */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-screen px-4 text-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="inline-block w-full max-w-xl my-16 text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl relative">
              {/* Input de recherche */}
              <div className="flex items-center px-4 border-b border-gray-200">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher clients, projets, devis..."
                  className="w-full px-4 py-4 text-lg focus:outline-none"
                />
                {loading && (
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                )}
              </div>

              {/* Résultats */}
              <div className="max-h-96 overflow-y-auto p-2">
                {results.length === 0 && query && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    Aucun résultat pour "{query}"
                  </div>
                )}

                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => {
                      router.push(result.link)
                      setIsOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[result.type]}`}>
                      {typeLabels[result.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                ))}

                {!query && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="mb-2">🔍 Recherche rapide</p>
                    <p className="text-sm">Tapez pour rechercher clients, projets, devis, factures...</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↑↓</kbd> naviguer</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↵</kbd> ouvrir</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">esc</kbd> fermer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
