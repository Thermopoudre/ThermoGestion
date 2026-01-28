'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Bell, Mail, MessageSquare, Save, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

interface RelanceConfig {
  type_relance: string
  actif: boolean
  delai_j1: number
  delai_j2: number
  delai_j3: number
  canal_j1: string
  canal_j2: string
  canal_j3: string
  template_email: string
  template_sms: string
}

const defaultConfigs: Record<string, RelanceConfig> = {
  facture_impayee: {
    type_relance: 'facture_impayee',
    actif: true,
    delai_j1: 7,
    delai_j2: 15,
    delai_j3: 30,
    canal_j1: 'email',
    canal_j2: 'email',
    canal_j3: 'email,sms',
    template_email: `Bonjour {client_name},

Nous vous rappelons que la facture n°{numero} d'un montant de {montant}€ TTC est en attente de règlement.

Date d'échéance : {date_echeance}

Merci de procéder au règlement dans les meilleurs délais.

Cordialement,
{atelier_name}`,
    template_sms: `Rappel: Facture {numero} de {montant}€ en attente. Merci de régulariser. {atelier_name}`,
  },
  devis_non_signe: {
    type_relance: 'devis_non_signe',
    actif: true,
    delai_j1: 3,
    delai_j2: 7,
    delai_j3: 14,
    canal_j1: 'email',
    canal_j2: 'email',
    canal_j3: 'email',
    template_email: `Bonjour {client_name},

Votre devis n°{numero} est toujours en attente de validation.

Pour confirmer votre commande, vous pouvez signer le devis en ligne ou nous contacter.

Cordialement,
{atelier_name}`,
    template_sms: `Votre devis {numero} attend votre validation. Signez en ligne: {lien}`,
  },
  projet_pret: {
    type_relance: 'projet_pret',
    actif: true,
    delai_j1: 0, // Immédiat
    delai_j2: 3,
    delai_j3: 7,
    canal_j1: 'email,sms',
    canal_j2: 'email',
    canal_j3: 'email,sms',
    template_email: `Bonjour {client_name},

Bonne nouvelle ! Votre projet "{projet_name}" est prêt à être retiré.

Vous pouvez venir le récupérer à notre atelier aux heures d'ouverture.

Cordialement,
{atelier_name}`,
    template_sms: `Votre projet {projet_name} est prêt! Venez le récupérer. {atelier_name}`,
  },
}

export default function AutoRelanceConfig() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [configs, setConfigs] = useState<Record<string, RelanceConfig>>(defaultConfigs)
  const [activeTab, setActiveTab] = useState<string>('facture_impayee')

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('atelier_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const { data: savedConfigs } = await supabase
        .from('config_relances')
        .select('*')
        .eq('atelier_id', userData.atelier_id)

      if (savedConfigs && savedConfigs.length > 0) {
        const configMap = { ...defaultConfigs }
        savedConfigs.forEach(c => {
          configMap[c.type_relance] = c as RelanceConfig
        })
        setConfigs(configMap)
      }
    } catch (error) {
      console.error('Erreur chargement config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: userData } = await supabase
        .from('users')
        .select('atelier_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('Atelier non trouvé')

      // Upsert chaque config
      for (const config of Object.values(configs)) {
        await supabase
          .from('config_relances')
          .upsert({
            atelier_id: userData.atelier_id,
            ...config,
          }, {
            onConflict: 'atelier_id,type_relance'
          })
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (type: string, field: keyof RelanceConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      }
    }))
  }

  const tabs = [
    { key: 'facture_impayee', label: 'Factures impayées', icon: AlertTriangle, color: 'text-red-500' },
    { key: 'devis_non_signe', label: 'Devis en attente', icon: Clock, color: 'text-orange-500' },
    { key: 'projet_pret', label: 'Projets prêts', icon: CheckCircle2, color: 'text-green-500' },
  ]

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    )
  }

  const currentConfig = configs[activeTab]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-orange-500" />
          Relances Automatiques
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {success ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.color}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Config panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        {/* Toggle actif */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Activer les relances automatiques</h3>
            <p className="text-sm text-gray-500">Les relances seront envoyées automatiquement selon les délais configurés</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentConfig.actif}
              onChange={e => updateConfig(activeTab, 'actif', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
          </label>
        </div>

        {/* Délais */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {[1, 2, 3].map(niveau => (
            <div key={niveau} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Relance {niveau} {niveau === 3 && '(dernière)'}
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Délai (jours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentConfig[`delai_j${niveau}` as keyof RelanceConfig] as number}
                    onChange={e => updateConfig(activeTab, `delai_j${niveau}` as keyof RelanceConfig, parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Canal
                  </label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(currentConfig[`canal_j${niveau}` as keyof RelanceConfig] as string).includes('email')}
                        onChange={e => {
                          const current = currentConfig[`canal_j${niveau}` as keyof RelanceConfig] as string
                          const hasEmail = current.includes('email')
                          let newValue = current.split(',').filter(c => c !== 'email')
                          if (!hasEmail) newValue.push('email')
                          updateConfig(activeTab, `canal_j${niveau}` as keyof RelanceConfig, newValue.filter(Boolean).join(','))
                        }}
                        className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                      />
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(currentConfig[`canal_j${niveau}` as keyof RelanceConfig] as string).includes('sms')}
                        onChange={e => {
                          const current = currentConfig[`canal_j${niveau}` as keyof RelanceConfig] as string
                          const hasSms = current.includes('sms')
                          let newValue = current.split(',').filter(c => c !== 'sms')
                          if (!hasSms) newValue.push('sms')
                          updateConfig(activeTab, `canal_j${niveau}` as keyof RelanceConfig, newValue.filter(Boolean).join(','))
                        }}
                        className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                      />
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm">SMS</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Templates */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Template Email
            </label>
            <textarea
              rows={6}
              value={currentConfig.template_email}
              onChange={e => updateConfig(activeTab, 'template_email', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables disponibles: {'{client_name}'}, {'{numero}'}, {'{montant}'}, {'{date_echeance}'}, {'{atelier_name}'}, {'{projet_name}'}, {'{lien}'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Template SMS (160 caractères max)
            </label>
            <textarea
              rows={2}
              maxLength={160}
              value={currentConfig.template_sms}
              onChange={e => updateConfig(activeTab, 'template_sms', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {currentConfig.template_sms.length}/160 caractères
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
