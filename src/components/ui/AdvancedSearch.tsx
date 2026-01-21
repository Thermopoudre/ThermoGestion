'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface SearchFilter {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'daterange'
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface AdvancedSearchProps {
  filters: SearchFilter[]
  baseUrl: string
  onSearch?: (params: Record<string, string>) => void
}

export function AdvancedSearch({ filters, baseUrl, onSearch }: AdvancedSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    filters.forEach(f => {
      initial[f.key] = searchParams.get(f.key) || ''
    })
    return initial
  })

  const activeFiltersCount = Object.values(values).filter(v => v).length

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    const params = new URLSearchParams()
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    
    const queryString = params.toString()
    router.push(`${baseUrl}${queryString ? '?' + queryString : ''}`)
    
    onSearch?.(values)
  }

  const handleReset = () => {
    const reset: Record<string, string> = {}
    filters.forEach(f => reset[f.key] = '')
    setValues(reset)
    router.push(baseUrl)
    onSearch?.({})
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
      {/* Barre de recherche principale */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={values[filters[0]?.key] || ''}
            onChange={(e) => handleChange(filters[0]?.key || 'q', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={filters[0]?.placeholder || 'Rechercher...'}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-4 py-3 rounded-lg border transition-colors flex items-center gap-2 ${
            isExpanded || activeFiltersCount > 0
              ? 'bg-orange-50 border-orange-300 text-orange-700'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>⚙️</span>
          Filtres
          {activeFiltersCount > 0 && (
            <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <button
          onClick={handleSearch}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all"
        >
          Rechercher
        </button>
      </div>

      {/* Filtres avancés */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filters.slice(1).map(filter => (
              <div key={filter.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {filter.label}
                </label>
                
                {filter.type === 'select' ? (
                  <select
                    value={values[filter.key] || ''}
                    onChange={(e) => handleChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Tous</option>
                    {filter.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : filter.type === 'date' ? (
                  <input
                    type="date"
                    value={values[filter.key] || ''}
                    onChange={(e) => handleChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                ) : filter.type === 'daterange' ? (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={values[`${filter.key}_from`] || ''}
                      onChange={(e) => handleChange(`${filter.key}_from`, e.target.value)}
                      className="flex-1 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                      placeholder="Du"
                    />
                    <input
                      type="date"
                      value={values[`${filter.key}_to`] || ''}
                      onChange={(e) => handleChange(`${filter.key}_to`, e.target.value)}
                      className="flex-1 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                      placeholder="Au"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={values[filter.key] || ''}
                    onChange={(e) => handleChange(filter.key, e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={filter.placeholder}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      )}

      {/* Filtres actifs */}
      {activeFiltersCount > 0 && !isExpanded && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(values).map(([key, value]) => {
            if (!value) return null
            const filter = filters.find(f => f.key === key)
            return (
              <span 
                key={key}
                className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
              >
                {filter?.label}: {value}
                <button
                  onClick={() => handleChange(key, '')}
                  className="hover:text-orange-900"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Filtres prédéfinis pour les projets
export const PROJET_FILTERS: SearchFilter[] = [
  { key: 'q', label: 'Recherche', type: 'text', placeholder: 'Rechercher un projet, client, numéro...' },
  { 
    key: 'status', 
    label: 'Statut', 
    type: 'select',
    options: [
      { value: 'en_attente', label: 'En attente' },
      { value: 'en_preparation', label: 'En préparation' },
      { value: 'en_traitement', label: 'En traitement' },
      { value: 'sechage', label: 'Séchage' },
      { value: 'controle_qualite', label: 'Contrôle qualité' },
      { value: 'pret', label: 'Prêt' },
      { value: 'livre', label: 'Livré' },
    ]
  },
  { key: 'ral', label: 'Couleur RAL', type: 'text', placeholder: 'ex: 7016' },
  { key: 'client', label: 'Client', type: 'text', placeholder: 'Nom du client' },
  { key: 'date', label: 'Période', type: 'daterange' },
]

// Filtres prédéfinis pour les devis
export const DEVIS_FILTERS: SearchFilter[] = [
  { key: 'q', label: 'Recherche', type: 'text', placeholder: 'Rechercher un devis, client...' },
  { 
    key: 'status', 
    label: 'Statut', 
    type: 'select',
    options: [
      { value: 'brouillon', label: 'Brouillon' },
      { value: 'envoye', label: 'Envoyé' },
      { value: 'accepte', label: 'Accepté' },
      { value: 'refuse', label: 'Refusé' },
    ]
  },
  { key: 'client', label: 'Client', type: 'text', placeholder: 'Nom du client' },
  { key: 'date', label: 'Période', type: 'daterange' },
]

// Filtres prédéfinis pour les factures
export const FACTURE_FILTERS: SearchFilter[] = [
  { key: 'q', label: 'Recherche', type: 'text', placeholder: 'Rechercher une facture...' },
  { 
    key: 'status', 
    label: 'Statut', 
    type: 'select',
    options: [
      { value: 'brouillon', label: 'Brouillon' },
      { value: 'envoyee', label: 'Envoyée' },
      { value: 'payee', label: 'Payée' },
      { value: 'annulee', label: 'Annulée' },
    ]
  },
  { key: 'client', label: 'Client', type: 'text', placeholder: 'Nom du client' },
  { key: 'date', label: 'Période', type: 'daterange' },
]
