'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, Users, Activity, 
  AlertTriangle, CheckCircle, Clock, BarChart3,
  PieChart, LineChart, ArrowUp, ArrowDown
} from 'lucide-react'

// Customer Health Score Component
interface CustomerHealth {
  id: string
  name: string
  email: string
  healthScore: number
  trend: 'up' | 'down' | 'stable'
  riskFactors: string[]
  lastActivity: string
  mrr: number
  daysSinceLogin: number
  featureUsage: number
}

// Cohort data
interface CohortData {
  month: string
  customers: number
  retention: number[]
}

// Usage data
interface FeatureUsage {
  feature: string
  usage: number
  trend: number
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'cohorts' | 'forecast' | 'usage'>('health')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<CustomerHealth[]>([])
  const [cohorts, setCohorts] = useState<CohortData[]>([])
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Mock data - In production, fetch from database
    setCustomers([
      {
        id: '1',
        name: 'Thermolaque Pro SARL',
        email: 'contact@thermolaquepro.fr',
        healthScore: 92,
        trend: 'up',
        riskFactors: [],
        lastActivity: '2026-01-21',
        mrr: 49,
        daysSinceLogin: 1,
        featureUsage: 85,
      },
      {
        id: '2',
        name: 'Atelier Poudre & Co',
        email: 'info@poudre-co.fr',
        healthScore: 78,
        trend: 'stable',
        riskFactors: ['Faible utilisation des devis'],
        lastActivity: '2026-01-19',
        mrr: 29,
        daysSinceLogin: 3,
        featureUsage: 62,
      },
      {
        id: '3',
        name: 'Metal Protect',
        email: 'admin@metalprotect.com',
        healthScore: 45,
        trend: 'down',
        riskFactors: ['Pas de connexion depuis 14 jours', 'Aucun projet créé ce mois', 'Support ticket ouvert'],
        lastActivity: '2026-01-07',
        mrr: 49,
        daysSinceLogin: 14,
        featureUsage: 25,
      },
      {
        id: '4',
        name: 'Laquage Express',
        email: 'contact@laquage-express.fr',
        healthScore: 88,
        trend: 'up',
        riskFactors: [],
        lastActivity: '2026-01-20',
        mrr: 29,
        daysSinceLogin: 2,
        featureUsage: 78,
      },
      {
        id: '5',
        name: 'Thermo Industrie',
        email: 'gestion@thermo-industrie.fr',
        healthScore: 35,
        trend: 'down',
        riskFactors: ['Carte bancaire expirée', 'Pas de connexion depuis 21 jours', 'Ticket non résolu'],
        lastActivity: '2025-12-31',
        mrr: 49,
        daysSinceLogin: 21,
        featureUsage: 12,
      },
    ])

    setCohorts([
      { month: 'Août 2025', customers: 45, retention: [100, 89, 82, 78, 75, 73] },
      { month: 'Sep 2025', customers: 52, retention: [100, 92, 85, 81, 79] },
      { month: 'Oct 2025', customers: 48, retention: [100, 88, 83, 80] },
      { month: 'Nov 2025', customers: 61, retention: [100, 91, 86] },
      { month: 'Déc 2025', customers: 55, retention: [100, 93] },
      { month: 'Jan 2026', customers: 68, retention: [100] },
    ])

    setFeatureUsage([
      { feature: 'Création de devis', usage: 89, trend: 5 },
      { feature: 'Gestion projets', usage: 82, trend: 3 },
      { feature: 'Facturation', usage: 76, trend: 8 },
      { feature: 'Planning', usage: 54, trend: 12 },
      { feature: 'Gestion poudres', usage: 45, trend: -2 },
      { feature: 'Rapports/Stats', usage: 38, trend: 15 },
      { feature: 'Client Portal', usage: 32, trend: 25 },
      { feature: 'API/Intégrations', usage: 12, trend: 8 },
    ])

    setLoading(false)
  }

  function getHealthColor(score: number) {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Avancées</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Insights business et prédictions
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'health', label: 'Health Score', icon: Activity },
            { id: 'cohorts', label: 'Cohortes', icon: Users },
            { id: 'forecast', label: 'Prévisions', icon: TrendingUp },
            { id: 'usage', label: 'Usage', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Health Score Tab */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {customers.filter(c => c.healthScore >= 80).length}
                    </p>
                    <p className="text-sm text-gray-500">Clients en bonne santé</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {customers.filter(c => c.healthScore >= 60 && c.healthScore < 80).length}
                    </p>
                    <p className="text-sm text-gray-500">À surveiller</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {customers.filter(c => c.healthScore < 60).length}
                    </p>
                    <p className="text-sm text-gray-500">Risque de churn</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(customers.reduce((acc, c) => acc + c.healthScore, 0) / customers.length)}
                    </p>
                    <p className="text-sm text-gray-500">Score moyen</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-bold text-gray-900 dark:text-white">Customer Health Scores</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {customers.sort((a, b) => a.healthScore - b.healthScore).map((customer) => (
                  <div key={customer.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${getHealthColor(customer.healthScore)}`}>
                          {customer.healthScore}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                          {customer.riskFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {customer.riskFactors.map((risk, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                  {risk}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white font-medium">{customer.mrr}€/mois</span>
                          {customer.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                          {customer.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                        </div>
                        <p className="text-sm text-gray-500">
                          Dernière activité: {customer.daysSinceLogin === 0 ? "Aujourd'hui" : `il y a ${customer.daysSinceLogin}j`}
                        </p>
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${customer.featureUsage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cohorts Tab */}
        {activeTab === 'cohorts' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Analyse de Cohortes</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Rétention mensuelle par cohorte d'inscription
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Cohorte</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Clients</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 0</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 1</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 2</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 3</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 4</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Mois 5</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{cohort.month}</td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">{cohort.customers}</td>
                      {[0, 1, 2, 3, 4, 5].map((month) => (
                        <td key={month} className="py-3 px-4 text-center">
                          {cohort.retention[month] !== undefined ? (
                            <span 
                              className={`inline-block px-3 py-1 rounded font-medium ${
                                cohort.retention[month] >= 90 ? 'bg-green-100 text-green-800' :
                                cohort.retention[month] >= 80 ? 'bg-green-50 text-green-700' :
                                cohort.retention[month] >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}
                            >
                              {cohort.retention[month]}%
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>Insight :</strong> La cohorte de Décembre 2025 montre la meilleure rétention à M+1 (93%), 
                probablement grâce aux améliorations UX déployées en novembre.
              </p>
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* MRR Forecast */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Prévision MRR</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Actuel</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">4 850€</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Fév 2026</span>
                    <span className="text-lg font-medium text-green-600">5 200€ <ArrowUp className="inline w-4 h-4" /></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Mar 2026</span>
                    <span className="text-lg font-medium text-green-600">5 600€ <ArrowUp className="inline w-4 h-4" /></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Juin 2026</span>
                    <span className="text-lg font-medium text-green-600">7 200€ <ArrowUp className="inline w-4 h-4" /></span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500">
                    Croissance estimée: <span className="text-green-600 font-bold">+48%</span> sur 6 mois
                  </p>
                </div>
              </div>

              {/* ARR Forecast */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Prévision ARR</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Actuel</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">58 200€</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Fin Q1 2026</span>
                    <span className="text-lg font-medium text-green-600">67 200€</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Fin Q2 2026</span>
                    <span className="text-lg font-medium text-green-600">86 400€</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Fin 2026</span>
                    <span className="text-lg font-medium text-green-600">120 000€</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500">
                    Objectif annuel: <span className="text-blue-600 font-bold">100 000€</span> → <span className="text-green-600 font-bold">+20% au-dessus</span>
                  </p>
                </div>
              </div>

              {/* Churn Prediction */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Prédiction Churn</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Churn actuel</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">2.1%</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Clients à risque ce mois</p>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                        2 clients (98€ MRR)
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Actions recommandées</p>
                    <ul className="text-sm space-y-1">
                      <li className="text-orange-600">• Contacter Metal Protect</li>
                      <li className="text-orange-600">• Contacter Thermo Industrie</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500">
                    Impact potentiel: <span className="text-red-600 font-bold">-98€/mois</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue Chart Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Évolution MRR (6 derniers mois + prévisions)</h3>
              <div className="h-64 flex items-end justify-between gap-2 px-4">
                {[
                  { label: 'Août', value: 3200, forecast: false },
                  { label: 'Sep', value: 3500, forecast: false },
                  { label: 'Oct', value: 3800, forecast: false },
                  { label: 'Nov', value: 4200, forecast: false },
                  { label: 'Déc', value: 4500, forecast: false },
                  { label: 'Jan', value: 4850, forecast: false },
                  { label: 'Fév', value: 5200, forecast: true },
                  { label: 'Mar', value: 5600, forecast: true },
                  { label: 'Avr', value: 6100, forecast: true },
                  { label: 'Mai', value: 6600, forecast: true },
                  { label: 'Juin', value: 7200, forecast: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div 
                      className={`w-full rounded-t ${item.forecast ? 'bg-orange-300' : 'bg-orange-500'}`}
                      style={{ height: `${(item.value / 7500) * 200}px` }}
                    />
                    <span className="text-xs text-gray-500 mt-2">{item.label}</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{(item.value / 1000).toFixed(1)}k€</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <span className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-4 h-4 bg-orange-500 rounded"></span> Réel
                </span>
                <span className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-4 h-4 bg-orange-300 rounded"></span> Prévision
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Utilisation des fonctionnalités</h2>
              <div className="space-y-4">
                {featureUsage.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {feature.feature}
                    </div>
                    <div className="flex-1">
                      <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-end pr-3"
                          style={{ width: `${feature.usage}%` }}
                        >
                          <span className="text-xs font-bold text-white">{feature.usage}%</span>
                        </div>
                      </div>
                    </div>
                    <div className={`w-16 text-right text-sm font-medium ${
                      feature.trend > 0 ? 'text-green-600' : feature.trend < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {feature.trend > 0 ? '+' : ''}{feature.trend}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top actions cette semaine</h3>
                <div className="space-y-3">
                  {[
                    { action: 'Création devis', count: 234 },
                    { action: 'Mise à jour projet', count: 189 },
                    { action: 'Création facture', count: 156 },
                    { action: 'Export PDF', count: 142 },
                    { action: 'Ajout client', count: 87 },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">{item.action}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Engagement quotidien</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Sessions actives/jour</span>
                    <span className="font-bold text-gray-900 dark:text-white">89</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Durée moyenne session</span>
                    <span className="font-bold text-gray-900 dark:text-white">12 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Pages/session</span>
                    <span className="font-bold text-gray-900 dark:text-white">8.4</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">DAU/MAU ratio</span>
                    <span className="font-bold text-green-600">42%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
