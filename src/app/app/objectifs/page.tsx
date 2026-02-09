'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Target, TrendingUp, Award, Flame, BarChart3 } from 'lucide-react'

interface Objectif {
  m2_traites: number
  pieces_traitees: number
  series_terminees: number
  projets_livres: number
}

export default function ObjectifsPage() {
  const supabase = createBrowserClient()
  const [objectifs, setObjectifs] = useState<{ m2: number; pieces: number; series: number }>({ m2: 50, pieces: 30, series: 5 })
  const [realise, setRealise] = useState<Objectif>({ m2_traites: 0, pieces_traitees: 0, series_terminees: 0, projets_livres: 0 })
  const [historique, setHistorique] = useState<(Objectif & { date: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const today = new Date().toISOString().split('T')[0]
      
      // Charger objectifs atelier
      const { data: atelierData } = await supabase
        .from('ateliers')
        .select('objectif_m2_jour, objectif_pieces_jour, objectif_series_jour')
        .limit(1)
        .single()
      
      if (atelierData) {
        setObjectifs({
          m2: atelierData.objectif_m2_jour || 50,
          pieces: atelierData.objectif_pieces_jour || 30,
          series: atelierData.objectif_series_jour || 5,
        })
      }

      // Charger données réalisées aujourd'hui
      const { data: objData } = await supabase
        .from('objectifs_journaliers')
        .select('*')
        .eq('date', today)
        .single()

      if (objData) {
        setRealise(objData)
      } else {
        // Calculer depuis les projets
        const { count: livresAujourdHui } = await supabase
          .from('projets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'livre')
          .gte('updated_at', today)
        
        setRealise(prev => ({ ...prev, projets_livres: livresAujourdHui || 0 }))
      }

      // Historique 7 jours
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data: histData } = await supabase
        .from('objectifs_journaliers')
        .select('*')
        .gte('date', weekAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
      
      if (histData) setHistorique(histData as any)
      setLoading(false)
    }
    loadData()
  }, [])

  const pctM2 = objectifs.m2 > 0 ? Math.min(100, (realise.m2_traites / objectifs.m2) * 100) : 0
  const pctPieces = objectifs.pieces > 0 ? Math.min(100, (realise.pieces_traitees / objectifs.pieces) * 100) : 0
  const pctSeries = objectifs.series > 0 ? Math.min(100, (realise.series_terminees / objectifs.series) * 100) : 0

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
    return (
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000 flex items-center justify-end pr-2`} style={{ width: `${Math.max(pct, 5)}%` }}>
          <span className="text-xs font-bold text-white">{pct.toFixed(0)}%</span>
        </div>
      </div>
    )
  }

  const allComplete = pctM2 >= 100 && pctPieces >= 100 && pctSeries >= 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-7 h-7 text-orange-500" />
            Objectifs journaliers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Badge accomplissement */}
      {allComplete && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-center text-white">
          <Award className="w-16 h-16 mx-auto mb-3" />
          <h2 className="text-2xl font-black">Objectifs atteints !</h2>
          <p className="text-yellow-100">Tous les objectifs du jour sont remplis. Excellent travail !</p>
        </div>
      )}

      {/* Objectifs du jour */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> Surface traitée
            </h3>
            <span className="text-sm text-gray-500">Objectif: {objectifs.m2} m²</span>
          </div>
          <div className="text-4xl font-black text-blue-600 mb-3">{realise.m2_traites} m²</div>
          <ProgressBar value={realise.m2_traites} max={objectifs.m2} color="bg-blue-500" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Pièces traitées
            </h3>
            <span className="text-sm text-gray-500">Objectif: {objectifs.pieces}</span>
          </div>
          <div className="text-4xl font-black text-orange-600 mb-3">{realise.pieces_traitees}</div>
          <ProgressBar value={realise.pieces_traitees} max={objectifs.pieces} color="bg-orange-500" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" /> Séries terminées
            </h3>
            <span className="text-sm text-gray-500">Objectif: {objectifs.series}</span>
          </div>
          <div className="text-4xl font-black text-green-600 mb-3">{realise.series_terminees}</div>
          <ProgressBar value={realise.series_terminees} max={objectifs.series} color="bg-green-500" />
        </div>
      </div>

      {/* Projets livrés */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <h3 className="font-bold text-purple-800 dark:text-purple-300 mb-1">Projets livrés aujourd&apos;hui</h3>
        <div className="text-3xl font-black text-purple-600">{realise.projets_livres}</div>
      </div>

      {/* Historique 7 jours */}
      {historique.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-bold">Historique (7 derniers jours)</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">m² traités</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Pièces</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Séries</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Livrés</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {historique.map(h => (
                <tr key={h.date}>
                  <td className="px-4 py-2 text-sm">{new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-2 text-center font-mono">{h.m2_traites}</td>
                  <td className="px-4 py-2 text-center font-mono">{h.pieces_traitees}</td>
                  <td className="px-4 py-2 text-center font-mono">{h.series_terminees}</td>
                  <td className="px-4 py-2 text-center font-mono">{h.projets_livres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
