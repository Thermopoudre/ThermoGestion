'use client'

import { useState } from 'react'
import { Calculator, Square, Circle, Box, Cylinder, TriangleRight, Plus, Trash2, Copy, Check } from 'lucide-react'

interface Shape {
  id: string
  type: 'rectangle' | 'circle' | 'cylinder' | 'tube' | 'angle' | 'custom'
  name: string
  dimensions: Record<string, number>
  quantity: number
  surface: number
}

const shapeConfigs = {
  rectangle: {
    label: 'Rectangle / Plaque',
    icon: Square,
    fields: [
      { key: 'longueur', label: 'Longueur (cm)', default: 100 },
      { key: 'largeur', label: 'Largeur (cm)', default: 50 },
    ],
    calculate: (d: Record<string, number>) => (d.longueur * d.largeur * 2) / 10000, // m² (2 faces)
  },
  circle: {
    label: 'Disque / Cercle',
    icon: Circle,
    fields: [
      { key: 'diametre', label: 'Diamètre (cm)', default: 50 },
    ],
    calculate: (d: Record<string, number>) => (Math.PI * Math.pow(d.diametre / 2, 2) * 2) / 10000, // m² (2 faces)
  },
  cylinder: {
    label: 'Cylindre plein',
    icon: Cylinder,
    fields: [
      { key: 'diametre', label: 'Diamètre (cm)', default: 10 },
      { key: 'longueur', label: 'Longueur (cm)', default: 100 },
    ],
    calculate: (d: Record<string, number>) => (Math.PI * d.diametre * d.longueur) / 10000, // m²
  },
  tube: {
    label: 'Tube creux',
    icon: Cylinder,
    fields: [
      { key: 'diametre_ext', label: 'Diamètre ext. (cm)', default: 10 },
      { key: 'diametre_int', label: 'Diamètre int. (cm)', default: 8 },
      { key: 'longueur', label: 'Longueur (cm)', default: 100 },
    ],
    calculate: (d: Record<string, number>) => {
      const surfaceExt = Math.PI * d.diametre_ext * d.longueur
      const surfaceInt = Math.PI * d.diametre_int * d.longueur
      return (surfaceExt + surfaceInt) / 10000 // m²
    },
  },
  angle: {
    label: 'Cornière / Angle',
    icon: TriangleRight,
    fields: [
      { key: 'aile1', label: 'Aile 1 (cm)', default: 5 },
      { key: 'aile2', label: 'Aile 2 (cm)', default: 5 },
      { key: 'epaisseur', label: 'Épaisseur (cm)', default: 0.5 },
      { key: 'longueur', label: 'Longueur (cm)', default: 100 },
    ],
    calculate: (d: Record<string, number>) => {
      // Surface = 2 faces des 2 ailes + chants
      const surfaceAiles = (d.aile1 + d.aile2) * d.longueur * 2
      const surfaceChants = (d.aile1 + d.aile2 + d.epaisseur * 4) * d.epaisseur * 2
      return (surfaceAiles + surfaceChants) / 10000 // m²
    },
  },
  custom: {
    label: 'Surface personnalisée',
    icon: Box,
    fields: [
      { key: 'surface', label: 'Surface (m²)', default: 1 },
    ],
    calculate: (d: Record<string, number>) => d.surface,
  },
}

export default function CalculateurPage() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [copied, setCopied] = useState(false)

  // Powder parameters
  const [prixPoudre, setPrixPoudre] = useState(15) // €/kg
  const [rendementPoudre, setRendementPoudre] = useState(10) // m²/kg
  const [epaisseurCouche, setEpaisseurCouche] = useState(80) // microns
  const [perte, setPerte] = useState(30) // % de perte

  function addShape(type: keyof typeof shapeConfigs) {
    const config = shapeConfigs[type]
    const defaultDimensions: Record<string, number> = {}
    config.fields.forEach(f => {
      defaultDimensions[f.key] = f.default
    })

    const newShape: Shape = {
      id: Date.now().toString(),
      type,
      name: config.label,
      dimensions: defaultDimensions,
      quantity: 1,
      surface: config.calculate(defaultDimensions),
    }

    setShapes([...shapes, newShape])
  }

  function updateShape(id: string, field: string, value: number) {
    setShapes(shapes.map(shape => {
      if (shape.id !== id) return shape
      
      const newDimensions = { ...shape.dimensions, [field]: value }
      const config = shapeConfigs[shape.type]
      const newSurface = config.calculate(newDimensions)
      
      return { ...shape, dimensions: newDimensions, surface: newSurface }
    }))
  }

  function updateQuantity(id: string, quantity: number) {
    setShapes(shapes.map(shape => 
      shape.id === id ? { ...shape, quantity: Math.max(1, quantity) } : shape
    ))
  }

  function removeShape(id: string) {
    setShapes(shapes.filter(s => s.id !== id))
  }

  function clearAll() {
    setShapes([])
  }

  // Calculations
  const totalSurface = shapes.reduce((acc, s) => acc + (s.surface * s.quantity), 0)
  const surfaceAvecPerte = totalSurface * (1 + perte / 100)
  const consommationPoudre = surfaceAvecPerte / rendementPoudre
  const coutPoudre = consommationPoudre * prixPoudre

  function copyResults() {
    const text = `Surface totale: ${totalSurface.toFixed(2)} m²
Avec pertes (${perte}%): ${surfaceAvecPerte.toFixed(2)} m²
Poudre nécessaire: ${consommationPoudre.toFixed(2)} kg
Coût poudre: ${coutPoudre.toFixed(2)} €`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Calculator className="w-8 h-8 text-orange-500" />
            Calculateur de Surface
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Calculez automatiquement la surface et la consommation de poudre
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Shape Selection & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shape Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">Ajouter une forme</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(shapeConfigs).map(([type, config]) => {
                  const Icon = config.icon
                  return (
                    <button
                      key={type}
                      onClick={() => addShape(type as keyof typeof shapeConfigs)}
                      className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:border-orange-500 border-2 border-transparent transition-all"
                    >
                      <Icon className="w-6 h-6 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Shapes List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 dark:text-white">Pièces ({shapes.length})</h2>
                {shapes.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Tout effacer
                  </button>
                )}
              </div>

              {shapes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Ajoutez des formes pour commencer le calcul</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shapes.map((shape, index) => {
                    const config = shapeConfigs[shape.type]
                    const Icon = config.icon
                    
                    return (
                      <div key={shape.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-orange-500" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              #{index + 1} {shape.name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeShape(shape.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                          {config.fields.map((field) => (
                            <div key={field.key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              <input
                                type="number"
                                value={shape.dimensions[field.key]}
                                onChange={(e) => updateShape(shape.id, field.key, parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                            <input
                              type="number"
                              value={shape.quantity}
                              onChange={(e) => updateQuantity(shape.id, parseInt(e.target.value) || 1)}
                              min="1"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-sm text-gray-500">Surface unitaire</span>
                          <span className="font-bold text-gray-900 dark:text-white">{shape.surface.toFixed(4)} m²</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm text-gray-500">Total ({shape.quantity} pièce{shape.quantity > 1 ? 's' : ''})</span>
                          <span className="font-bold text-orange-500">{(shape.surface * shape.quantity).toFixed(4)} m²</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Parameters & Results */}
          <div className="space-y-6">
            {/* Powder Parameters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">Paramètres poudre</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Prix poudre (€/kg)
                  </label>
                  <input
                    type="number"
                    value={prixPoudre}
                    onChange={(e) => setPrixPoudre(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Rendement (m²/kg)
                  </label>
                  <input
                    type="number"
                    value={rendementPoudre}
                    onChange={(e) => setRendementPoudre(parseFloat(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Épaisseur couche (µm)
                  </label>
                  <input
                    type="number"
                    value={epaisseurCouche}
                    onChange={(e) => setEpaisseurCouche(parseFloat(e.target.value) || 60)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Pertes estimées (%)
                  </label>
                  <input
                    type="number"
                    value={perte}
                    onChange={(e) => setPerte(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Résultats</h2>
                <button
                  onClick={copyResults}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Surface totale</span>
                  <span className="text-2xl font-black">{totalSurface.toFixed(2)} m²</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Avec pertes ({perte}%)</span>
                  <span className="text-lg font-bold">{surfaceAvecPerte.toFixed(2)} m²</span>
                </div>
                <div className="h-px bg-white/20"></div>
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Poudre nécessaire</span>
                  <span className="text-2xl font-black">{consommationPoudre.toFixed(2)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Coût poudre</span>
                  <span className="text-2xl font-black">{coutPoudre.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Astuce :</strong> Le rendement standard est d'environ 10 m²/kg pour une épaisseur de 60-80 µm. 
                Ajustez selon votre poudre et votre méthode d'application.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
