'use client'

import { useState, useEffect } from 'react'
import { 
  Clock, CheckCircle2, AlertTriangle, Flame, Package, 
  TrendingUp, Users, RefreshCw, Maximize2, Settings
} from 'lucide-react'

interface Projet {
  id: string
  numero: string
  name: string
  status: string
  client?: {
    full_name: string
  }
  poudre?: {
    ral?: string
    reference: string
  }
  date_souhaite?: string
  priority?: number
}

interface Alert {
  id: string
  type: 'stock' | 'delai' | 'maintenance' | 'qualite'
  message: string
  severity: 'info' | 'warning' | 'critical'
}

interface WorkshopScreenProps {
  projets: Projet[]
  alerts?: Alert[]
  stats?: {
    projetsJour: number
    projetsSemaine: number
    surfaceJour: number
    tauxRetouche: number
  }
  config?: {
    afficher_projets_jour: boolean
    afficher_alertes: boolean
    afficher_stats: boolean
    refresh_interval_sec: number
    theme: 'light' | 'dark'
  }
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  devis: { label: 'Devis', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  en_cours: { label: 'En cours', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  en_cuisson: { label: 'Cuisson', color: 'text-red-600', bgColor: 'bg-red-100' },
  qc: { label: 'Contrôle', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  pret: { label: 'Prêt', color: 'text-green-600', bgColor: 'bg-green-100' },
  livre: { label: 'Livré', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  annule: { label: 'Annulé', color: 'text-red-600', bgColor: 'bg-red-100' }
}

export default function WorkshopScreen({ projets, alerts = [], stats, config }: WorkshopScreenProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Mise à jour de l'heure
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-refresh
  useEffect(() => {
    const interval = (config?.refresh_interval_sec || 30) * 1000
    const refreshTimer = setInterval(() => {
      setLastRefresh(new Date())
      // Trigger a page refresh or data fetch
      window.location.reload()
    }, interval)
    return () => clearInterval(refreshTimer)
  }, [config?.refresh_interval_sec])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Projets du jour triés par priorité/statut
  const projetsActifs = projets
    .filter(p => !['livre', 'annule', 'devis'].includes(p.status))
    .sort((a, b) => {
      // Priorité d'abord, puis par statut
      if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0)
      const statusOrder = ['en_cuisson', 'qc', 'en_cours', 'pret']
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
    })

  // Alertes critiques
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Atelier ThermoGestion</h1>
          <p className="text-gray-400">Tableau de bord temps réel</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-4xl font-mono font-bold">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-gray-400">
              {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Alertes critiques */}
      {criticalAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {criticalAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-red-900/50 border border-red-500 rounded-xl p-4 flex items-center gap-4 animate-pulse"
            >
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <p className="text-lg font-medium">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Stats rapides */}
        {config?.afficher_stats !== false && stats && (
          <div className="col-span-4 grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Projets du jour</p>
                  <p className="text-3xl font-bold">{stats.projetsJour}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Cette semaine</p>
                  <p className="text-3xl font-bold">{stats.projetsSemaine}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Flame className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Surface (m²)</p>
                  <p className="text-3xl font-bold">{stats.surfaceJour}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Taux retouche</p>
                  <p className="text-3xl font-bold">{stats.tauxRetouche}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projets actifs */}
        {config?.afficher_projets_jour !== false && (
          <div className="col-span-3 bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-700/50 flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Projets en cours ({projetsActifs.length})
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4" />
                Maj: {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            
            <div className="divide-y divide-gray-700">
              {projetsActifs.slice(0, 10).map((projet) => {
                const statusInfo = statusConfig[projet.status] || statusConfig.en_cours
                
                return (
                  <div
                    key={projet.id}
                    className="p-4 flex items-center gap-4 hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Indicateur RAL */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold bg-gray-600"
                      style={{
                        backgroundColor: projet.poudre?.ral ? `#${projet.poudre.ral}` : undefined
                      }}
                    >
                      {projet.poudre?.ral || '-'}
                    </div>
                    
                    {/* Infos projet */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg">{projet.numero}</span>
                        {projet.priority && projet.priority > 5 && (
                          <span className="px-2 py-0.5 bg-red-500 text-xs rounded-full">URGENT</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{projet.client?.full_name}</p>
                    </div>
                    
                    {/* Poudre */}
                    <div className="text-right">
                      <p className="text-sm">{projet.poudre?.reference}</p>
                    </div>
                    
                    {/* Statut */}
                    <div className={`px-4 py-2 rounded-lg ${statusInfo.bgColor} ${statusInfo.color} font-medium min-w-[120px] text-center`}>
                      {statusInfo.label}
                    </div>
                  </div>
                )
              })}
              
              {projetsActifs.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">Aucun projet en cours</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alertes et infos */}
        {config?.afficher_alertes !== false && (
          <div className="col-span-1 space-y-4">
            {/* Alertes warning */}
            {warningAlerts.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Alertes
                </h3>
                <div className="space-y-2">
                  {warningAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg text-sm"
                    >
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statuts des projets */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3">Répartition par statut</h3>
              <div className="space-y-2">
                {Object.entries(statusConfig)
                  .filter(([status]) => !['devis', 'livre', 'annule'].includes(status))
                  .map(([status, config]) => {
                    const count = projets.filter(p => p.status === status).length
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className={`text-sm ${config.color}`}>{config.label}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Projets prêts */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Prêts à retirer
              </h3>
              <div className="space-y-2">
                {projets
                  .filter(p => p.status === 'pret')
                  .slice(0, 5)
                  .map((projet) => (
                    <div
                      key={projet.id}
                      className="p-2 bg-green-900/30 border border-green-700/50 rounded-lg"
                    >
                      <p className="font-mono text-sm">{projet.numero}</p>
                      <p className="text-xs text-gray-400">{projet.client?.full_name}</p>
                    </div>
                  ))}
                {projets.filter(p => p.status === 'pret').length === 0 && (
                  <p className="text-sm text-gray-500">Aucun projet prêt</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 flex items-center justify-between text-gray-500 text-sm">
        <p>ThermoGestion - Écran Atelier</p>
        <div className="flex items-center gap-4">
          <span>Actualisation: {config?.refresh_interval_sec || 30}s</span>
          <a href="/app/parametres" className="hover:text-white">
            <Settings className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  )
}
