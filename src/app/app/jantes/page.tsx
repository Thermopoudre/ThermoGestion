'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Circle, Plus, Search, Filter, Car, Palette, 
  Clock, CheckCircle, AlertTriangle, Package,
  DollarSign, Camera, Edit, Trash2, Eye
} from 'lucide-react'
import Link from 'next/link'

interface JanteProjet {
  id: string
  numero: string
  client_name: string
  client_phone: string | null
  vehicule_marque: string
  vehicule_modele: string
  vehicule_immatriculation: string
  nb_jantes: number
  taille_pouces: number
  type_jante: 'alu' | 'tole' | 'carbone'
  etat_reception: string
  couleur_souhaitee: string
  code_ral: string | null
  finition: 'mat' | 'brillant' | 'satin' | 'metallise'
  prix_unitaire: number
  prix_total: number
  statut: string
  date_depot: string
  date_promise: string | null
  vehicule_pret: boolean
  notes: string | null
  photos_avant: string[]
  photos_apres: string[]
  created_at: string
}

const STATUTS = [
  { value: 'recu', label: 'Réceptionné', color: 'bg-blue-100 text-blue-700', icon: Package },
  { value: 'decapage', label: 'Décapage', color: 'bg-yellow-100 text-yellow-700', icon: Circle },
  { value: 'preparation', label: 'Préparation', color: 'bg-orange-100 text-orange-700', icon: Clock },
  { value: 'poudrage', label: 'Poudrage', color: 'bg-purple-100 text-purple-700', icon: Palette },
  { value: 'cuisson', label: 'Cuisson', color: 'bg-red-100 text-red-700', icon: Circle },
  { value: 'controle', label: 'Contrôle QC', color: 'bg-indigo-100 text-indigo-700', icon: Eye },
  { value: 'pret', label: 'Prêt', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'livre', label: 'Livré', color: 'bg-gray-100 text-gray-600', icon: Car },
]

const FINITIONS = [
  { value: 'mat', label: 'Mat', surcharge: 0 },
  { value: 'brillant', label: 'Brillant', surcharge: 0 },
  { value: 'satin', label: 'Satiné', surcharge: 5 },
  { value: 'metallise', label: 'Métallisé', surcharge: 15 },
]

const TARIFS_BASE: Record<number, number> = {
  14: 45, 15: 50, 16: 55, 17: 60, 18: 65, 19: 70, 20: 80, 21: 90, 22: 100, 23: 110,
}

export default function JantesPage() {
  const [projets, setProjets] = useState<JanteProjet[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    vehicule_marque: '',
    vehicule_modele: '',
    vehicule_immatriculation: '',
    nb_jantes: 4,
    taille_pouces: 17,
    type_jante: 'alu' as 'alu' | 'tole' | 'carbone',
    etat_reception: 'bon',
    couleur_souhaitee: '',
    code_ral: '',
    finition: 'brillant' as 'mat' | 'brillant' | 'satin' | 'metallise',
    date_promise: '',
    vehicule_pret: false,
    notes: '',
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

    // On utilise la table projets avec un tag "jante"
    const { data } = await supabase
      .from('projets')
      .select('id, numero, name, description, status, created_at, date_depot, date_promise, pieces_count, metadata')
      .eq('atelier_id', userData.atelier_id)
      .eq('type_projet', 'jante')
      .order('created_at', { ascending: false })

    // Mapper vers le format JanteProjet
    const mapped: JanteProjet[] = (data || []).map((p: any) => {
      const meta = p.metadata || {}
      return {
        id: p.id,
        numero: p.numero,
        client_name: meta.client_name || p.name || '',
        client_phone: meta.client_phone || null,
        vehicule_marque: meta.vehicule_marque || '',
        vehicule_modele: meta.vehicule_modele || '',
        vehicule_immatriculation: meta.vehicule_immatriculation || '',
        nb_jantes: p.pieces_count || 4,
        taille_pouces: meta.taille_pouces || 17,
        type_jante: meta.type_jante || 'alu',
        etat_reception: meta.etat_reception || '',
        couleur_souhaitee: meta.couleur_souhaitee || '',
        code_ral: meta.code_ral || null,
        finition: meta.finition || 'brillant',
        prix_unitaire: meta.prix_unitaire || 0,
        prix_total: meta.prix_total || 0,
        statut: p.status || 'recu',
        date_depot: p.date_depot || p.created_at,
        date_promise: p.date_promise,
        vehicule_pret: meta.vehicule_pret || false,
        notes: p.description,
        photos_avant: meta.photos_avant || [],
        photos_apres: meta.photos_apres || [],
        created_at: p.created_at,
      }
    })

    setProjets(mapped)
    setLoading(false)
  }

  function calculatePrice(): { unitaire: number; total: number } {
    const base = TARIFS_BASE[formData.taille_pouces] || 60
    const finitionSurcharge = FINITIONS.find(f => f.value === formData.finition)?.surcharge || 0
    const typeSurcharge = formData.type_jante === 'carbone' ? 30 : formData.type_jante === 'tole' ? -10 : 0
    const unitaire = base + finitionSurcharge + typeSurcharge
    return { unitaire, total: unitaire * formData.nb_jantes }
  }

  async function createJanteProjet() {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    const price = calculatePrice()

    const { error } = await supabase.from('projets').insert({
      atelier_id: userData.atelier_id,
      name: `Jantes ${formData.vehicule_marque} ${formData.vehicule_modele} - ${formData.client_name}`,
      description: formData.notes || null,
      status: 'recu',
      type_projet: 'jante',
      pieces_count: formData.nb_jantes,
      date_depot: new Date().toISOString().split('T')[0],
      date_promise: formData.date_promise || null,
      metadata: {
        client_name: formData.client_name,
        client_phone: formData.client_phone,
        vehicule_marque: formData.vehicule_marque,
        vehicule_modele: formData.vehicule_modele,
        vehicule_immatriculation: formData.vehicule_immatriculation,
        taille_pouces: formData.taille_pouces,
        type_jante: formData.type_jante,
        etat_reception: formData.etat_reception,
        couleur_souhaitee: formData.couleur_souhaitee,
        code_ral: formData.code_ral,
        finition: formData.finition,
        prix_unitaire: price.unitaire,
        prix_total: price.total,
        vehicule_pret: formData.vehicule_pret,
        photos_avant: [],
        photos_apres: [],
      },
    })

    if (!error) {
      setShowForm(false)
      loadData()
    }
  }

  async function updateStatut(id: string, newStatut: string) {
    await supabase.from('projets').update({ status: newStatut }).eq('id', id)
    loadData()
  }

  const filtered = projets.filter(p => {
    if (filter !== 'all' && p.statut !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return p.client_name.toLowerCase().includes(s) || 
             p.vehicule_immatriculation.toLowerCase().includes(s) ||
             p.numero?.toLowerCase().includes(s) ||
             p.vehicule_marque.toLowerCase().includes(s)
    }
    return true
  })

  const stats = {
    total: projets.length,
    enCours: projets.filter(p => !['pret', 'livre'].includes(p.statut)).length,
    prets: projets.filter(p => p.statut === 'pret').length,
    caMois: projets
      .filter(p => new Date(p.created_at).getMonth() === new Date().getMonth())
      .reduce((acc, p) => acc + p.prix_total, 0),
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Circle className="w-8 h-8 text-orange-500" />
            Module Jantes
          </h1>
          <p className="text-gray-500 mt-1">Gestion complète du thermolaquage de jantes automobiles</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle jante
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Circle className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500">Total commandes</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Clock className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.enCours}</p>
          <p className="text-sm text-gray-500">En cours</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.prets}</p>
          <p className="text-sm text-gray-500">Prêts à livrer</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <DollarSign className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.caMois.toFixed(0)} EUR</p>
          <p className="text-sm text-gray-500">CA jantes ce mois</p>
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par client, immatriculation, marque..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button onClick={() => setFilter('all')} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            Tous
          </button>
          {STATUTS.map(s => (
            <button key={s.value} onClick={() => setFilter(s.value)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${filter === s.value ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <Circle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {search || filter !== 'all' ? 'Aucun résultat' : 'Aucune commande de jantes'}
          </h2>
          <p className="text-gray-500">
            {search || filter !== 'all' ? 'Essayez de modifier vos filtres' : 'Créez votre première commande de jantes'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(projet => {
            const statutConfig = STATUTS.find(s => s.value === projet.statut)
            const StatutIcon = statutConfig?.icon || Package
            const isLate = projet.date_promise && new Date(projet.date_promise) < new Date() && !['pret', 'livre'].includes(projet.statut)

            return (
              <div key={projet.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border-l-4 ${
                isLate ? 'border-red-500' : projet.statut === 'pret' ? 'border-green-500' : 'border-orange-500'
              }`}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Circle className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-white">{projet.client_name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutConfig?.color}`}>
                            {statutConfig?.label}
                          </span>
                          {isLate && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Retard
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {projet.vehicule_marque} {projet.vehicule_modele} — {projet.vehicule_immatriculation} — {projet.nb_jantes}x {projet.taille_pouces}" {projet.type_jante}
                        </p>
                        <p className="text-xs text-gray-400">
                          {projet.couleur_souhaitee} {projet.code_ral ? `(${projet.code_ral})` : ''} — Finition {projet.finition} — {projet.prix_total.toFixed(0)} EUR
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Bouton statut suivant */}
                      {projet.statut !== 'livre' && (
                        <select
                          value={projet.statut}
                          onChange={(e) => updateStatut(projet.id, e.target.value)}
                          className="text-xs px-2 py-1 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                          {STATUTS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tarifs de référence */}
      <div className="mt-8 bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6">
        <h3 className="font-bold text-orange-900 dark:text-orange-200 mb-4">Grille tarifaire jantes (indicative)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {Object.entries(TARIFS_BASE).map(([pouces, prix]) => (
            <div key={pouces} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="font-bold text-gray-900 dark:text-white">{pouces}"</p>
              <p className="text-orange-600 font-bold">{prix} EUR</p>
              <p className="text-xs text-gray-500">/jante</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
          Majorations: Satiné +5 EUR, Métallisé +15 EUR, Carbone +30 EUR. Tôle -10 EUR.
        </p>
      </div>

      {/* Modal nouveau projet jante */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Nouvelle commande jantes</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Client */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom client *</label>
                  <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Jean Dupont" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone</label>
                  <input type="tel" value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="06 12 34 56 78" />
                </div>
              </div>

              {/* Véhicule */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marque *</label>
                  <input type="text" value={formData.vehicule_marque} onChange={e => setFormData({...formData, vehicule_marque: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="BMW" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modèle</label>
                  <input type="text" value={formData.vehicule_modele} onChange={e => setFormData({...formData, vehicule_modele: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Série 3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Immatriculation</label>
                  <input type="text" value={formData.vehicule_immatriculation} onChange={e => setFormData({...formData, vehicule_immatriculation: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 uppercase" placeholder="AB-123-CD" />
                </div>
              </div>

              {/* Jantes */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nb jantes</label>
                  <select value={formData.nb_jantes} onChange={e => setFormData({...formData, nb_jantes: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taille (pouces)</label>
                  <select value={formData.taille_pouces} onChange={e => setFormData({...formData, taille_pouces: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    {[14,15,16,17,18,19,20,21,22,23].map(p => <option key={p} value={p}>{p}"</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={formData.type_jante} onChange={e => setFormData({...formData, type_jante: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    <option value="alu">Aluminium</option>
                    <option value="tole">Tôle</option>
                    <option value="carbone">Carbone</option>
                  </select>
                </div>
              </div>

              {/* Couleur + finition */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Couleur souhaitée</label>
                  <input type="text" value={formData.couleur_souhaitee} onChange={e => setFormData({...formData, couleur_souhaitee: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Noir" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code RAL</label>
                  <input type="text" value={formData.code_ral} onChange={e => setFormData({...formData, code_ral: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="RAL 9005" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Finition</label>
                  <select value={formData.finition} onChange={e => setFormData({...formData, finition: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    {FINITIONS.map(f => <option key={f.value} value={f.value}>{f.label} {f.surcharge > 0 ? `(+${f.surcharge} EUR)` : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Date + véhicule prêt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date promise</label>
                  <input type="date" value={formData.date_promise} onChange={e => setFormData({...formData, date_promise: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.vehicule_pret} onChange={e => setFormData({...formData, vehicule_pret: e.target.checked})}
                      className="rounded text-orange-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Véhicule de prêt disponible</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  rows={2} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Notes, état des jantes..." />
              </div>

              {/* Résumé prix */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Prix unitaire</span>
                  <span className="font-bold">{calculatePrice().unitaire} EUR</span>
                </div>
                <div className="flex justify-between text-lg font-black text-orange-600">
                  <span>Total ({formData.nb_jantes} jantes)</span>
                  <span>{calculatePrice().total} EUR</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200">
                Annuler
              </button>
              <button
                onClick={createJanteProjet}
                disabled={!formData.client_name || !formData.vehicule_marque}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                Créer la commande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
