'use client'

import { useState } from 'react'
import { Download, FileText, Calculator, Database, CheckCircle2 } from 'lucide-react'

const FORMATS = [
  { id: 'csv', name: 'CSV Simple', description: 'Format tableur universel', icon: FileText },
  { id: 'quickbooks', name: 'QuickBooks IIF', description: 'Import direct QuickBooks', icon: Calculator },
  { id: 'sage', name: 'Sage', description: 'Format Sage Comptabilité', icon: Database },
  { id: 'fec', name: 'FEC', description: 'Fichier des Écritures Comptables (légal)', icon: FileText },
]

export default function ExportComptableForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState('csv')
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState(() => {
    const d = new Date()
    d.setDate(0) // Dernier jour du mois précédent
    return d.toISOString().split('T')[0]
  })

  const handleExport = async () => {
    setLoading(true)
    setSuccess(null)

    try {
      const response = await fetch(`/api/exports/comptable?format=${selectedFormat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_debut: dateDebut,
          date_fin: dateFin,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export')
      }

      // Télécharger le fichier
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `export_${selectedFormat}.txt`
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setSuccess(filename)
    } catch (error) {
      console.error('Erreur export:', error)
    } finally {
      setLoading(false)
    }
  }

  // Raccourcis période
  const setPeriod = (period: 'month' | 'quarter' | 'year') => {
    const now = new Date()
    let start: Date, end: Date

    switch (period) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
        const yearOffset = currentQuarter === 0 ? -1 : 0
        start = new Date(now.getFullYear() + yearOffset, prevQuarter * 3, 1)
        end = new Date(now.getFullYear() + yearOffset, (prevQuarter + 1) * 3, 0)
        break
      case 'year':
        start = new Date(now.getFullYear() - 1, 0, 1)
        end = new Date(now.getFullYear() - 1, 11, 31)
        break
    }

    setDateDebut(start.toISOString().split('T')[0])
    setDateFin(end.toISOString().split('T')[0])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-orange-500" />
          Export Comptable
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        {/* Format selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Format d'export
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FORMATS.map(format => {
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedFormat === format.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${selectedFormat === format.id ? 'text-orange-500' : 'text-gray-400'}`} />
                  <p className="font-medium text-gray-900 dark:text-white">{format.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{format.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Période */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Période
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setPeriod('month')}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Mois précédent
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Trimestre précédent
            </button>
            <button
              onClick={() => setPeriod('year')}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Année précédente
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Au</label>
              <input
                type="date"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Info FEC */}
        {selectedFormat === 'fec' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>FEC (Fichier des Écritures Comptables)</strong> : Format obligatoire pour les contrôles fiscaux en France.
              Le fichier généré respecte les normes de l'article A.47 A-1 du Livre des procédures fiscales.
            </p>
          </div>
        )}

        {/* Bouton export */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Export en cours...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Téléchargé : {success}
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Télécharger l'export
            </>
          )}
        </button>
      </div>
    </div>
  )
}
