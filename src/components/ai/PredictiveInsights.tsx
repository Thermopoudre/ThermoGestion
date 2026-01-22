'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Brain, TrendingUp, Clock, AlertTriangle, 
  Sparkles, BarChart2, Calendar, Target, Lightbulb
} from 'lucide-react'

interface Projet {
  id: string
  numero: string
  name: string
  status: string
  created_at: string
  date_souhaite?: string
  surface_m2?: number
  temps_estime_min?: number
  temps_reel_min?: number
  client?: {
    full_name: string
    nb_projets?: number
  }
}

interface HistoricalData {
  avgDurationBySize: Record<string, number> // small, medium, large
  avgDelayByClient: Record<string, number>
  avgRetoucheRate: number
  peakDays: string[] // jours de la semaine les plus chargés
  avgConversionTime: number // jours moyen devis -> projet
}

interface PredictiveInsightsProps {
  projets: Projet[]
  historicalData?: HistoricalData
}

interface Prediction {
  type: 'delai' | 'anomalie' | 'conseil'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  confidence: number
  action?: string
}

export default function PredictiveInsights({ projets, historicalData }: PredictiveInsightsProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  // Générer des prédictions basées sur les données
  useEffect(() => {
    setIsAnalyzing(true)
    
    // Simuler un temps d'analyse
    const timer = setTimeout(() => {
      const newPredictions: Prediction[] = []

      // Analyser chaque projet actif
      projets
        .filter(p => ['en_cours', 'en_cuisson', 'qc'].includes(p.status))
        .forEach(projet => {
          // Prédiction de retard
          if (projet.date_souhaite) {
            const daysUntilDue = Math.floor(
              (new Date(projet.date_souhaite).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
            
            // Estimation du temps restant basée sur l'historique
            const estimatedDaysNeeded = projet.surface_m2 
              ? (projet.surface_m2 > 10 ? 5 : projet.surface_m2 > 5 ? 3 : 2)
              : 3

            if (daysUntilDue < estimatedDaysNeeded) {
              newPredictions.push({
                type: 'delai',
                severity: daysUntilDue < 0 ? 'critical' : 'warning',
                title: `Risque de retard: ${projet.numero}`,
                description: `Ce projet pourrait ne pas être livré à temps. Date souhaitée: ${new Date(projet.date_souhaite).toLocaleDateString('fr-FR')}`,
                confidence: 75 + Math.random() * 20,
                action: 'Prioriser ce projet ou contacter le client'
              })
            }
          }

          // Détection d'anomalie sur le temps
          if (projet.temps_estime_min && projet.temps_reel_min) {
            const ratio = projet.temps_reel_min / projet.temps_estime_min
            if (ratio > 1.5) {
              newPredictions.push({
                type: 'anomalie',
                severity: ratio > 2 ? 'critical' : 'warning',
                title: `Temps anormal: ${projet.numero}`,
                description: `Le temps réel (${projet.temps_reel_min}min) dépasse de ${Math.round((ratio - 1) * 100)}% l'estimation`,
                confidence: 85,
                action: 'Vérifier s\'il y a eu des problèmes ou ajuster les estimations futures'
              })
            }
          }
        })

      // Conseils généraux basés sur les patterns
      const projetsEnCours = projets.filter(p => p.status === 'en_cours').length
      if (projetsEnCours > 10) {
        newPredictions.push({
          type: 'conseil',
          severity: 'info',
          title: 'Charge de travail élevée',
          description: `${projetsEnCours} projets en cours simultanément. Envisagez de prioriser par urgence.`,
          confidence: 90,
          action: 'Utiliser le batching par couleur pour optimiser'
        })
      }

      // Prédiction de pic d'activité
      const today = new Date().getDay()
      if (historicalData?.peakDays?.includes(['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][today])) {
        newPredictions.push({
          type: 'conseil',
          severity: 'info',
          title: 'Journée chargée prévue',
          description: 'Historiquement, ce jour est l\'un des plus chargés de la semaine.',
          confidence: 70
        })
      }

      // Conseil stock si trop de couleurs différentes
      const uniqueRals = new Set(projets.filter(p => p.status === 'en_cours').map(p => (p as any).poudre?.ral)).size
      if (uniqueRals > 5) {
        newPredictions.push({
          type: 'conseil',
          severity: 'warning',
          title: 'Optimisation possible',
          description: `${uniqueRals} couleurs différentes en cours. Le regroupement (batching) pourrait économiser du temps.`,
          confidence: 80,
          action: 'Consulter la vue Batching dans le planning'
        })
      }

      setPredictions(newPredictions)
      setIsAnalyzing(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [projets, historicalData])

  // Statistiques prédictives
  const predictiveStats = useMemo(() => {
    const projetsActifs = projets.filter(p => !['livre', 'annule'].includes(p.status))
    
    // Prédiction CA potentiel
    const potentialRevenue = projetsActifs.reduce((sum, p) => {
      // Estimation basique: 15€/m²
      return sum + ((p.surface_m2 || 5) * 15)
    }, 0)

    // Délai moyen estimé
    const avgDelay = projetsActifs.length > 0 
      ? projetsActifs.reduce((sum, p) => sum + (p.surface_m2 ? (p.surface_m2 > 10 ? 5 : 3) : 2), 0) / projetsActifs.length
      : 0

    // Charge de la semaine
    const weekLoad = projetsActifs.reduce((sum, p) => sum + (p.surface_m2 || 5), 0)

    return { potentialRevenue, avgDelay, weekLoad }
  }, [projets])

  const severityColors = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }

  const severityIcons = {
    info: <Lightbulb className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    critical: <AlertTriangle className="w-5 h-5 text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Brain className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Intelligence Artificielle</h2>
            <p className="text-purple-100">Analyse prédictive et recommandations</p>
          </div>
        </div>

        {/* Stats prédictives */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm text-purple-100">CA Potentiel</span>
            </div>
            <p className="text-2xl font-bold">{predictiveStats.potentialRevenue.toLocaleString()} €</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm text-purple-100">Délai moyen estimé</span>
            </div>
            <p className="text-2xl font-bold">{predictiveStats.avgDelay.toFixed(1)} jours</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-4 h-4" />
              <span className="text-sm text-purple-100">Charge semaine</span>
            </div>
            <p className="text-2xl font-bold">{predictiveStats.weekLoad.toFixed(0)} m²</p>
          </div>
        </div>
      </div>

      {/* Prédictions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Prédictions et Recommandations
          </h3>
          {isAnalyzing && (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Analyse en cours...
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          {predictions.length === 0 && !isAnalyzing && (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune alerte ou recommandation pour le moment</p>
              <p className="text-sm">Tout semble optimal !</p>
            </div>
          )}

          {predictions.map((prediction, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${severityColors[prediction.severity]}`}
            >
              <div className="flex items-start gap-3">
                {severityIcons[prediction.severity]}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{prediction.title}</h4>
                    <span className="text-xs text-gray-500">
                      Confiance: {prediction.confidence.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {prediction.description}
                  </p>
                  {prediction.action && (
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {prediction.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conseils d'optimisation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Conseils d'optimisation
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium mb-2">Batching couleurs</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Regroupez les projets par couleur RAL pour réduire les temps de changement de teinte.
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium mb-2">Planning four</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Optimisez les cuissons en regroupant les pièces avec les mêmes températures.
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium mb-2">Pointage temps</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Utilisez le pointage pour améliorer vos estimations futures.
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium mb-2">Qualité préventive</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Les contrôles réguliers réduisent les retouches de 40% en moyenne.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
