'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  DndContext, 
  DragOverlay,
  useSensor, 
  useSensors, 
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  addWeeks,
  subWeeks,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { createBrowserClient } from '@/lib/supabase/client'

interface Event {
  id: string
  title: string
  date: string
  type: 'projet' | 'depot' | 'devis'
  status: string
  client: string
  poudre?: string
  link: string
}

interface PlanningCalendarProps {
  events: Event[]
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-700 border-gray-300',
  brouillon: 'bg-gray-100 text-gray-700 border-gray-300',
  envoye: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  en_cours: 'bg-blue-100 text-blue-700 border-blue-300',
  en_attente: 'bg-gray-100 text-gray-700 border-gray-300',
  en_preparation: 'bg-blue-100 text-blue-700 border-blue-300',
  en_traitement: 'bg-orange-100 text-orange-700 border-orange-300',
  en_cuisson: 'bg-orange-100 text-orange-700 border-orange-300',
  sechage: 'bg-amber-100 text-amber-700 border-amber-300',
  controle_qualite: 'bg-purple-100 text-purple-700 border-purple-300',
  qc: 'bg-purple-100 text-purple-700 border-purple-300',
  pret: 'bg-green-100 text-green-700 border-green-300',
}

const typeIcons: Record<string, string> = {
  projet: '🔧',
  depot: '📥',
  devis: '📝',
}

// Composant Draggable pour les événements
function DraggableEvent({ event, compact = false }: { event: Event; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: event,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`
          text-xs px-1 py-0.5 rounded truncate border cursor-grab active:cursor-grabbing
          ${statusColors[event.status] || 'bg-gray-100 text-gray-700 border-gray-300'}
          ${isDragging ? 'shadow-lg ring-2 ring-orange-400' : ''}
        `}
        title={`${event.title} - Glissez pour déplacer`}
      >
        {typeIcons[event.type]} {event.title.slice(0, 12)}...
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing
        ${statusColors[event.status] || 'bg-gray-50 border-gray-200'}
        ${isDragging ? 'shadow-lg ring-2 ring-orange-400' : 'hover:shadow-md'}
      `}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{typeIcons[event.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{event.title}</p>
          <p className="text-sm opacity-80">{event.client}</p>
          {event.poudre && (
            <p className="text-xs opacity-60 mt-1">🎨 {event.poudre}</p>
          )}
        </div>
        <span className="text-xs opacity-50">⋮⋮</span>
      </div>
    </div>
  )
}

// Composant Droppable pour les jours
function DroppableDay({ 
  day, 
  children, 
  isCurrentMonth,
  isSelected,
  isCurrentDay,
  onClick,
}: { 
  day: Date
  children: React.ReactNode
  isCurrentMonth: boolean
  isSelected: boolean
  isCurrentDay: boolean
  onClick: () => void
}) {
  const dateKey = format(day, 'yyyy-MM-dd')
  const { isOver, setNodeRef } = useDroppable({
    id: dateKey,
    data: { date: day },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        min-h-[80px] p-1 border rounded-lg cursor-pointer transition-all
        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}
        ${isCurrentDay ? 'bg-blue-50' : ''}
        ${isOver ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : ''}
        hover:border-blue-300
      `}
    >
      {children}
    </div>
  )
}

export function PlanningCalendar({ events: initialEvents }: PlanningCalendarProps) {
  const supabase = createBrowserClient()
  const [events, setEvents] = useState(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Calcul des jours selon le mode de vue
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start: weekStart, end: weekEnd })
    }
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate, viewMode])

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {}
    for (const event of events) {
      const dateKey = event.date
      if (!map[dateKey]) {
        map[dateKey] = []
      }
      map[dateKey].push(event)
    }
    return map
  }, [events])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return eventsByDate[dateKey] || []
  }, [selectedDate, eventsByDate])

  const activeEvent = useMemo(() => {
    if (!activeId) return null
    return events.find(e => e.id === activeId)
  }, [activeId, events])

  // Navigation
  const goToPrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    } else {
      setCurrentDate(subMonths(currentDate, 1))
    }
  }

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    } else {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const eventId = active.id as string
    const newDate = over.id as string
    const draggedEvent = events.find(e => e.id === eventId)

    if (!draggedEvent || draggedEvent.date === newDate) return

    // Optimistic update
    setEvents(events.map(e => 
      e.id === eventId ? { ...e, date: newDate } : e
    ))

    setSaving(true)

    try {
      // Déterminer la table et le champ à mettre à jour
      if (draggedEvent.type === 'projet' || draggedEvent.type === 'depot') {
        const realId = eventId.replace('-depot', '')
        const field = draggedEvent.type === 'depot' ? 'date_depot' : 'date_promise'
        
        await supabase
          .from('projets')
          .update({ [field]: newDate })
          .eq('id', realId)
      } else if (draggedEvent.type === 'devis') {
        await supabase
          .from('devis')
          .update({ valid_until: newDate })
          .eq('id', eventId)
      }
    } catch (error) {
      console.error('Erreur mise à jour date:', error)
      // Revert on error
      setEvents(events)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              {viewMode === 'week' 
                ? `Semaine du ${format(days[0], 'd MMMM', { locale: fr })}`
                : format(currentDate, 'MMMM yyyy', { locale: fr })
              }
            </h2>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
            >
              Aujourd'hui
            </button>
            {saving && (
              <span className="text-sm text-gray-500 animate-pulse">
                💾 Enregistrement...
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle vue */}
            <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'week' 
                    ? 'bg-white text-gray-900 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'month' 
                    ? 'bg-white text-gray-900 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mois
              </button>
            </div>

            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              →
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Calendrier */}
          <div className="flex-1 p-4">
            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grille des jours */}
            <div className={`grid grid-cols-7 gap-1 ${viewMode === 'week' ? 'min-h-[400px]' : ''}`}>
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayEvents = eventsByDate[dateKey] || []
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentDay = isToday(day)

                return (
                  <DroppableDay
                    key={day.toString()}
                    day={day}
                    isCurrentMonth={viewMode === 'week' || isCurrentMonth}
                    isSelected={isSelected}
                    isCurrentDay={isCurrentDay}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className={`
                      text-sm font-medium mb-1
                      ${(viewMode === 'week' || isCurrentMonth) ? 'text-gray-900' : 'text-gray-400'}
                      ${isCurrentDay ? 'text-orange-600' : ''}
                    `}>
                      {format(day, 'd')}
                      {viewMode === 'week' && (
                        <span className="text-xs text-gray-400 ml-1">
                          {format(day, 'MMM', { locale: fr })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, viewMode === 'week' ? 10 : 3).map((event) => (
                        <DraggableEvent 
                          key={event.id} 
                          event={event} 
                          compact={viewMode === 'month'}
                        />
                      ))}
                      {dayEvents.length > (viewMode === 'week' ? 10 : 3) && (
                        <div className="text-xs text-gray-500 pl-1">
                          +{dayEvents.length - (viewMode === 'week' ? 10 : 3)} autre(s)
                        </div>
                      )}
                    </div>
                  </DroppableDay>
                )
              })}
            </div>

            {/* Hint drag & drop */}
            <p className="text-xs text-gray-400 mt-4 text-center">
              💡 Glissez-déposez les projets pour modifier leur date
            </p>
          </div>

          {/* Panneau détails */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 p-4">
            <h3 className="font-bold text-gray-900 mb-4">
              {selectedDate 
                ? format(selectedDate, 'EEEE d MMMM', { locale: fr })
                : 'Sélectionnez un jour'
              }
            </h3>

            {selectedDate && selectedDateEvents.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <span className="text-3xl block mb-2">📭</span>
                <p>Aucun événement</p>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {selectedDateEvents.map((event) => (
                <Link
                  key={event.id}
                  href={event.link}
                  className={`
                    block p-3 rounded-lg border transition-all hover:shadow-md
                    ${statusColors[event.status] || 'bg-gray-50 border-gray-200'}
                  `}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{typeIcons[event.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-sm opacity-80">{event.client}</p>
                      {event.poudre && (
                        <p className="text-xs opacity-60 mt-1">🎨 {event.poudre}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Légende */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Légende</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
                  <span>En cours</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
                  <span>Traitement</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>
                  <span>Contrôle</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
                  <span>Prêt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeEvent && (
          <div className={`
            p-2 rounded-lg border shadow-xl
            ${statusColors[activeEvent.status] || 'bg-gray-100'}
          `}>
            <span className="text-sm font-medium">
              {typeIcons[activeEvent.type]} {activeEvent.title}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
