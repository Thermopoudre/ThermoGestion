'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Send, Paperclip, Image } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender_type: 'client' | 'atelier'
  sender_name: string
  created_at: string
  attachments?: string[]
}

export default function ClientMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [clientUser, setClientUser] = useState<any>(null)
  const [atelier, setAtelier] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadData() {
    const supabase = createBrowserClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/client/auth/login')
      return
    }

    const { data: clientUserData, error } = await supabase
      .from('client_users')
      .select('client_id, atelier_id, clients(full_name)')
      .eq('id', user.id)
      .single()

    if (error || !clientUserData) {
      router.push('/client/auth/login')
      return
    }

    setClientUser(clientUserData)

    // Get atelier info
    const { data: atelierData } = await supabase
      .from('ateliers')
      .select('name, email, phone')
      .eq('id', clientUserData.atelier_id)
      .single()

    setAtelier(atelierData)

    // Get messages (mock for now - would need a messages table)
    // In real app, this would fetch from a messages table
    setMessages([
      {
        id: '1',
        content: 'Bonjour ! Votre projet de thermolaquage a bien été reçu. Nous commençons la préparation demain.',
        sender_type: 'atelier',
        sender_name: atelierData?.name || 'Atelier',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: '2',
        content: 'Merci pour l\'information ! Avez-vous une estimation de la date de fin ?',
        sender_type: 'client',
        sender_name: (clientUserData.clients as any)?.full_name || 'Client',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        content: 'Le projet devrait être terminé d\'ici vendredi. Nous vous enverrons une notification dès qu\'il sera prêt à être récupéré.',
        sender_type: 'atelier',
        sender_name: atelierData?.name || 'Atelier',
        created_at: new Date(Date.now() - 43200000).toISOString(),
      },
    ])

    setLoading(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return

    setSending(true)

    // In real app, this would save to database
    const newMsg: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender_type: 'client',
      sender_name: (clientUser?.clients as any)?.full_name || 'Client',
      created_at: new Date().toISOString(),
    }

    setMessages([...messages, newMsg])
    setNewMessage('')
    setSending(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Communication avec {atelier?.name}
        </p>
      </div>

      {/* Chat Container */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
              {atelier?.name?.charAt(0) || 'A'}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{atelier?.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{atelier?.email}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${message.sender_type === 'client' ? 'order-2' : ''}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.sender_type === 'client'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  }`}
                >
                  <p>{message.content}</p>
                </div>
                <p className={`text-xs text-gray-500 mt-1 ${message.sender_type === 'client' ? 'text-right' : ''}`}>
                  {format(new Date(message.created_at), 'dd MMM à HH:mm', { locale: fr })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Image className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="p-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full hover:from-orange-400 hover:to-red-400 disabled:opacity-50 transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Contact Info */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-4">
          Autres moyens de contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {atelier?.email && (
            <a 
              href={`mailto:${atelier.email}`}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <span className="text-xl">📧</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Email</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{atelier.email}</p>
              </div>
            </a>
          )}
          {atelier?.phone && (
            <a 
              href={`tel:${atelier.phone}`}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <span className="text-xl">📞</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Téléphone</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{atelier.phone}</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
