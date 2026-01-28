'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Users, BarChart3, PieChart } from 'lucide-react'

interface ProjetRentabilite {
  projet_id: string
  numero: string
  name: string
  client_name: string
  status: string
  montant_devis_ht: number
  cout_reel_total: number
  marge_brute: number
  marge_pourcent: number
}

interface ClientRentabilite {
  client_id: string
  client_name: string
  nb_projets: number
  ca_total: number
  cout_total: number
  marge_totale: number
  marge_moyenne_pourcent: number
}

export default function ProfitabilityDashboard() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [projets, setProjets] = useState<ProjetRentabilite[]>([])
  const [clientStats, setClientStats] = useState<ClientRentabilite[]>([])
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [globalStats, setGlobalStats] = useState({
    ca_total: 0,
    cout_total: 0,
    marge_totale: 0,
    marge_moyenne: 0,
    nb_projets: 0,
    projets_deficitaires: 0,
  })

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      // Calculer les dates selon la période
      const now = new Date()
      let startDate: Date
      
      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }

      // Charger les projets avec leurs coûts
      const { data: projetsData } = await supabase
        .from('projets')
        .select(`
          id,
          numero,
          name,
          status,
          client_id,
          created_at,
          clients (full_name),
          devis (total_ht, total_ttc)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      // Charger les coûts
      const { data: coutsData } = await supabase
        .from('couts_projet')
        .select('projet_id, cout_total')

      // Calculer la rentabilité par projet
      const projetsAvecMarge: ProjetRentabilite[] = (projetsData || []).map(p => {
        const couts = (coutsData || [])
          .filter(c => c.projet_id === p.id)
          .reduce((sum, c) => sum + (c.cout_total || 0), 0)
        
        const montantHt = p.devis?.total_ht || 0
        const marge = montantHt - couts
        const margePourcent = montantHt > 0 ? (marge / montantHt) * 100 : 0

        return {
          projet_id: p.id,
          numero: p.numero,
          name: p.name,
          client_name: (p.clients as any)?.full_name || 'Client',
          status: p.status,
          montant_devis_ht: montantHt,
          cout_reel_total: couts,
          marge_brute: marge,
          marge_pourcent: margePourcent,
        }
      })

      setProjets(projetsAvecMarge)

      // Calculer les stats par client
      const clientMap = new Map<string, ClientRentabilite>()
      
      projetsAvecMarge.forEach(p => {
        const existing = clientMap.get(p.client_name) || {
          client_id: '',
          client_name: p.client_name,
          nb_projets: 0,
          ca_total: 0,
          cout_total: 0,
          marge_totale: 0,
          marge_moyenne_pourcent: 0,
        }
        
        existing.nb_projets++
        existing.ca_total += p.montant_devis_ht
        existing.cout_total += p.cout_reel_total
        existing.marge_totale += p.marge_brute
        
        clientMap.set(p.client_name, existing)
      })

      const clientStatsArray = Array.from(clientMap.values()).map(c => ({
        ...c,
        marge_moyenne_pourcent: c.ca_total > 0 ? (c.marge_totale / c.ca_total) * 100 : 0,
      })).sort((a, b) => b.marge_totale - a.marge_totale)

      setClientStats(clientStatsArray)

      // Stats globales
      const ca = projetsAvecMarge.reduce((sum, p) => sum + p.montant_devis_ht, 0)
      const cout = projetsAvecMarge.reduce((sum, p) => sum + p.cout_reel_total, 0)
      const marge = ca - cout
      const deficitaires = projetsAvecMarge.filter(p => p.marge_brute < 0).length

      setGlobalStats({
        ca_total: ca,
        cout_total: cout,
        marge_totale: marge,
        marge_moyenne: ca > 0 ? (marge / ca) * 100 : 0,
        nb_projets: projetsAvecMarge.length,
        projets_deficitaires: deficitaires,
      })

    } catch (error) {
      console.error('Erreur chargement rentabilité:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-200 h-32 rounded-xl" />
          ))}
        </div>
        <div className="bg-gray-200 h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analyse de Rentabilité</h2>
        <div className="flex gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {p === 'month' ? 'Ce mois' : p === 'quarter' ? 'Ce trimestre' : 'Cette année'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <DollarSign className="w-8 h-8 text-blue-500" />
            <span className="text-xs text-gray-500">{globalStats.nb_projets} projets</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {globalStats.ca_total.toLocaleString('fr-FR')} €
          </p>
          <p className="text-sm text-gray-500">Chiffre d'affaires HT</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <BarChart3 className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {globalStats.cout_total.toLocaleString('fr-FR')} €
          </p>
          <p className="text-sm text-gray-500">Coûts totaux</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            {globalStats.marge_totale >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-500" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold mt-2 ${globalStats.marge_totale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {globalStats.marge_totale.toLocaleString('fr-FR')} €
          </p>
          <p className="text-sm text-gray-500">Marge brute</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <PieChart className="w-8 h-8 text-purple-500" />
            {globalStats.projets_deficitaires > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                {globalStats.projets_deficitaires} déficitaires
              </span>
            )}
          </div>
          <p className={`text-2xl font-bold mt-2 ${globalStats.marge_moyenne >= 20 ? 'text-green-600' : globalStats.marge_moyenne >= 10 ? 'text-orange-600' : 'text-red-600'}`}>
            {globalStats.marge_moyenne.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500">Marge moyenne</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top clients par rentabilité */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Rentabilité par client
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {clientStats.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune donnée</p>
            ) : (
              clientStats.slice(0, 10).map((client, index) => (
                <div key={client.client_name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded-full text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{client.client_name}</p>
                      <p className="text-xs text-gray-500">{client.nb_projets} projets</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${client.marge_totale >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {client.marge_totale.toLocaleString('fr-FR')} €
                    </p>
                    <p className="text-xs text-gray-500">{client.marge_moyenne_pourcent.toFixed(1)}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Projets à surveiller */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Projets à surveiller
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {projets.filter(p => p.marge_pourcent < 15).length === 0 ? (
              <p className="text-center text-gray-500 py-8">Tous les projets sont rentables ✅</p>
            ) : (
              projets
                .filter(p => p.marge_pourcent < 15)
                .sort((a, b) => a.marge_pourcent - b.marge_pourcent)
                .slice(0, 10)
                .map(projet => (
                  <div key={projet.projet_id} className={`p-3 rounded-lg ${projet.marge_brute < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">#{projet.numero}</p>
                        <p className="text-xs text-gray-500">{projet.client_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${projet.marge_brute < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {projet.marge_pourcent.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {projet.marge_brute.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-white dark:bg-gray-700 rounded">
                        CA: {projet.montant_devis_ht.toLocaleString('fr-FR')} €
                      </span>
                      <span className="px-2 py-1 bg-white dark:bg-gray-700 rounded">
                        Coûts: {projet.cout_reel_total.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
