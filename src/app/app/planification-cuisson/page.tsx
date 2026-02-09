'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Flame, Clock, Plus, Calendar, Package, Weight,
  AlertTriangle, CheckCircle, Trash2, ArrowRight, 
  Thermometer, Timer, BarChart3
} from 'lucide-react'

interface Projet {
  id: string
  numero: string
  name: string
  poids_total_kg: number | null
  pieces_count: number
  client: { full_name: string } | null
  poudre: { nom: string; temp_cuisson_min: number | null; temp_cuisson_max: number | null; duree_cuisson_min: number | null } | null
}

interface FourneeSlot {
  id: string
  date: string
  heure_debut: string
  heure_fin: string
  temperature: number
  projets: Projet[]
  poids_total_kg: number
  volume_utilise_pct: number
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule'
  notes: string
}

export default function PlanificationCuissonPage() {
  const [fournees, setFournees] = useState<FourneeSlot[]>([])
  const [projetsDispos, setProjetsDispos] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [atelierConfig, setAtelierConfig] = useState<any>(null)
  
  // Nouvelle fournée
  const [newFournee, setNewFournee] = useState({
    heure_debut: '08:00',
    heure_fin: '09:30',
    temperature: 200,
    notes: '',
  })
  const [selectedProjets, setSelectedProjets] = useState<string[]>([])

  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
  }, [selectedDate])

  async function loadData() {
    setLoading(true)
    
    // Config atelier
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.user.id)
      .single()
    
    if (!userData?.atelier_id) return

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('four_longueur_cm, four_largeur_cm, four_hauteur_cm, four_poids_max_kg, four_fournees_jour, four_temp_max')
      .eq('id', userData.atelier_id)
      .single()

    setAtelierConfig(atelier)

    // Fournées du jour
    const { data: planifs } = await supabase
      .from('planification_cuisson')
      .select('*')
      .eq('atelier_id', userData.atelier_id)
      .eq('date_planification', selectedDate)
      .order('heure_debut')

    // Projets disponibles (en préparation ou reçus)
    const { data: projets } = await supabase
      .from('projets')
      .select(`
        id, numero, name, poids_total_kg, pieces_count,
        client:clients(full_name),
        poudre:poudres(nom, temp_cuisson_min, temp_cuisson_max, duree_cuisson_min)
      `)
      .eq('atelier_id', userData.atelier_id)
      .in('status', ['recu', 'en_preparation', 'en_cours'])

    setProjetsDispos(projets as any || [])

    // Reconstituer les fournées avec projets
    const enrichedFournees: FourneeSlot[] = (planifs || []).map((p: any) => {
      const projetIds = p.projets_ids || []
      const projetsFournee = (projets || []).filter((pr: any) => projetIds.includes(pr.id))
      return {
        id: p.id,
        date: p.date_planification,
        heure_debut: p.heure_debut || '08:00',
        heure_fin: p.heure_fin || '09:30',
        temperature: p.temperature || 200,
        projets: projetsFournee as any,
        poids_total_kg: p.poids_total_kg || 0,
        volume_utilise_pct: p.volume_utilise_pct || 0,
        statut: p.statut || 'planifie',
        notes: p.notes || '',
      }
    })

    setFournees(enrichedFournees)
    setLoading(false)
  }

  async function createFournee() {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.user.id)
      .single()
    
    if (!userData?.atelier_id) return

    const projetsSel = projetsDispos.filter(p => selectedProjets.includes(p.id))
    const poidsTotal = projetsSel.reduce((acc, p) => acc + (p.poids_total_kg || 5), 0)
    const maxPoids = atelierConfig?.four_poids_max_kg || 500
    const volumePct = Math.round((poidsTotal / maxPoids) * 100)

    const { error } = await supabase.from('planification_cuisson').insert({
      atelier_id: userData.atelier_id,
      date_planification: selectedDate,
      heure_debut: newFournee.heure_debut,
      heure_fin: newFournee.heure_fin,
      temperature: newFournee.temperature,
      projets_ids: selectedProjets,
      poids_total_kg: poidsTotal,
      volume_utilise_pct: volumePct,
      statut: 'planifie',
      notes: newFournee.notes,
    })

    if (!error) {
      setShowNewForm(false)
      setSelectedProjets([])
      setNewFournee({ heure_debut: '08:00', heure_fin: '09:30', temperature: 200, notes: '' })
      loadData()
    }
  }

  async function deleteFournee(id: string) {
    if (!confirm('Supprimer cette fournée ?')) return
    await supabase.from('planification_cuisson').delete().eq('id', id)
    loadData()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('planification_cuisson').update({ statut }).eq('id', id)
    
    // Si terminée, mettre les projets en statut "en_cuisson" -> "qc"
    if (statut === 'termine') {
      const fournee = fournees.find(f => f.id === id)
      if (fournee) {
        for (const projet of fournee.projets) {
          await supabase.from('projets').update({ status: 'qc' }).eq('id', projet.id)
        }
      }
    } else if (statut === 'en_cours') {
      const fournee = fournees.find(f => f.id === id)
      if (fournee) {
        for (const projet of fournee.projets) {
          await supabase.from('projets').update({ status: 'en_cuisson' }).eq('id', projet.id)
        }
      }
    }
    
    loadData()
  }

  // Calcul optimisation four
  const maxFournees = atelierConfig?.four_fournees_jour || 8
  const fourneesRestantes = maxFournees - fournees.filter(f => f.statut !== 'annule').length
  const maxPoids = atelierConfig?.four_poids_max_kg || 500
  const maxTemp = atelierConfig?.four_temp_max || 250

  const statutConfig: Record<string, { label: string; color: string; icon: any }> = {
    planifie: { label: 'Planifié', color: 'bg-blue-100 text-blue-700', icon: Calendar },
    en_cours: { label: 'En cuisson', color: 'bg-orange-100 text-orange-700', icon: Flame },
    termine: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    annule: { label: 'Annulé', color: 'bg-gray-100 text-gray-500', icon: Trash2 },
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            Planification Cuisson
          </h1>
          <p className="text-gray-500 mt-1">Optimisez le chargement et la planification de vos fournées</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            onClick={() => setShowNewForm(true)}
            disabled={fourneesRestantes <= 0}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouvelle fournée
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Flame className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fournees.length}</p>
          <p className="text-sm text-gray-500">Fournées planifiées</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Timer className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fourneesRestantes}</p>
          <p className="text-sm text-gray-500">Créneaux restants</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Weight className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{maxPoids} kg</p>
          <p className="text-sm text-gray-500">Capacité max four</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Thermometer className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{maxTemp}°C</p>
          <p className="text-sm text-gray-500">Temp. max four</p>
        </div>
      </div>

      {/* Timeline des fournées */}
      {fournees.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <Flame className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Aucune fournée planifiée
          </h2>
          <p className="text-gray-500 mb-4">
            Planifiez vos fournées pour optimiser la production du {new Date(selectedDate).toLocaleDateString('fr-FR')}
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600"
          >
            Créer la première fournée
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {fournees.map((fournee) => {
            const StatutIcon = statutConfig[fournee.statut]?.icon || Calendar
            return (
              <div key={fournee.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <Clock className="w-5 h-5 text-orange-500 mx-auto" />
                      <p className="text-lg font-black text-gray-900 dark:text-white">{fournee.heure_debut}</p>
                      <p className="text-xs text-gray-500">{fournee.heure_fin}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{fournee.temperature}°C</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutConfig[fournee.statut]?.color}`}>
                          <StatutIcon className="w-3 h-3 inline mr-1" />
                          {statutConfig[fournee.statut]?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {fournee.projets.length} projets - {fournee.poids_total_kg.toFixed(1)} kg
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Jauge de chargement */}
                    <div className="w-32 hidden md:block">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Chargement</span>
                        <span>{fournee.volume_utilise_pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${fournee.volume_utilise_pct > 90 ? 'bg-red-500' : fournee.volume_utilise_pct > 70 ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(fournee.volume_utilise_pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {fournee.statut === 'planifie' && (
                      <>
                        <button
                          onClick={() => updateStatut(fournee.id, 'en_cours')}
                          className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 flex items-center gap-1"
                        >
                          <Flame className="w-4 h-4" />
                          Démarrer
                        </button>
                        <button
                          onClick={() => deleteFournee(fournee.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {fournee.statut === 'en_cours' && (
                      <button
                        onClick={() => updateStatut(fournee.id, 'termine')}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Terminée
                      </button>
                    )}
                  </div>
                </div>

                {/* Projets dans cette fournée */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {fournee.projets.map(projet => (
                    <div key={projet.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Package className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{projet.numero}</p>
                        <p className="text-xs text-gray-500 truncate">{(projet.client as any)?.full_name}</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-auto shrink-0">{projet.poids_total_kg || '~5'} kg</span>
                    </div>
                  ))}
                </div>

                {fournee.notes && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-500 italic">{fournee.notes}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Suggestions optimisation */}
      {projetsDispos.length > 0 && (
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" />
            Suggestions d'optimisation
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            {projetsDispos.filter(p => !fournees.some(f => f.projets.some(fp => fp.id === p.id))).length > 0 && (
              <p>
                {projetsDispos.filter(p => !fournees.some(f => f.projets.some(fp => fp.id === p.id))).length} projets
                non encore planifiés en cuisson
              </p>
            )}
            {fournees.some(f => f.volume_utilise_pct < 50 && f.statut === 'planifie') && (
              <p className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Certaines fournées sont sous-chargées ({`<`}50%). Envisagez de les fusionner.
              </p>
            )}
            {fourneesRestantes > 2 && (
              <p>Vous avez encore {fourneesRestantes} créneaux disponibles aujourd'hui.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal nouvelle fournée */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Nouvelle fournée</h2>
              <p className="text-gray-500 text-sm">
                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure début</label>
                  <input
                    type="time"
                    value={newFournee.heure_debut}
                    onChange={(e) => setNewFournee({...newFournee, heure_debut: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure fin</label>
                  <input
                    type="time"
                    value={newFournee.heure_fin}
                    onChange={(e) => setNewFournee({...newFournee, heure_fin: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Température (°C) - Max: {maxTemp}°C
                </label>
                <input
                  type="number"
                  value={newFournee.temperature}
                  onChange={(e) => setNewFournee({...newFournee, temperature: Math.min(parseInt(e.target.value) || 0, maxTemp)})}
                  min={100}
                  max={maxTemp}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Sélection des projets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Projets à cuire ({selectedProjets.length} sélectionnés)
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2 dark:border-gray-600">
                  {projetsDispos
                    .filter(p => !fournees.some(f => f.projets.some(fp => fp.id === p.id)))
                    .map(projet => (
                      <label 
                        key={projet.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedProjets.includes(projet.id) ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200' : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjets.includes(projet.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProjets([...selectedProjets, projet.id])
                            } else {
                              setSelectedProjets(selectedProjets.filter(id => id !== projet.id))
                            }
                          }}
                          className="rounded text-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{projet.numero} - {projet.name}</p>
                          <p className="text-xs text-gray-500">
                            {(projet.client as any)?.full_name} - {(projet.poudre as any)?.nom || 'Poudre N/A'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">{projet.poids_total_kg || '~5'} kg</span>
                      </label>
                    ))}
                </div>

                {/* Résumé chargement */}
                {selectedProjets.length > 0 && (
                  <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 dark:text-orange-300">Poids estimé</span>
                      <span className="font-bold text-orange-700 dark:text-orange-300">
                        {projetsDispos
                          .filter(p => selectedProjets.includes(p.id))
                          .reduce((acc, p) => acc + (p.poids_total_kg || 5), 0)
                          .toFixed(1)} kg / {maxPoids} kg
                      </span>
                    </div>
                    <div className="h-2 bg-orange-200 rounded-full mt-2">
                      <div 
                        className="h-full bg-orange-500 rounded-full"
                        style={{ 
                          width: `${Math.min(
                            (projetsDispos
                              .filter(p => selectedProjets.includes(p.id))
                              .reduce((acc, p) => acc + (p.poids_total_kg || 5), 0) / maxPoids) * 100, 
                            100
                          )}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={newFournee.notes}
                  onChange={(e) => setNewFournee({...newFournee, notes: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Notes sur cette fournée..."
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={createFournee}
                disabled={selectedProjets.length === 0}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                Créer la fournée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
