'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { MessageSquare, Heart, Star, CheckCircle } from 'lucide-react'

const REASONS = [
  { value: 'trop_cher', label: 'Le prix est trop élevé' },
  { value: 'pas_besoin', label: 'Je n\'en ai plus besoin' },
  { value: 'concurrent', label: 'J\'ai trouvé une alternative' },
  { value: 'complexe', label: 'L\'outil est trop complexe' },
  { value: 'fonctionnalites', label: 'Il manque des fonctionnalités' },
  { value: 'performance', label: 'Problèmes de performance' },
  { value: 'support', label: 'Support client insatisfaisant' },
  { value: 'fermeture', label: 'Fermeture d\'activité' },
  { value: 'autre', label: 'Autre raison' },
]

export default function ExitSurveyPage() {
  const supabase = createBrowserClient()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    reason: '',
    details: '',
    rating: 0,
    would_return: null as boolean | null,
  })

  const handleSubmit = async () => {
    if (!form.reason) return
    
    await supabase.from('exit_surveys').insert({
      reason: form.reason,
      details: form.details || null,
      rating: form.rating || null,
      would_return: form.would_return,
    })
    
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Merci pour votre retour</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Vos commentaires nous aident à améliorer ThermoGestion. Nous espérons vous revoir bientôt !
          </p>
          <p className="text-sm text-orange-600 font-medium">
            Si vous changez d&apos;avis dans les 30 prochains jours, contactez-nous pour réactiver votre compte avec -20% pendant 3 mois.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <MessageSquare className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nous sommes tristes de vous voir partir</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Aidez-nous à comprendre pourquoi, pour nous améliorer.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 space-y-6">
        {/* Raison principale */}
        <div>
          <label className="block font-medium mb-3">Quelle est la raison principale de votre départ ?</label>
          <div className="space-y-2">
            {REASONS.map(r => (
              <label key={r.value} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                form.reason === r.value ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={form.reason === r.value}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="text-orange-500"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Détails */}
        <div>
          <label className="block font-medium mb-2">Pouvez-vous nous en dire plus ? (optionnel)</label>
          <textarea
            value={form.details}
            onChange={e => setForm({ ...form, details: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            rows={4}
            placeholder="Qu'aurions-nous pu faire mieux ?"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block font-medium mb-2">Comment évaluez-vous votre expérience globale ?</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setForm({ ...form, rating: n })}
                className={`p-2 transition-colors ${form.rating >= n ? 'text-yellow-500' : 'text-gray-300'}`}
              >
                <Star className={`w-8 h-8 ${form.rating >= n ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Reviendrait */}
        <div>
          <label className="block font-medium mb-2">Envisageriez-vous de revenir dans le futur ?</label>
          <div className="flex gap-3">
            <button
              onClick={() => setForm({ ...form, would_return: true })}
              className={`px-6 py-2 rounded-lg border-2 ${form.would_return === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}
            >
              <Heart className="w-4 h-4 inline mr-1" /> Oui, peut-être
            </button>
            <button
              onClick={() => setForm({ ...form, would_return: false })}
              className={`px-6 py-2 rounded-lg border-2 ${form.would_return === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}
            >
              Non, c&apos;est définitif
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!form.reason}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-red-700 disabled:opacity-50"
        >
          Envoyer mon retour
        </button>
      </div>
    </div>
  )
}
