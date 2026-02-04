'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  QrCode, Package, CheckCircle, Clock, Flame,
  RefreshCw, Volume2, VolumeX, Maximize2, ChevronRight
} from 'lucide-react'

interface Projet {
  id: string
  numero: string
  description: string
  status: string
  client: { full_name: string } | null
  poudre: { nom: string; code_ral: string } | null
  date_livraison_prevue: string | null
  pieces_count: number
}

const statusConfig = {
  recu: { label: 'À traiter', color: 'bg-blue-500', icon: Package },
  en_preparation: { label: 'Préparation', color: 'bg-yellow-500', icon: Clock },
  en_cours: { label: 'En four', color: 'bg-orange-500', icon: Flame },
  termine: { label: 'Prêt', color: 'bg-green-500', icon: CheckCircle },
}

export default function AtelierPage() {
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    loadProjets()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadProjets()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Listen for barcode scanner input
  useEffect(() => {
    let buffer = ''
    let timeout: NodeJS.Timeout

    function handleKeyPress(e: KeyboardEvent) {
      // Barcode scanners typically send Enter at the end
      if (e.key === 'Enter' && buffer.length > 0) {
        handleScan(buffer)
        buffer = ''
        return
      }
      
      // Accumulate characters
      buffer += e.key
      
      // Clear buffer after 100ms of no input
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        buffer = ''
      }, 100)
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [projets])

  async function loadProjets() {
    const supabase = createBrowserClient()
    
    const { data } = await supabase
      .from('projets')
      .select(`
        id, numero, description, status, date_livraison_prevue, pieces_count,
        client:clients(full_name),
        poudre:poudres(nom, code_ral)
      `)
      .in('status', ['recu', 'en_preparation', 'en_cours', 'termine'])
      .order('date_livraison_prevue', { ascending: true })

    if (data) {
      setProjets(data as Projet[])
    }
    setLastUpdate(new Date())
    setLoading(false)
  }

  async function handleScan(code: string) {
    // Find project by numero or ID
    const projet = projets.find(p => 
      p.numero === code || p.id === code || p.numero.includes(code)
    )

    if (projet) {
      setSelectedProjet(projet)
      if (soundEnabled) {
        playSound('success')
      }
    } else {
      if (soundEnabled) {
        playSound('error')
      }
    }
  }

  async function updateStatus(projetId: string, newStatus: string) {
    const supabase = createBrowserClient()
    
    await supabase
      .from('projets')
      .update({ status: newStatus })
      .eq('id', projetId)

    setProjets(projets.map(p => 
      p.id === projetId ? { ...p, status: newStatus } : p
    ))

    if (soundEnabled) {
      playSound('success')
    }

    setSelectedProjet(null)
  }

  function playSound(type: 'success' | 'error') {
    // Simple beep using Web Audio API
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.frequency.value = type === 'success' ? 800 : 300
    gain.gain.value = 0.3
    
    osc.start()
    setTimeout(() => osc.stop(), 150)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-orange-500">MODE ATELIER</h1>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4" />
            <span>Mis à jour : {lastUpdate.toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg ${soundEnabled ? 'bg-green-600' : 'bg-gray-700'}`}
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
          <button
            onClick={loadProjets}
            className="px-4 py-2 bg-orange-500 rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 p-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = projets.filter(p => p.status === status).length
          const Icon = config.icon
          return (
            <div key={status} className={`${config.color} rounded-xl p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Icon className="w-8 h-8" />
                <span className="font-bold text-lg">{config.label}</span>
              </div>
              <span className="text-4xl font-black">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-4 gap-4 p-4 h-[calc(100vh-220px)]">
        {Object.entries(statusConfig).map(([status, config]) => {
          const statusProjets = projets.filter(p => p.status === status)
          const Icon = config.icon
          
          return (
            <div key={status} className="bg-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className={`${config.color} px-4 py-3 flex items-center gap-2`}>
                <Icon className="w-5 h-5" />
                <span className="font-bold">{config.label}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {statusProjets.map((projet) => (
                  <div
                    key={projet.id}
                    onClick={() => setSelectedProjet(projet)}
                    className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-orange-400">{projet.numero}</span>
                      <QrCode className="w-4 h-4 text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-1 mb-2">
                      {projet.description || 'Sans description'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{projet.client?.full_name || 'Sans client'}</span>
                      {projet.poudre && (
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-gray-500"
                            style={{ backgroundColor: `#${projet.poudre.code_ral || 'ccc'}` }}
                          />
                          <span>{projet.poudre.nom}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {statusProjets.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Aucun projet</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scan Input (hidden, captures barcode scanner) */}
      <input
        type="text"
        value={scanInput}
        onChange={(e) => setScanInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleScan(scanInput)
            setScanInput('')
          }
        }}
        className="absolute -top-10 opacity-0"
        autoFocus
      />

      {/* Project Modal */}
      {selectedProjet && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-orange-500 px-6 py-4">
              <p className="text-sm opacity-80">Projet</p>
              <h2 className="text-3xl font-black">{selectedProjet.numero}</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-400">Description</p>
                <p className="text-lg">{selectedProjet.description || 'Sans description'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Client</p>
                  <p>{selectedProjet.client?.full_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Poudre</p>
                  <div className="flex items-center gap-2">
                    {selectedProjet.poudre && (
                      <div 
                        className="w-4 h-4 rounded border border-gray-500"
                        style={{ backgroundColor: `#${selectedProjet.poudre.code_ral || 'ccc'}` }}
                      />
                    )}
                    <span>{selectedProjet.poudre?.nom || '-'}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-3">Changer le statut</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(statusConfig).map(([status, config]) => {
                    const Icon = config.icon
                    const isCurrentStatus = selectedProjet.status === status
                    return (
                      <button
                        key={status}
                        onClick={() => updateStatus(selectedProjet.id, status)}
                        disabled={isCurrentStatus}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                          isCurrentStatus 
                            ? `${config.color} opacity-50 cursor-not-allowed` 
                            : `${config.color} hover:opacity-80`
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedProjet(null)}
                className="w-full py-3 bg-gray-700 rounded-lg font-bold hover:bg-gray-600"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Hint */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 px-6 py-3 rounded-full flex items-center gap-3 text-gray-400">
        <QrCode className="w-5 h-5" />
        <span>Scannez un QR code projet ou cliquez sur une carte</span>
      </div>
    </div>
  )
}
