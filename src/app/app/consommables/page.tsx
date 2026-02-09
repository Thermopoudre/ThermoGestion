'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Package, Plus, AlertTriangle, Search, Filter, Edit, Trash2, ArrowDown, ArrowUp } from 'lucide-react'

interface Consommable {
  id: string
  nom: string
  categorie: string
  description: string | null
  unite: string
  stock_actuel: number
  stock_minimum: number
  prix_unitaire: number | null
  fournisseur: string | null
  reference_fournisseur: string | null
  date_peremption: string | null
  emplacement: string | null
}

const CATEGORIES = [
  { value: 'filtre', label: 'Filtres cabine' },
  { value: 'epi', label: 'EPI (gants, masques)' },
  { value: 'chimique', label: 'Produits chimiques' },
  { value: 'abrasif', label: 'Abrasifs' },
  { value: 'accrochage', label: 'Crochets / Accrochage' },
  { value: 'emballage', label: 'Emballage' },
  { value: 'autre', label: 'Autre' },
]

export default function ConsommablesPage() {
  const supabase = createBrowserClient()
  const [items, setItems] = useState<Consommable[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Consommable | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const [form, setForm] = useState({
    nom: '', categorie: 'autre', description: '', unite: 'pièce',
    stock_actuel: '0', stock_minimum: '5', prix_unitaire: '',
    fournisseur: '', reference_fournisseur: '', date_peremption: '', emplacement: ''
  })

  const loadData = async () => {
    const { data } = await supabase
      .from('consommables')
      .select('*')
      .order('categorie')
      .order('nom')
    if (data) setItems(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    const payload = {
      nom: form.nom,
      categorie: form.categorie,
      description: form.description || null,
      unite: form.unite,
      stock_actuel: parseFloat(form.stock_actuel) || 0,
      stock_minimum: parseFloat(form.stock_minimum) || 0,
      prix_unitaire: form.prix_unitaire ? parseFloat(form.prix_unitaire) : null,
      fournisseur: form.fournisseur || null,
      reference_fournisseur: form.reference_fournisseur || null,
      date_peremption: form.date_peremption || null,
      emplacement: form.emplacement || null,
    }

    if (editItem) {
      await supabase.from('consommables').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('consommables').insert(payload)
    }
    setShowForm(false)
    setEditItem(null)
    setForm({ nom: '', categorie: 'autre', description: '', unite: 'pièce', stock_actuel: '0', stock_minimum: '5', prix_unitaire: '', fournisseur: '', reference_fournisseur: '', date_peremption: '', emplacement: '' })
    loadData()
  }

  const handleMouvement = async (id: string, type: 'entree' | 'sortie', quantite: number) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newStock = type === 'entree' ? item.stock_actuel + quantite : item.stock_actuel - quantite
    await supabase.from('consommables').update({ stock_actuel: Math.max(0, newStock) }).eq('id', id)
    await supabase.from('consommables_mouvements').insert({ consommable_id: id, type, quantite, motif: `${type === 'entree' ? 'Réception' : 'Utilisation'} manuelle` })
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce consommable ?')) return
    await supabase.from('consommables').delete().eq('id', id)
    loadData()
  }

  const openEdit = (item: Consommable) => {
    setEditItem(item)
    setForm({
      nom: item.nom, categorie: item.categorie, description: item.description || '',
      unite: item.unite, stock_actuel: String(item.stock_actuel), stock_minimum: String(item.stock_minimum),
      prix_unitaire: item.prix_unitaire ? String(item.prix_unitaire) : '', fournisseur: item.fournisseur || '',
      reference_fournisseur: item.reference_fournisseur || '', date_peremption: item.date_peremption || '',
      emplacement: item.emplacement || ''
    })
    setShowForm(true)
  }

  const filtered = items.filter(i => {
    if (catFilter && i.categorie !== catFilter) return false
    if (search && !i.nom.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const alertes = items.filter(i => i.stock_actuel <= i.stock_minimum)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-orange-500" />
            Consommables
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Filtres, EPI, produits chimiques, abrasifs...</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditItem(null); setForm({ nom: '', categorie: 'autre', description: '', unite: 'pièce', stock_actuel: '0', stock_minimum: '5', prix_unitaire: '', fournisseur: '', reference_fournisseur: '', date_peremption: '', emplacement: '' }) }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Alertes stock bas */}
      {alertes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" /> {alertes.length} consommable(s) en stock bas
          </h3>
          <div className="flex flex-wrap gap-2">
            {alertes.map(a => (
              <span key={a.id} className="px-3 py-1 bg-amber-100 dark:bg-amber-800/30 rounded-full text-sm text-amber-700 dark:text-amber-300">
                {a.nom}: {a.stock_actuel} {a.unite} (min: {a.stock_minimum})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Liste */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Minimum</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(item => {
              const isLow = item.stock_actuel <= item.stock_minimum
              return (
                <tr key={item.id} className={isLow ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{item.nom}</div>
                    {item.fournisseur && <div className="text-xs text-gray-500">{item.fournisseur}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm">{CATEGORIES.find(c => c.value === item.categorie)?.label || item.categorie}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                      {item.stock_actuel} {item.unite}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">{item.stock_minimum} {item.unite}</td>
                  <td className="px-4 py-3 text-right text-sm">{item.prix_unitaire ? `${item.prix_unitaire.toFixed(2)} €` : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleMouvement(item.id, 'entree', 1)} title="Entrée +1" className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleMouvement(item.id, 'sortie', 1)} title="Sortie -1" className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editItem ? 'Modifier' : 'Ajouter'} un consommable</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom *</label>
                <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unité</label>
                  <select value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    <option value="pièce">Pièce</option>
                    <option value="boîte">Boîte</option>
                    <option value="rouleau">Rouleau</option>
                    <option value="litre">Litre</option>
                    <option value="kg">Kg</option>
                    <option value="paire">Paire</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Stock actuel</label>
                  <input type="number" value={form.stock_actuel} onChange={e => setForm({ ...form, stock_actuel: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock minimum</label>
                  <input type="number" value={form.stock_minimum} onChange={e => setForm({ ...form, stock_minimum: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prix unitaire (€)</label>
                  <input type="number" step="0.01" value={form.prix_unitaire} onChange={e => setForm({ ...form, prix_unitaire: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Fournisseur</label>
                  <input type="text" value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date péremption</label>
                  <input type="date" value={form.date_peremption} onChange={e => setForm({ ...form, date_peremption: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Emplacement</label>
                <input type="text" value={form.emplacement} onChange={e => setForm({ ...form, emplacement: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Ex: Étagère A3" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 font-bold">
                {editItem ? 'Mettre à jour' : 'Ajouter'}
              </button>
              <button onClick={() => { setShowForm(false); setEditItem(null) }} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
