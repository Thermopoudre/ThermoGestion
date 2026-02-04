'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  MessageSquare, Send, Search, User, Clock,
  Package, Paperclip, Image, Phone, Mail,
  ChevronLeft, MoreVertical, Check, CheckCheck
} from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: 'atelier' | 'client'
  created_at: string
  read: boolean
  attachment?: string
}

interface Conversation {
  id: string
  client: {
    id: string
    full_name: string
    email: string
    telephone?: string
  }
  projet?: {
    id: string
    numero: string
    description: string
  }
  lastMessage?: Message
  unreadCount: number
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id)
    }
  }, [selectedConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    const supabase = createBrowserClient()

    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id, full_name, email, telephone,
        projets:projets(id, numero, description)
      `)
      .limit(20)

    // Create mock conversations from clients
    const convs: Conversation[] = (clients || []).map((client, i) => ({
      id: `conv-${client.id}`,
      client: {
        id: client.id,
        full_name: client.full_name,
        email: client.email,
        telephone: client.telephone,
      },
      projet: (client.projets as { id: string; numero: string; description: string }[])?.[0],
      lastMessage: {
        id: `msg-${i}`,
        content: i % 2 === 0 
          ? 'Bonjour, où en est mon projet ?' 
          : 'Merci pour votre retour rapide !',
        sender: i % 2 === 0 ? 'client' : 'atelier',
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        read: i % 3 !== 0,
      },
      unreadCount: i % 3 === 0 ? 1 : 0,
    }))

    setConversations(convs)
    setLoading(false)
  }

  async function loadMessages(convId: string) {
    // Mock messages for demo
    const mockMessages: Message[] = [
      {
        id: '1',
        content: 'Bonjour, je voudrais savoir où en est mon projet de thermolaquage.',
        sender: 'client',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        read: true,
      },
      {
        id: '2',
        content: 'Bonjour ! Votre projet est actuellement en cours de préparation. Le traitement devrait commencer demain.',
        sender: 'atelier',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        read: true,
      },
      {
        id: '3',
        content: 'Super, merci pour le retour rapide ! Savez-vous quand il sera prêt ?',
        sender: 'client',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        read: true,
      },
      {
        id: '4',
        content: 'D\'après notre planning, la livraison est prévue pour vendredi. Souhaitez-vous que nous vous appelions quand c\'est prêt ?',
        sender: 'atelier',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        read: true,
      },
      {
        id: '5',
        content: 'Oui ce serait parfait, merci !',
        sender: 'client',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        read: true,
      },
    ]

    setMessages(mockMessages)
  }

  function sendMessage() {
    if (!newMessage.trim() || !selectedConv) return

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'atelier',
      created_at: new Date().toISOString(),
      read: false,
    }

    setMessages([...messages, message])
    setNewMessage('')

    // Update conversation last message
    setConversations(conversations.map(c => 
      c.id === selectedConv.id 
        ? { ...c, lastMessage: message } 
        : c
    ))
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    if (hours < 48) {
      return 'Hier'
    }
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const filteredConversations = conversations.filter(conv =>
    conv.client.full_name.toLowerCase().includes(search.toLowerCase()) ||
    conv.projet?.numero.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex">
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 animate-pulse bg-gray-100 dark:bg-gray-800" />
        <div className="flex-1 animate-pulse bg-gray-50 dark:bg-gray-900" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-50 dark:bg-gray-900">
      {/* Conversations List */}
      <div className={`w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${
        selectedConv ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Search Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="font-bold text-xl text-gray-900 dark:text-white mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 ${
                  selectedConv?.id === conv.id ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {conv.client.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">
                      {conv.client.full_name}
                    </h3>
                    {conv.lastMessage && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTime(conv.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  {conv.projet && (
                    <p className="text-xs text-orange-500 font-medium mb-1">
                      {conv.projet.numero}
                    </p>
                  )}
                  {conv.lastMessage && (
                    <p className="text-sm text-gray-500 truncate">
                      {conv.lastMessage.sender === 'atelier' && (
                        <span className="text-gray-400">Vous: </span>
                      )}
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>

                {/* Unread Badge */}
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
            <button
              onClick={() => setSelectedConv(null)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
              {selectedConv.client.full_name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {selectedConv.client.full_name}
              </h2>
              {selectedConv.projet && (
                <p className="text-sm text-orange-500">
                  Projet {selectedConv.projet.numero}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedConv.client.telephone && (
                <a
                  href={`tel:${selectedConv.client.telephone}`}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </a>
              )}
              <a
                href={`mailto:${selectedConv.client.email}`}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </a>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'atelier' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${
                  msg.sender === 'atelier' 
                    ? 'bg-orange-500 text-white rounded-2xl rounded-br-sm' 
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm shadow'
                } px-4 py-3`}>
                  <p>{msg.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${
                    msg.sender === 'atelier' ? 'text-orange-100' : 'text-gray-400'
                  }`}>
                    <span className="text-xs">
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {msg.sender === 'atelier' && (
                      msg.read ? <CheckCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <Paperclip className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <Image className="w-5 h-5 text-gray-500" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Votre message..."
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-900 dark:text-white"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center text-gray-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">Messagerie</h2>
            <p>Sélectionnez une conversation pour commencer</p>
          </div>
        </div>
      )}
    </div>
  )
}
