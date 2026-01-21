'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

type TemplateName = 'classic' | 'modern' | 'industrial' | 'premium'

interface Template {
  id: TemplateName
  name: string
  description: string
  features: string[]
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  bestFor: string
}

const TEMPLATES: Template[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Design professionnel et épuré, parfait pour tous secteurs',
    features: ['En-tête structuré', 'Tableau élégant', 'Zone signature'],
    colors: { primary: '#1e3a5f', secondary: '#6b7280', accent: '#3b82f6' },
    bestFor: 'Polyvalent',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Design contemporain avec touches de couleur vives',
    features: ['Barre d\'accent colorée', 'Mise en page aérée', 'Badges stylisés'],
    colors: { primary: '#0f172a', secondary: '#64748b', accent: '#06b6d4' },
    bestFor: 'Startups & Tech',
  },
  {
    id: 'industrial',
    name: 'Industriel',
    description: 'Conçu spécialement pour les ateliers de thermolaquage',
    features: ['Icône atelier 🔥', 'Style robuste', 'Couleurs chaudes'],
    colors: { primary: '#dc2626', secondary: '#374151', accent: '#f97316' },
    bestFor: 'Thermolaquage',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Design haut de gamme avec finitions élégantes',
    features: ['Bordure dorée', 'Typographie raffinée', 'Filigrane décoratif'],
    colors: { primary: '#1f2937', secondary: '#9ca3af', accent: '#d4af37' },
    bestFor: 'Luxe & Prestige',
  },
]

interface TemplateSelectorProps {
  atelierId: string
  currentTemplate: string
}

export function TemplateSelector({ atelierId, currentTemplate }: TemplateSelectorProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [selected, setSelected] = useState<TemplateName>(currentTemplate as TemplateName)
  const [saving, setSaving] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<TemplateName | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      // Récupérer les settings actuels
      const { data: atelier } = await supabase
        .from('ateliers')
        .select('settings')
        .eq('id', atelierId)
        .single()

      // Mettre à jour avec le nouveau template
      const { error } = await supabase
        .from('ateliers')
        .update({
          settings: {
            ...(atelier?.settings || {}),
            pdf_template: selected,
          },
        })
        .eq('id', atelierId)

      if (error) throw error

      router.refresh()
      alert('Template sauvegardé avec succès !')
    } catch (error) {
      console.error('Erreur sauvegarde template:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Grille des templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TEMPLATES.map((template) => (
          <div
            key={template.id}
            onClick={() => setSelected(template.id)}
            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all transform hover:scale-[1.02] ${
              selected === template.id
                ? 'ring-4 ring-orange-500 ring-offset-2'
                : 'hover:shadow-xl'
            }`}
          >
            {/* Badge sélectionné */}
            {selected === template.id && (
              <div className="absolute top-4 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
                ✓ Sélectionné
              </div>
            )}

            {/* Preview colorée */}
            <div 
              className="h-32 relative"
              style={{ 
                background: `linear-gradient(135deg, ${template.colors.primary} 0%, ${template.colors.accent} 100%)` 
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 text-white">
                  <span className="text-2xl font-bold">{template.name}</span>
                </div>
              </div>
              
              {/* Mini-aperçu */}
              <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                <div className="h-1 flex-1 bg-white/30 rounded"></div>
                <div className="h-1 w-8 bg-white/50 rounded"></div>
              </div>
            </div>

            {/* Infos */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mt-1">
                    {template.bestFor}
                  </span>
                </div>
                
                {/* Couleurs */}
                <div className="flex gap-1">
                  <div 
                    className="w-5 h-5 rounded-full shadow-inner" 
                    style={{ backgroundColor: template.colors.primary }}
                    title="Primaire"
                  ></div>
                  <div 
                    className="w-5 h-5 rounded-full shadow-inner" 
                    style={{ backgroundColor: template.colors.accent }}
                    title="Accent"
                  ></div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {template.description}
              </p>

              {/* Features */}
              <ul className="space-y-1.5">
                {template.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Bouton aperçu */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewTemplate(template.id)
                }}
                className="mt-4 w-full py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                👁️ Prévisualiser
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bouton de sauvegarde */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Template actuel</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {TEMPLATES.find(t => t.id === selected)?.name || 'Non défini'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || selected === currentTemplate}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-8 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
        </button>
      </div>

      {/* Modal de prévisualisation */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                Aperçu - {TEMPLATES.find(t => t.id === previewTemplate)?.name}
              </h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="h-[70vh] overflow-auto">
              <iframe
                src={`/api/templates/preview?template=${previewTemplate}`}
                className="w-full h-full border-0"
                title="Aperçu template"
              />
            </div>
            <div className="flex items-center justify-end gap-4 p-4 border-t bg-gray-50">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-6 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setSelected(previewTemplate)
                  setPreviewTemplate(null)
                }}
                className="px-6 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Choisir ce template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note d'aide */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-2">💡 Conseil</h4>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Le template <strong>Industriel</strong> est particulièrement adapté aux ateliers de thermolaquage 
          avec ses couleurs chaudes et son icône 🔥. Pour un rendu plus sobre, optez pour <strong>Classic</strong>.
          Le template <strong>Premium</strong> est idéal pour les prestations haut de gamme.
        </p>
      </div>
    </div>
  )
}
