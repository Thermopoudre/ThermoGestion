'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, AlertTriangle, Camera, MessageSquare, Save } from 'lucide-react'

interface QualityCheckItem {
  id: string
  label: string
  description: string
  category: 'aspect' | 'adherence' | 'epaisseur' | 'couleur' | 'finition'
  checked: boolean
  comment: string
  result: 'ok' | 'nc' | 'na' | null  // ok, non-conforme, non-applicable
}

interface QualityChecklistProps {
  projetId: string
  atelierId: string
  existingCheck?: {
    id: string
    items: QualityCheckItem[]
    global_result: string
    notes: string
    checked_by: string
    checked_at: string
  } | null
  onComplete?: () => void
}

const DEFAULT_ITEMS: Omit<QualityCheckItem, 'checked' | 'comment' | 'result'>[] = [
  // Aspect
  { id: 'aspect_uniformite', label: 'Uniformité de la couche', description: 'La couche de poudre est uniforme sur toute la surface', category: 'aspect' },
  { id: 'aspect_defauts', label: 'Absence de défauts visuels', description: 'Pas de coulures, cloques, craquelures, trous d\'épingle', category: 'aspect' },
  { id: 'aspect_peau_orange', label: 'Pas de peau d\'orange excessive', description: 'Texture conforme aux attentes du client', category: 'aspect' },
  { id: 'aspect_inclusions', label: 'Pas d\'inclusions', description: 'Aucune particule étrangère dans le revêtement', category: 'aspect' },
  
  // Adhérence
  { id: 'adherence_test', label: 'Test d\'adhérence quadrillage', description: 'Le revêtement adhère correctement (test ISO 2409)', category: 'adherence' },
  { id: 'adherence_impact', label: 'Résistance à l\'impact', description: 'Pas d\'écaillage lors d\'un choc léger', category: 'adherence' },
  
  // Épaisseur
  { id: 'epaisseur_mesure', label: 'Épaisseur dans la fourchette', description: 'Mesure au peigne ou jauge entre 60-120μm (ou spec client)', category: 'epaisseur' },
  { id: 'epaisseur_reguliere', label: 'Épaisseur régulière', description: 'Écart < 20μm sur toute la pièce', category: 'epaisseur' },
  
  // Couleur
  { id: 'couleur_ral', label: 'Conformité couleur RAL', description: 'La couleur correspond à la référence RAL demandée', category: 'couleur' },
  { id: 'couleur_brillance', label: 'Brillance conforme', description: 'Niveau de brillance conforme (mat, satiné, brillant)', category: 'couleur' },
  
  // Finition
  { id: 'finition_bords', label: 'Finition des bords', description: 'Les bords et arêtes sont correctement couverts', category: 'finition' },
  { id: 'finition_points_accroche', label: 'Points d\'accroche masqués', description: 'Les marques de suspension sont minimales ou retouchées', category: 'finition' },
  { id: 'finition_nettoyage', label: 'Pièce propre', description: 'La pièce est propre, sans poussière ou résidu', category: 'finition' },
]

const CATEGORY_LABELS: Record<string, string> = {
  aspect: 'Aspect visuel',
  adherence: 'Adhérence',
  epaisseur: 'Épaisseur',
  couleur: 'Couleur',
  finition: 'Finition',
}

export function QualityChecklist({ projetId, atelierId, existingCheck, onComplete }: QualityChecklistProps) {
  const supabase = createBrowserClient()

  const [items, setItems] = useState<QualityCheckItem[]>(
    existingCheck?.items || DEFAULT_ITEMS.map(item => ({
      ...item,
      checked: false,
      comment: '',
      result: null,
    }))
  )
  const [globalNotes, setGlobalNotes] = useState(existingCheck?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateItem = (id: string, updates: Partial<QualityCheckItem>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const toggleResult = (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return

    const cycle: ('ok' | 'nc' | 'na' | null)[] = [null, 'ok', 'nc', 'na']
    const currentIdx = cycle.indexOf(item.result)
    const nextResult = cycle[(currentIdx + 1) % cycle.length]

    updateItem(id, { result: nextResult, checked: nextResult !== null })
  }

  // Calculer le résultat global
  const checkedItems = items.filter(i => i.result !== null && i.result !== 'na')
  const okItems = items.filter(i => i.result === 'ok')
  const ncItems = items.filter(i => i.result === 'nc')
  const naItems = items.filter(i => i.result === 'na')
  const uncheckedItems = items.filter(i => i.result === null)
  const allChecked = uncheckedItems.length === 0
  const globalResult = ncItems.length > 0 ? 'non_conforme' : allChecked ? 'conforme' : 'en_cours'

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const checkData = {
        projet_id: projetId,
        atelier_id: atelierId,
        items,
        global_result: globalResult,
        notes: globalNotes,
        checked_at: new Date().toISOString(),
        nc_count: ncItems.length,
        ok_count: okItems.length,
        na_count: naItems.length,
      }

      if (existingCheck?.id) {
        const { error: updateError } = await supabase
          .from('quality_checks')
          .update(checkData)
          .eq('id', existingCheck.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('quality_checks')
          .insert(checkData)

        if (insertError) throw insertError
      }

      // Si conforme, mettre à jour le statut du projet
      if (globalResult === 'conforme') {
        await supabase
          .from('projets')
          .update({ status: 'pret', quality_validated_at: new Date().toISOString() })
          .eq('id', projetId)
      }

      setSuccess(true)
      onComplete?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const getResultIcon = (result: QualityCheckItem['result']) => {
    switch (result) {
      case 'ok':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />
      case 'nc':
        return <AlertTriangle className="w-6 h-6 text-red-500" />
      case 'na':
        return <span className="w-6 h-6 flex items-center justify-center text-gray-400 text-xs font-bold">N/A</span>
      default:
        return <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
    }
  }

  const getResultLabel = (result: QualityCheckItem['result']) => {
    switch (result) {
      case 'ok': return 'Conforme'
      case 'nc': return 'Non conforme'
      case 'na': return 'Non applicable'
      default: return 'Non vérifié'
    }
  }

  // Grouper par catégorie
  const categories = Object.entries(CATEGORY_LABELS)

  return (
    <div className="space-y-6">
      {/* En-tête résumé */}
      <div className={`rounded-xl p-4 border ${
        globalResult === 'conforme'
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : globalResult === 'non_conforme'
          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              Contrôle Qualité
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {checkedItems.length + naItems.length}/{items.length} points vérifiés
              {ncItems.length > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {' '}&bull; {ncItems.length} non-conformité{ncItems.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            globalResult === 'conforme'
              ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
              : globalResult === 'non_conforme'
              ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
              : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
          }`}>
            {globalResult === 'conforme' ? 'Conforme' : globalResult === 'non_conforme' ? 'Non conforme' : 'En cours'}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div className="bg-green-500 transition-all" style={{ width: `${(okItems.length / items.length) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(ncItems.length / items.length) * 100}%` }} />
            <div className="bg-gray-400 transition-all" style={{ width: `${(naItems.length / items.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Checklist par catégorie */}
      {categories.map(([categoryKey, categoryLabel]) => {
        const categoryItems = items.filter(i => i.category === categoryKey)
        if (categoryItems.length === 0) return null

        return (
          <div key={categoryKey} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
                {categoryLabel}
              </h4>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {categoryItems.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleResult(item.id)}
                      className="mt-0.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-full"
                      aria-label={`${item.label}: ${getResultLabel(item.result)}`}
                    >
                      {getResultIcon(item.result)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${
                          item.result === 'ok' ? 'text-green-700 dark:text-green-400' :
                          item.result === 'nc' ? 'text-red-700 dark:text-red-400' :
                          'text-gray-900 dark:text-white'
                        }`}>
                          {item.label}
                        </span>
                        {item.result && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            item.result === 'ok' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            item.result === 'nc' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {getResultLabel(item.result)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>

                      {/* Commentaire si non-conforme */}
                      {item.result === 'nc' && (
                        <div className="mt-2">
                          <textarea
                            value={item.comment}
                            onChange={(e) => updateItem(item.id, { comment: e.target.value })}
                            placeholder="Décrivez la non-conformité..."
                            className="w-full text-sm border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Notes globales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <MessageSquare className="w-4 h-4 inline mr-1" />
          Notes globales
        </label>
        <textarea
          value={globalNotes}
          onChange={(e) => setGlobalNotes(e.target.value)}
          placeholder="Notes additionnelles sur le contrôle qualité..."
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      {/* Erreur et succès */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm" role="status">
          Contrôle qualité enregistré avec succès
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Enregistrer le contrôle
            </>
          )}
        </button>
      </div>
    </div>
  )
}
