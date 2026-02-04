'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Layers, Package, Calendar, Clock, CheckCircle,
  AlertTriangle, ArrowRight, Palette, Users, Filter
} from 'lucide-react'
import Link from 'next/link'

interface ProjetBatch {
  id: string
  numero: string
  description: string
  pieces_count: number
  date_livraison_prevue: string | null
  client: { full_name: string } | null
}

interface Batch {
  couleur: string
  codeRal: string | null
  poudreNom: string
  projets: ProjetBatch[]
  totalPieces: number
  prioriteMax: 'normal' | 'urgent' | 'critique'
}

export default function BatchingPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [filter, setFilter] = useState<'all' | 'urgent' | 'today'>('all')

  useEffect(() => {
    loadBatches()
  }, [])

  async function loadBatches() {
    const supabase = createBrowserClient()

    const { data: projets } = await supabase
      .from('projets')
      .select(`
        id, numero, description, pieces_count, date_livraison_prevue, status,
        client:clients(full_name),
        poudre:poudres(id, nom, code_ral)
      `)
      .in('status', ['recu', 'en_preparation'])
      .order('date_livraison_prevue', { ascending: true })

    // Group by powder/color
    const batchMap = new Map<string, Batch>()

    projets?.forEach(projet => {
      const poudre = projet.poudre as { id: string; nom: string; code_ral: string } | null
      const key = poudre?.id || 'no-powder'
      
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          couleur: poudre?.code_ral || '#808080',
          codeRal: poudre?.code_ral || null,
          poudreNom: poudre?.nom || 'Sans poudre',
          projets: [],
          totalPieces: 0,
          prioriteMax: 'normal',
        })
      }

      const batch = batchMap.get(key)!
      
      // Calculate priority based on delivery date
      const livraison = projet.date_livraison_prevue ? new Date(projet.date_livraison_prevue) : null
      const today = new Date()
      const daysUntil = livraison ? Math.ceil((livraison.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 999
      
      let priorite: 'normal' | 'urgent' | 'critique' = 'normal'
      if (daysUntil <= 0) priorite = 'critique'
      else if (daysUntil <= 2) priorite = 'urgent'

      if (priorite === 'critique' || (priorite === 'urgent' && batch.prioriteMax !== 'critique')) {
        batch.prioriteMax = priorite
      }

      batch.projets.push({
        id: projet.id,
        numero: projet.numero,
        description: projet.description,
        pieces_count: projet.pieces_count || 1,
        date_livraison_prevue: projet.date_livraison_prevue,
        client: projet.client as { full_name: string } | null,
      })
      batch.totalPieces += projet.pieces_count || 1
    })

    // Sort batches by priority and number of projects
    const sortedBatches = Array.from(batchMap.values()).sort((a, b) => {
      const priorityOrder = { critique: 0, urgent: 1, normal: 2 }
      if (priorityOrder[a.prioriteMax] !== priorityOrder[b.prioriteMax]) {
        return priorityOrder[a.prioriteMax] - priorityOrder[b.prioriteMax]
      }
      return b.projets.length - a.projets.length
    })

    setBatches(sortedBatches)
    setLoading(false)
  }

  const filteredBatches = batches.filter(batch => {
    if (filter === 'urgent') {
      return batch.prioriteMax === 'urgent' || batch.prioriteMax === 'critique'
    }
    if (filter === 'today') {
      return batch.projets.some(p => {
        if (!p.date_livraison_prevue) return false
        const date = new Date(p.date_livraison_prevue)
        const today = new Date()
        return date.toDateString() === today.toDateString()
      })
    }
    return true
  })

  const stats = {
    totalBatches: batches.length,
    totalProjets: batches.reduce((acc, b) => acc + b.projets.length, 0),
    totalPieces: batches.reduce((acc, b) => acc + b.totalPieces, 0),
    urgent: batches.filter(b => b.prioriteMax !== 'normal').length,
  }

  const priorityConfig = {
    normal: { label: 'Normal', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Clock },
    critique: { label: 'Critique', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          Batching Couleurs
        </h1>
        <p className="text-gray-500">
          Regroupement automatique des projets par couleur RAL pour optimiser la production
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Layers className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalBatches}</p>
          <p className="text-sm text-gray-500">Lots de couleurs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Package className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalProjets}</p>
          <p className="text-sm text-gray-500">Projets à traiter</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Palette className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalPieces}</p>
          <p className="text-sm text-gray-500">Pièces totales</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.urgent}</p>
          <p className="text-sm text-gray-500">Lots urgents</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-gray-400" />
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'urgent' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Urgents
        </button>
        <button
          onClick={() => setFilter('today')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'today' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Aujourd'hui
        </button>
      </div>

      {/* Batches Grid */}
      {filteredBatches.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <Layers className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Aucun lot à afficher
          </h2>
          <p className="text-gray-500">
            {filter !== 'all' 
              ? 'Aucun lot ne correspond à ce filtre' 
              : 'Aucun projet en attente de traitement'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBatches.map((batch, index) => {
            const PriorityIcon = priorityConfig[batch.prioriteMax].icon
            
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => setSelectedBatch(batch)}
              >
                {/* Color Header */}
                <div 
                  className="h-16 flex items-center justify-between px-4"
                  style={{ backgroundColor: batch.couleur }}
                >
                  <span className="px-3 py-1 bg-white/90 rounded-lg text-sm font-bold text-gray-800">
                    {batch.codeRal || 'N/A'}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 ${priorityConfig[batch.prioriteMax].color}`}>
                    <PriorityIcon className="w-4 h-4" />
                    {priorityConfig[batch.prioriteMax].label}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                    {batch.poudreNom}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {batch.projets.length} projets
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      {batch.totalPieces} pièces
                    </span>
                  </div>

                  {/* Project List Preview */}
                  <div className="space-y-2">
                    {batch.projets.slice(0, 3).map(projet => (
                      <div 
                        key={projet.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {projet.numero}
                          </p>
                          <p className="text-xs text-gray-500">{projet.client?.full_name}</p>
                        </div>
                        {projet.date_livraison_prevue && (
                          <span className="text-xs text-gray-500">
                            {new Date(projet.date_livraison_prevue).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    ))}
                    {batch.projets.length > 3 && (
                      <p className="text-sm text-orange-500 font-medium text-center">
                        +{batch.projets.length - 3} autres projets
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Cliquez pour voir le détail</span>
                  <ArrowRight className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedBatch && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedBatch(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="h-20 flex items-center justify-between px-6"
              style={{ backgroundColor: selectedBatch.couleur }}
            >
              <div>
                <p className="text-white/80 text-sm">Lot de production</p>
                <h2 className="text-2xl font-black text-white">
                  {selectedBatch.poudreNom}
                </h2>
              </div>
              <span className="px-4 py-2 bg-white/90 rounded-lg font-bold text-gray-800">
                {selectedBatch.codeRal || 'N/A'}
              </span>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {selectedBatch.projets.length}
                  </p>
                  <p className="text-sm text-gray-500">Projets</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {selectedBatch.totalPieces}
                  </p>
                  <p className="text-sm text-gray-500">Pièces</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className={`text-2xl font-black ${priorityConfig[selectedBatch.prioriteMax].color.split(' ')[1]}`}>
                    {priorityConfig[selectedBatch.prioriteMax].label}
                  </p>
                  <p className="text-sm text-gray-500">Priorité</p>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Liste des projets
              </h3>

              <div className="space-y-3">
                {selectedBatch.projets.map(projet => (
                  <Link
                    key={projet.id}
                    href={`/app/projets/${projet.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {projet.numero}
                      </p>
                      <p className="text-sm text-gray-500">{projet.description}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Users className="w-4 h-4" />
                        {projet.client?.full_name || 'Client non spécifié'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {projet.pieces_count} pièces
                      </p>
                      {projet.date_livraison_prevue && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(projet.date_livraison_prevue).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                Fermer
              </button>
              <button
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600"
              >
                Lancer le lot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
