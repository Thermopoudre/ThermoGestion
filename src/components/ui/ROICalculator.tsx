'use client'

import { useState } from 'react'
import { Calculator, TrendingUp, Clock, Euro } from 'lucide-react'

interface ROIInputs {
  devisParMois: number
  tempsDevisMinutes: number
  tauxHoraire: number
  relancesParMois: number
  tempsRelanceMinutes: number
  erreursPct: number
}

const defaultInputs: ROIInputs = {
  devisParMois: 30,
  tempsDevisMinutes: 45,
  tauxHoraire: 45,
  relancesParMois: 15,
  tempsRelanceMinutes: 15,
  erreursPct: 5,
}

export function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>(defaultInputs)
  const [showResults, setShowResults] = useState(false)

  const prixPro = 49 // €/mois HT

  // Calculs
  const tempsDevisActuelH = (inputs.devisParMois * inputs.tempsDevisMinutes) / 60
  const tempsDevisAvecH = (inputs.devisParMois * 10) / 60 // 10 min par devis avec ThermoGestion
  const tempsRelanceActuelH = (inputs.relancesParMois * inputs.tempsRelanceMinutes) / 60
  const tempsRelanceAvecH = (inputs.relancesParMois * 2) / 60 // 2 min (automatisé)
  const tempsAdminActuelH = tempsDevisActuelH + tempsRelanceActuelH + 8 // 8h/mois de gestion diverse
  const tempsAdminAvecH = tempsDevisAvecH + tempsRelanceAvecH + 2 // 2h/mois avec ThermoGestion

  const heuresEconomisees = Math.max(0, tempsAdminActuelH - tempsAdminAvecH)
  const economieEuros = heuresEconomisees * inputs.tauxHoraire
  const coutErreurs = inputs.devisParMois * (inputs.erreursPct / 100) * inputs.tauxHoraire * 2 // 2h par erreur
  const economieTotale = economieEuros + coutErreurs
  const roi = economieTotale > 0 ? ((economieTotale - prixPro) / prixPro * 100) : 0

  function handleChange(field: keyof ROIInputs, value: number) {
    setInputs(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-7 h-7" />
          <h3 className="text-xl font-bold">Calculateur de ROI</h3>
        </div>
        <p className="opacity-90 text-sm">
          Estimez vos économies mensuelles avec ThermoGestion
        </p>
      </div>

      {/* Inputs */}
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Devis créés par mois
          </label>
          <input
            type="range"
            min={5}
            max={100}
            value={inputs.devisParMois}
            onChange={(e) => handleChange('devisParMois', Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>5</span>
            <span className="font-bold text-orange-500 text-sm">{inputs.devisParMois}</span>
            <span>100</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Temps actuel par devis (minutes)
          </label>
          <input
            type="range"
            min={15}
            max={120}
            step={5}
            value={inputs.tempsDevisMinutes}
            onChange={(e) => handleChange('tempsDevisMinutes', Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>15 min</span>
            <span className="font-bold text-orange-500 text-sm">{inputs.tempsDevisMinutes} min</span>
            <span>120 min</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Votre taux horaire (€/h)
          </label>
          <input
            type="range"
            min={20}
            max={100}
            step={5}
            value={inputs.tauxHoraire}
            onChange={(e) => handleChange('tauxHoraire', Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>20€</span>
            <span className="font-bold text-orange-500 text-sm">{inputs.tauxHoraire}€/h</span>
            <span>100€</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Relances manuelles par mois
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={inputs.relancesParMois}
            onChange={(e) => handleChange('relancesParMois', Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span className="font-bold text-orange-500 text-sm">{inputs.relancesParMois}</span>
            <span>50</span>
          </div>
        </div>

        <button
          onClick={() => setShowResults(true)}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-400 hover:to-red-400 transition-all"
        >
          Calculer mes économies
        </button>
      </div>

      {/* Results */}
      {showResults && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4">Vos économies estimées</h4>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <Clock className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <div className="text-2xl font-black text-blue-600">{Math.round(heuresEconomisees)}h</div>
              <div className="text-xs text-gray-500">économisées/mois</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <Euro className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <div className="text-2xl font-black text-green-600">{Math.round(economieTotale)}€</div>
              <div className="text-xs text-gray-500">économisés/mois</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <TrendingUp className="w-6 h-6 text-orange-500 mx-auto mb-1" />
              <div className="text-2xl font-black text-orange-600">{Math.round(roi)}%</div>
              <div className="text-xs text-gray-500">ROI mensuel</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <Calculator className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <div className="text-2xl font-black text-purple-600">{Math.round(economieTotale * 12)}€</div>
              <div className="text-xs text-gray-500">économisés/an</div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
            <p className="text-green-800 dark:text-green-300 text-sm font-medium">
              Pour seulement <strong>{prixPro}€/mois</strong>, vous économisez{' '}
              <strong>{Math.round(economieTotale)}€/mois</strong> soit{' '}
              <strong>{Math.round(economieTotale / prixPro)}x</strong> le prix de l&apos;abonnement.
            </p>
          </div>

          <div className="mt-4 text-center">
            <a
              href="/auth/inscription"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-400 hover:to-red-400 transition-all"
            >
              Essai gratuit 30 jours
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
