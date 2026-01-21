'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
  parseISO
} from 'date-fns'
import { fr } from 'date-fns/locale'

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
  en_cuisson: 'bg-orange-100 text-orange-700 border-orange-300',
  qc: 'bg-purple-100 text-purple-700 border-purple-300',
  pret: 'bg-green-100 text-green-700 border-green-300',
}

const typeIcons: Record<string, string> = {
  projet: '🔧',
  depot: '📥',
  devis: '📝',
}

export function PlanningCalendar({ events }: PlanningCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate])

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

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-50 text-orange-500 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="flex">
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
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate[dateKey] || []
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[80px] p-1 border rounded-lg cursor-pointer transition-all
                    ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}
                    ${isCurrentDay ? 'bg-blue-50' : ''}
                    hover:border-blue-300
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1
                    ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                    ${isCurrentDay ? 'text-orange-500' : ''}
                  `}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`
                          text-xs px-1 py-0.5 rounded truncate border
                          ${statusColors[event.status] || 'bg-gray-100 text-gray-700 border-gray-300'}
                        `}
                        title={event.title}
                      >
                        {typeIcons[event.type]} {event.title.slice(0, 15)}...
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 pl-1">
                        +{dayEvents.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panneau détails */}
        <div className="w-80 border-l border-gray-100 p-4">
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
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
                <span>En cours</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
                <span>En cuisson</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>
                <span>Contrôle qualité</span>
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
  )
}
