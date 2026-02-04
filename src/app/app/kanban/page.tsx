'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Package, Clock, Flame, CheckCircle, Truck, 
  GripVertical, User, Calendar, Eye
} from 'lucide-react'

interface Projet {
  id: string
  numero: string
  description: string
  status: string
  client: { full_name: string } | null
  date_reception: string
  date_livraison_prevue: string | null
  poudre: { nom: string; code_ral: string } | null
}

const columns = [
  { id: 'recu', label: 'Reçu', icon: Package, color: 'bg-blue-500' },
  { id: 'en_preparation', label: 'En préparation', icon: Clock, color: 'bg-yellow-500' },
  { id: 'en_cours', label: 'En cours', icon: Flame, color: 'bg-orange-500' },
  { id: 'termine', label: 'Terminé', icon: CheckCircle, color: 'bg-green-500' },
  { id: 'livre', label: 'Livré', icon: Truck, color: 'bg-gray-500' },
]

export default function KanbanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [projets, setProjets] = useState<Projet[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  useEffect(() => {
    loadProjets()
  }, [])

  async function loadProjets() {
    const supabase = createBrowserClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/auth/login')
      return
    }

    const { data } = await supabase
      .from('projets')
      .select(`
        id, numero, description, status, date_reception, date_livraison_prevue,
        client:clients(full_name),
        poudre:poudres(nom, code_ral)
      `)
      .order('date_reception', { ascending: false })

    if (data) {
      setProjets(data as Projet[])
    }
    setLoading(false)
  }

  function handleDragStart(e: React.DragEvent, projetId: string) {
    setDraggedItem(projetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedItem) return

    const supabase = createBrowserClient()
    
    // Update in database
    await supabase
      .from('projets')
      .update({ status: newStatus })
      .eq('id', draggedItem)

    // Update local state
    setProjets(projets.map(p => 
      p.id === draggedItem ? { ...p, status: newStatus } : p
    ))

    setDraggedItem(null)
  }

  function getProjetsByStatus(status: string) {
    return projets.filter(p => p.status === status)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vue Kanban</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Glissez-déposez les projets pour changer leur statut
          </p>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnProjets = getProjetsByStatus(column.id)
            const Icon = column.icon
            
            return (
              <div
                key={column.id}
                className={`flex-shrink-0 w-72 rounded-xl bg-gray-200 dark:bg-gray-800 transition-all ${
                  dragOverColumn === column.id ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={`${column.color} px-4 py-3 rounded-t-xl flex items-center justify-between`}>
                  <div className="flex items-center gap-2 text-white">
                    <Icon className="w-5 h-5" />
                    <span className="font-bold">{column.label}</span>
                  </div>
                  <span className="bg-white/20 text-white text-sm px-2 py-0.5 rounded-full">
                    {columnProjets.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 min-h-[400px]">
                  {columnProjets.map((projet) => (
                    <div
                      key={projet.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, projet.id)}
                      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                        draggedItem === projet.id ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="flex items-center gap-2 mb-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-sm font-bold text-orange-600">
                          {projet.numero}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                        {projet.description || 'Sans description'}
                      </p>

                      {/* Client */}
                      {projet.client && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                          <User className="w-4 h-4" />
                          <span className="truncate">{projet.client.full_name}</span>
                        </div>
                      )}

                      {/* RAL Color */}
                      {projet.poudre && (
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: `#${projet.poudre.code_ral || 'ccc'}` }}
                          />
                          <span className="text-xs text-gray-500">{projet.poudre.nom}</span>
                        </div>
                      )}

                      {/* Date */}
                      {projet.date_livraison_prevue && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(projet.date_livraison_prevue).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}

                      {/* View Button */}
                      <button
                        onClick={() => router.push(`/app/projets/${projet.id}`)}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </button>
                    </div>
                  ))}

                  {columnProjets.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucun projet</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
