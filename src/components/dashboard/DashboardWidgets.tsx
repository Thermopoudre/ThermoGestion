'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  GripVertical, TrendingUp, Users, FileText, Package, 
  Euro, Calendar, AlertTriangle, CheckCircle, Clock,
  Settings, X, Plus
} from 'lucide-react'

interface Widget {
  id: string
  type: string
  title: string
  size: 'small' | 'medium' | 'large'
  enabled: boolean
  position: number
}

const availableWidgets = [
  { type: 'ca_mensuel', title: 'CA Mensuel', icon: Euro, size: 'small' as const },
  { type: 'projets_actifs', title: 'Projets Actifs', icon: Package, size: 'small' as const },
  { type: 'devis_attente', title: 'Devis en Attente', icon: FileText, size: 'small' as const },
  { type: 'clients_total', title: 'Clients', icon: Users, size: 'small' as const },
  { type: 'factures_impayees', title: 'Factures Impayées', icon: AlertTriangle, size: 'medium' as const },
  { type: 'projets_status', title: 'État des Projets', icon: Package, size: 'medium' as const },
  { type: 'ca_evolution', title: 'Évolution CA', icon: TrendingUp, size: 'large' as const },
  { type: 'planning', title: 'Planning Semaine', icon: Calendar, size: 'large' as const },
]

interface DashboardData {
  caMensuel: number
  projetsActifs: number
  devisAttente: number
  clientsTotal: number
  facturesImpayees: { count: number; montant: number }
  projetsParStatus: Record<string, number>
  caEvolution: { mois: string; montant: number }[]
}

export function DashboardWidgets() {
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: '1', type: 'ca_mensuel', title: 'CA Mensuel', size: 'small', enabled: true, position: 0 },
    { id: '2', type: 'projets_actifs', title: 'Projets Actifs', size: 'small', enabled: true, position: 1 },
    { id: '3', type: 'devis_attente', title: 'Devis en Attente', size: 'small', enabled: true, position: 2 },
    { id: '4', type: 'clients_total', title: 'Clients', size: 'small', enabled: true, position: 3 },
    { id: '5', type: 'projets_status', title: 'État des Projets', size: 'medium', enabled: true, position: 4 },
    { id: '6', type: 'factures_impayees', title: 'Factures Impayées', size: 'medium', enabled: true, position: 5 },
  ])
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createBrowserClient()
    
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    // Load all stats in parallel
    const [facturesRes, projetsRes, devisRes, clientsRes, impayeesRes] = await Promise.all([
      supabase
        .from('factures')
        .select('montant_ttc')
        .eq('status', 'payee')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth),
      supabase
        .from('projets')
        .select('status'),
      supabase
        .from('devis')
        .select('id')
        .eq('status', 'envoye'),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('factures')
        .select('montant_ttc')
        .in('status', ['envoyee', 'en_retard']),
    ])

    // Calculate stats
    const caMensuel = facturesRes.data?.reduce((acc, f) => acc + (f.montant_ttc || 0), 0) || 0
    
    const projetsParStatus: Record<string, number> = {}
    projetsRes.data?.forEach(p => {
      projetsParStatus[p.status] = (projetsParStatus[p.status] || 0) + 1
    })
    
    const projetsActifs = Object.entries(projetsParStatus)
      .filter(([status]) => !['livre', 'annule'].includes(status))
      .reduce((acc, [, count]) => acc + count, 0)

    const montantImpaye = impayeesRes.data?.reduce((acc, f) => acc + (f.montant_ttc || 0), 0) || 0

    // CA evolution (last 6 months - mock data for now)
    const caEvolution = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      caEvolution.push({
        mois: d.toLocaleDateString('fr-FR', { month: 'short' }),
        montant: Math.random() * 50000 + 10000, // Mock
      })
    }

    setData({
      caMensuel,
      projetsActifs,
      devisAttente: devisRes.data?.length || 0,
      clientsTotal: clientsRes.count || 0,
      facturesImpayees: { count: impayeesRes.data?.length || 0, montant: montantImpaye },
      projetsParStatus,
      caEvolution,
    })
    setLoading(false)
  }

  function handleDragStart(widgetId: string) {
    setDraggedWidget(widgetId)
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedWidget || draggedWidget === targetId) return

    const newWidgets = [...widgets]
    const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget)
    const targetIndex = newWidgets.findIndex(w => w.id === targetId)
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newWidgets.splice(draggedIndex, 1)
      newWidgets.splice(targetIndex, 0, removed)
      setWidgets(newWidgets.map((w, i) => ({ ...w, position: i })))
    }
  }

  function handleDragEnd() {
    setDraggedWidget(null)
  }

  function toggleWidget(type: string) {
    const existing = widgets.find(w => w.type === type)
    if (existing) {
      setWidgets(widgets.map(w => 
        w.type === type ? { ...w, enabled: !w.enabled } : w
      ))
    } else {
      const config = availableWidgets.find(w => w.type === type)
      if (config) {
        setWidgets([...widgets, {
          id: Date.now().toString(),
          type: config.type,
          title: config.title,
          size: config.size,
          enabled: true,
          position: widgets.length,
        }])
      }
    }
  }

  function renderWidget(widget: Widget) {
    if (!data) return null

    const statusLabels: Record<string, string> = {
      recu: 'Reçu',
      en_preparation: 'Préparation',
      en_cours: 'En cours',
      termine: 'Terminé',
      livre: 'Livré',
    }

    const statusColors: Record<string, string> = {
      recu: 'bg-blue-500',
      en_preparation: 'bg-yellow-500',
      en_cours: 'bg-orange-500',
      termine: 'bg-green-500',
      livre: 'bg-gray-500',
    }

    switch (widget.type) {
      case 'ca_mensuel':
        return (
          <div className="text-center">
            <Euro className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-3xl font-black text-gray-900 dark:text-white">
              {data.caMensuel.toLocaleString('fr-FR')} €
            </p>
            <p className="text-sm text-gray-500">Ce mois</p>
          </div>
        )
      
      case 'projets_actifs':
        return (
          <div className="text-center">
            <Package className="w-8 h-8 mx-auto mb-2 text-orange-500" />
            <p className="text-3xl font-black text-gray-900 dark:text-white">{data.projetsActifs}</p>
            <p className="text-sm text-gray-500">En cours</p>
          </div>
        )
      
      case 'devis_attente':
        return (
          <div className="text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-3xl font-black text-gray-900 dark:text-white">{data.devisAttente}</p>
            <p className="text-sm text-gray-500">À valider</p>
          </div>
        )
      
      case 'clients_total':
        return (
          <div className="text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-3xl font-black text-gray-900 dark:text-white">{data.clientsTotal}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        )
      
      case 'factures_impayees':
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-medium text-gray-900 dark:text-white">Factures impayées</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-500">{data.facturesImpayees.count}</span>
              <span className="text-gray-500">factures</span>
            </div>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-300 mt-1">
              {data.facturesImpayees.montant.toLocaleString('fr-FR')} € TTC
            </p>
          </div>
        )
      
      case 'projets_status':
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-gray-900 dark:text-white">État des projets</span>
            </div>
            <div className="space-y-2">
              {Object.entries(data.projetsParStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {statusLabels[status] || status}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'ca_evolution':
        const maxCA = Math.max(...data.caEvolution.map(d => d.montant))
        return (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-900 dark:text-white">Évolution CA</span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {data.caEvolution.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-orange-500 rounded-t"
                    style={{ height: `${(d.montant / maxCA) * 100}%` }}
                  />
                  <span className="text-xs text-gray-500">{d.mois}</span>
                </div>
              ))}
            </div>
          </div>
        )
      
      default:
        return <p>Widget non disponible</p>
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-32 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Customize Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Settings className="w-4 h-4" />
          Personnaliser
        </button>
      </div>

      {/* Customization Panel */}
      {isCustomizing && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-blue-900 dark:text-blue-100">Widgets disponibles</h3>
            <button onClick={() => setIsCustomizing(false)} className="text-blue-500 hover:text-blue-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableWidgets.map(config => {
              const isEnabled = widgets.find(w => w.type === config.type)?.enabled
              const Icon = config.icon
              return (
                <button
                  key={config.type}
                  onClick={() => toggleWidget(config.type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isEnabled 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {config.title}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-blue-700 dark:text-blue-300">
            Glissez-déposez les widgets pour les réorganiser
          </p>
        </div>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {widgets
          .filter(w => w.enabled)
          .sort((a, b) => a.position - b.position)
          .map(widget => {
            const sizeClass = widget.size === 'large' 
              ? 'col-span-2 md:col-span-4' 
              : widget.size === 'medium' 
                ? 'col-span-2' 
                : 'col-span-1'
            
            return (
              <div
                key={widget.id}
                draggable={isCustomizing}
                onDragStart={() => handleDragStart(widget.id)}
                onDragOver={(e) => handleDragOver(e, widget.id)}
                onDragEnd={handleDragEnd}
                className={`${sizeClass} bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${
                  isCustomizing ? 'cursor-grab active:cursor-grabbing border-2 border-dashed border-gray-300 dark:border-gray-600' : ''
                } ${draggedWidget === widget.id ? 'opacity-50' : ''}`}
              >
                {isCustomizing && (
                  <div className="flex items-center justify-center mb-2 text-gray-400">
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}
                {renderWidget(widget)}
              </div>
            )
          })}
      </div>
    </div>
  )
}
