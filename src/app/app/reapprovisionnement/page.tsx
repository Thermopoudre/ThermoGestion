'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  ShoppingCart, AlertTriangle, TrendingUp, Package,
  ArrowDown, ArrowUp, Clock, CheckCircle, Send,
  Download, Filter
} from 'lucide-react'

interface PoudreStock {
  id: string
  nom: string
  code_ral: string | null
  stock_kg: number
  seuil_alerte_kg: number
  fournisseur: string | null
  prix_kg: number | null
  consommation_mois: number // estimée
  jours_restants: number
  a_commander: boolean
}

export default function ReapprovisionnementPage() {
  const [poudres, setPoudres] = useState<PoudreStock[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'urgent' | 'prevision'>('all')

  const supabase = createBrowserClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    // Poudres avec stock
    const { data: poudresData } = await supabase
      .from('poudres')
      .select('id, nom, code_ral, stock_kg, seuil_alerte_kg, fournisseur, prix_kg')
      .eq('atelier_id', userData.atelier_id)
      .order('stock_kg', { ascending: true })

    // Projets récents pour estimer la consommation
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: projetsRecents } = await supabase
      .from('projets')
      .select('poudre_id, surface_m2')
      .eq('atelier_id', userData.atelier_id)
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Calculer consommation par poudre (estimation: 0.15 kg/m2 en moyenne)
    const consoParPoudre: Record<string, number> = {}
    projetsRecents?.forEach((p: any) => {
      if (p.poudre_id) {
        consoParPoudre[p.poudre_id] = (consoParPoudre[p.poudre_id] || 0) + (p.surface_m2 || 0) * 0.15
      }
    })

    const enriched: PoudreStock[] = (poudresData || []).map((p: any) => {
      const consoMois = consoParPoudre[p.id] || 0
      const consoJour = consoMois / 30
      const joursRestants = consoJour > 0 ? Math.floor(p.stock_kg / consoJour) : 999

      return {
        ...p,
        consommation_mois: Math.round(consoMois * 100) / 100,
        jours_restants: joursRestants,
        a_commander: p.stock_kg <= p.seuil_alerte_kg || joursRestants < 14,
      }
    })

    setPoudres(enriched)
    setLoading(false)
  }

  const filtered = poudres.filter(p => {
    if (filter === 'urgent') return p.stock_kg <= p.seuil_alerte_kg
    if (filter === 'prevision') return p.jours_restants < 14 && p.stock_kg > p.seuil_alerte_kg
    return true
  })

  const stats = {
    total: poudres.length,
    enAlerte: poudres.filter(p => p.stock_kg <= p.seuil_alerte_kg).length,
    bientotVide: poudres.filter(p => p.jours_restants < 14 && p.stock_kg > p.seuil_alerte_kg).length,
    estimationBudget: poudres
      .filter(p => p.a_commander)
      .reduce((acc, p) => acc + ((p.seuil_alerte_kg * 2 - p.stock_kg) * (p.prix_kg || 15)), 0),
  }

  function generateCommandeCSV() {
    const lines = ['Référence;Nom;Code RAL;Stock actuel (kg);Quantité à commander (kg);Fournisseur;Prix estimé (EUR)']
    
    poudres.filter(p => p.a_commander).forEach(p => {
      const qte = Math.max(p.seuil_alerte_kg * 2 - p.stock_kg, 10)
      const prix = qte * (p.prix_kg || 15)
      lines.push(`${p.nom};${p.nom};${p.code_ral || ''};${p.stock_kg};${qte.toFixed(1)};${p.fournisseur || ''};${prix.toFixed(2)}`)
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commande-poudres-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-orange-500" />
            Réapprovisionnement
          </h1>
          <p className="text-gray-500 mt-1">Suggestions intelligentes basées sur la consommation réelle</p>
        </div>
        {stats.enAlerte + stats.bientotVide > 0 && (
          <button
            onClick={generateCommandeCSV}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter bon de commande
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Package className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500">Références poudre</p>
        </div>
        <div className={`rounded-xl p-4 shadow ${stats.enAlerte > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-800'}`}>
          <AlertTriangle className={`w-8 h-8 mb-2 ${stats.enAlerte > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.enAlerte}</p>
          <p className="text-sm text-gray-500">En alerte stock</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Clock className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.bientotVide}</p>
          <p className="text-sm text-gray-500">Bientôt en rupture</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.estimationBudget.toFixed(0)} EUR</p>
          <p className="text-sm text-gray-500">Budget commande estimé</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-gray-400" />
        {(['all', 'urgent', 'prevision'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Toutes' : f === 'urgent' ? 'Alertes stock' : 'Prévision < 14j'}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.map(poudre => {
          const stockPct = poudre.seuil_alerte_kg > 0 ? (poudre.stock_kg / (poudre.seuil_alerte_kg * 3)) * 100 : 50
          const isLow = poudre.stock_kg <= poudre.seuil_alerte_kg
          const isSoon = poudre.jours_restants < 14

          return (
            <div key={poudre.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow border-l-4 ${
              isLow ? 'border-red-500' : isSoon ? 'border-orange-500' : 'border-green-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div 
                    className="w-10 h-10 rounded-lg border-2"
                    style={{ backgroundColor: poudre.code_ral || '#808080' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 dark:text-white">{poudre.nom}</p>
                      {poudre.code_ral && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{poudre.code_ral}</span>
                      )}
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Stock bas
                        </span>
                      )}
                      {isSoon && !isLow && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                          ~{poudre.jours_restants}j restants
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>Stock: <strong>{poudre.stock_kg} kg</strong></span>
                      <span>Seuil: {poudre.seuil_alerte_kg} kg</span>
                      <span>Conso/mois: ~{poudre.consommation_mois} kg</span>
                      {poudre.fournisseur && <span>Fournisseur: {poudre.fournisseur}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 hidden md:block">
                  {/* Jauge stock */}
                  <div className="w-32">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${stockPct < 30 ? 'bg-red-500' : stockPct < 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(stockPct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {poudre.a_commander 
                        ? `Commander: ~${Math.max(poudre.seuil_alerte_kg * 2 - poudre.stock_kg, 10).toFixed(0)} kg`
                        : 'Stock OK'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tous les stocks sont corrects</h2>
          <p className="text-gray-500">Aucune poudre ne nécessite de réapprovisionnement</p>
        </div>
      )}
    </div>
  )
}
