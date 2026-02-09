'use client'

import { useState } from 'react'
import { Calculator, Send, CheckCircle, ArrowRight } from 'lucide-react'

const TYPES_PIECES = [
  { value: 'portail', label: 'Portail / Clôture', surface_approx: 8 },
  { value: 'garde_corps', label: 'Garde-corps / Rambarde', surface_approx: 3 },
  { value: 'volet', label: 'Volets / Persiennes', surface_approx: 2 },
  { value: 'meuble', label: 'Meuble / Étagère métal', surface_approx: 4 },
  { value: 'chassis', label: 'Châssis / Cadre', surface_approx: 1.5 },
  { value: 'jante', label: 'Jante(s) automobile', surface_approx: 0.3 },
  { value: 'piece_industrielle', label: 'Pièce industrielle', surface_approx: 5 },
  { value: 'luminaire', label: 'Luminaire / Décoration', surface_approx: 0.5 },
  { value: 'autre', label: 'Autre', surface_approx: 2 },
]

const FINITIONS = [
  { value: 'mat', label: 'Mat', majoration: 0 },
  { value: 'satine', label: 'Satiné', majoration: 0 },
  { value: 'brillant', label: 'Brillant', majoration: 10 },
  { value: 'texture', label: 'Texturé', majoration: 15 },
  { value: 'metallise', label: 'Métallisé', majoration: 25 },
]

export default function DevisPublicPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    type_piece: '',
    quantite: '1',
    surface_m2: '',
    finition: 'mat',
    couleur_ral: '',
    urgence: false,
    nom: '',
    email: '',
    telephone: '',
    entreprise: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [estimation, setEstimation] = useState<number | null>(null)

  const calculerEstimation = () => {
    const type = TYPES_PIECES.find(t => t.value === form.type_piece)
    const finition = FINITIONS.find(f => f.value === form.finition)
    const surface = form.surface_m2 ? parseFloat(form.surface_m2) : (type?.surface_approx || 2)
    const quantite = parseInt(form.quantite) || 1
    
    const prixBase = 28 // €/m² moyen
    const majFinition = finition?.majoration || 0
    const majUrgence = form.urgence ? 30 : 0
    
    const prixUnitaire = surface * prixBase * (1 + majFinition / 100) * (1 + majUrgence / 100)
    const forfaitMin = 30
    const total = Math.max(prixUnitaire, forfaitMin) * quantite
    
    setEstimation(Math.round(total))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/devis-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimation,
          surface_estimee: form.surface_m2 || TYPES_PIECES.find(t => t.value === form.type_piece)?.surface_approx,
        })
      })
      if (response.ok) setSubmitted(true)
    } catch {
      alert('Erreur lors de l\'envoi. Veuillez réessayer.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Demande envoyée !</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Estimation indicative : <strong className="text-green-600">{estimation} € HT</strong>
          </p>
          <p className="text-gray-500 mb-8">
            Un atelier partenaire vous recontactera sous 24h avec un devis détaillé personnalisé.
          </p>
          <a href="/" className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold inline-block">
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Calculator className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Devis thermolaquage en ligne</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Obtenez une estimation instantanée + un devis pro sous 24h</p>
        </div>

        {/* Étapes */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s}
              </div>
              <span className={`text-sm ${step >= s ? 'font-medium' : 'text-gray-400'}`}>
                {s === 1 ? 'Pièce' : s === 2 ? 'Options' : 'Contact'}
              </span>
              {s < 3 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
          {/* Étape 1: Type de pièce */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Quelle pièce souhaitez-vous faire thermolaquér ?</h2>
              <div className="grid grid-cols-2 gap-3">
                {TYPES_PIECES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, type_piece: t.value })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.type_piece === t.value 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-gray-500">~{t.surface_approx} m²</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantité</label>
                  <input type="number" min="1" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Surface totale (m²) — optionnel</label>
                  <input type="number" step="0.1" value={form.surface_m2} onChange={e => setForm({ ...form, surface_m2: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Laisser vide pour estimation" />
                </div>
              </div>
              <button onClick={() => { setStep(2) }} disabled={!form.type_piece} className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold disabled:opacity-50">
                Continuer
              </button>
            </div>
          )}

          {/* Étape 2: Options */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Choisissez les options</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Finition</label>
                <div className="flex flex-wrap gap-2">
                  {FINITIONS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setForm({ ...form, finition: f.value })}
                      className={`px-4 py-2 rounded-lg border-2 text-sm ${
                        form.finition === f.value 
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 font-bold' 
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {f.label} {f.majoration > 0 && <span className="text-orange-500">+{f.majoration}%</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Couleur RAL souhaitée</label>
                <input type="text" value={form.couleur_ral} onChange={e => setForm({ ...form, couleur_ral: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Ex: RAL 9010, RAL 7016, ou 'à définir'" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.urgence} onChange={e => setForm({ ...form, urgence: e.target.checked })} className="rounded" />
                <span className="font-medium">Urgence (+30% — traitement sous 48h)</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Retour</button>
                <button onClick={() => { calculerEstimation(); setStep(3) }} className="flex-1 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold">
                  Voir l&apos;estimation
                </button>
              </div>
            </div>
          )}

          {/* Étape 3: Contact + estimation */}
          {step === 3 && (
            <div className="space-y-6">
              {estimation && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-6 text-center border-2 border-green-200 dark:border-green-800">
                  <p className="text-sm text-gray-500 mb-1">Estimation indicative</p>
                  <div className="text-4xl font-black text-green-600">{estimation} € HT</div>
                  <p className="text-xs text-gray-400 mt-1">Prix final communiqué par l&apos;atelier sous 24h</p>
                </div>
              )}
              <h2 className="text-xl font-bold">Vos coordonnées</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input type="text" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Entreprise</label>
                  <input type="text" value={form.entreprise} onChange={e => setForm({ ...form, entreprise: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <input type="tel" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message complémentaire</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" rows={3} placeholder="Détails supplémentaires, dimensions précises..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-6 py-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Retour</button>
                <button onClick={handleSubmit} disabled={loading || !form.nom || !form.email} className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? 'Envoi...' : <><Send className="w-4 h-4" /> Envoyer ma demande</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
