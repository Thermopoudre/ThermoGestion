'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface RealtimeEvent {
  id: string
  type: 'projet_status' | 'nouveau_devis' | 'facture_payee' | 'nouveau_message' | 'stock_bas'
  title: string
  message: string
  timestamp: Date
  read: boolean
  link?: string
}

interface RealtimeContextType {
  events: RealtimeEvent[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearEvents: () => void
}

const RealtimeContext = createContext<RealtimeContextType>({
  events: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearEvents: () => {},
})

export function useRealtime() {
  return useContext(RealtimeContext)
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<RealtimeEvent[]>([])

  useEffect(() => {
    const supabase = createBrowserClient()

    const projectChannel = supabase
      .channel('projets-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projets' },
        (payload) => {
          const oldStatus = payload.old?.status
          const newStatus = payload.new?.status
          if (oldStatus !== newStatus && newStatus) {
            const statusLabels: Record<string, string> = {
              recu: 'recu', en_preparation: 'en preparation',
              en_cours: 'en cours', termine: 'termine', livre: 'livre',
            }
            const event: RealtimeEvent = {
              id: `proj-${Date.now()}`,
              type: 'projet_status',
              title: `Projet ${payload.new.numero || ''} mis a jour`,
              message: `Statut: ${statusLabels[newStatus] || newStatus}`,
              timestamp: new Date(),
              read: false,
              link: `/app/projets/${payload.new.id}`,
            }
            setEvents(prev => [event, ...prev].slice(0, 50))
            try {
              const audio = new Audio('/notification.mp3')
              audio.volume = 0.3
              audio.play().catch(() => {})
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'devis' },
        (payload) => {
          setEvents(prev => [{
            id: `devis-${Date.now()}`,
            type: 'nouveau_devis',
            title: 'Nouveau devis',
            message: `Devis ${payload.new.numero || ''}`,
            timestamp: new Date(),
            read: false,
            link: `/app/devis/${payload.new.id}`,
          }, ...prev].slice(0, 50))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'factures' },
        (payload) => {
          if (payload.new?.status === 'payee' && payload.old?.status !== 'payee') {
            setEvents(prev => [{
              id: `facture-${Date.now()}`,
              type: 'facture_payee',
              title: 'Facture payee',
              message: `${payload.new.numero || ''} - ${payload.new.montant_ttc || 0} EUR`,
              timestamp: new Date(),
              read: false,
              link: `/app/factures/${payload.new.id}`,
            }, ...prev].slice(0, 50))
          }
        }
      )
      .subscribe()

    return () => { projectChannel.unsubscribe() }
  }, [])

  function markAsRead(id: string) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e))
  }
  function markAllAsRead() {
    setEvents(prev => prev.map(e => ({ ...e, read: true })))
  }
  function clearEvents() { setEvents([]) }

  const unreadCount = events.filter(e => !e.read).length

  return (
    <RealtimeContext.Provider value={{ events, unreadCount, markAsRead, markAllAsRead, clearEvents }}>
      {children}
    </RealtimeContext.Provider>
  )
}
