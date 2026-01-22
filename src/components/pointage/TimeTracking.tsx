'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Square, Clock, User, Calendar, BarChart2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Pointage {
  id: string
  projet_id: string
  user_id: string
  etape: string
  date_debut: string
  date_fin?: string
  duree_minutes?: number
  pause_minutes: number
  notes?: string
  user?: {
    full_name: string
  }
}

interface TimeTrackingProps {
  projetId: string
  projetNumero: string
  atelierId: string
  userId: string
  userName: string
  pointages?: Pointage[]
  onUpdate: () => void
}

const etapes = [
  { id: 'preparation', label: 'Préparation', color: 'bg-yellow-500' },
  { id: 'sablage', label: 'Sablage', color: 'bg-orange-500' },
  { id: 'poudrage', label: 'Poudrage', color: 'bg-blue-500' },
  { id: 'cuisson', label: 'Cuisson', color: 'bg-red-500' },
  { id: 'controle', label: 'Contrôle', color: 'bg-green-500' },
  { id: 'emballage', label: 'Emballage', color: 'bg-purple-500' }
]

export default function TimeTracking({ projetId, projetNumero, atelierId, userId, userName, pointages = [], onUpdate }: TimeTrackingProps) {
  const supabase = createClientComponentClient()
  const [activePointage, setActivePointage] = useState<Pointage | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedEtape, setSelectedEtape] = useState('preparation')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Trouver un pointage actif (sans date_fin)
  useEffect(() => {
    const active = pointages.find(p => !p.date_fin && p.user_id === userId)
    if (active) {
      setActivePointage(active)
      setSelectedEtape(active.etape)
    }
  }, [pointages, userId])

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (activePointage) {
      const startTime = new Date(activePointage.date_debut).getTime()
      
      interval = setInterval(() => {
        const now = Date.now()
        const elapsed = Math.floor((now - startTime) / 1000)
        setElapsedTime(elapsed)
      }, 1000)
    } else {
      setElapsedTime(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activePointage])

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
    }
    return `${minutes}m ${secs.toString().padStart(2, '0')}s`
  }

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const startTimer = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pointages')
        .insert({
          atelier_id: atelierId,
          projet_id: projetId,
          user_id: userId,
          etape: selectedEtape,
          date_debut: new Date().toISOString(),
          pause_minutes: 0
        })
        .select()
        .single()

      if (error) throw error
      setActivePointage(data)
      onUpdate()
    } catch (error) {
      console.error('Error starting timer:', error)
    }
    setLoading(false)
  }

  const stopTimer = async () => {
    if (!activePointage) return
    
    setLoading(true)
    try {
      const dateFin = new Date()
      const dateDebut = new Date(activePointage.date_debut)
      const dureeMinutes = Math.floor((dateFin.getTime() - dateDebut.getTime()) / 60000) - (activePointage.pause_minutes || 0)

      await supabase
        .from('pointages')
        .update({
          date_fin: dateFin.toISOString(),
          duree_minutes: dureeMinutes,
          notes
        })
        .eq('id', activePointage.id)

      // Mettre à jour le temps total du projet
      const totalMinutes = pointages
        .filter(p => p.date_fin)
        .reduce((sum, p) => sum + (p.duree_minutes || 0), 0) + dureeMinutes

      await supabase
        .from('projets')
        .update({ temps_reel_min: totalMinutes })
        .eq('id', projetId)

      setActivePointage(null)
      setNotes('')
      onUpdate()
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
    setLoading(false)
  }

  // Stats par étape
  const statsByEtape = etapes.map(etape => {
    const etapePointages = pointages.filter(p => p.etape === etape.id && p.date_fin)
    const totalMinutes = etapePointages.reduce((sum, p) => sum + (p.duree_minutes || 0), 0)
    return {
      ...etape,
      totalMinutes,
      count: etapePointages.length
    }
  })

  const totalTime = pointages
    .filter(p => p.date_fin)
    .reduce((sum, p) => sum + (p.duree_minutes || 0), 0)

  return (
    <div className="space-y-6">
      {/* Timer actif */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Pointage - {projetNumero}
          </h3>
        </div>

        <div className="p-6">
          {activePointage ? (
            // Timer en cours
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                En cours : {etapes.find(e => e.id === activePointage.etape)?.label}
              </div>
              
              <div className="text-5xl font-mono font-bold text-gray-900 dark:text-white mb-6">
                {formatDuration(elapsedTime)}
              </div>

              <div className="flex items-center justify-center gap-2 mb-6">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{userName}</span>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={2}
                  placeholder="Notes sur le travail effectué..."
                />
              </div>

              <button
                onClick={stopTimer}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Square className="w-5 h-5" />
                Arrêter le pointage
              </button>
            </div>
          ) : (
            // Sélection d'étape et démarrage
            <div>
              <label className="block text-sm font-medium mb-3">Sélectionnez l'étape</label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {etapes.map((etape) => (
                  <button
                    key={etape.id}
                    onClick={() => setSelectedEtape(etape.id)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all ${
                      selectedEtape === etape.id
                        ? `${etape.color} text-white shadow-lg scale-105`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {etape.label}
                  </button>
                ))}
              </div>

              <button
                onClick={startTimer}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-lg"
              >
                <Play className="w-6 h-6" />
                Démarrer le pointage
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats par étape */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-purple-600" />
          Temps par étape
        </h4>
        
        <div className="space-y-3">
          {statsByEtape.map((stat) => (
            <div key={stat.id} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${stat.color}`} />
              <span className="flex-1 text-sm">{stat.label}</span>
              <span className="text-sm font-medium">
                {stat.totalMinutes > 0 ? formatMinutes(stat.totalMinutes) : '-'}
              </span>
            </div>
          ))}
          
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="font-bold text-lg">{formatMinutes(totalTime)}</span>
          </div>
        </div>
      </div>

      {/* Historique des pointages */}
      {pointages.filter(p => p.date_fin).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              Historique
            </h4>
          </div>
          
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {pointages
              .filter(p => p.date_fin)
              .sort((a, b) => new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime())
              .slice(0, 10)
              .map((pointage) => {
                const etape = etapes.find(e => e.id === pointage.etape)
                return (
                  <div key={pointage.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${etape?.color || 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">{etape?.label}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(pointage.date_debut).toLocaleDateString('fr-FR')} à{' '}
                          {new Date(pointage.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {pointage.duree_minutes ? formatMinutes(pointage.duree_minutes) : '-'}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
