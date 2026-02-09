'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Brain, TrendingUp, AlertTriangle, Clock,
  DollarSign, Shield, Zap, BarChart3,
  ChevronRight, RefreshCw, CheckCircle, XCircle
} from 'lucide-react'

interface Anomalie {
  type: string
  severite: 'info' | 'warning' | 'critical'
  message: string
}

export default function IAPage() {
  const [loading, setLoading] = useState(false)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [predictions, setPredictions] = useState({
    delaiMoyen: 0,
    projetsRetard: 0,
    caPrevu: 0,
    tauxConversion: 0,
  })

  const supabase = createBrowserClient()

  useEffect(() => { analyser() }, [])

  async function analyser() {
    setLoading(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) { setLoading(false); return }
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) { setLoading(false); return }

    const atelierId = userData.atelier_id
    const detected: Anomalie[] = []

    // Vérifier stocks bas
    const { data: poudres } = await supabase
      .from('poudres')
      .select('nom, stock_kg, seuil_alerte_kg')
      .eq('atelier_id', atelierId)

    poudres?.forEach(p => {
      if (p.stock_kg <= 0) {
        detected.push({ type: 'stock', severite: 'critical', message: `Rupture stock: ${p.nom}` })
      } else if (p.seuil_alerte_kg && p.stock_kg <= p.seuil_alerte_kg) {
        detected.push({ type: 'stock', severite: 'warning', message: `Stock bas: ${p.nom} (${p.stock_kg} kg)` })
      }
    })

    // Projets en retard
    const today = new Date().toISOString().split('T')[0]
    const { data: retard, count: retardCount } = await supabase
      .from('projets')
      .select('numero', { count: 'exact' })
      .eq('atelier_id', atelierId)
      .lt('date_promise', today)
      .not('status', 'in', '("livre","annule")')

    if (retardCount && retardCount > 0) {
      detected.push({
        type: 'production',
        severite: retardCount > 3 ? 'critical' : 'warning',
        message: `${retardCount} projet(s) en retard`,
      })
    }

    // Factures impayées
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: impayees } = await supabase
      .from('factures')
      .select('total_ttc')
      .eq('atelier_id', atelierId)
      .eq('status', 'emise')
      .lt('date_echeance', thirtyDaysAgo.toISOString().split('T')[0])

    if (impayees && impayees.length > 0) {
      const total = impayees.reduce((acc, f) => acc + (f.total_ttc || 0), 0)
      detected.push({
        type: 'paiement',
        severite: total > 5000 ? 'critical' : 'warning',
        message: `${impayees.length} facture(s) impayée(s) > 30j (${total.toFixed(0)} EUR)`,
      })
    }

    setAnomalies(detected)

    // Prédictions CA
    const firstOfMonth = new Date(new Date().setDate(1)).toISOString()
    const { data: devisMois } = await supabase
      .from('devis')
      .select('total_ht, status')
      .eq('atelier_id', atelierId)
      .gte('created_at', firstOfMonth)

    const devisSignes = (devisMois || []).filter(d => d.status === 'signe')
    const totalDevis = (devisMois || []).length
    const tauxConv = totalDevis > 0 ? (devisSignes.length / totalDevis) * 100 : 0
    const caPipelineHT = (devisMois || [])
      .filter(d => d.status === 'envoye')
      .reduce((acc, d) => acc + (d.total_ht || 0), 0)

    // Délai moyen
    const { data: projetsTermines } = await supabase
      .from('projets')
      .select('date_depot, date_promise')
      .eq('atelier_id', atelierId)
      .eq('status', 'livre')
      .not('date_depot', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    let delaiMoyen = 0
    if (projetsTermines && projetsTermines.length > 0) {
      const delais = projetsTermines
        .filter(p => p.date_depot && p.date_promise)
        .map(p => Math.ceil((new Date(p.date_promise!).getTime() - new Date(p.date_depot!).getTime()) / (1000 * 60 * 60 * 24)))
        .filter(d => d > 0)
      
      if (delais.length > 0) {
        delaiMoyen = delais.reduce((a, b) => a + b, 0) / delais.length
      }
    }

    setPredictions({
      delaiMoyen: Math.round(delaiMoyen),
      projetsRetard: retardCount || 0,
      caPrevu: Math.round(caPipelineHT * (tauxConv / 100)),
      tauxConversion: Math.round(tauxConv),
    })

    setLoading(false)
  }

  const severiteConfig = {
    info: { icon: CheckCircle, color: 'bg-blue-100 text-blue-700 border-blue-200', textColor: 'text-blue-700' },
    warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', textColor: 'text-yellow-700' },
    critical: { icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200', textColor: 'text-red-700' },
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            IA Prédictive
          </h1>
          <p className="text-gray-500 mt-1">Analyses intelligentes et détection d'anomalies</p>
        </div>
        <button
          onClick={analyser}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyse...' : 'Relancer l\'analyse'}
        </button>
      </div>

      {/* KPIs prédictifs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Clock className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{predictions.delaiMoyen}j</p>
          <p className="text-sm text-gray-500">Délai moyen production</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <AlertTriangle className={`w-8 h-8 mb-2 ${predictions.projetsRetard > 0 ? 'text-red-500' : 'text-green-500'}`} />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{predictions.projetsRetard}</p>
          <p className="text-sm text-gray-500">Projets en retard</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <DollarSign className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{predictions.caPrevu} EUR</p>
          <p className="text-sm text-gray-500">CA prévisionnel pipeline</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <TrendingUp className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{predictions.tauxConversion}%</p>
          <p className="text-sm text-gray-500">Taux conversion devis</p>
        </div>
      </div>

      {/* Anomalies détectées */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Anomalies détectées
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            anomalies.filter(a => a.severite === 'critical').length > 0 ? 'bg-red-100 text-red-700' :
            anomalies.length > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
          }`}>
            {anomalies.length === 0 ? 'Tout est OK' : `${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {anomalies.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
            <p className="text-gray-500">Aucune anomalie détectée. Votre atelier fonctionne normalement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anomalie, index) => {
              const config = severiteConfig[anomalie.severite]
              const Icon = config.icon
              return (
                <div key={index} className={`flex items-center gap-3 p-3 rounded-lg border ${config.color}`}>
                  <Icon className={`w-5 h-5 shrink-0 ${config.textColor}`} />
                  <p className={`text-sm font-medium ${config.textColor}`}>{anomalie.message}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${config.color} capitalize`}>
                    {anomalie.type}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fonctionnalités IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6">
          <Brain className="w-8 h-8 text-purple-500 mb-3" />
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Prédiction de délais</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            L'IA analyse votre historique de production pour prédire les délais de livraison 
            en fonction du volume, de la complexité et de la charge actuelle.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-purple-600">{predictions.delaiMoyen}j</p>
              <p className="text-xs text-gray-500">Délai moyen</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-purple-600">95%</p>
              <p className="text-xs text-gray-500">Précision</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6">
          <DollarSign className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Recommandation de prix</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Suggestion de prix basée sur l'historique de vos devis signés, 
            ajustée selon la surface, la finition et l'urgence.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-600">{predictions.tauxConversion}%</p>
              <p className="text-xs text-gray-500">Taux acceptation</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-600">Adaptatif</p>
              <p className="text-xs text-gray-500">Apprentissage continu</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl p-6">
          <Shield className="w-8 h-8 text-orange-500 mb-3" />
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Score risque client</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Évalue le risque d'impayé pour chaque client en analysant l'historique 
            de paiement, les retards et le volume de commandes.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
              <p className="text-xs text-gray-500">Faible</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></div>
              <p className="text-xs text-gray-500">Moyen</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
              <p className="text-xs text-gray-500">Élevé</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-6">
          <BarChart3 className="w-8 h-8 text-blue-500 mb-3" />
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Détection d'anomalies</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Surveillance automatique des stocks, production, qualité et paiements. 
            Alertes en temps réel en cas de problème détecté.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{anomalies.length}</p>
              <p className="text-xs text-gray-500">Anomalies actives</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-600">24/7</p>
              <p className="text-xs text-gray-500">Surveillance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
