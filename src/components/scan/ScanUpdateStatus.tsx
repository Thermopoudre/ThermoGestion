'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScanUpdateStatusProps {
  projet: {
    id: string
    numero: string
    description?: string
    status: string
  }
  client: {
    full_name: string
    email?: string
  } | null
  atelier: {
    name: string
  } | null
}

const STATUSES = [
  { key: 'en_attente', label: 'En attente', icon: '⏳', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { key: 'en_preparation', label: 'En préparation', icon: '📦', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'en_traitement', label: 'En traitement', icon: '🔥', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'sechage', label: 'Séchage', icon: '☀️', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { key: 'controle_qualite', label: 'Contrôle qualité', icon: '🔍', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { key: 'pret', label: 'Prêt', icon: '✅', color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'livre', label: 'Livré', icon: '🎉', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
]

export function ScanUpdateStatus({ projet, client, atelier }: ScanUpdateStatusProps) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState(projet.status)
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStatusIndex = STATUSES.findIndex(s => s.key === currentStatus)

  const updateStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) return

    setLoading(newStatus)
    setError(null)

    try {
      const response = await fetch(`/api/scan/${projet.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          notifyClient: true // Envoyer une notification au client
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la mise à jour')
      }

      setCurrentStatus(newStatus)
      setSuccess(true)

      // Reset success after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(null)
    }
  }

  const currentStatusData = STATUSES.find(s => s.key === currentStatus)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header compact */}
      <header className="bg-black/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <span className="font-bold">{atelier?.name}</span>
        </div>
        <span className="text-sm text-gray-400">Mode Atelier</span>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Info projet */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Projet</p>
            <h1 className="text-3xl font-black mb-2">{projet.numero}</h1>
            {projet.description && (
              <p className="text-gray-300 text-sm">{projet.description}</p>
            )}
            {client && (
              <p className="text-gray-400 text-sm mt-2">
                Client: {client.full_name}
              </p>
            )}
          </div>

          {/* Statut actuel */}
          <div className={`mt-6 p-4 rounded-xl ${currentStatusData?.color} border-2 text-center`}>
            <span className="text-3xl">{currentStatusData?.icon}</span>
            <p className="font-bold text-lg mt-2">{currentStatusData?.label}</p>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-xl mb-6 text-center animate-pulse">
            ✅ Statut mis à jour ! Client notifié.
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-xl mb-6 text-center">
            ❌ {error}
          </div>
        )}

        {/* Boutons de statut */}
        <div className="space-y-3">
          <p className="text-center text-gray-400 text-sm mb-4">
            Appuyez pour changer le statut
          </p>
          
          {STATUSES.map((status, idx) => {
            const isActive = status.key === currentStatus
            const isPast = idx < currentStatusIndex
            const isNext = idx === currentStatusIndex + 1
            const isLoading = loading === status.key

            return (
              <button
                key={status.key}
                onClick={() => updateStatus(status.key)}
                disabled={isLoading || loading !== null}
                className={`
                  w-full p-4 rounded-xl border-2 transition-all
                  flex items-center gap-4
                  ${isActive 
                    ? 'bg-orange-500 border-orange-400 text-white scale-105 shadow-lg shadow-orange-500/30' 
                    : isPast
                    ? 'bg-gray-700/50 border-gray-600 text-gray-400'
                    : isNext
                    ? 'bg-white/10 border-orange-400 text-white hover:bg-orange-500/20'
                    : 'bg-white/5 border-gray-700 text-gray-300 hover:bg-white/10'
                  }
                  ${isLoading ? 'animate-pulse' : ''}
                  disabled:opacity-50
                `}
              >
                <span className="text-3xl">{status.icon}</span>
                <div className="flex-1 text-left">
                  <p className="font-bold text-lg">{status.label}</p>
                  {isActive && <p className="text-sm opacity-80">Statut actuel</p>}
                  {isNext && <p className="text-sm text-orange-300">Étape suivante →</p>}
                </div>
                {isPast && <span className="text-green-400 text-xl">✓</span>}
                {isLoading && <span className="animate-spin text-xl">⏳</span>}
              </button>
            )
          })}
        </div>

        {/* Actions rapides */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="p-4 bg-white/10 rounded-xl text-center hover:bg-white/20 transition-colors"
          >
            <span className="text-2xl block mb-1">🔄</span>
            <span className="text-sm">Rafraîchir</span>
          </button>
          <a 
            href={`/app/projets/${projet.id}`}
            className="p-4 bg-white/10 rounded-xl text-center hover:bg-white/20 transition-colors"
          >
            <span className="text-2xl block mb-1">📋</span>
            <span className="text-sm">Voir détails</span>
          </a>
        </div>

        {/* Hint */}
        <p className="text-center text-gray-500 text-xs mt-8">
          Scan QR code pour un autre projet
        </p>
      </main>
    </div>
  )
}
