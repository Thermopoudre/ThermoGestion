'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Monitor, Clock, AlertTriangle, CheckCircle, Flame, Package, TrendingUp, RefreshCw } from 'lucide-react'

interface ProjetJour {
  id: string
  numero: string
  name: string
  status: string
  clients?: { full_name: string } | null
  poudres?: { reference: string; ral: string } | null
  date_promise?: string | null
  priorite?: string | null
}

export default function EcranAtelierPage() {
  const supabase = createBrowserClient()
  const [projets, setProjets] = useState<ProjetJour[]>([])
  const [stats, setStats] = useState({ enCours: 0, cuisson: 0, qc: 0, prets: 0, livres: 0, retards: 0 })
  const [heure, setHeure] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    const { data: projetsData } = await supabase
      .from('projets')
      .select('id, numero, name, status, date_promise, priorite, clients(full_name), poudres(reference, ral)')
      .in('status', ['en_cours', 'en_cuisson', 'qc', 'pret'])
      .order('priorite', { ascending: false })
      .order('date_promise', { ascending: true })
      .limit(50)

    if (projetsData) setProjets(projetsData as any)

    // Stats du jour
    const { count: enCours } = await supabase.from('projets').select('*', { count: 'exact', head: true }).eq('status', 'en_cours')
    const { count: cuisson } = await supabase.from('projets').select('*', { count: 'exact', head: true }).eq('status', 'en_cuisson')
    const { count: qc } = await supabase.from('projets').select('*', { count: 'exact', head: true }).eq('status', 'qc')
    const { count: prets } = await supabase.from('projets').select('*', { count: 'exact', head: true }).eq('status', 'pret')
    
    // Livrés aujourd'hui
    const { count: livres } = await supabase.from('projets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'livre')
      .gte('updated_at', today)

    // En retard
    const { count: retards } = await supabase.from('projets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['en_cours', 'en_cuisson', 'qc'])
      .lt('date_promise', today)

    setStats({
      enCours: enCours || 0,
      cuisson: cuisson || 0,
      qc: qc || 0,
      prets: prets || 0,
      livres: livres || 0,
      retards: retards || 0,
    })
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh toutes les 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setHeure(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    en_cours: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'En cours' },
    en_cuisson: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Cuisson' },
    qc: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Contrôle' },
    pret: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Prêt' },
  }

  const isEnRetard = (p: ProjetJour) => {
    if (!p.date_promise) return false
    return new Date(p.date_promise) < new Date() && !['pret', 'livre'].includes(p.status)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Monitor className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-3xl font-black">ATELIER</h1>
            <p className="text-gray-400 text-sm">Tableau de bord temps réel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={toggleFullscreen} className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-sm">
            {isFullscreen ? 'Quitter plein écran' : 'Mode kiosk'}
          </button>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-orange-500">
              {heure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-gray-400">
              {heure.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        {[
          { label: 'En cours', value: stats.enCours, icon: Package, color: 'text-blue-400', bg: 'from-blue-500/20' },
          { label: 'Cuisson', value: stats.cuisson, icon: Flame, color: 'text-orange-400', bg: 'from-orange-500/20' },
          { label: 'Contrôle QC', value: stats.qc, icon: CheckCircle, color: 'text-yellow-400', bg: 'from-yellow-500/20' },
          { label: 'Prêts', value: stats.prets, icon: CheckCircle, color: 'text-green-400', bg: 'from-green-500/20' },
          { label: 'Livrés (jour)', value: stats.livres, icon: TrendingUp, color: 'text-purple-400', bg: 'from-purple-500/20' },
          { label: 'En retard', value: stats.retards, icon: AlertTriangle, color: stats.retards > 0 ? 'text-red-400' : 'text-gray-500', bg: stats.retards > 0 ? 'from-red-500/20' : 'from-gray-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`bg-gradient-to-br ${bg} to-transparent rounded-2xl p-4 border border-gray-800`}>
            <Icon className={`w-6 h-6 ${color} mb-2`} />
            <div className={`text-4xl font-black ${color}`}>{value}</div>
            <div className="text-sm text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Liste projets */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold">Projets en production</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {projets.map(p => {
            const conf = statusConfig[p.status] || statusConfig.en_cours
            const retard = isEnRetard(p)
            return (
              <div key={p.id} className={`px-6 py-4 flex items-center gap-4 ${retard ? 'bg-red-950/30' : 'hover:bg-gray-800/50'} transition-colors`}>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${conf.bg} ${conf.color}`}>
                  {conf.label}
                </div>
                <div className="font-mono font-bold text-lg flex-shrink-0 w-40">{p.numero}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name || '-'}</div>
                  <div className="text-sm text-gray-500">{(p.clients as any)?.full_name}</div>
                </div>
                <div className="text-sm text-gray-400 text-right flex-shrink-0">
                  {(p.poudres as any)?.reference} {(p.poudres as any)?.ral ? `RAL ${(p.poudres as any).ral}` : ''}
                </div>
                {retard && (
                  <div className="flex items-center gap-1 text-red-400 text-sm font-bold flex-shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                    RETARD
                  </div>
                )}
                {p.date_promise && !retard && (
                  <div className="text-sm text-gray-500 flex-shrink-0">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(p.date_promise).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </div>
                )}
              </div>
            )
          })}
          {projets.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">Aucun projet en cours</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
