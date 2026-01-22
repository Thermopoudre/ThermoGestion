'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Package, Search, Filter, GripVertical } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Prestation {
  id: string
  code: string
  nom: string
  description?: string
  categorie?: string
  unite: string
  prix_unitaire_ht: number
  tva_rate: number
  duree_estimee_min?: number
  is_active: boolean
  ordre_affichage: number
}

interface PrestationsCatalogProps {
  prestations: Prestation[]
  atelierId: string
  onUpdate: () => void
  onSelect?: (prestation: Prestation) => void
}

const categories = [
  { id: 'thermolaquage', label: 'Thermolaquage', color: 'bg-blue-100 text-blue-700' },
  { id: 'sablage', label: 'Sablage/Grenaillage', color: 'bg-orange-100 text-orange-700' },
  { id: 'traitement', label: 'Traitement de surface', color: 'bg-green-100 text-green-700' },
  { id: 'transport', label: 'Transport/Logistique', color: 'bg-purple-100 text-purple-700' },
  { id: 'autre', label: 'Autre', color: 'bg-gray-100 text-gray-700' }
]

const unites = [
  { id: 'm2', label: 'm²' },
  { id: 'kg', label: 'kg' },
  { id: 'piece', label: 'pièce' },
  { id: 'ml', label: 'm linéaire' },
  { id: 'forfait', label: 'forfait' },
  { id: 'heure', label: 'heure' }
]

export default function PrestationsCatalog({ prestations, atelierId, onUpdate, onSelect }: PrestationsCatalogProps) {
  const supabase = createClientComponentClient()
  const [showForm, setShowForm] = useState(false)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState<Partial<Prestation>>({
    code: '',
    nom: '',
    description: '',
    categorie: 'thermolaquage',
    unite: 'm2',
    prix_unitaire_ht: 0,
    tva_rate: 20,
    duree_estimee_min: undefined,
    is_active: true,
    ordre_affichage: 0
  })

  const resetForm = () => {
    setForm({
      code: '',
      nom: '',
      description: '',
      categorie: 'thermolaquage',
      unite: 'm2',
      prix_unitaire_ht: 0,
      tva_rate: 20,
      duree_estimee_min: undefined,
      is_active: true,
      ordre_affichage: prestations.length
    })
    setEditingPrestation(null)
    setShowForm(false)
  }

  const handleEdit = (prestation: Prestation) => {
    setForm(prestation)
    setEditingPrestation(prestation)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.nom || !form.prix_unitaire_ht) return
    
    setLoading(true)
    try {
      if (editingPrestation) {
        await supabase
          .from('prestations')
          .update(form)
          .eq('id', editingPrestation.id)
      } else {
        await supabase
          .from('prestations')
          .insert({ ...form, atelier_id: atelierId })
      }
      resetForm()
      onUpdate()
    } catch (error) {
      console.error('Error saving prestation:', error)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette prestation ?')) return
    
    try {
      await supabase.from('prestations').delete().eq('id', id)
      onUpdate()
    } catch (error) {
      console.error('Error deleting prestation:', error)
    }
  }

  const toggleActive = async (prestation: Prestation) => {
    try {
      await supabase
        .from('prestations')
        .update({ is_active: !prestation.is_active })
        .eq('id', prestation.id)
      onUpdate()
    } catch (error) {
      console.error('Error toggling prestation:', error)
    }
  }

  // Filtrer les prestations
  const filteredPrestations = prestations.filter(p => {
    const matchSearch = !search || 
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    const matchCategorie = !filterCategorie || p.categorie === filterCategorie
    return matchSearch && matchCategorie
  })

  // Grouper par catégorie
  const groupedPrestations = categories.reduce((acc, cat) => {
    acc[cat.id] = filteredPrestations.filter(p => p.categorie === cat.id)
    return acc
  }, {} as Record<string, Prestation[]>)

  const getCategoryStyle = (categorie?: string) => {
    return categories.find(c => c.id === categorie)?.color || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Catalogue des Prestations</h2>
          <p className="text-sm text-gray-500">{prestations.length} prestation(s) configurée(s)</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle prestation
        </button>
      </div>

      {/* Recherche et filtres */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une prestation..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategorie(null)}
            className={`px-3 py-2 rounded-lg text-sm ${
              !filterCategorie ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategorie(cat.id === filterCategorie ? null : cat.id)}
              className={`px-3 py-2 rounded-lg text-sm ${
                filterCategorie === cat.id ? cat.color : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste par catégorie */}
      {filterCategorie ? (
        // Vue filtrée
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredPrestations.map((prestation) => (
              <PrestationRow
                key={prestation.id}
                prestation={prestation}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={toggleActive}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ) : (
        // Vue groupée
        categories.map((cat) => {
          const catPrestations = groupedPrestations[cat.id]
          if (catPrestations.length === 0) return null

          return (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className={`px-4 py-3 ${cat.color} rounded-t-xl font-medium`}>
                {cat.label} ({catPrestations.length})
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {catPrestations.map((prestation) => (
                  <PrestationRow
                    key={prestation.id}
                    prestation={prestation}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={toggleActive}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {filteredPrestations.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Aucune prestation trouvée</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">
              {editingPrestation ? 'Modifier la prestation' : 'Nouvelle prestation'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code *</label>
                  <input
                    type="text"
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    placeholder="THERMO-STD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Catégorie</label>
                  <select
                    value={form.categorie || 'thermolaquage'}
                    onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.nom || ''}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Thermolaquage standard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={2}
                  placeholder="Description de la prestation..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Prix HT *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prix_unitaire_ht || ''}
                    onChange={(e) => setForm({ ...form, prix_unitaire_ht: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unité</label>
                  <select
                    value={form.unite || 'm2'}
                    onChange={(e) => setForm({ ...form, unite: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    {unites.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TVA %</label>
                  <select
                    value={form.tva_rate || 20}
                    onChange={(e) => setForm({ ...form, tva_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={20}>20%</option>
                    <option value={10}>10%</option>
                    <option value={5.5}>5.5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Durée estimée (min)</label>
                <input
                  type="number"
                  value={form.duree_estimee_min || ''}
                  onChange={(e) => setForm({ ...form, duree_estimee_min: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Optionnel"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Prestation active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !form.code || !form.nom || !form.prix_unitaire_ht}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Composant ligne de prestation
function PrestationRow({ 
  prestation, 
  onEdit, 
  onDelete, 
  onToggleActive,
  onSelect 
}: { 
  prestation: Prestation
  onEdit: (p: Prestation) => void
  onDelete: (id: string) => void
  onToggleActive: (p: Prestation) => void
  onSelect?: (p: Prestation) => void
}) {
  const unite = unites.find(u => u.id === prestation.unite)?.label || prestation.unite
  
  return (
    <div 
      className={`p-4 flex items-center gap-4 ${!prestation.is_active ? 'opacity-50' : ''} ${
        onSelect ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
      }`}
      onClick={() => onSelect?.(prestation)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {prestation.code}
          </span>
          <span className="font-medium">{prestation.nom}</span>
          {!prestation.is_active && (
            <span className="text-xs text-red-500">(Inactif)</span>
          )}
        </div>
        {prestation.description && (
          <p className="text-sm text-gray-500 mt-1">{prestation.description}</p>
        )}
      </div>
      
      <div className="text-right">
        <p className="font-semibold">{prestation.prix_unitaire_ht.toFixed(2)} € / {unite}</p>
        <p className="text-xs text-gray-500">TVA {prestation.tva_rate}%</p>
      </div>

      {!onSelect && (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive(prestation) }}
            className={`p-2 rounded-lg ${
              prestation.is_active 
                ? 'text-green-600 hover:bg-green-50' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            {prestation.is_active ? '✓' : '○'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(prestation) }}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(prestation.id) }}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
