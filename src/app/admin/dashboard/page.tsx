'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  TrendingUp, Users, CreditCard, AlertTriangle, 
  DollarSign, UserPlus, UserMinus,
  ArrowUp, ArrowDown, BarChart3, HardDrive, RefreshCw
} from 'lucide-react'

// Admin dashboard for the SaaS owner to monitor business metrics
// Protected by middleware - only accessible to superadmins (SUPERADMIN_EMAILS)

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
  planDistribution: { trial: number; lite: number; pro: number }
  totalStorageUsed: number
  totalStorageQuota: number
}

interface RecentCustomer {
  name: string
  plan: string
  mrr: number
  date: string
}

interface MRRHistory {
  month: string
  value: number
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [mrrHistory, setMrrHistory] = useState<MRRHistory[]>([])
  const [period, setPeriod] = useState('30d')

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/metrics')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur de chargement')
      }
      const data = await res.json()
      setMetrics(data.metrics)
      setRecentCustomers(data.recentCustomers || [])
      setMrrHistory(data.mrrHistory || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement des métriques...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <button
            onClick={loadMetrics}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const maxMrr = Math.max(...mrrHistory.map(h => h.value), 1)

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Vue d'ensemble des métriques SaaS - Données en temps réel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadMetrics}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Actualiser"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
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
                  {p === '7d' ? '7j' : p === '30d' ? '30j' : p === '90d' ? '90j' : 'Tout'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* MRR */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-500" />
              {metrics!.mrrChange !== 0 && (
                <span className={`flex items-center text-sm font-medium ${
                  metrics!.mrrChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics!.mrrChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  {Math.abs(metrics!.mrrChange)}%
                </span>
              )}
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
            <p className="text-sm text-gray-500">Clients actifs / {metrics!.totalCustomers} total</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserPlus className="w-6 h-6 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">+{metrics!.newCustomersThisMonth}</span>
            </div>
            <p className="text-sm text-gray-500">Nouveaux ce mois</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserMinus className="w-6 h-6 text-red-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">-{metrics!.churnedThisMonth}</span>
            </div>
            <p className="text-sm text-gray-500">Churn ce mois</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-6 h-6 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{metrics!.avgRevenuePerUser.toFixed(2)} €</span>
            </div>
            <p className="text-sm text-gray-500">ARPU</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <HardDrive className="w-6 h-6 text-purple-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{metrics!.totalStorageUsed} Go</span>
            </div>
            <p className="text-sm text-gray-500">Storage utilisé / {metrics!.totalStorageQuota} Go</p>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
            <p className="text-4xl font-black text-orange-500">{metrics!.planDistribution.trial}</p>
            <p className="text-sm text-gray-500 mt-1">Essai gratuit</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
            <p className="text-4xl font-black text-blue-500">{metrics!.planDistribution.lite}</p>
            <p className="text-sm text-gray-500 mt-1">Plan Lite (29 €)</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
            <p className="text-4xl font-black text-purple-500">{metrics!.planDistribution.pro}</p>
            <p className="text-sm text-gray-500 mt-1">Plan Pro (49 €)</p>
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
                  <p className="text-xs text-gray-500 mb-1">{item.value} €</p>
                  <div 
                    className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t transition-all"
                    style={{ height: `${(item.value / maxMrr) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-gray-500 mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Customers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Derniers clients</h2>
            {recentCustomers.length > 0 ? (
              <div className="space-y-4">
                {recentCustomers.map((customer, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(customer.date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        customer.plan === 'Pro' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                          : customer.plan === 'Trial'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                        {customer.plan}
                      </span>
                      {customer.mrr > 0 && (
                        <p className="text-sm text-gray-500 mt-1">{customer.mrr} €/mois</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun client pour le moment
              </div>
            )}
          </div>
        </div>

        {/* LTV */}
        <div className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold opacity-90">Customer Lifetime Value (LTV)</h3>
              <p className="text-4xl font-black mt-2">{metrics!.ltv.toLocaleString()} €</p>
              <p className="text-sm opacity-80 mt-1">Valeur estimée d'un client sur 24 mois</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Clients payants</p>
              <p className="text-3xl font-bold">
                {metrics!.planDistribution.lite + metrics!.planDistribution.pro}
              </p>
              <p className="text-sm opacity-80 mt-1">sur {metrics!.totalCustomers} inscrits</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
