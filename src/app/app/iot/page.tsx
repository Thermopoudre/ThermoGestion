'use client'

import { useState } from 'react'
import { 
  Cpu, Thermometer, Scale, Wind, Wifi, WifiOff,
  Activity, AlertTriangle, Settings, Clock, 
  TrendingUp, BarChart3, Zap
} from 'lucide-react'

interface Machine {
  id: string
  nom: string
  type: 'four' | 'balance' | 'cabine' | 'compresseur' | 'convoyeur'
  statut: 'connecte' | 'deconnecte' | 'erreur'
  derniere_donnee: string
  valeur_actuelle: string | number
  unite: string
  seuil_alerte?: number
  historique: { time: string; value: number }[]
}

// Données de démonstration pour l'interface IoT
const DEMO_MACHINES: Machine[] = [
  {
    id: '1',
    nom: 'Four principal',
    type: 'four',
    statut: 'connecte',
    derniere_donnee: new Date().toISOString(),
    valeur_actuelle: 192,
    unite: '°C',
    seuil_alerte: 250,
    historique: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}h`,
      value: 180 + Math.random() * 20,
    })),
  },
  {
    id: '2',
    nom: 'Balance poudre',
    type: 'balance',
    statut: 'connecte',
    derniere_donnee: new Date().toISOString(),
    valeur_actuelle: 23.450,
    unite: 'kg',
    historique: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}h`,
      value: 20 + Math.random() * 10,
    })),
  },
  {
    id: '3',
    nom: 'Cabine de poudrage',
    type: 'cabine',
    statut: 'connecte',
    derniere_donnee: new Date().toISOString(),
    valeur_actuelle: 65,
    unite: '% extraction',
    seuil_alerte: 50,
    historique: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}h`,
      value: 55 + Math.random() * 20,
    })),
  },
  {
    id: '4',
    nom: 'Compresseur',
    type: 'compresseur',
    statut: 'deconnecte',
    derniere_donnee: new Date(Date.now() - 3600000).toISOString(),
    valeur_actuelle: 0,
    unite: 'bar',
    seuil_alerte: 4,
    historique: [],
  },
  {
    id: '5',
    nom: 'Convoyeur',
    type: 'convoyeur',
    statut: 'erreur',
    derniere_donnee: new Date(Date.now() - 7200000).toISOString(),
    valeur_actuelle: 'Arrêt',
    unite: '',
    historique: [],
  },
]

const typeConfig: Record<string, { icon: any; color: string }> = {
  four: { icon: Thermometer, color: 'text-red-500' },
  balance: { icon: Scale, color: 'text-blue-500' },
  cabine: { icon: Wind, color: 'text-purple-500' },
  compresseur: { icon: Zap, color: 'text-yellow-500' },
  convoyeur: { icon: Activity, color: 'text-green-500' },
}

const statutConfig: Record<string, { label: string; color: string; icon: any }> = {
  connecte: { label: 'Connecté', color: 'bg-green-100 text-green-700', icon: Wifi },
  deconnecte: { label: 'Déconnecté', color: 'bg-gray-100 text-gray-500', icon: WifiOff },
  erreur: { label: 'Erreur', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
}

export default function IoTPage() {
  const [machines] = useState<Machine[]>(DEMO_MACHINES)
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)

  const stats = {
    connectees: machines.filter(m => m.statut === 'connecte').length,
    deconnectees: machines.filter(m => m.statut === 'deconnecte').length,
    erreurs: machines.filter(m => m.statut === 'erreur').length,
    total: machines.length,
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Cpu className="w-8 h-8 text-orange-500" />
            Machines IoT
          </h1>
          <p className="text-gray-500 mt-1">Supervision temps réel de vos équipements connectés</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <Wifi className="w-4 h-4 inline mr-1" />
            {stats.connectees}/{stats.total} connectés
          </span>
          {stats.erreurs > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {stats.erreurs} erreur{stats.erreurs > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Cpu className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500">Machines configurées</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Wifi className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.connectees}</p>
          <p className="text-sm text-gray-500">Connectées</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Thermometer className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {machines.find(m => m.type === 'four')?.valeur_actuelle || '-'}°C
          </p>
          <p className="text-sm text-gray-500">Temp. four</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Scale className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {machines.find(m => m.type === 'balance')?.valeur_actuelle || '-'} kg
          </p>
          <p className="text-sm text-gray-500">Balance poudre</p>
        </div>
      </div>

      {/* Grille machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {machines.map(machine => {
          const config = typeConfig[machine.type] || typeConfig.four
          const MachineIcon = config.icon
          const statut = statutConfig[machine.statut]
          const StatutIcon = statut.icon

          return (
            <div
              key={machine.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow ${
                machine.statut === 'erreur' ? 'ring-2 ring-red-500' : ''
              }`}
              onClick={() => setSelectedMachine(machine)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                      <MachineIcon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{machine.nom}</p>
                      <p className="text-xs text-gray-500 capitalize">{machine.type}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statut.color}`}>
                    <StatutIcon className="w-3 h-3" />
                    {statut.label}
                  </span>
                </div>

                {/* Valeur actuelle */}
                <div className="text-center py-4">
                  <p className="text-4xl font-black text-gray-900 dark:text-white">
                    {machine.valeur_actuelle}
                  </p>
                  <p className="text-sm text-gray-500">{machine.unite}</p>
                </div>

                {/* Mini graphique (barres simples) */}
                {machine.historique.length > 0 && (
                  <div className="flex items-end gap-[2px] h-12 mt-2">
                    {machine.historique.slice(-24).map((h, i) => {
                      const max = Math.max(...machine.historique.map(x => x.value))
                      const min = Math.min(...machine.historique.map(x => x.value))
                      const range = max - min || 1
                      const pct = ((h.value - min) / range) * 100
                      return (
                        <div 
                          key={i} 
                          className={`flex-1 rounded-t ${machine.statut === 'erreur' ? 'bg-red-400' : 'bg-orange-400'}`}
                          style={{ height: `${Math.max(pct, 5)}%` }}
                        />
                      )
                    })}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Dernière donnée: {new Date(machine.derniere_donnee).toLocaleTimeString('fr-FR')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Configuration */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configuration IoT</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connectez vos équipements via MQTT, API REST ou webhook. ThermoGestion supporte les protocoles industriels standards.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">MQTT</h4>
            <p className="text-sm text-gray-500">Protocole temps réel pour capteurs industriels</p>
            <code className="text-xs text-blue-600 block mt-2">mqtt://iot.thermogestion.fr:1883</code>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">API REST</h4>
            <p className="text-sm text-gray-500">Envoi de données via HTTP POST</p>
            <code className="text-xs text-blue-600 block mt-2">POST /api/v1/iot/data</code>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">Webhook</h4>
            <p className="text-sm text-gray-500">Alertes et événements en temps réel</p>
            <code className="text-xs text-blue-600 block mt-2">POST /api/webhooks/iot</code>
          </div>
        </div>
      </div>

      {/* Modal détail machine */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedMachine(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{selectedMachine.nom}</h2>
              <p className="text-sm text-gray-500 capitalize">{selectedMachine.type}</p>
            </div>
            <div className="p-6">
              <div className="text-center py-6">
                <p className="text-6xl font-black text-gray-900 dark:text-white">
                  {selectedMachine.valeur_actuelle}
                </p>
                <p className="text-lg text-gray-500">{selectedMachine.unite}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Statut</p>
                  <p className="font-bold text-gray-900 dark:text-white capitalize">{selectedMachine.statut}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Dernière donnée</p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {new Date(selectedMachine.derniere_donnee).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              </div>
              {selectedMachine.seuil_alerte && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Seuil d'alerte configuré : {selectedMachine.seuil_alerte} {selectedMachine.unite}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-700 flex justify-end rounded-b-2xl">
              <button onClick={() => setSelectedMachine(null)} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
