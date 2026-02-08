'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

type TemplateName = 'classic' | 'modern' | 'industrial' | 'premium'

interface PdfSettings {
  template: TemplateName
  primaryColor: string
  accentColor: string
  showLogo: boolean
  fontFamily: 'inter' | 'roboto' | 'opensans'
  cgvDevis: string
  cgvFacture: string
  paymentTerms: string
  footerText: string
}

const DEFAULT_CGV_DEVIS = 'Devis valable 30 jours à compter de sa date d\'émission. Acompte de 30% à la commande, solde à la livraison. Pas d\'escompte pour paiement anticipé.'

const DEFAULT_CGV_FACTURE = 'Paiement à réception de facture. En cas de retard de paiement, une pénalité de retard au taux de 3 fois le taux d\'intérêt légal sera appliquée (art. L441-10 C. com.), ainsi qu\'une indemnité forfaitaire de recouvrement de 40 € (art. D441-5 C. com.). Pas d\'escompte pour paiement anticipé.'

const DEFAULT_SETTINGS: PdfSettings = {
  template: 'industrial',
  primaryColor: '#dc2626',
  accentColor: '#f97316',
  showLogo: true,
  fontFamily: 'inter',
  cgvDevis: DEFAULT_CGV_DEVIS,
  cgvFacture: DEFAULT_CGV_FACTURE,
  paymentTerms: '30 jours',
  footerText: '',
}

const TEMPLATES = [
  {
    id: 'classic' as TemplateName,
    name: 'Classic',
    description: 'Design professionnel et épuré',
    defaultColors: { primary: '#1e3a5f', accent: '#3b82f6' },
  },
  {
    id: 'modern' as TemplateName,
    name: 'Modern',
    description: 'Design contemporain avec touches vives',
    defaultColors: { primary: '#0f172a', accent: '#06b6d4' },
  },
  {
    id: 'industrial' as TemplateName,
    name: 'Industriel',
    description: 'Parfait pour thermolaquage et métallurgie',
    defaultColors: { primary: '#dc2626', accent: '#f97316' },
  },
  {
    id: 'premium' as TemplateName,
    name: 'Premium',
    description: 'Design haut de gamme élégant',
    defaultColors: { primary: '#1f2937', accent: '#d4af37' },
  },
]

const PRESET_COLORS = [
  { name: 'Rouge', value: '#dc2626' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Bleu', value: '#2563eb' },
  { name: 'Bleu foncé', value: '#1e3a5f' },
  { name: 'Vert', value: '#16a34a' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Rose', value: '#db2777' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Gris', value: '#374151' },
  { name: 'Or', value: '#d4af37' },
]

interface TemplateCustomizerProps {
  atelierId: string
  initialSettings?: Partial<PdfSettings>
  atelierLogo?: string
}

export function TemplateCustomizer({ atelierId, initialSettings, atelierLogo }: TemplateCustomizerProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [settings, setSettings] = useState<PdfSettings>({ ...DEFAULT_SETTINGS, ...initialSettings })
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'template' | 'colors' | 'text'>('template')

  // Mise à jour des couleurs par défaut quand on change de template
  const handleTemplateChange = (templateId: TemplateName) => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSettings(prev => ({
        ...prev,
        template: templateId,
        primaryColor: template.defaultColors.primary,
        accentColor: template.defaultColors.accent,
      }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: atelier } = await supabase
        .from('ateliers')
        .select('settings')
        .eq('id', atelierId)
        .single()

      const { error } = await supabase
        .from('ateliers')
        .update({
          settings: {
            ...(atelier?.settings || {}),
            pdf_template: settings.template,
            pdf_primary_color: settings.primaryColor,
            pdf_accent_color: settings.accentColor,
            pdf_show_logo: settings.showLogo,
            pdf_font_family: settings.fontFamily,
            cgv_devis: settings.cgvDevis,
            cgv_facture: settings.cgvFacture,
            pdf_payment_terms: settings.paymentTerms,
            pdf_footer_text: settings.footerText,
          },
        })
        .eq('id', atelierId)

      if (error) throw error

      router.refresh()
      alert('Paramètres PDF sauvegardés !')
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Panel de configuration */}
      <div className="space-y-6">
        {/* Onglets */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {[
            { id: 'template', label: 'Template', icon: '📄' },
            { id: 'colors', label: 'Couleurs', icon: '🎨' },
            { id: 'text', label: 'Textes', icon: '✏️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          {activeTab === 'template' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Choisir un modèle
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateChange(template.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      settings.template === template.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: template.defaultColors.primary }}
                      />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {template.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {template.description}
                    </p>
                    {settings.template === template.id && (
                      <span className="inline-block mt-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                        ✓ Sélectionné
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Couleur principale
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Utilisée pour les en-têtes, titres et éléments principaux
                </p>
                
                {/* Couleurs prédéfinies */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setSettings(prev => ({ ...prev, primaryColor: color.value }))}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        settings.primaryColor === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                
                {/* Color picker personnalisé */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                    placeholder="#dc2626"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Couleur d'accent
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Utilisée pour les liens, boutons et mises en avant
                </p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setSettings(prev => ({ ...prev, accentColor: color.value }))}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        settings.accentColor === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                    placeholder="#f97316"
                  />
                </div>
              </div>

              {/* Aperçu des couleurs */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Aperçu</p>
                <div className="flex items-center gap-3">
                  <div 
                    className="h-12 flex-1 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    En-tête
                  </div>
                  <div 
                    className="h-12 w-24 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: settings.accentColor }}
                  >
                    Accent
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CGV — Devis
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Texte affiché en bas de chaque devis (validité, acompte, conditions)
                </p>
                <textarea
                  value={settings.cgvDevis}
                  onChange={(e) => setSettings(prev => ({ ...prev, cgvDevis: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Devis valable 30 jours..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CGV — Factures
                  <span className="ml-2 text-xs font-normal text-orange-500">(obligatoire légalement)</span>
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Texte affiché en bas de chaque facture (pénalités de retard, escompte, indemnité forfaitaire)
                </p>
                <textarea
                  value={settings.cgvFacture}
                  onChange={(e) => setSettings(prev => ({ ...prev, cgvFacture: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Pénalités de retard, escompte, indemnité forfaitaire..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Délai de paiement
                </label>
                <select
                  value={settings.paymentTerms}
                  onChange={(e) => setSettings(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="comptant">Paiement comptant</option>
                  <option value="15 jours">15 jours</option>
                  <option value="30 jours">30 jours</option>
                  <option value="45 jours">45 jours fin de mois</option>
                  <option value="60 jours">60 jours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Note de bas de page (optionnel)
                </label>
                <textarea
                  value={settings.footerText}
                  onChange={(e) => setSettings(prev => ({ ...prev, footerText: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Message personnalisé en bas du document..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Afficher le logo</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {atelierLogo ? 'Logo configuré' : 'Aucun logo (configurer dans Paramètres)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showLogo}
                    onChange={(e) => setSettings(prev => ({ ...prev, showLogo: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-4">
          <button
            onClick={refreshPreview}
            className="flex-1 py-3 px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            🔄 Rafraîchir aperçu
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50"
          >
            {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Aperçu PDF A4 */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">
            Aperçu format A4
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            210 × 297 mm
          </span>
        </div>
        
        {/* Container A4 avec ratio correct */}
        <div 
          className="bg-white rounded-lg shadow-xl overflow-hidden mx-auto"
          style={{ 
            aspectRatio: '210 / 297',
            maxHeight: 'calc(100vh - 300px)',
            width: '100%',
            maxWidth: '500px'
          }}
        >
          <iframe
            key={previewKey}
            src={`/api/templates/preview?template=${settings.template}&primaryColor=${encodeURIComponent(settings.primaryColor)}&accentColor=${encodeURIComponent(settings.accentColor)}`}
            className="w-full h-full border-0"
            title="Aperçu PDF"
          />
        </div>
        
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          Le rendu final sera au format A4 (210 × 297 mm)
        </p>
      </div>
    </div>
  )
}
