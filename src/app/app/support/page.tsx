'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, ChevronRight, Search } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Ticket {
  id: string
  numero: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  created_at: string
  last_response_at: string | null
  messages_count: number
}

export default function SupportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // New ticket form
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [category, setCategory] = useState('general')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    // Mock data - in production, fetch from database
    setTickets([
      {
        id: '1',
        numero: 'TK-2026-001',
        subject: 'Problème de génération PDF',
        status: 'in_progress',
        priority: 'high',
        created_at: '2026-01-20T10:00:00',
        last_response_at: '2026-01-20T14:30:00',
        messages_count: 3,
      },
      {
        id: '2',
        numero: 'TK-2026-002',
        subject: 'Question sur le calcul des marges',
        status: 'resolved',
        priority: 'medium',
        created_at: '2026-01-18T09:00:00',
        last_response_at: '2026-01-19T11:00:00',
        messages_count: 5,
      },
      {
        id: '3',
        numero: 'TK-2026-003',
        subject: 'Demande de fonctionnalité: Export Excel',
        status: 'open',
        priority: 'low',
        created_at: '2026-01-15T16:00:00',
        last_response_at: null,
        messages_count: 1,
      },
    ])
    setLoading(false)
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    // In production, save to database
    const newTicket: Ticket = {
      id: Date.now().toString(),
      numero: `TK-2026-${String(tickets.length + 4).padStart(3, '0')}`,
      subject,
      status: 'open',
      priority,
      created_at: new Date().toISOString(),
      last_response_at: null,
      messages_count: 1,
    }

    setTickets([newTicket, ...tickets])
    setShowCreate(false)
    setSubject('')
    setDescription('')
    setSubmitting(false)
  }

  const filteredTickets = tickets.filter(ticket => {
    if (filter !== 'all' && ticket.status !== filter) return false
    if (searchQuery && !ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const statusConfig = {
    open: { label: 'Ouvert', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: Clock },
    in_progress: { label: 'En cours', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: AlertCircle },
    resolved: { label: 'Résolu', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
    closed: { label: 'Fermé', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: CheckCircle },
  }

  const priorityConfig = {
    low: { label: 'Basse', color: 'text-gray-500' },
    medium: { label: 'Moyenne', color: 'text-yellow-500' },
    high: { label: 'Haute', color: 'text-red-500' },
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gérez vos demandes d'assistance
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouveau ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
            <p className="text-sm text-gray-500">Total tickets</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-2xl font-bold text-blue-600">{tickets.filter(t => t.status === 'open').length}</p>
            <p className="text-sm text-gray-500">Ouverts</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-2xl font-bold text-yellow-600">{tickets.filter(t => t.status === 'in_progress').length}</p>
            <p className="text-sm text-gray-500">En cours</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'resolved').length}</p>
            <p className="text-sm text-gray-500">Résolus</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'open', 'in_progress', 'resolved'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === status
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {status === 'all' ? 'Tous' : statusConfig[status as keyof typeof statusConfig]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Aucun ticket trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTickets.map((ticket) => {
                const StatusIcon = statusConfig[ticket.status].icon
                return (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => router.push(`/app/support/${ticket.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <StatusIcon className={`w-6 h-6 flex-shrink-0 ${
                          ticket.status === 'resolved' ? 'text-green-500' :
                          ticket.status === 'in_progress' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{ticket.numero}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[ticket.status].color}`}>
                              {statusConfig[ticket.status].label}
                            </span>
                            <span className={`text-xs font-medium ${priorityConfig[ticket.priority].color}`}>
                              • {priorityConfig[ticket.priority].label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</p>
                          <p className="text-sm text-gray-500">
                            Créé le {format(new Date(ticket.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            {ticket.last_response_at && (
                              <> • Dernière réponse {format(new Date(ticket.last_response_at), 'dd MMM', { locale: fr })}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{ticket.messages_count} messages</span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Help */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
            Avant de créer un ticket...
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm mb-4">
            Consultez notre centre d'aide, vous y trouverez peut-être la réponse à votre question !
          </p>
          <a 
            href="/app/aide"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Accéder au centre d'aide
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Nouveau ticket
              </h2>
              <form onSubmit={createTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sujet
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Décrivez brièvement votre problème"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Catégorie
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="general">Question générale</option>
                      <option value="bug">Bug / Problème</option>
                      <option value="billing">Facturation</option>
                      <option value="feature">Demande de fonctionnalité</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priorité
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décrivez votre problème en détail..."
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 disabled:opacity-50"
                  >
                    {submitting ? 'Création...' : 'Créer le ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
