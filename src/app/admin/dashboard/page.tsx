'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, Users, CreditCard, AlertTriangle, 
  Activity, DollarSign, UserPlus, UserMinus,
  ArrowUp, ArrowDown, BarChart3
} from 'lucide-react'

// Admin dashboard for the SaaS owner to monitor business metrics
// This page should only be accessible to super admins

interface Metrics {
  mrr: number
  mrrChange: number
  arr: number
  totalCustomers: number
  activeCustomers: number
  trialCustomers: number
  churnRate: number
  newCustomersThisMonth: number
  churnedThisMonth: number
  avgRevenuePerUser: number
  ltv: number
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    loadMetrics()
  }, [period])

  async function loadMetrics() {
    // In production, this would fetch from database
    // Mock data for demonstration
    setMetrics({
      mrr: 4850,
      mrrChange: 12.5,
      arr: 58200,
      totalCustomers: 156,
      activeCustomers: 142,
      trialCustomers: 14,
      churnRate: 2.1,
      newCustomersThisMonth: 18,
      churnedThisMonth: 3,
      avgRevenuePerUser: 34.15,
      ltv: 1230,
    })
    setLoading(false)
  }

  const recentCustomers = [
    { name: 'Thermolaque Pro SARL', plan: 'Pro', mrr: 49, date: '2026-01-20' },
    { name: 'Atelier Poudre & Co', plan: 'Atelier', mrr: 29, date: '2026-01-19' },
    { name: 'Metal Protect', plan: 'Pro', mrr: 49, date: '2026-01-18' },
    { name: 'Laquage Express', plan: 'Atelier', mrr: 29, date: '2026-01-17' },
    { name: 'Thermo Industrie', plan: 'Pro', mrr: 49, date: '2026-01-15' },
  ]

  const mrrHistory = [
    { month: 'Août', value: 3200 },
    { month: 'Sep', value: 3500 },
    { month: 'Oct', value: 3800 },
    { month: 'Nov', value: 4200 },
    { month: 'Déc', value: 4500 },
    { month: 'Jan', value: 4850 },
  ]

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Vue d'ensemble des métriques SaaS</p>
          </div>
          <div className="flex gap-2">
            {['7d', '30d', '90d', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  period === p
                    ? 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : p === '90d' ? '90 jours' : 'Tout'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* MRR */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-500" />
              <span className={`flex items-center text-sm font-medium ${
                metrics!.mrrChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metrics!.mrrChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(metrics!.mrrChange)}%
              </span>
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{metrics!.mrr.toLocaleString()} €</p>
            <p className="text-sm text-gray-500">MRR (Revenu mensuel récurrent)</p>
          </div>

          {/* ARR */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{metrics!.arr.toLocaleString()} €</p>
            <p className="text-sm text-gray-500">ARR (Revenu annuel récurrent)</p>
          </div>

          {/* Active Customers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-500" />
              <span className="text-sm text-gray-500">{metrics!.trialCustomers} en essai</span>
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{metrics!.activeCustomers}</p>
            <p className="text-sm text-gray-500">Clients actifs</p>
          </div>

          {/* Churn Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className={`w-8 h-8 ${metrics!.churnRate > 5 ? 'text-red-500' : 'text-yellow-500'}`} />
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{metrics!.churnRate}%</p>
            <p className="text-sm text-gray-500">Taux de churn mensuel</p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserPlus className="w-6 h-6 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">+{metrics!.newCustomersThisMonth}</span>
            </div>
            <p className="text-sm text-gray-500">Nouveaux clients ce mois</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserMinus className="w-6 h-6 text-red-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">-{metrics!.churnedThisMonth}</span>
            </div>
            <p className="text-sm text-gray-500">Clients perdus ce mois</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-6 h-6 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{metrics!.avgRevenuePerUser.toFixed(2)} €</span>
            </div>
            <p className="text-sm text-gray-500">ARPU (Revenu moyen / utilisateur)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MRR Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Évolution MRR</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-end justify-between h-48 gap-2">
              {mrrHistory.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t"
                    style={{ height: `${(item.value / 5000) * 100}%` }}
                  />
                  <span className="text-xs text-gray-500 mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Customers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Derniers clients</h2>
            <div className="space-y-4">
              {recentCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      customer.plan === 'Pro' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    }`}>
                      {customer.plan}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{customer.mrr} €/mois</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LTV */}
        <div className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold opacity-90">Customer Lifetime Value (LTV)</h3>
              <p className="text-4xl font-black mt-2">{metrics!.ltv.toLocaleString()} €</p>
              <p className="text-sm opacity-80 mt-1">Valeur moyenne d'un client sur sa durée de vie</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">LTV / CAC Ratio</p>
              <p className="text-3xl font-bold">4.2x</p>
              <p className="text-sm opacity-80 mt-1">Objectif: &gt; 3x</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
