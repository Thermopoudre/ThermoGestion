'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Gift, Star, Award, TrendingUp, Users, 
  Percent, Calendar, Check, ChevronRight,
  Settings, Plus, Trash2
} from 'lucide-react'

interface Client {
  id: string
  full_name: string
  email: string
  points: number
  niveau: 'bronze' | 'silver' | 'gold' | 'platinum'
  totalAchats: number
  dernierAchat: string | null
}

interface Reward {
  id: string
  nom: string
  description: string
  points_requis: number
  type: 'discount' | 'gift' | 'service'
  valeur: number
  actif: boolean
}

const niveaux = {
  bronze: { label: 'Bronze', color: 'bg-amber-600', min: 0, max: 499, multiplier: 1 },
  silver: { label: 'Argent', color: 'bg-gray-400', min: 500, max: 1999, multiplier: 1.5 },
  gold: { label: 'Or', color: 'bg-yellow-400', min: 2000, max: 4999, multiplier: 2 },
  platinum: { label: 'Platine', color: 'bg-purple-400', min: 5000, max: 999999, multiplier: 3 },
}

export default function FidelitePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [rewards, setRewards] = useState<Reward[]>([
    { id: '1', nom: '5% de reduction', description: 'Sur votre prochaine commande', points_requis: 100, type: 'discount', valeur: 5, actif: true },
    { id: '2', nom: '10% de reduction', description: 'Sur votre prochaine commande', points_requis: 250, type: 'discount', valeur: 10, actif: true },
    { id: '3', nom: 'Livraison gratuite', description: 'Livraison offerte', points_requis: 150, type: 'service', valeur: 0, actif: true },
    { id: '4', nom: '15% de reduction', description: 'Sur votre prochaine commande', points_requis: 500, type: 'discount', valeur: 15, actif: true },
  ])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'clients' | 'rewards' | 'settings'>('clients')
  const [pointsParEuro, setPointsParEuro] = useState(1)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    const supabase = createBrowserClient()
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, full_name, email, factures:factures(montant_ttc, created_at)')
      .limit(50)

    const clientsWithPoints = clientsData?.map(client => {
      const factures = (client.factures || []) as { montant_ttc: number; created_at: string }[]
      const totalAchats = factures.reduce((acc, f) => acc + (f.montant_ttc || 0), 0)
      const points = Math.floor(totalAchats * pointsParEuro)
      const dernierAchat = factures.length > 0 
        ? factures.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
        : null

      let niveau: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze'
      if (points >= niveaux.platinum.min) niveau = 'platinum'
      else if (points >= niveaux.gold.min) niveau = 'gold'
      else if (points >= niveaux.silver.min) niveau = 'silver'

      return { id: client.id, full_name: client.full_name, email: client.email, points, niveau, totalAchats, dernierAchat }
    }) || []

    clientsWithPoints.sort((a, b) => b.points - a.points)
    setClients(clientsWithPoints)
    setLoading(false)
  }

  const totalPoints = clients.reduce((acc, c) => acc + c.points, 0)
  const avgPoints = clients.length > 0 ? Math.round(totalPoints / clients.length) : 0
  const niveauDistribution = {
    bronze: clients.filter(c => c.niveau === 'bronze').length,
    silver: clients.filter(c => c.niveau === 'silver').length,
    gold: clients.filter(c => c.niveau === 'gold').length,
    platinum: clients.filter(c => c.niveau === 'platinum').length,
  }

  if (loading) {
    return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded-xl" /></div>
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Programme Fidelite</h1>
        <p className="text-gray-500">Recompensez vos clients reguliers</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <Star className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-3xl font-black">{totalPoints.toLocaleString()}</p>
          <p className="text-sm opacity-80">Points totaux</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Users className="w-8 h-8 mb-2 text-blue-500" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">{clients.length}</p>
          <p className="text-sm text-gray-500">Clients membres</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <TrendingUp className="w-8 h-8 mb-2 text-green-500" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">{avgPoints}</p>
          <p className="text-sm text-gray-500">Points moyens</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Gift className="w-8 h-8 mb-2 text-purple-500" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">{rewards.filter(r => r.actif).length}</p>
          <p className="text-sm text-gray-500">Recompenses actives</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {['clients', 'rewards', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 px-6 py-4 font-bold text-center transition-colors ${
                activeTab === tab 
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 border-b-2 border-orange-500' 
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'clients' && <Users className="w-5 h-5 mx-auto mb-1" />}
              {tab === 'rewards' && <Gift className="w-5 h-5 mx-auto mb-1" />}
              {tab === 'settings' && <Settings className="w-5 h-5 mx-auto mb-1" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'clients' && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {Object.entries(niveaux).map(([key, niveau]) => (
                  <div key={key} className={`p-3 rounded-xl text-center ${niveau.color} text-white`}>
                    <p className="text-2xl font-black">{niveauDistribution[key as keyof typeof niveauDistribution]}</p>
                    <p className="text-sm opacity-80">{niveau.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {clients.slice(0, 10).map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 font-bold">{index + 1}</div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{client.full_name}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-orange-500">{client.points} pts</p>
                        <p className="text-sm text-gray-500">{client.totalAchats.toLocaleString()} EUR</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${niveaux[client.niveau].color} text-white`}>
                        {niveaux[client.niveau].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.map(reward => (
                <div key={reward.id} className={`p-4 rounded-xl border-2 ${reward.actif ? 'bg-white dark:bg-gray-700 border-gray-200' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {reward.type === 'discount' ? <Percent className="w-6 h-6 text-green-500" /> : <Gift className="w-6 h-6 text-purple-500" />}
                      <h4 className="font-bold text-gray-900 dark:text-white">{reward.nom}</h4>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{reward.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-bold">
                      <Star className="w-4 h-4" />{reward.points_requis} points
                    </span>
                    {reward.type === 'discount' && <span className="text-green-600 font-bold">-{reward.valeur}%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6">Configuration</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Points par euro</label>
                <input
                  type="number"
                  value={pointsParEuro}
                  onChange={(e) => setPointsParEuro(parseInt(e.target.value))}
                  className="w-32 px-4 py-2 border border-gray-200 rounded-lg text-center"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
