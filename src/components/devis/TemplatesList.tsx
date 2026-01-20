'use client'

import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { useState } from 'react'
import type { Database } from '@/types/database.types'

type Template = Database['public']['Tables']['devis_templates']['Row']

interface TemplatesListProps {
  templates: Template[]
}

export function TemplatesList({ templates: initialTemplates }: TemplatesListProps) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createBrowserClient()

  const handleSetDefault = async (templateId: string) => {
    setLoading(templateId)
    try {
      // Retirer le statut default de tous les templates
      const { error: updateAllError } = await supabase
        .from('devis_templates')
        .update({ is_default: false })
        .eq('atelier_id', templates[0]?.atelier_id)

      if (updateAllError) throw updateAllError

      // Mettre le template sélectionné comme défaut
      const { error: updateError } = await supabase
        .from('devis_templates')
        .update({ is_default: true })
        .eq('id', templateId)

      if (updateError) throw updateError

      // Mettre à jour l'état local
      setTemplates(templates.map(t => ({
        ...t,
        is_default: t.id === templateId
      })))
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Erreur lors de la mise à jour'))
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (templateId: string, isSystem: boolean) => {
    if (isSystem) {
      alert('Les templates système ne peuvent pas être supprimés')
      return
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) {
      return
    }

    setLoading(templateId)
    try {
      const { error } = await supabase
        .from('devis_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      // Mettre à jour l'état local
      setTemplates(templates.filter(t => t.id !== templateId))
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Erreur lors de la suppression'))
    } finally {
      setLoading(null)
    }
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-600 mb-4">Aucun template disponible</p>
        <Link
          href="/app/devis/templates/new"
          className="inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Créer votre premier template
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => {
        const config = (template.config as any) || {}
        const colors = config.colors || {}
        
        return (
          <div
            key={template.id}
            className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-blue-200 transition-all"
            style={{
              borderColor: template.is_default ? colors.primary || '#2563eb' : undefined,
              borderWidth: template.is_default ? 2 : 1
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {template.is_default && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Par défaut
                    </span>
                  )}
                  {template.is_system && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Système
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                    {template.template_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Aperçu des couleurs */}
            <div className="flex gap-2 mb-4">
              <div
                className="w-8 h-8 rounded"
                style={{ backgroundColor: colors.primary || '#2563eb' }}
                title="Couleur primaire"
              />
              <div
                className="w-8 h-8 rounded"
                style={{ backgroundColor: colors.secondary || '#64748b' }}
                title="Couleur secondaire"
              />
              <div
                className="w-8 h-8 rounded"
                style={{ backgroundColor: colors.accent || '#0ea5e9' }}
                title="Couleur accent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              {!template.is_default && (
                <button
                  onClick={() => handleSetDefault(template.id)}
                  disabled={loading === template.id}
                  className="flex-1 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {loading === template.id ? '...' : 'Définir par défaut'}
                </button>
              )}
              {!template.is_system && (
                <>
                  <Link
                    href={`/app/devis/templates/${template.id}/edit`}
                    className="flex-1 text-center text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Modifier
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id, template.is_system || false)}
                    disabled={loading === template.id}
                    className="flex-1 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {loading === template.id ? '...' : 'Supprimer'}
                  </button>
                </>
              )}
              {template.is_system && (
                <Link
                  href={`/app/devis/templates/${template.id}/edit`}
                  className="flex-1 text-center text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Voir
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
