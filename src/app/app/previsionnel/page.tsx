'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { TrendingUp, Euro, FileText, Target, BarChart3 } from 'lucide-react'

interface PrevData {
  mois: string
  devisEnAttente: number
  devisAcceptes: number
  devisTotal: number
  tauxConversion: number
  caReel: number
  caPrevu: number
}

export default function PrevisionnelPage() {
  const supabase = createBrowserClient()
  const [data, setData] = useState<PrevData[]>([])
  const [loading, setLoading] = useState(true)
  const [tauxConversionGlobal, setTauxConversionGlobal] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      const now = new Date()
      const results: PrevData[] = []

      // 12 derniers mois + 3 prochains
      for (let i = -11; i <= 3; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const moisStr = date.toISOString().split('T')[0].substring(0, 7) // YYYY-MM
        const debut = `${moisStr}-01`
        const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]

        // Devis du mois
        const { count: devisTotal } = await supabase
          .from('devis')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', debut)
          .lte('created_at', fin + 'T23:59:59')

        const { count: devisAcceptes } = await supabase
          .from('devis')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'accepte')
          .gte('created_at', debut)
          .lte('created_at', fin + 'T23:59:59')

        // Devis en attente (futurs mois seulement)
        const { data: devisEnAttenteData } = await supabase
          .from('devis')
          .select('total_ttc')
          .eq('status', 'envoye')
          .gte('created_at', debut)
          .lte('created_at', fin + 'T23:59:59')

        const devisEnAttenteMontant = (devisEnAttenteData || []).reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0)

        // CA réel (factures payées)
        const { data: facturesData } = await supabase
          .from('factures')
          .select('total_ttc')
          .eq('payment_status', 'paid')
          .gte('created_at', debut)
          .lte('created_at', fin + 'T23:59:59')

        const caReel = (facturesData || []).reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0)

        const taux = (devisTotal || 0) > 0 ? ((devisAcceptes || 0) / (devisTotal || 1)) * 100 : 0

        results.push({
          mois: moisStr,
          devisEnAttente: devisEnAttenteMontant,
          devisAcceptes: devisAcceptes || 0,
          devisTotal: devisTotal || 0,
          tauxConversion: taux,
          caReel,
          caPrevu: caReel + devisEnAttenteMontant * (taux / 100),
        })
      }

      setData(results)
      const totalDevis = results.reduce((s, r) => s + r.devisTotal, 0)
      const totalAcceptes = results.reduce((s, r) => s + r.devisAcceptes, 0)
      setTauxConversionGlobal(totalDevis > 0 ? (totalAcceptes / totalDevis) * 100 : 0)
      setLoading(false)
    }
    loadData()
  }, [])

  const formatMois = (m: string) => {
    const [y, mo] = m.split('-')
    const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    return `${moisNoms[parseInt(mo) - 1]} ${y}`
  }

  const currentMonth = new Date().toISOString().split('T')[0].substring(0, 7)
  const futureData = data.filter(d => d.mois >= currentMonth)
  const pastData = data.filter(d => d.mois < currentMonth)
  
  const totalCaPrevu = futureData.reduce((s, d) => s + d.caPrevu, 0)
  const totalDevisAttente = futureData.reduce((s, d) => s + d.devisEnAttente, 0)

  const maxCa = Math.max(...data.map(d => Math.max(d.caReel, d.caPrevu)), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-orange-500" />
          Prévisionnel CA
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Projections basées sur les devis en attente et le taux de conversion historique</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'CA prévu (3 mois)', value: `${totalCaPrevu.toFixed(0)} €`, icon: Euro, color: 'text-green-600' },
          { label: 'Devis en attente', value: `${totalDevisAttente.toFixed(0)} €`, icon: FileText, color: 'text-blue-600' },
          { label: 'Taux conversion global', value: `${tauxConversionGlobal.toFixed(1)}%`, icon: Target, color: 'text-orange-600' },
          { label: 'Mois analysés', value: `${data.length}`, icon: BarChart3, color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <Icon className={`w-6 h-6 ${color} mb-2`} />
            <div className={`text-2xl font-black ${color}`}>{loading ? '...' : value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Graphique simplifié (barres) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-bold mb-4">Évolution CA</h3>
        <div className="flex items-end gap-1 h-48">
          {data.map(d => {
            const isFuture = d.mois >= currentMonth
            const heightReel = (d.caReel / maxCa) * 100
            const heightPrevu = (d.caPrevu / maxCa) * 100
            return (
              <div key={d.mois} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                  {isFuture ? (
                    <div className="w-full bg-orange-200 dark:bg-orange-900/40 rounded-t border-2 border-dashed border-orange-400" style={{ height: `${heightPrevu}%` }} title={`Prévu: ${d.caPrevu.toFixed(0)}€`} />
                  ) : (
                    <div className="w-full bg-green-500 rounded-t" style={{ height: `${heightReel}%` }} title={`Réel: ${d.caReel.toFixed(0)}€`} />
                  )}
                </div>
                <div className="text-[10px] text-gray-400 whitespace-nowrap">{formatMois(d.mois)}</div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> CA réel</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-200 border-2 border-dashed border-orange-400 rounded" /> Prévisionnel</span>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mois</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Devis</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acceptés</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Taux</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CA réel</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">En attente</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CA prévu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map(d => {
              const isCurrent = d.mois === currentMonth
              const isFuture = d.mois > currentMonth
              return (
                <tr key={d.mois} className={isCurrent ? 'bg-blue-50/50 dark:bg-blue-900/10 font-medium' : isFuture ? 'bg-orange-50/30 dark:bg-orange-900/5' : ''}>
                  <td className="px-4 py-2 text-sm">{formatMois(d.mois)} {isCurrent && <span className="text-blue-600 text-xs">(en cours)</span>}</td>
                  <td className="px-4 py-2 text-center text-sm">{d.devisTotal}</td>
                  <td className="px-4 py-2 text-center text-sm">{d.devisAcceptes}</td>
                  <td className="px-4 py-2 text-center text-sm">{d.tauxConversion.toFixed(0)}%</td>
                  <td className="px-4 py-2 text-right text-sm font-mono">{d.caReel > 0 ? `${d.caReel.toFixed(0)} €` : '-'}</td>
                  <td className="px-4 py-2 text-right text-sm font-mono text-blue-600">{d.devisEnAttente > 0 ? `${d.devisEnAttente.toFixed(0)} €` : '-'}</td>
                  <td className="px-4 py-2 text-right text-sm font-mono font-bold text-green-600">{d.caPrevu > 0 ? `${d.caPrevu.toFixed(0)} €` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
