'use client'

import { useState } from 'react'

const FORMATS = [
  { key: 'sage', label: 'Sage', icon: '📊', description: 'Format texte Sage 100' },
  { key: 'ebp', label: 'EBP', icon: '📈', description: 'Format CSV EBP Compta' },
  { key: 'cegid', label: 'Cegid', icon: '🏢', description: 'Format Cegid Quadra' },
  { key: 'quadra', label: 'Quadra', icon: '📑', description: 'Format Quadra Compta' },
  { key: 'fec', label: 'FEC', icon: '🏛️', description: 'Fichier des Écritures Comptables' },
]

export function ExportComptable() {
  const [format, setFormat] = useState('sage')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (status) params.set('status', status)

      const endpoint = format === 'fec' 
        ? '/api/factures/export/fec' 
        : '/api/factures/export/comptable'

      const response = await fetch(`${endpoint}?${params.toString()}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de l\'export')
      }

      // Télécharger le fichier
      const blob = await response.blob()
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') 
        || `export_${format}_${new Date().toISOString().split('T')[0]}.txt`
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  // Raccourcis de période
  const setThisMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateFrom(firstDay.toISOString().split('T')[0])
    setDateTo(lastDay.toISOString().split('T')[0])
  }

  const setLastMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    setDateFrom(firstDay.toISOString().split('T')[0])
    setDateTo(lastDay.toISOString().split('T')[0])
  }

  const setThisYear = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), 0, 1)
    setDateFrom(firstDay.toISOString().split('T')[0])
    setDateTo(now.toISOString().split('T')[0])
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        📥 Export Comptable
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Sélection du format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Format d'export
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  format === f.key
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-2">{f.icon}</span>
                <p className="font-bold text-sm">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Période */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Période
          </label>
          
          {/* Raccourcis */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={setThisMonth}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Ce mois
            </button>
            <button
              onClick={setLastMonth}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Mois dernier
            </button>
            <button
              onClick={setThisYear}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cette année
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Statut */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Factures à inclure
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="all"
                checked={status === 'all'}
                onChange={() => setStatus('all')}
                className="text-orange-500 focus:ring-orange-500"
              />
              <span>Toutes les factures</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="payee"
                checked={status === 'payee'}
                onChange={() => setStatus('payee')}
                className="text-orange-500 focus:ring-orange-500"
              />
              <span>Factures payées uniquement</span>
            </label>
          </div>
        </div>

        {/* Bouton export */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Génération en cours...
            </>
          ) : (
            <>
              <span>📥</span>
              Télécharger l'export {FORMATS.find(f => f.key === format)?.label}
            </>
          )}
        </button>

        {/* Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 Les comptes comptables utilisés sont configurables dans les paramètres.
          <br />
          411000 (Clients), 706000 (Prestations), 445710 (TVA collectée)
        </p>
      </div>
    </div>
  )
}
