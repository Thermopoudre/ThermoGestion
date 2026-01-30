'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Calendar, AlertTriangle, TrendingUp, Package, Clock } from 'lucide-react'

interface DayLoad {
  date: string
  nbProjets: number
  surfaceM2: number
  capaciteMax: number
  tauxCharge: number
  projets: Array<{
    id: string
    numero: string
    name: string
    surface_m2: number
    client_name: string
  }>
}

export default function CapacityPlanning() {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [capaciteJour, setCapaciteJour] = useState(50) // m²/jour par défaut
  const [weekData, setWeekData] = useState<DayLoad[]>([])

  // Calculer les dates de la semaine
  const weekDates = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7)) // Lundi
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      return d
    })
  }, [weekOffset])

  useEffect(() => {
    loadData()
  }, [weekDates])

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger la capacité de l'atelier
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('atelier_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const { data: atelierData } = await supabase
        .from('ateliers')
        .select('capacite_m2_jour')
        .eq('id', userData.atelier_id)
        .single()

      if (atelierData?.capacite_m2_jour) {
        setCapaciteJour(atelierData.capacite_m2_jour)
      }

      // Charger les projets de la semaine
      const startDate = weekDates[0].toISOString().split('T')[0]
      const endDate = weekDates[6].toISOString().split('T')[0]

      const { data: projets } = await supabase
        .from('projets')
        .select(`
          id,
          numero,
          name,
          surface_m2,
          date_promise,
          date_depot,
          status,
          clients (full_name)
        `)
        .eq('atelier_id', userData.atelier_id)
        .in('status', ['devis', 'en_cours', 'en_cuisson', 'qc'])
        .or(`date_promise.gte.${startDate},date_promise.lte.${endDate}`)

      // Organiser par jour
      const dayMap = new Map<string, DayLoad>()
      
      weekDates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0]
        dayMap.set(dateStr, {
          date: dateStr,
          nbProjets: 0,
          surfaceM2: 0,
          capaciteMax: capaciteJour,
          tauxCharge: 0,
          projets: [],
        })
      })

      (projets || []).forEach(projet => {
        const datePromise = projet.date_promise || projet.date_depot
        if (!datePromise) return
        
        const dateStr = new Date(datePromise).toISOString().split('T')[0]
        const dayData = dayMap.get(dateStr)
        
        if (dayData) {
          dayData.nbProjets++
          dayData.surfaceM2 += projet.surface_m2 || 5
          dayData.projets.push({
            id: projet.id,
            numero: projet.numero,
            name: projet.name,
            surface_m2: projet.surface_m2 || 5,
            client_name: (projet.clients as any)?.full_name || 'Client',
          })
        }
      })

      // Calculer les taux de charge
      dayMap.forEach(day => {
        day.tauxCharge = (day.surfaceM2 / day.capaciteMax) * 100
      })

      setWeekData(Array.from(dayMap.values()))
    } catch (error) {
      console.error('Erreur chargement planning:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChargeColor = (taux: number) => {
    if (taux > 100) return 'bg-red-500'
    if (taux > 80) return 'bg-orange-500'
    if (taux > 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getChargeBgColor = (taux: number) => {
    if (taux > 100) return 'bg-red-50 dark:bg-red-900/20 border-red-200'
    if (taux > 80) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200'
    return 'bg-white dark:bg-gray-800 border-gray-200'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const isToday = (dateStr: string) => {
    return dateStr === new Date().toISOString().split('T')[0]
  }

  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay()
    return day === 0 || day === 6
  }

  // Stats semaine
  const weekStats = useMemo(() => {
    const workDays = weekData.filter(d => !isWeekend(d.date))
    const totalSurface = workDays.reduce((sum, d) => sum + d.surfaceM2, 0)
    const totalCapacite = workDays.reduce((sum, d) => sum + d.capaciteMax, 0)
    const overloadDays = workDays.filter(d => d.tauxCharge > 100).length
    
    return {
      totalSurface,
      totalCapacite,
      tauxMoyen: totalCapacite > 0 ? (totalSurface / totalCapacite) * 100 : 0,
      overloadDays,
    }
  }, [weekData])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="grid grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-orange-500" />
          Planning Capacitaire
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Semaine précédente
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
          >
            Cette semaine
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Semaine suivante →
          </button>
        </div>
      </div>

      {/* Stats résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <TrendingUp className="w-6 h-6 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{weekStats.totalSurface.toFixed(0)} m²</p>
          <p className="text-sm text-gray-500">Surface planifiée</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Package className="w-6 h-6 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{weekStats.totalCapacite.toFixed(0)} m²</p>
          <p className="text-sm text-gray-500">Capacité totale</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Clock className="w-6 h-6 text-purple-500 mb-2" />
          <p className={`text-2xl font-bold ${weekStats.tauxMoyen > 100 ? 'text-red-600' : weekStats.tauxMoyen > 80 ? 'text-orange-600' : 'text-green-600'}`}>
            {weekStats.tauxMoyen.toFixed(0)}%
          </p>
          <p className="text-sm text-gray-500">Taux de charge moyen</p>
        </div>
        {weekStats.overloadDays > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200">
            <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-600">{weekStats.overloadDays} jour{weekStats.overloadDays > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-500">En surcharge</p>
          </div>
        )}
      </div>

      {/* Grille semaine */}
      <div className="grid grid-cols-7 gap-3">
        {weekData.map(day => (
          <div
            key={day.date}
            className={`rounded-xl border ${getChargeBgColor(day.tauxCharge)} ${
              isToday(day.date) ? 'ring-2 ring-orange-500' : ''
            } ${isWeekend(day.date) ? 'opacity-50' : ''}`}
          >
            {/* Header jour */}
            <div className={`p-3 border-b ${isToday(day.date) ? 'bg-orange-100 dark:bg-orange-900/30' : ''}`}>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {formatDate(day.date)}
              </p>
              {!isWeekend(day.date) && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getChargeColor(day.tauxCharge)} transition-all`}
                      style={{ width: `${Math.min(day.tauxCharge, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${day.tauxCharge > 100 ? 'text-red-600' : ''}`}>
                    {day.tauxCharge.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Contenu */}
            {!isWeekend(day.date) && (
              <div className="p-3 space-y-2 min-h-[150px] max-h-[200px] overflow-y-auto">
                {day.projets.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Aucun projet</p>
                ) : (
                  day.projets.map(projet => (
                    <div 
                      key={projet.id}
                      className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs"
                    >
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        #{projet.numero}
                      </p>
                      <p className="text-gray-500 truncate">{projet.client_name}</p>
                      <p className="text-orange-500">{projet.surface_m2} m²</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Footer stats */}
            {!isWeekend(day.date) && (
              <div className="p-2 border-t bg-gray-50 dark:bg-gray-700/50 text-xs text-center">
                <span className="font-medium">{day.surfaceM2.toFixed(0)}</span>
                <span className="text-gray-400"> / {day.capaciteMax} m²</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>&lt; 50%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span>50-80%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded" />
          <span>80-100%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>&gt; 100% (surcharge)</span>
        </div>
      </div>
    </div>
  )
}
