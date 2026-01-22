'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Camera, Save, ClipboardCheck, Ruler, Droplets, Eye, Palette, Sparkles } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ControleQualite {
  id?: string
  projet_id: string
  etape: 'preparation' | 'poudrage' | 'cuisson' | 'final'
  epaisseur_ok?: boolean
  epaisseur_mesure?: number
  adherence_ok?: boolean
  aspect_visuel_ok?: boolean
  teinte_conforme?: boolean
  brillance_ok?: boolean
  resultat: 'en_attente' | 'conforme' | 'non_conforme' | 'a_retoucher'
  commentaires?: string
  photos?: string[]
}

interface QualityChecklistProps {
  projetId: string
  projetNumero: string
  atelierId: string
  userId: string
  existingControles?: ControleQualite[]
  onSave: () => void
}

const etapes = [
  { id: 'preparation', label: 'Préparation', icon: Droplets },
  { id: 'poudrage', label: 'Poudrage', icon: Sparkles },
  { id: 'cuisson', label: 'Cuisson', icon: Ruler },
  { id: 'final', label: 'Contrôle final', icon: ClipboardCheck }
] as const

export default function QualityChecklist({ projetId, projetNumero, atelierId, userId, existingControles = [], onSave }: QualityChecklistProps) {
  const supabase = createClientComponentClient()
  const [activeEtape, setActiveEtape] = useState<typeof etapes[number]['id']>('preparation')
  const [loading, setSaving] = useState(false)
  
  const getExistingControle = (etape: string) => {
    return existingControles.find(c => c.etape === etape)
  }

  const [form, setForm] = useState<Record<string, Partial<ControleQualite>>>(() => {
    const initial: Record<string, Partial<ControleQualite>> = {}
    etapes.forEach(e => {
      const existing = getExistingControle(e.id)
      initial[e.id] = existing || {
        projet_id: projetId,
        etape: e.id,
        epaisseur_ok: undefined,
        epaisseur_mesure: undefined,
        adherence_ok: undefined,
        aspect_visuel_ok: undefined,
        teinte_conforme: undefined,
        brillance_ok: undefined,
        resultat: 'en_attente',
        commentaires: '',
        photos: []
      }
    })
    return initial
  })

  const updateField = (etape: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      [etape]: { ...prev[etape], [field]: value }
    }))
  }

  const calculateResultat = (controle: Partial<ControleQualite>): ControleQualite['resultat'] => {
    const checks = [
      controle.epaisseur_ok,
      controle.adherence_ok,
      controle.aspect_visuel_ok,
      controle.teinte_conforme,
      controle.brillance_ok
    ].filter(c => c !== undefined)
    
    if (checks.length === 0) return 'en_attente'
    if (checks.every(c => c === true)) return 'conforme'
    if (checks.some(c => c === false)) return 'non_conforme'
    return 'a_retoucher'
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const controle = form[activeEtape]
      const resultat = calculateResultat(controle)
      
      const data = {
        atelier_id: atelierId,
        projet_id: projetId,
        controleur_id: userId,
        etape: activeEtape,
        ...controle,
        resultat,
        date_controle: new Date().toISOString()
      }

      const existing = getExistingControle(activeEtape)
      if (existing?.id) {
        await supabase
          .from('controles_qualite')
          .update(data)
          .eq('id', existing.id)
      } else {
        await supabase
          .from('controles_qualite')
          .insert(data)
      }

      // Mettre à jour le résultat local
      setForm(prev => ({
        ...prev,
        [activeEtape]: { ...prev[activeEtape], resultat }
      }))

      onSave()
    } catch (error) {
      console.error('Error saving controle:', error)
    }
    setSaving(false)
  }

  const currentForm = form[activeEtape]

  const CheckButton = ({ 
    checked, 
    onChange, 
    label 
  }: { 
    checked: boolean | undefined
    onChange: (value: boolean) => void
    label: string 
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`p-2 rounded-lg transition-colors ${
            checked === true 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-green-100'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`p-2 rounded-lg transition-colors ${
            checked === false 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-red-100'
          }`}
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  )

  const resultatColors = {
    en_attente: 'bg-gray-100 text-gray-700',
    conforme: 'bg-green-100 text-green-700',
    non_conforme: 'bg-red-100 text-red-700',
    a_retoucher: 'bg-amber-100 text-amber-700'
  }

  const resultatLabels = {
    en_attente: 'En attente',
    conforme: 'Conforme',
    non_conforme: 'Non conforme',
    a_retoucher: 'À retoucher'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Contrôle Qualité
            </h3>
            <p className="text-sm text-gray-500">Projet {projetNumero}</p>
          </div>
        </div>
      </div>

      {/* Tabs des étapes */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {etapes.map((etape) => {
          const Icon = etape.icon
          const controle = form[etape.id]
          const resultat = controle?.resultat || 'en_attente'
          
          return (
            <button
              key={etape.id}
              onClick={() => setActiveEtape(etape.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors relative ${
                activeEtape === etape.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{etape.label}</span>
              
              {/* Indicateur de résultat */}
              {resultat !== 'en_attente' && (
                <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${
                  resultat === 'conforme' ? 'bg-green-500' :
                  resultat === 'non_conforme' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Formulaire de l'étape active */}
      <div className="p-4 space-y-4">
        {/* Résultat actuel */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <span className="text-sm font-medium">Résultat</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${resultatColors[currentForm?.resultat || 'en_attente']}`}>
            {resultatLabels[currentForm?.resultat || 'en_attente']}
          </span>
        </div>

        {/* Checks */}
        <div className="space-y-3">
          <CheckButton
            label="Épaisseur conforme"
            checked={currentForm?.epaisseur_ok}
            onChange={(value) => updateField(activeEtape, 'epaisseur_ok', value)}
          />
          
          {currentForm?.epaisseur_ok !== undefined && (
            <div className="ml-4">
              <label className="block text-xs text-gray-500 mb-1">Mesure (µm)</label>
              <input
                type="number"
                value={currentForm?.epaisseur_mesure || ''}
                onChange={(e) => updateField(activeEtape, 'epaisseur_mesure', parseInt(e.target.value))}
                className="w-32 px-3 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="60-80"
              />
            </div>
          )}

          <CheckButton
            label="Adhérence OK"
            checked={currentForm?.adherence_ok}
            onChange={(value) => updateField(activeEtape, 'adherence_ok', value)}
          />

          <CheckButton
            label="Aspect visuel OK"
            checked={currentForm?.aspect_visuel_ok}
            onChange={(value) => updateField(activeEtape, 'aspect_visuel_ok', value)}
          />

          <CheckButton
            label="Teinte conforme"
            checked={currentForm?.teinte_conforme}
            onChange={(value) => updateField(activeEtape, 'teinte_conforme', value)}
          />

          <CheckButton
            label="Brillance OK"
            checked={currentForm?.brillance_ok}
            onChange={(value) => updateField(activeEtape, 'brillance_ok', value)}
          />
        </div>

        {/* Commentaires */}
        <div>
          <label className="block text-sm font-medium mb-1">Commentaires / Observations</label>
          <textarea
            value={currentForm?.commentaires || ''}
            onChange={(e) => updateField(activeEtape, 'commentaires', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            rows={3}
            placeholder="Notes sur le contrôle..."
          />
        </div>

        {/* Bouton photo */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <Camera className="w-5 h-5" />
          Ajouter une photo
        </button>

        {/* Actions */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Enregistrement...' : 'Enregistrer le contrôle'}
        </button>
      </div>

      {/* Résumé global */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
        <h4 className="text-sm font-medium mb-2">Résumé des contrôles</h4>
        <div className="grid grid-cols-4 gap-2">
          {etapes.map((etape) => {
            const controle = form[etape.id]
            const resultat = controle?.resultat || 'en_attente'
            
            return (
              <div
                key={etape.id}
                className={`text-center py-2 rounded-lg text-xs ${resultatColors[resultat]}`}
              >
                {etape.label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
