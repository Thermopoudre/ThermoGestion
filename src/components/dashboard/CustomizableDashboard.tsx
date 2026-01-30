'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  LayoutGrid, Plus, X, GripVertical, Settings, 
  TrendingUp, Users, Package, Receipt, Calendar,
  BarChart3, PieChart, Clock, AlertTriangle
} from 'lucide-react'

// Types de widgets disponibles
const WIDGET_TYPES = {
  kpi_ca: { name: 'Chiffre d\'affaires', icon: TrendingUp, defaultSize: { w: 1, h: 1 } },
  kpi_projets: { name: 'Projets actifs', icon: Package, defaultSize: { w: 1, h: 1 } },
  kpi_clients: { name: 'Clients', icon: Users, defaultSize: { w: 1, h: 1 } },
  kpi_factures: { name: 'Factures impayées', icon: Receipt, defaultSize: { w: 1, h: 1 } },
  chart_ca: { name: 'Évolution CA', icon: BarChart3, defaultSize: { w: 2, h: 2 } },
  chart_projets: { name: 'Répartition projets', icon: PieChart, defaultSize: { w: 2, h: 2 } },
  list_projets: { name: 'Derniers projets', icon: Package, defaultSize: { w: 2, h: 2 } },
  list_taches: { name: 'Tâches du jour', icon: Clock, defaultSize: { w: 2, h: 2 } },
  calendar: { name: 'Calendrier', icon: Calendar, defaultSize: { w: 2, h: 2 } },
  alertes: { name: 'Alertes', icon: AlertTriangle, defaultSize: { w: 2, h: 1 } },
}

interface Widget {
  id: string
  type: keyof typeof WIDGET_TYPES
  x: number
  y: number
  w: number
  h: number
  config: Record<string, any>
}

interface CustomizableDashboardProps {
  userId: string
  initialWidgets?: Widget[]
}

export default function CustomizableDashboard({ userId, initialWidgets = [] }: CustomizableDashboardProps) {
  const supabase = createBrowserClient()
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets)
  const [editMode, setEditMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)

  // Charger les widgets depuis la BDD
  useEffect(() => {
    loadWidgets()
  }, [])

  const loadWidgets = async () => {
    const { data } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('user_id', userId)
      .eq('visible', true)
      .order('position_y', { ascending: true })

    if (data && data.length > 0) {
      setWidgets(data.map(w => ({
        id: w.id,
        type: w.widget_type as keyof typeof WIDGET_TYPES,
        x: w.position_x,
        y: w.position_y,
        w: w.width,
        h: w.height,
        config: w.widget_config || {},
      })))
    } else {
      // Widgets par défaut
      setWidgets([
        { id: '1', type: 'kpi_ca', x: 0, y: 0, w: 1, h: 1, config: {} },
        { id: '2', type: 'kpi_projets', x: 1, y: 0, w: 1, h: 1, config: {} },
        { id: '3', type: 'kpi_clients', x: 2, y: 0, w: 1, h: 1, config: {} },
        { id: '4', type: 'kpi_factures', x: 3, y: 0, w: 1, h: 1, config: {} },
        { id: '5', type: 'list_projets', x: 0, y: 1, w: 2, h: 2, config: {} },
        { id: '6', type: 'alertes', x: 2, y: 1, w: 2, h: 1, config: {} },
      ])
    }
  }

  const saveWidgets = async () => {
    // Supprimer les anciens widgets
    await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('user_id', userId)

    // Insérer les nouveaux
    if (widgets.length > 0) {
      await supabase.from('dashboard_widgets').insert(
        widgets.map(w => ({
          user_id: userId,
          widget_type: w.type,
          position_x: w.x,
          position_y: w.y,
          width: w.w,
          height: w.h,
          widget_config: w.config,
          visible: true,
        }))
      )
    }
  }

  const addWidget = (type: keyof typeof WIDGET_TYPES) => {
    const widgetInfo = WIDGET_TYPES[type]
    const newWidget: Widget = {
      id: Date.now().toString(),
      type,
      x: 0,
      y: Math.max(...widgets.map(w => w.y + w.h), 0),
      w: widgetInfo.defaultSize.w,
      h: widgetInfo.defaultSize.h,
      config: {},
    }
    setWidgets([...widgets, newWidget])
    setShowAddModal(false)
  }

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id))
  }

  const handleDragStart = (id: string) => {
    setDraggedWidget(id)
  }

  const handleDrop = (targetX: number, targetY: number) => {
    if (!draggedWidget) return

    setWidgets(widgets.map(w => 
      w.id === draggedWidget ? { ...w, x: targetX, y: targetY } : w
    ))
    setDraggedWidget(null)
  }

  const toggleEditMode = () => {
    if (editMode) {
      saveWidgets()
    }
    setEditMode(!editMode)
  }

  // Rendu d'un widget
  const renderWidgetContent = (widget: Widget) => {
    const WidgetIcon = WIDGET_TYPES[widget.type]?.icon || Package

    // Placeholder content - dans une vraie implémentation, chaque type aurait son composant
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <WidgetIcon className="w-5 h-5 text-orange-500" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {WIDGET_TYPES[widget.type]?.name}
          </span>
        </div>
        
        {widget.type.startsWith('kpi_') && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {widget.type === 'kpi_ca' && '12 450 €'}
              {widget.type === 'kpi_projets' && '8'}
              {widget.type === 'kpi_clients' && '24'}
              {widget.type === 'kpi_factures' && '3'}
            </p>
          </div>
        )}

        {widget.type === 'list_projets' && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                <p className="font-medium">Projet #{2024000 + i}</p>
                <p className="text-gray-500 text-xs">Client {i}</p>
              </div>
            ))}
          </div>
        )}

        {widget.type === 'alertes' && (
          <div className="flex-1 space-y-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>2 factures en retard</span>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>Stock RAL 7016 bas</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-orange-500" />
          Mon Tableau de Bord
        </h2>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter widget
            </button>
          )}
          <button
            onClick={toggleEditMode}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              editMode 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            {editMode ? 'Enregistrer' : 'Personnaliser'}
          </button>
        </div>
      </div>

      {/* Grille de widgets */}
      <div 
        className="grid grid-cols-4 gap-4 min-h-[400px]"
        style={{ gridAutoRows: '150px' }}
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 relative ${
              editMode ? 'ring-2 ring-dashed ring-gray-300 dark:ring-gray-600' : ''
            }`}
            style={{
              gridColumn: `span ${widget.w}`,
              gridRow: `span ${widget.h}`,
            }}
            draggable={editMode}
            onDragStart={() => handleDragStart(widget.id)}
          >
            {editMode && (
              <>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute top-2 left-2 cursor-move text-gray-400">
                  <GripVertical className="w-4 h-4" />
                </div>
              </>
            )}
            {renderWidgetContent(widget)}
          </div>
        ))}
      </div>

      {/* Modal ajout widget */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ajouter un widget</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(WIDGET_TYPES).map(([key, info]) => {
                const Icon = info.icon
                return (
                  <button
                    key={key}
                    onClick={() => addWidget(key as keyof typeof WIDGET_TYPES)}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left flex items-center gap-3"
                  >
                    <Icon className="w-6 h-6 text-orange-500" />
                    <span className="font-medium text-gray-900 dark:text-white">{info.name}</span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
