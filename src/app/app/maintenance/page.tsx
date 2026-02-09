'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Wrench, Plus, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface MaintenanceItem {
  id: string
  type: string
  description: string
  date_planifiee: string | null
  date_realisee: string | null
  cout: number | null
  technicien: string | null
  notes: string | null
  statut: string
  prochaine_maintenance: string | null
  intervalle_jours: number | null
  equipements?: { nom: string; type: string } | null
}

export default function MaintenancePage() {
  const supabase = createBrowserClient()
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [equipements, setEquipements] = useState<{ id: string; nom: string; type: string }[]>([])
  
  const [form, setForm] = useState({
    equipement_id: '', type: 'preventive', description: '', date_planifiee: '',
    technicien: '', notes: '', intervalle_jours: '90'
  })

  const loadData = async () => {
    const { data } = await supabase
      .from('maintenance_equipements')
      .select('*, equipements(nom, type)')
      .order('date_planifiee', { ascending: true })
    if (data) setItems(data as any)

    const { data: equips } = await supabase.from('equipements').select('id, nom, type')
    if (equips) setEquipements(equips)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    await supabase.from('maintenance_equipements').insert({
      equipement_id: form.equipement_id,
      type: form.type,
      description: form.description,
      date_planifiee: form.date_planifiee || null,
      technicien: form.technicien || null,
      notes: form.notes || null,
      intervalle_jours: form.intervalle_jours ? parseInt(form.intervalle_jours) : null,
      statut: 'planifie',
    })
    setShowForm(false)
    setForm({ equipement_id: '', type: 'preventive', description: '', date_planifiee: '', technicien: '', notes: '', intervalle_jours: '90' })
    loadData()
  }

  const markDone = async (item: MaintenanceItem) => {
    const today = new Date().toISOString().split('T')[0]
    let prochaine = null
    if (item.intervalle_jours) {
      const next = new Date()
      next.setDate(next.getDate() + item.intervalle_jours)
      prochaine = next.toISOString().split('T')[0]
    }
    
    await supabase.from('maintenance_equipements')
      .update({ statut: 'realise', date_realisee: today, prochaine_maintenance: prochaine })
      .eq('id', item.id)

    // Si maintenance récurrente, créer la prochaine
    if (prochaine && item.intervalle_jours) {
      await supabase.from('maintenance_equipements').insert({
        equipement_id: item.id, // Accès via jointure
        type: item.type,
        description: item.description,
        date_planifiee: prochaine,
        technicien: item.technicien,
        intervalle_jours: item.intervalle_jours,
        statut: 'planifie',
      })
    }
    loadData()
  }

  const today = new Date().toISOString().split('T')[0]
  const overdue = items.filter(i => i.statut === 'planifie' && i.date_planifiee && i.date_planifiee < today)
  const upcoming = items.filter(i => i.statut === 'planifie' && i.date_planifiee && i.date_planifiee >= today)
  const done = items.filter(i => i.statut === 'realise')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-7 h-7 text-orange-500" />
            Maintenance préventive
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Suivi révisions four, cabine, pistolets, équipements</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Planifier
        </button>
      </div>

      {/* Alertes maintenance en retard */}
      {overdue.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" /> {overdue.length} maintenance(s) en retard
          </h3>
          <div className="space-y-2">
            {overdue.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-100 dark:border-red-800/50">
                <div>
                  <span className="font-medium">{(item.equipements as any)?.nom || 'Équipement'}</span>
                  <span className="text-gray-500 ml-2">— {item.description}</span>
                  <p className="text-sm text-red-600">Prévue le {new Date(item.date_planifiee!).toLocaleDateString('fr-FR')}</p>
                </div>
                <button onClick={() => markDone(item)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  Marquer fait
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* À venir */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" /> Maintenances planifiées ({upcoming.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {upcoming.map(item => (
            <div key={item.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{(item.equipements as any)?.nom || 'Équipement'}</div>
                <div className="text-sm text-gray-500">{item.description}</div>
                <div className="text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {item.date_planifiee ? new Date(item.date_planifiee).toLocaleDateString('fr-FR') : 'Non planifiée'}
                  {item.intervalle_jours && <span className="ml-2">• Récurrence: tous les {item.intervalle_jours}j</span>}
                </div>
              </div>
              <button onClick={() => markDone(item)} className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                <CheckCircle className="w-4 h-4 inline mr-1" /> Fait
              </button>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">Aucune maintenance planifiée</div>
          )}
        </div>
      </div>

      {/* Historique */}
      {done.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-500">Historique ({done.length})</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {done.slice(0, 10).map(item => (
              <div key={item.id} className="px-6 py-3 flex items-center gap-3 text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{(item.equipements as any)?.nom}</span>
                <span>— {item.description}</span>
                <span className="ml-auto">{item.date_realisee ? new Date(item.date_realisee).toLocaleDateString('fr-FR') : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Planifier une maintenance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Équipement *</label>
                <select value={form.equipement_id} onChange={e => setForm({ ...form, equipement_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <option value="">Sélectionner...</option>
                  {equipements.map(e => <option key={e.id} value={e.id}>{e.nom} ({e.type})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <option value="preventive">Préventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="revision">Révision</option>
                  <option value="nettoyage">Nettoyage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Ex: Remplacement filtres cabine" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date prévue</label>
                  <input type="date" value={form.date_planifiee} onChange={e => setForm({ ...form, date_planifiee: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Récurrence (jours)</label>
                  <input type="number" value={form.intervalle_jours} onChange={e => setForm({ ...form, intervalle_jours: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="90" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Technicien</label>
                <input type="text" value={form.technicien} onChange={e => setForm({ ...form, technicien: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 font-bold">Planifier</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
