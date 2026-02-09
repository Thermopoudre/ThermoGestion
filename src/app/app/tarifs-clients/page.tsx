'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Users, Percent, Plus, Trash2, Edit, Save, X,
  TrendingDown, Star, Calendar, Search
} from 'lucide-react'

interface TarifClient {
  id: string
  client_id: string
  remise_pct: number
  prix_m2_special: number | null
  conditions: string | null
  valide_jusqu_au: string | null
  created_at: string
  client?: { full_name: string; email: string; entreprise: string | null }
}

export default function TarifsClientsPage() {
  const [tarifs, setTarifs] = useState<TarifClient[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({
    client_id: '',
    remise_pct: 0,
    prix_m2_special: '',
    conditions: '',
    valide_jusqu_au: '',
  })

  const supabase = createBrowserClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    const { data: tarifsData } = await supabase
      .from('tarifs_clients')
      .select('*')
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, full_name, email, entreprise')
      .eq('atelier_id', userData.atelier_id)
      .order('full_name')

    // Enrichir les tarifs avec les données clients
    const enriched = (tarifsData || []).map(t => ({
      ...t,
      client: (clientsData || []).find(c => c.id === t.client_id)
    }))

    setTarifs(enriched)
    setClients(clientsData || [])
    setLoading(false)
  }

  async function saveTarif() {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    const payload = {
      atelier_id: userData.atelier_id,
      client_id: formData.client_id,
      remise_pct: formData.remise_pct,
      prix_m2_special: formData.prix_m2_special ? parseFloat(formData.prix_m2_special) : null,
      conditions: formData.conditions || null,
      valide_jusqu_au: formData.valide_jusqu_au || null,
    }

    if (editingId) {
      await supabase.from('tarifs_clients').update(payload).eq('id', editingId)
    } else {
      await supabase.from('tarifs_clients').insert(payload)
    }

    setShowForm(false)
    setEditingId(null)
    setFormData({ client_id: '', remise_pct: 0, prix_m2_special: '', conditions: '', valide_jusqu_au: '' })
    loadData()
  }

  function editTarif(tarif: TarifClient) {
    setFormData({
      client_id: tarif.client_id,
      remise_pct: tarif.remise_pct,
      prix_m2_special: tarif.prix_m2_special?.toString() || '',
      conditions: tarif.conditions || '',
      valide_jusqu_au: tarif.valide_jusqu_au || '',
    })
    setEditingId(tarif.id)
    setShowForm(true)
  }

  async function deleteTarif(id: string) {
    if (!confirm('Supprimer ce tarif préférentiel ?')) return
    await supabase.from('tarifs_clients').delete().eq('id', id)
    loadData()
  }

  const filteredTarifs = tarifs.filter(t => {
    if (!search) return true
    const clientName = t.client?.full_name?.toLowerCase() || ''
    const entreprise = t.client?.entreprise?.toLowerCase() || ''
    return clientName.includes(search.toLowerCase()) || entreprise.includes(search.toLowerCase())
  })

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Percent className="w-8 h-8 text-orange-500" />
            Tarifs préférentiels
          </h1>
          <p className="text-gray-500 mt-1">Gérez les remises et prix spéciaux par client</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData({ client_id: '', remise_pct: 0, prix_m2_special: '', conditions: '', valide_jusqu_au: '' }) }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau tarif
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Users className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{tarifs.length}</p>
          <p className="text-sm text-gray-500">Clients avec tarif spécial</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <TrendingDown className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {tarifs.length > 0 ? (tarifs.reduce((acc, t) => acc + t.remise_pct, 0) / tarifs.length).toFixed(1) : 0}%
          </p>
          <p className="text-sm text-gray-500">Remise moyenne</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Star className="w-8 h-8 text-yellow-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {tarifs.filter(t => t.remise_pct >= 10).length}
          </p>
          <p className="text-sm text-gray-500">Clients VIP ({'>'}=10%)</p>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {/* Liste */}
      {filteredTarifs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <Percent className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun tarif préférentiel</h2>
          <p className="text-gray-500">Ajoutez des remises pour vos clients réguliers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTarifs.map(tarif => {
            const isExpired = tarif.valide_jusqu_au && new Date(tarif.valide_jusqu_au) < new Date()
            return (
              <div key={tarif.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow border-l-4 ${
                isExpired ? 'border-red-500 opacity-60' : tarif.remise_pct >= 10 ? 'border-yellow-500' : 'border-orange-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Users className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {tarif.client?.full_name || 'Client inconnu'}
                        {tarif.client?.entreprise && (
                          <span className="text-sm font-normal text-gray-500 ml-2">({tarif.client.entreprise})</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Remise: <strong className="text-orange-600">{tarif.remise_pct}%</strong>
                        </span>
                        {tarif.prix_m2_special && (
                          <span>Prix/m2: <strong>{tarif.prix_m2_special} EUR</strong></span>
                        )}
                        {tarif.valide_jusqu_au && (
                          <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500' : ''}`}>
                            <Calendar className="w-3 h-3" />
                            {isExpired ? 'Expiré' : `Jusqu'au ${new Date(tarif.valide_jusqu_au).toLocaleDateString('fr-FR')}`}
                          </span>
                        )}
                      </div>
                      {tarif.conditions && (
                        <p className="text-xs text-gray-400 mt-1 italic">{tarif.conditions}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => editTarif(tarif)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteTarif(tarif.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {editingId ? 'Modifier le tarif' : 'Nouveau tarif préférentiel'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.entreprise ? `(${c.entreprise})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remise (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={formData.remise_pct}
                    onChange={(e) => setFormData({...formData, remise_pct: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prix/m2 spécial (EUR)</label>
                  <input
                    type="number"
                    step={0.01}
                    value={formData.prix_m2_special}
                    onChange={(e) => setFormData({...formData, prix_m2_special: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Laisser vide si non applicable"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valide jusqu'au</label>
                <input
                  type="date"
                  value={formData.valide_jusqu_au}
                  onChange={(e) => setFormData({...formData, valide_jusqu_au: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conditions</label>
                <textarea
                  value={formData.conditions}
                  onChange={(e) => setFormData({...formData, conditions: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Ex: minimum 500 EUR/mois, contrat annuel..."
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200">
                Annuler
              </button>
              <button
                onClick={saveTarif}
                disabled={!formData.client_id}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
