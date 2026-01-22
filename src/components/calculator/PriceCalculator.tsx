'use client'

import { useState, useMemo, useEffect } from 'react'
import { Calculator, Info, Save, RotateCcw } from 'lucide-react'

interface GrilleTarifaire {
  id: string
  nom: string
  prix_base_m2: number
  palier_1_max_m2: number
  palier_1_coef: number
  palier_2_max_m2: number
  palier_2_coef: number
  palier_3_max_m2: number
  palier_3_coef: number
  palier_4_coef: number
  complexite_simple_coef: number
  complexite_moyenne_coef: number
  complexite_complexe_coef: number
  finition_mat_coef: number
  finition_satine_coef: number
  finition_brillant_coef: number
  finition_texture_coef: number
  finition_metallise_coef: number
  prix_couche_sup: number
  forfait_minimum: number
  prix_sablage_m2: number
  prix_degraissage_m2: number
  prix_primaire_m2: number
}

interface PriceCalculatorProps {
  grille?: GrilleTarifaire
  onApply?: (result: CalculationResult) => void
  initialValues?: Partial<FormValues>
}

interface FormValues {
  longueur: number
  largeur: number
  hauteur: number
  quantite: number
  complexite: 'simple' | 'moyenne' | 'complexe'
  finition: 'mat' | 'satine' | 'brillant' | 'texture' | 'metallise'
  couches: number
  sablage: boolean
  degraissage: boolean
  primaire: boolean
}

interface CalculationResult {
  surface_m2: number
  prix_base: number
  coef_surface: number
  coef_complexite: number
  coef_finition: number
  prix_couches_sup: number
  prix_preparation: number
  total_ht: number
  total_ttc: number
  detail: {
    label: string
    value: number
  }[]
}

const defaultGrille: GrilleTarifaire = {
  id: 'default',
  nom: 'Grille standard',
  prix_base_m2: 15,
  palier_1_max_m2: 2,
  palier_1_coef: 1.5,
  palier_2_max_m2: 5,
  palier_2_coef: 1.2,
  palier_3_max_m2: 10,
  palier_3_coef: 1,
  palier_4_coef: 0.85,
  complexite_simple_coef: 1,
  complexite_moyenne_coef: 1.3,
  complexite_complexe_coef: 1.6,
  finition_mat_coef: 1,
  finition_satine_coef: 1.05,
  finition_brillant_coef: 1.1,
  finition_texture_coef: 1.25,
  finition_metallise_coef: 1.35,
  prix_couche_sup: 8,
  forfait_minimum: 50,
  prix_sablage_m2: 12,
  prix_degraissage_m2: 5,
  prix_primaire_m2: 8
}

export default function PriceCalculator({ grille, onApply, initialValues }: PriceCalculatorProps) {
  const g = grille || defaultGrille
  
  const [form, setForm] = useState<FormValues>({
    longueur: initialValues?.longueur || 100,
    largeur: initialValues?.largeur || 50,
    hauteur: initialValues?.hauteur || 0,
    quantite: initialValues?.quantite || 1,
    complexite: initialValues?.complexite || 'simple',
    finition: initialValues?.finition || 'mat',
    couches: initialValues?.couches || 1,
    sablage: initialValues?.sablage || false,
    degraissage: initialValues?.degraissage || false,
    primaire: initialValues?.primaire || false
  })

  const result = useMemo<CalculationResult>(() => {
    // Calcul surface (en m²)
    // Si hauteur > 0, calcul 3D (boîte), sinon 2D (plaque)
    let surface_m2: number
    if (form.hauteur > 0) {
      // Surface d'une boîte ouverte (5 faces)
      const l = form.longueur / 100 // cm -> m
      const w = form.largeur / 100
      const h = form.hauteur / 100
      surface_m2 = (l * w) + 2 * (l * h) + 2 * (w * h)
    } else {
      // Surface 2D (2 faces)
      surface_m2 = 2 * (form.longueur / 100) * (form.largeur / 100)
    }
    surface_m2 *= form.quantite

    // Coefficient de surface (dégressivité)
    let coef_surface: number
    if (surface_m2 <= g.palier_1_max_m2) {
      coef_surface = g.palier_1_coef
    } else if (surface_m2 <= g.palier_2_max_m2) {
      coef_surface = g.palier_2_coef
    } else if (surface_m2 <= g.palier_3_max_m2) {
      coef_surface = g.palier_3_coef
    } else {
      coef_surface = g.palier_4_coef
    }

    // Coefficient complexité
    const coef_complexite = form.complexite === 'simple' 
      ? g.complexite_simple_coef 
      : form.complexite === 'moyenne' 
        ? g.complexite_moyenne_coef 
        : g.complexite_complexe_coef

    // Coefficient finition
    const coef_finition = {
      mat: g.finition_mat_coef,
      satine: g.finition_satine_coef,
      brillant: g.finition_brillant_coef,
      texture: g.finition_texture_coef,
      metallise: g.finition_metallise_coef
    }[form.finition]

    // Prix de base
    const prix_base = surface_m2 * g.prix_base_m2 * coef_surface * coef_complexite * coef_finition

    // Couches supplémentaires
    const prix_couches_sup = form.couches > 1 ? (form.couches - 1) * g.prix_couche_sup * surface_m2 : 0

    // Préparation
    let prix_preparation = 0
    if (form.sablage) prix_preparation += g.prix_sablage_m2 * surface_m2
    if (form.degraissage) prix_preparation += g.prix_degraissage_m2 * surface_m2
    if (form.primaire) prix_preparation += g.prix_primaire_m2 * surface_m2

    // Total
    let total_ht = prix_base + prix_couches_sup + prix_preparation
    
    // Forfait minimum
    if (total_ht < g.forfait_minimum) {
      total_ht = g.forfait_minimum
    }

    const total_ttc = total_ht * 1.2

    // Détail pour affichage
    const detail = [
      { label: `Surface (${surface_m2.toFixed(2)} m²) × ${g.prix_base_m2}€`, value: surface_m2 * g.prix_base_m2 },
      { label: `Coef. surface (×${coef_surface.toFixed(2)})`, value: 0 },
      { label: `Coef. complexité (×${coef_complexite.toFixed(2)})`, value: 0 },
      { label: `Coef. finition (×${coef_finition.toFixed(2)})`, value: 0 },
    ]
    
    if (prix_couches_sup > 0) {
      detail.push({ label: `${form.couches - 1} couche(s) sup.`, value: prix_couches_sup })
    }
    if (form.sablage) {
      detail.push({ label: 'Sablage', value: g.prix_sablage_m2 * surface_m2 })
    }
    if (form.degraissage) {
      detail.push({ label: 'Dégraissage', value: g.prix_degraissage_m2 * surface_m2 })
    }
    if (form.primaire) {
      detail.push({ label: 'Primaire anticorrosion', value: g.prix_primaire_m2 * surface_m2 })
    }

    return {
      surface_m2,
      prix_base,
      coef_surface,
      coef_complexite,
      coef_finition,
      prix_couches_sup,
      prix_preparation,
      total_ht,
      total_ttc,
      detail
    }
  }, [form, g])

  const reset = () => {
    setForm({
      longueur: 100,
      largeur: 50,
      hauteur: 0,
      quantite: 1,
      complexite: 'simple',
      finition: 'mat',
      couches: 1,
      sablage: false,
      degraissage: false,
      primaire: false
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Calculateur de Prix</h3>
          </div>
          <button
            onClick={reset}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">Grille : {g.nom}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dimensions (cm)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Longueur</label>
              <input
                type="number"
                value={form.longueur}
                onChange={(e) => setForm({ ...form, longueur: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Largeur</label>
              <input
                type="number"
                value={form.largeur}
                onChange={(e) => setForm({ ...form, largeur: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Hauteur (3D)</label>
              <input
                type="number"
                value={form.hauteur}
                onChange={(e) => setForm({ ...form, hauteur: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="0 = 2D"
              />
            </div>
          </div>
        </div>

        {/* Quantité */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quantité de pièces
          </label>
          <input
            type="number"
            min="1"
            value={form.quantite}
            onChange={(e) => setForm({ ...form, quantite: Math.max(1, Number(e.target.value)) })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        {/* Complexité */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Complexité de la pièce
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['simple', 'moyenne', 'complexe'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setForm({ ...form, complexite: c })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.complexite === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {form.complexite === 'simple' && 'Plaques, tubes droits, pièces plates'}
            {form.complexite === 'moyenne' && 'Pièces avec angles, profils, reliefs légers'}
            {form.complexite === 'complexe' && 'Pièces ajourées, volutes, structures 3D complexes'}
          </p>
        </div>

        {/* Finition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type de finition
          </label>
          <select
            value={form.finition}
            onChange={(e) => setForm({ ...form, finition: e.target.value as FormValues['finition'] })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="mat">Mat (standard)</option>
            <option value="satine">Satiné (+5%)</option>
            <option value="brillant">Brillant (+10%)</option>
            <option value="texture">Texturé (+25%)</option>
            <option value="metallise">Métallisé (+35%)</option>
          </select>
        </div>

        {/* Couches */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nombre de couches
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="3"
              value={form.couches}
              onChange={(e) => setForm({ ...form, couches: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-lg font-semibold w-8">{form.couches}</span>
          </div>
        </div>

        {/* Options préparation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Préparation de surface
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sablage}
                onChange={(e) => setForm({ ...form, sablage: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Sablage/Grenaillage (+{g.prix_sablage_m2}€/m²)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.degraissage}
                onChange={(e) => setForm({ ...form, degraissage: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Dégraissage (+{g.prix_degraissage_m2}€/m²)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.primaire}
                onChange={(e) => setForm({ ...form, primaire: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Primaire anticorrosion (+{g.prix_primaire_m2}€/m²)</span>
            </label>
          </div>
        </div>

        {/* Résultat */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Surface totale</span>
            <span className="font-semibold">{result.surface_m2.toFixed(2)} m²</span>
          </div>
          
          <div className="space-y-1 text-sm border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
            {result.detail.filter(d => d.value > 0).map((d, i) => (
              <div key={i} className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{d.label}</span>
                <span>{d.value.toFixed(2)} €</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-lg">
            <span className="font-medium">Total HT</span>
            <span className="font-bold text-blue-600">{result.total_ht.toFixed(2)} €</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total TTC (20%)</span>
            <span className="font-semibold text-gray-900 dark:text-white">{result.total_ttc.toFixed(2)} €</span>
          </div>
          
          {result.total_ht === g.forfait_minimum && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Forfait minimum appliqué
            </p>
          )}
        </div>

        {onApply && (
          <button
            onClick={() => onApply(result)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            Appliquer au devis
          </button>
        )}
      </div>
    </div>
  )
}
