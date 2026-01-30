'use client'

import { useState } from 'react'
import { History, ChevronDown, ChevronUp, Copy, ArrowRight, Check, Clock, FileText } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface DevisVersion {
  id: string
  devis_id: string
  version_number: number
  items: any[]
  total_ht: number
  total_ttc: number
  notes?: string
  motif_modification?: string
  created_by?: string
  created_at: string
  user?: {
    full_name: string
  }
}

interface DevisVersionsProps {
  devisId: string
  currentVersion: number
  versions: DevisVersion[]
  currentItems: any[]
  currentTotalHt: number
  currentTotalTtc: number
  onRestore: (version: DevisVersion) => void
}

export default function DevisVersions({ 
  devisId, 
  currentVersion, 
  versions, 
  currentItems,
  currentTotalHt,
  currentTotalTtc,
  onRestore 
}: DevisVersionsProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<DevisVersion | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDiff = (oldTotal: number, newTotal: number) => {
    const diff = newTotal - oldTotal
    const pct = oldTotal > 0 ? ((diff / oldTotal) * 100).toFixed(1) : '0'
    return { diff, pct, isPositive: diff >= 0 }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-gray-500" />
          <div className="text-left">
            <p className="font-medium">Historique des versions</p>
            <p className="text-sm text-gray-500">
              Version actuelle : v{currentVersion} • {versions.length} version(s)
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Liste des versions */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Version actuelle */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  v{currentVersion}
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Version actuelle
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Active</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Total : {currentTotalTtc.toFixed(2)} € TTC
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Versions précédentes */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedVersions.map((version) => {
              const diff = calculateDiff(version.total_ttc, currentTotalTtc)
              
              return (
                <div
                  key={version.id}
                  className={`p-4 ${selectedVersion?.id === version.id ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-sm font-bold">
                        v{version.version_number}
                      </div>
                      <div>
                        <p className="font-medium">
                          Version {version.version_number}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(version.created_at)}
                          {version.user && (
                            <>
                              <span>•</span>
                              <span>{version.user.full_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">{version.total_ttc.toFixed(2)} €</p>
                        <p className={`text-xs ${diff.isPositive ? 'text-red-500' : 'text-green-500'}`}>
                          {diff.isPositive ? '+' : ''}{diff.diff.toFixed(2)} € ({diff.pct}%)
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedVersion(selectedVersion?.id === version.id ? null : version)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Voir les détails"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Restaurer cette version ? Les modifications actuelles seront perdues.')) {
                              onRestore(version)
                            }
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Restaurer cette version"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Motif de modification */}
                  {version.motif_modification && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-3 py-2">
                      {version.motif_modification}
                    </p>
                  )}

                  {/* Détails si sélectionné */}
                  {selectedVersion?.id === version.id && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <h4 className="font-medium mb-3">Détail des lignes</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-2">Désignation</th>
                            <th className="pb-2 text-right">Qté</th>
                            <th className="pb-2 text-right">P.U.</th>
                            <th className="pb-2 text-right">Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {version.items.map((item: any, idx: number) => (
                            <tr key={idx} className="border-t border-gray-200 dark:border-gray-600">
                              <td className="py-2">{item.designation}</td>
                              <td className="py-2 text-right">{item.quantite}</td>
                              <td className="py-2 text-right">{item.prix_unitaire?.toFixed(2)} €</td>
                              <td className="py-2 text-right">{item.total_ht?.toFixed(2)} €</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-300 dark:border-gray-500 font-medium">
                            <td colSpan={3} className="py-2">Total HT</td>
                            <td className="py-2 text-right">{version.total_ht.toFixed(2)} €</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {versions.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune version précédente</p>
              <p className="text-sm">L'historique sera créé lors de la prochaine modification</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
