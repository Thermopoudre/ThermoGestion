'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

const exportTypes = [
  {
    id: 'clients',
    title: 'Clients',
    description: 'Export de tous vos clients avec leurs coordonnées',
    icon: '👥',
    formats: ['csv', 'xlsx', 'json'],
  },
  {
    id: 'devis',
    title: 'Devis',
    description: 'Export de tous vos devis avec détails',
    icon: '📝',
    formats: ['csv', 'xlsx', 'json'],
  },
  {
    id: 'factures',
    title: 'Factures',
    description: 'Export de toutes vos factures',
    icon: '📄',
    formats: ['csv', 'xlsx', 'json', 'fec'],
  },
  {
    id: 'projets',
    title: 'Projets',
    description: 'Export de tous vos projets',
    icon: '🏭',
    formats: ['csv', 'xlsx', 'json'],
  },
  {
    id: 'poudres',
    title: 'Poudres',
    description: 'Export de votre catalogue de poudres',
    icon: '🎨',
    formats: ['csv', 'xlsx', 'json'],
  },
  {
    id: 'all',
    title: 'Export complet',
    description: 'Toutes vos données (RGPD)',
    icon: '📦',
    formats: ['json', 'zip'],
  },
]

export default function ExportsPage() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<Record<string, string>>({})

  async function handleExport(type: string) {
    setExporting(type)
    
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) return

    const format = selectedFormat[type] || 'csv'
    
    // Simulate export - in real app, this would call an API endpoint
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Create mock download
    const mockData = {
      export_type: type,
      export_date: new Date().toISOString(),
      format: format,
      message: 'Export simulé - en production, cela téléchargerait un vrai fichier',
    }

    const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thermogestion_${type}_${new Date().toISOString().split('T')[0]}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setExporting(null)
  }

  async function handleDeleteAccount() {
    if (!confirm('ATTENTION: Cette action est irréversible.\n\nToutes vos données seront définitivement supprimées.\n\nÊtes-vous sûr de vouloir continuer ?')) {
      return
    }
    
    if (!confirm('Dernière confirmation: Voulez-vous vraiment supprimer toutes vos données et votre compte ?')) {
      return
    }

    alert('Pour des raisons de sécurité, la suppression du compte nécessite une vérification manuelle.\n\nVeuillez contacter le support à contact@thermogestion.fr')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Exports & Données</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Exportez vos données ou demandez une copie complète (RGPD)
          </p>
        </div>

        {/* Date filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Filtrer par période (optionnel)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Export Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {exportTypes.map((type) => (
            <div
              key={type.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
                  {type.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {type.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {type.description}
                  </p>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <select
                      value={selectedFormat[type.id] || type.formats[0]}
                      onChange={(e) => setSelectedFormat({ ...selectedFormat, [type.id]: e.target.value })}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                    >
                      {type.formats.map((format) => (
                        <option key={format} value={format}>
                          {format.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleExport(type.id)}
                    disabled={exporting === type.id}
                    className="w-full px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {exporting === type.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Export en cours...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Exporter
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RGPD Section */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
            🔒 Vos droits RGPD
          </h2>
          <p className="text-blue-700 dark:text-blue-300 text-sm mb-4">
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous avez le droit d'accéder à vos données, de les rectifier, de les supprimer ou de les transférer.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm">
              Demander mes données
            </button>
            <button className="px-4 py-2 bg-white dark:bg-blue-800 text-blue-700 dark:text-blue-200 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-700 transition-colors text-sm border border-blue-300 dark:border-blue-600">
              Politique de confidentialité
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">
            Zone de danger
          </h2>
          <p className="text-red-700 dark:text-red-400 text-sm mb-4">
            La suppression de vos données est irréversible. Assurez-vous d'avoir exporté toutes vos données avant de procéder.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Supprimer toutes mes données
          </button>
        </div>
      </div>
    </div>
  )
}
