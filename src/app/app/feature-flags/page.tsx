'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { ToggleLeft, ToggleRight, Shield, Zap, Info } from 'lucide-react'

interface FeatureFlag {
  id: string
  feature_key: string
  label: string
  description: string | null
  plan_lite: boolean
  plan_pro: boolean
  enabled: boolean
}

export default function FeatureFlagsPage() {
  const supabase = createBrowserClient()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data } = await supabase
      .from('feature_flags')
      .select('*')
      .order('label')
    if (data) setFlags(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const toggleFlag = async (id: string, field: 'plan_lite' | 'plan_pro' | 'enabled', value: boolean) => {
    await supabase.from('feature_flags').update({ [field]: value }).eq('id', id)
    setFlags(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap className="w-7 h-7 text-orange-500" />
          Feature Flags
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Activation/désactivation des fonctionnalités par plan (Lite / Pro)
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          Les feature flags permettent d&apos;activer/désactiver des fonctionnalités selon le plan de l&apos;atelier. 
          Un flag désactivé globalement (&quot;Activé&quot; = OFF) masque la fonctionnalité pour tous les plans.
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonctionnalité</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                <span className="flex items-center justify-center gap-1">
                  <Shield className="w-4 h-4" /> Plan Lite
                </span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                <span className="flex items-center justify-center gap-1">
                  <Zap className="w-4 h-4" /> Plan Pro
                </span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Activé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {flags.map(flag => (
              <tr key={flag.id} className={!flag.enabled ? 'opacity-50' : ''}>
                <td className="px-6 py-4">
                  <div className="font-medium text-sm">{flag.label}</div>
                  {flag.description && <div className="text-xs text-gray-500 mt-0.5">{flag.description}</div>}
                  <div className="text-xs text-gray-400 font-mono mt-1">{flag.feature_key}</div>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleFlag(flag.id, 'plan_lite', !flag.plan_lite)}
                    className={`transition-colors ${flag.plan_lite ? 'text-green-500' : 'text-gray-300'}`}
                  >
                    {flag.plan_lite ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleFlag(flag.id, 'plan_pro', !flag.plan_pro)}
                    className={`transition-colors ${flag.plan_pro ? 'text-green-500' : 'text-gray-300'}`}
                  >
                    {flag.plan_pro ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleFlag(flag.id, 'enabled', !flag.enabled)}
                    className={`transition-colors ${flag.enabled ? 'text-blue-500' : 'text-gray-300'}`}
                  >
                    {flag.enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
