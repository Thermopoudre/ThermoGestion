'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Euro, Plus, Trash2, Save, Calculator } from 'lucide-react'

interface Palier {
  id?: string
  nom: string
  surface_min_m2: number
  surface_max_m2: number | null
  prix_m2: number
  majoration_metallise_pct: number
  majoration_texture_pct: number
  majoration_brillant_pct: number
  forfait_minimum: number
  prix_kg_petites_pieces: number | null
  actif: boolean
}

export default function GrilleTarifairePage() {
  const supabase = createBrowserClient()
  const [paliers, setPaliers] = useState<Palier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Simulateur
  const [simSurface, setSimSurface] = useState('3')
  const [simFinition, setSimFinition] = useState('mat')

  const loadData = async () => {
    const { data } = await supabase
      .from('grilles_tarifaires_paliers')
      .select('*')
      .order('surface_min_m2')
    if (data && data.length > 0) {
      setPaliers(data)
    } else {
      // Valeurs par défaut
      setPaliers([
        { nom: 'Très petite', surface_min_m2: 0, surface_max_m2: 0.5, prix_m2: 45, majoration_metallise_pct: 25, majoration_texture_pct: 15, majoration_brillant_pct: 10, forfait_minimum: 25, prix_kg_petites_pieces: 35, actif: true },
        { nom: 'Petite', surface_min_m2: 0.5, surface_max_m2: 2, prix_m2: 35, majoration_metallise_pct: 25, majoration_texture_pct: 15, majoration_brillant_pct: 10, forfait_minimum: 30, prix_kg_petites_pieces: null, actif: true },
        { nom: 'Moyenne', surface_min_m2: 2, surface_max_m2: 5, prix_m2: 28, majoration_metallise_pct: 25, majoration_texture_pct: 15, majoration_brillant_pct: 10, forfait_minimum: 0, prix_kg_petites_pieces: null, actif: true },
        { nom: 'Grande', surface_min_m2: 5, surface_max_m2: 10, prix_m2: 22, majoration_metallise_pct: 25, majoration_texture_pct: 15, majoration_brillant_pct: 10, forfait_minimum: 0, prix_kg_petites_pieces: null, actif: true },
        { nom: 'Très grande', surface_min_m2: 10, surface_max_m2: null, prix_m2: 18, majoration_metallise_pct: 25, majoration_texture_pct: 15, majoration_brillant_pct: 10, forfait_minimum: 0, prix_kg_petites_pieces: null, actif: true },
      ])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    setSaving(true)
    // Supprimer les anciens paliers
    await supabase.from('grilles_tarifaires_paliers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Insérer les nouveaux
    const { error } = await supabase.from('grilles_tarifaires_paliers').insert(
      paliers.map(({ id, ...p }) => p)
    )
    if (!error) alert('Grille tarifaire enregistrée !')
    setSaving(false)
    loadData()
  }

  const updatePalier = (index: number, updates: Partial<Palier>) => {
    setPaliers(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p))
  }

  const addPalier = () => {
    const last = paliers[paliers.length - 1]
    setPaliers([...paliers, {
      nom: 'Nouveau palier',
      surface_min_m2: last ? (last.surface_max_m2 || last.surface_min_m2 + 5) : 0,
      surface_max_m2: null,
      prix_m2: 20,
      majoration_metallise_pct: 25,
      majoration_texture_pct: 15,
      majoration_brillant_pct: 10,
      forfait_minimum: 0,
      prix_kg_petites_pieces: null,
      actif: true,
    }])
  }

  const removePalier = (index: number) => {
    setPaliers(prev => prev.filter((_, i) => i !== index))
  }

  // Simulateur de prix
  const simulerPrix = () => {
    const surface = parseFloat(simSurface) || 0
    const palier = paliers.find(p => surface >= p.surface_min_m2 && (p.surface_max_m2 === null || surface < p.surface_max_m2))
    if (!palier) return { prix: 0, majoration: 0, total: 0, forfait: 0 }

    let prixBase = surface * palier.prix_m2
    let majPct = 0
    if (simFinition === 'metallise') majPct = palier.majoration_metallise_pct
    else if (simFinition === 'texture') majPct = palier.majoration_texture_pct
    else if (simFinition === 'brillant') majPct = palier.majoration_brillant_pct

    const majoration = prixBase * majPct / 100
    const total = Math.max(prixBase + majoration, palier.forfait_minimum)
    return { prix: prixBase, majoration, total, forfait: palier.forfait_minimum, palierNom: palier.nom }
  }

  const sim = simulerPrix()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Euro className="w-7 h-7 text-orange-500" />
            Grille tarifaire
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Prix au m² par palier de surface, majorations par finition</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* Simulateur */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Simulateur de prix
        </h3>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Surface (m²)</label>
            <input type="number" step="0.1" value={simSurface} onChange={e => setSimSurface(e.target.value)} className="w-32 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Finition</label>
            <select value={simFinition} onChange={e => setSimFinition(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
              <option value="mat">Mat / Satiné</option>
              <option value="brillant">Brillant</option>
              <option value="texture">Texturé</option>
              <option value="metallise">Métallisé</option>
            </select>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-3 border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-gray-500">Prix estimé</div>
            <div className="text-3xl font-black text-blue-600">{sim.total.toFixed(2)} € HT</div>
            <div className="text-xs text-gray-400">
              {sim.palierNom} • Base: {sim.prix.toFixed(2)}€ {sim.majoration > 0 ? `+ Majoration: ${sim.majoration.toFixed(2)}€` : ''}
              {sim.forfait > 0 && sim.prix + sim.majoration < sim.forfait ? ` (forfait min: ${sim.forfait}€)` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des paliers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">De (m²)</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">À (m²)</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prix/m²</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">+Métal %</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">+Texture %</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">+Brillant %</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Forfait min</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">€/kg</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {paliers.map((p, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input type="text" value={p.nom} onChange={e => updatePalier(i, { nom: e.target.value })} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="0.1" value={p.surface_min_m2} onChange={e => updatePalier(i, { surface_min_m2: parseFloat(e.target.value) })} className="w-20 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="0.1" value={p.surface_max_m2 ?? ''} onChange={e => updatePalier(i, { surface_max_m2: e.target.value ? parseFloat(e.target.value) : null })} className="w-20 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" placeholder="∞" /></td>
                <td className="px-3 py-2"><input type="number" step="0.5" value={p.prix_m2} onChange={e => updatePalier(i, { prix_m2: parseFloat(e.target.value) })} className="w-20 px-2 py-1 border rounded text-sm text-center font-bold text-green-600 dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="1" value={p.majoration_metallise_pct} onChange={e => updatePalier(i, { majoration_metallise_pct: parseFloat(e.target.value) })} className="w-16 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="1" value={p.majoration_texture_pct} onChange={e => updatePalier(i, { majoration_texture_pct: parseFloat(e.target.value) })} className="w-16 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="1" value={p.majoration_brillant_pct} onChange={e => updatePalier(i, { majoration_brillant_pct: parseFloat(e.target.value) })} className="w-16 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="1" value={p.forfait_minimum} onChange={e => updatePalier(i, { forfait_minimum: parseFloat(e.target.value) })} className="w-20 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" /></td>
                <td className="px-3 py-2"><input type="number" step="0.5" value={p.prix_kg_petites_pieces ?? ''} onChange={e => updatePalier(i, { prix_kg_petites_pieces: e.target.value ? parseFloat(e.target.value) : null })} className="w-20 px-2 py-1 border rounded text-sm text-center dark:bg-gray-700 dark:border-gray-600" placeholder="-" /></td>
                <td className="px-3 py-2">
                  <button onClick={() => removePalier(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={addPalier} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <Plus className="w-4 h-4" /> Ajouter un palier
          </button>
        </div>
      </div>
    </div>
  )
}
