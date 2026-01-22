'use client'

import { useState, useMemo } from 'react'
import { 
  Users, Phone, Mail, Calendar, TrendingUp, Target, 
  Plus, Filter, Search, Star, Clock, ChevronRight,
  MessageSquare, DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Client {
  id: string
  full_name: string
  email: string
  phone?: string
  type: string
  categorie?: string
  ca_total?: number
  nb_projets?: number
  score_fidelite?: number
  date_dernier_contact?: string
  tags?: string[]
}

interface Interaction {
  id: string
  client_id: string
  type: string
  date_interaction: string
  sujet?: string
  contenu?: string
  duree_minutes?: number
  resultat?: string
  relance_prevue?: string
  client?: Client
}

interface Opportunite {
  id: string
  client_id: string
  titre: string
  montant_estime?: number
  probabilite: number
  statut: string
  date_cloture_prevue?: string
  client?: Client
}

interface CRMDashboardProps {
  clients: Client[]
  interactions: Interaction[]
  opportunites: Opportunite[]
  atelierId: string
  onUpdate: () => void
}

const categorieColors: Record<string, string> = {
  prospect: 'bg-gray-100 text-gray-700',
  standard: 'bg-blue-100 text-blue-700',
  vip: 'bg-amber-100 text-amber-700',
  inactif: 'bg-red-100 text-red-700'
}

const statutOpportunite: Record<string, { label: string; color: string }> = {
  prospection: { label: 'Prospection', color: 'bg-gray-100 text-gray-700' },
  qualification: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  proposition: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  negociation: { label: 'Négociation', color: 'bg-amber-100 text-amber-700' },
  gagne: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  perdu: { label: 'Perdu', color: 'bg-red-100 text-red-700' }
}

export default function CRMDashboard({ clients, interactions, opportunites, atelierId, onUpdate }: CRMDashboardProps) {
  const supabase = createClientComponentClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'opportunites' | 'interactions'>('overview')
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [interactionForm, setInteractionForm] = useState({
    client_id: '',
    type: 'appel',
    sujet: '',
    contenu: '',
    duree_minutes: 0,
    resultat: 'neutre',
    relance_prevue: ''
  })

  // Stats
  const stats = useMemo(() => {
    const totalCA = clients.reduce((sum, c) => sum + (c.ca_total || 0), 0)
    const clientsVIP = clients.filter(c => c.categorie === 'vip').length
    const clientsActifs = clients.filter(c => c.categorie !== 'inactif').length
    const relancesDuJour = interactions.filter(i => {
      if (!i.relance_prevue) return false
      const relanceDate = new Date(i.relance_prevue).toDateString()
      return relanceDate === new Date().toDateString()
    })
    const opportunitesEnCours = opportunites.filter(o => !['gagne', 'perdu'].includes(o.statut))
    const pipelineValue = opportunitesEnCours.reduce((sum, o) => sum + ((o.montant_estime || 0) * o.probabilite / 100), 0)

    return { totalCA, clientsVIP, clientsActifs, relancesDuJour, opportunitesEnCours, pipelineValue }
  }, [clients, interactions, opportunites])

  // Top clients
  const topClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => (b.ca_total || 0) - (a.ca_total || 0))
      .slice(0, 5)
  }, [clients])

  // Dernières interactions
  const recentInteractions = useMemo(() => {
    return [...interactions]
      .sort((a, b) => new Date(b.date_interaction).getTime() - new Date(a.date_interaction).getTime())
      .slice(0, 10)
  }, [interactions])

  const handleAddInteraction = async () => {
    if (!interactionForm.client_id || !interactionForm.sujet) return
    
    setLoading(true)
    try {
      await supabase.from('interactions_client').insert({
        ...interactionForm,
        atelier_id: atelierId,
        date_interaction: new Date().toISOString()
      })

      // Mettre à jour la date de dernier contact du client
      await supabase
        .from('clients')
        .update({ date_dernier_contact: new Date().toISOString().split('T')[0] })
        .eq('id', interactionForm.client_id)

      setShowInteractionForm(false)
      setInteractionForm({
        client_id: '',
        type: 'appel',
        sujet: '',
        contenu: '',
        duree_minutes: 0,
        resultat: 'neutre',
        relance_prevue: ''
      })
      onUpdate()
    } catch (error) {
      console.error('Error adding interaction:', error)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Clients actifs</p>
              <p className="text-xl font-bold">{stats.clientsActifs}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Clients VIP</p>
              <p className="text-xl font-bold">{stats.clientsVIP}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">CA Total</p>
              <p className="text-xl font-bold">{stats.totalCA.toLocaleString()}€</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pipeline</p>
              <p className="text-xl font-bold">{stats.pipelineValue.toLocaleString()}€</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Relances du jour</p>
              <p className="text-xl font-bold">{stats.relancesDuJour.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'overview', label: 'Vue d\'ensemble' },
          { id: 'clients', label: 'Clients' },
          { id: 'opportunites', label: 'Opportunités' },
          { id: 'interactions', label: 'Interactions' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Top clients */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold">Top Clients</h3>
              <Link href="/app/clients" className="text-sm text-blue-600 hover:underline">
                Voir tous
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {topClients.map((client, index) => (
                <Link
                  key={client.id}
                  href={`/app/clients/${client.id}`}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-xs text-gray-500">{client.nb_projets || 0} projets</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{(client.ca_total || 0).toLocaleString()}€</p>
                    {client.categorie && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${categorieColors[client.categorie]}`}>
                        {client.categorie}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Dernières interactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold">Dernières Interactions</h3>
              <button
                onClick={() => setShowInteractionForm(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentInteractions.slice(0, 5).map((interaction) => (
                <div key={interaction.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {interaction.type === 'appel' && <Phone className="w-4 h-4 text-green-500" />}
                    {interaction.type === 'email' && <Mail className="w-4 h-4 text-blue-500" />}
                    {interaction.type === 'visite' && <Users className="w-4 h-4 text-purple-500" />}
                    <span className="font-medium text-sm">{interaction.client?.full_name}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{interaction.sujet}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(interaction.date_interaction).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline opportunités */}
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold">Pipeline Commercial</h3>
            </div>
            <div className="p-4">
              <div className="flex gap-4">
                {Object.entries(statutOpportunite).filter(([k]) => !['gagne', 'perdu'].includes(k)).map(([statut, config]) => {
                  const statOpps = opportunites.filter(o => o.statut === statut)
                  const total = statOpps.reduce((sum, o) => sum + (o.montant_estime || 0), 0)
                  
                  return (
                    <div key={statut} className="flex-1 min-w-[200px]">
                      <div className={`${config.color} rounded-t-lg px-3 py-2 font-medium text-sm`}>
                        {config.label} ({statOpps.length})
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-b-lg min-h-[150px] p-2 space-y-2">
                        {statOpps.map((opp) => (
                          <div
                            key={opp.id}
                            className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
                          >
                            <p className="font-medium text-sm">{opp.titre}</p>
                            <p className="text-xs text-gray-500">{opp.client?.full_name}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold">
                                {(opp.montant_estime || 0).toLocaleString()}€
                              </span>
                              <span className="text-xs text-gray-500">{opp.probabilite}%</span>
                            </div>
                          </div>
                        ))}
                        {statOpps.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-4">Aucune opportunité</p>
                        )}
                      </div>
                      <div className="text-center py-2 text-sm font-medium">
                        {total.toLocaleString()}€
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout interaction */}
      {showInteractionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Nouvelle interaction</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client *</label>
                <select
                  value={interactionForm.client_id}
                  onChange={(e) => setInteractionForm({ ...interactionForm, client_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Sélectionner...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={interactionForm.type}
                    onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="appel">Appel</option>
                    <option value="email">Email</option>
                    <option value="visite">Visite</option>
                    <option value="reunion">Réunion</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Durée (min)</label>
                  <input
                    type="number"
                    value={interactionForm.duree_minutes}
                    onChange={(e) => setInteractionForm({ ...interactionForm, duree_minutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Sujet *</label>
                <input
                  type="text"
                  value={interactionForm.sujet}
                  onChange={(e) => setInteractionForm({ ...interactionForm, sujet: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Objet de l'échange..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contenu</label>
                <textarea
                  value={interactionForm.contenu}
                  onChange={(e) => setInteractionForm({ ...interactionForm, contenu: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Résultat</label>
                  <select
                    value={interactionForm.resultat}
                    onChange={(e) => setInteractionForm({ ...interactionForm, resultat: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="positif">Positif</option>
                    <option value="neutre">Neutre</option>
                    <option value="negatif">Négatif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Relance prévue</label>
                  <input
                    type="date"
                    value={interactionForm.relance_prevue}
                    onChange={(e) => setInteractionForm({ ...interactionForm, relance_prevue: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInteractionForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleAddInteraction}
                disabled={loading || !interactionForm.client_id || !interactionForm.sujet}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
