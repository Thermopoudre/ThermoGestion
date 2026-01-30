'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Camera, Box, Weight, Ruler, Check, X, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Rack {
  id: string
  numero: string
  nom?: string
  type: 'standard' | 'cremaillere' | 'palonnier'
  longueur_cm?: number
  largeur_cm?: number
  hauteur_cm?: number
  capacite_kg: number
  nb_crochets: number
  status: 'disponible' | 'en_utilisation' | 'maintenance'
  photo_url?: string
  notes?: string
}

interface RacksManagementProps {
  racks: Rack[]
  atelierId: string
  onUpdate: () => void
}

export default function RacksManagement({ racks, atelierId, onUpdate }: RacksManagementProps) {
  const supabase = createBrowserClient()
  const [editingRack, setEditingRack] = useState<Rack | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState<Partial<Rack>>({
    numero: '',
    nom: '',
    type: 'standard',
    longueur_cm: 200,
    largeur_cm: 100,
    hauteur_cm: 200,
    capacite_kg: 100,
    nb_crochets: 20,
    status: 'disponible',
    notes: ''
  })

  const resetForm = () => {
    setForm({
      numero: '',
      nom: '',
      type: 'standard',
      longueur_cm: 200,
      largeur_cm: 100,
      hauteur_cm: 200,
      capacite_kg: 100,
      nb_crochets: 20,
      status: 'disponible',
      notes: ''
    })
    setEditingRack(null)
    setShowForm(false)
  }

  const handleEdit = (rack: Rack) => {
    setForm(rack)
    setEditingRack(rack)
    setShowForm(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (editingRack) {
        await supabase
          .from('racks')
          .update(form)
          .eq('id', editingRack.id)
      } else {
        await supabase
          .from('racks')
          .insert({ ...form, atelier_id: atelierId })
      }
      resetForm()
      onUpdate()
    } catch (error) {
      console.error('Error saving rack:', error)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce rack ?')) return
    
    try {
      await supabase.from('racks').delete().eq('id', id)
      onUpdate()
    } catch (error) {
      console.error('Error deleting rack:', error)
    }
  }

  const handleStatusChange = async (rack: Rack, newStatus: Rack['status']) => {
    try {
      await supabase
        .from('racks')
        .update({ status: newStatus })
        .eq('id', rack.id)
      onUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const statusColors = {
    disponible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    en_utilisation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }

  const statusLabels = {
    disponible: 'Disponible',
    en_utilisation: 'En utilisation',
    maintenance: 'Maintenance'
  }

  const typeLabels = {
    standard: 'Standard',
    cremaillere: 'Crémaillère',
    palonnier: 'Palonnier'
  }

  const stats = {
    total: racks.length,
    disponibles: racks.filter(r => r.status === 'disponible').length,
    enUtilisation: racks.filter(r => r.status === 'en_utilisation').length,
    maintenance: racks.filter(r => r.status === 'maintenance').length,
    capaciteTotale: racks.reduce((sum, r) => sum + r.capacite_kg, 0)
  }

  return (
    <div className="space-y-6">
      {/* Header et stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestion des Racks</h2>
          <p className="text-sm text-gray-500">{stats.total} rack(s) • Capacité totale : {stats.capaciteTotale} kg</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau rack
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">Disponibles</p>
          <p className="text-2xl font-bold text-green-600">{stats.disponibles}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">En utilisation</p>
          <p className="text-2xl font-bold text-blue-600">{stats.enUtilisation}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">En maintenance</p>
          <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-4">
            {editingRack ? 'Modifier le rack' : 'Nouveau rack'}
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Numéro *</label>
              <input
                type="text"
                value={form.numero || ''}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="R-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom</label>
              <input
                type="text"
                value={form.nom || ''}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Rack principal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Rack['type'] })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="standard">Standard</option>
                <option value="cremaillere">Crémaillère</option>
                <option value="palonnier">Palonnier</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longueur (cm)</label>
              <input
                type="number"
                value={form.longueur_cm || ''}
                onChange={(e) => setForm({ ...form, longueur_cm: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Largeur (cm)</label>
              <input
                type="number"
                value={form.largeur_cm || ''}
                onChange={(e) => setForm({ ...form, largeur_cm: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hauteur (cm)</label>
              <input
                type="number"
                value={form.hauteur_cm || ''}
                onChange={(e) => setForm({ ...form, hauteur_cm: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Capacité (kg)</label>
              <input
                type="number"
                value={form.capacite_kg || ''}
                onChange={(e) => setForm({ ...form, capacite_kg: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nb crochets</label>
              <input
                type="number"
                value={form.nb_crochets || ''}
                onChange={(e) => setForm({ ...form, nb_crochets: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Rack['status'] })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="disponible">Disponible</option>
                <option value="en_utilisation">En utilisation</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !form.numero}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des racks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {racks.map((rack) => (
          <div
            key={rack.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Photo ou placeholder */}
            <div className="h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              {rack.photo_url ? (
                <img src={rack.photo_url} alt={rack.numero} className="w-full h-full object-cover" />
              ) : (
                <Box className="w-12 h-12 text-gray-400" />
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">{rack.numero}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[rack.status]}`}>
                  {statusLabels[rack.status]}
                </span>
              </div>

              {rack.nom && (
                <p className="text-sm text-gray-500 mb-2">{rack.nom}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Ruler className="w-4 h-4" />
                  {rack.longueur_cm} × {rack.largeur_cm} × {rack.hauteur_cm} cm
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Weight className="w-4 h-4" />
                  {rack.capacite_kg} kg max
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                {typeLabels[rack.type]} • {rack.nb_crochets} crochets
              </p>

              {/* Actions rapides de statut */}
              <div className="flex gap-2 mb-3">
                {rack.status !== 'disponible' && (
                  <button
                    onClick={() => handleStatusChange(rack, 'disponible')}
                    className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    <Check className="w-3 h-3 inline mr-1" />
                    Disponible
                  </button>
                )}
                {rack.status !== 'en_utilisation' && (
                  <button
                    onClick={() => handleStatusChange(rack, 'en_utilisation')}
                    className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    En usage
                  </button>
                )}
                {rack.status !== 'maintenance' && (
                  <button
                    onClick={() => handleStatusChange(rack, 'maintenance')}
                    className="flex-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                  >
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Maint.
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleEdit(rack)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(rack.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {racks.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Aucun rack configuré</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-blue-600 hover:underline"
          >
            Ajouter un premier rack
          </button>
        </div>
      )}
    </div>
  )
}
