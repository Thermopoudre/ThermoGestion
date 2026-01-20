'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { TemplateConfig } from '@/lib/devis-templates'

interface TemplateFormProps {
  atelierId: string
  userId: string
  templateId?: string
  initialData?: any
  isSystem?: boolean
}

export function TemplateForm({ atelierId, userId, templateId, initialData, isSystem = false }: TemplateFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const defaultConfig: TemplateConfig = {
    header: {
      show_logo: true,
      show_atelier_info: true,
      layout: 'left',
      logo_url: ''
    },
    colors: {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#0ea5e9'
    },
    body: {
      show_client_info: true,
      table_style: 'striped',
      column_widths: {}
    },
    footer: {
      show_cgv: true,
      cgv_text: 'Devis valable 30 jours. Conditions générales de vente disponibles sur demande.',
      show_signature: true,
      custom_text: ''
    },
    layout: {
      page_size: 'A4',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      font_family: 'Arial, sans-serif',
      font_size: 12
    }
  }

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    template_type: initialData?.template_type || 'custom',
    config: (initialData?.config as TemplateConfig) || defaultConfig
  })

  const updateConfig = (path: string[], value: any) => {
    setFormData(prev => {
      const newConfig = { ...prev.config }
      let current: any = newConfig
      
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] }
        current = current[path[i]]
      }
      
      current[path[path.length - 1]] = value
      
      return { ...prev, config: newConfig }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.name.trim()) {
      setError('Le nom du template est requis')
      setLoading(false)
      return
    }

    try {
      const templateData = {
        atelier_id: atelierId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        template_type: formData.template_type,
        config: formData.config,
        created_by: templateId ? undefined : userId,
        is_system: false
      }

      if (templateId && !isSystem) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('devis_templates')
          .update(templateData)
          .eq('id', templateId)

        if (updateError) throw updateError
      } else if (!templateId) {
        // Création
        const { error: insertError } = await supabase
          .from('devis_templates')
          .insert(templateData)

        if (insertError) throw insertError
      } else {
        setError('Les templates système ne peuvent pas être modifiés')
        setLoading(false)
        return
      }

      router.push('/app/devis/templates')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  if (isSystem) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            ⚠️ Ce template est un template système et ne peut pas être modifié. Vous pouvez le dupliquer pour créer votre propre version.
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Configuration actuelle</h3>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(formData.config, null, 2)}
            </pre>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/app/devis/templates')}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Informations générales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Informations générales</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nom du template *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Template personnalisé"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Description du template..."
            />
          </div>
        </div>
      </div>

      {/* Couleurs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Couleurs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur primaire</label>
            <input
              type="color"
              value={formData.config.colors.primary}
              onChange={(e) => updateConfig(['colors', 'primary'], e.target.value)}
              className="w-full h-12 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.config.colors.primary}
              onChange={(e) => updateConfig(['colors', 'primary'], e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur secondaire</label>
            <input
              type="color"
              value={formData.config.colors.secondary}
              onChange={(e) => updateConfig(['colors', 'secondary'], e.target.value)}
              className="w-full h-12 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.config.colors.secondary}
              onChange={(e) => updateConfig(['colors', 'secondary'], e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur accent</label>
            <input
              type="color"
              value={formData.config.colors.accent}
              onChange={(e) => updateConfig(['colors', 'accent'], e.target.value)}
              className="w-full h-12 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.config.colors.accent}
              onChange={(e) => updateConfig(['colors', 'accent'], e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* En-tête */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">En-tête</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="show_logo"
              checked={formData.config.header.show_logo}
              onChange={(e) => updateConfig(['header', 'show_logo'], e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="show_logo" className="text-sm font-medium text-gray-700">
              Afficher le logo
            </label>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="show_atelier_info"
              checked={formData.config.header.show_atelier_info}
              onChange={(e) => updateConfig(['header', 'show_atelier_info'], e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="show_atelier_info" className="text-sm font-medium text-gray-700">
              Afficher les informations de l'atelier
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mise en page</label>
            <select
              value={formData.config.header.layout}
              onChange={(e) => updateConfig(['header', 'layout'], e.target.value as 'left' | 'right' | 'center')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="left">Gauche</option>
              <option value="center">Centré</option>
              <option value="right">Droite</option>
            </select>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Corps du document</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="show_client_info"
              checked={formData.config.body.show_client_info}
              onChange={(e) => updateConfig(['body', 'show_client_info'], e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="show_client_info" className="text-sm font-medium text-gray-700">
              Afficher les informations client
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Style de tableau</label>
            <select
              value={formData.config.body.table_style}
              onChange={(e) => updateConfig(['body', 'table_style'], e.target.value as 'bordered' | 'striped' | 'minimal')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="bordered">Avec bordures</option>
              <option value="striped">Rayé (alternance)</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pied de page */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Pied de page</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="show_cgv"
              checked={formData.config.footer.show_cgv}
              onChange={(e) => updateConfig(['footer', 'show_cgv'], e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="show_cgv" className="text-sm font-medium text-gray-700">
              Afficher les CGV
            </label>
          </div>
          {formData.config.footer.show_cgv && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Texte CGV (variables disponibles: {`{nom_client}, {date_devis}, {montant_ttc}, etc.`})
              </label>
              <textarea
                value={formData.config.footer.cgv_text}
                onChange={(e) => updateConfig(['footer', 'cgv_text'], e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Devis valable 30 jours..."
              />
            </div>
          )}
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="show_signature"
              checked={formData.config.footer.show_signature}
              onChange={(e) => updateConfig(['footer', 'show_signature'], e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="show_signature" className="text-sm font-medium text-gray-700">
              Afficher la signature électronique
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Texte personnalisé (optionnel)</label>
            <textarea
              value={formData.config.footer.custom_text}
              onChange={(e) => updateConfig(['footer', 'custom_text'], e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Texte personnalisé..."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enregistrement...' : templateId ? 'Mettre à jour' : 'Créer le template'}
        </button>
        <a
          href="/app/devis/templates"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Annuler
        </a>
      </div>
    </form>
  )
}
