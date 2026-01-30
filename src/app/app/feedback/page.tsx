'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

const roadmapItems = [
  {
    status: 'done',
    title: 'QR Codes projets',
    description: 'Scan pour mise à jour rapide du statut',
    votes: 47,
  },
  {
    status: 'done',
    title: 'Paiement en ligne',
    description: 'Intégration Stripe et PayPal',
    votes: 89,
  },
  {
    status: 'in_progress',
    title: 'Application mobile',
    description: 'PWA pour iOS et Android',
    votes: 156,
  },
  {
    status: 'in_progress',
    title: 'Export comptable avancé',
    description: 'Intégration Sage, EBP, Cegid',
    votes: 78,
  },
  {
    status: 'planned',
    title: 'IA prédictive',
    description: 'Estimation automatique des délais',
    votes: 45,
  },
  {
    status: 'planned',
    title: 'Mode hors-ligne',
    description: 'Travailler sans connexion internet',
    votes: 67,
  },
  {
    status: 'considering',
    title: 'Réalité augmentée',
    description: 'Visualisation des couleurs RAL sur les pièces',
    votes: 34,
  },
  {
    status: 'considering',
    title: 'Multi-langues',
    description: 'Interface en anglais, espagnol, allemand',
    votes: 23,
  },
]

const categories = [
  { id: 'feature', label: 'Nouvelle fonctionnalité', icon: '✨' },
  { id: 'improvement', label: 'Amélioration', icon: '🔧' },
  { id: 'bug', label: 'Bug / Problème', icon: '🐛' },
  { id: 'other', label: 'Autre', icon: '💬' },
]

export default function FeedbackPage() {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [filter, setFilter] = useState('all')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    // In a real app, this would save to the database
    await new Promise(resolve => setTimeout(resolve, 1000))

    setSubmitted(true)
    setSubmitting(false)
    setTitle('')
    setDescription('')
    setSelectedCategory('')
  }

  const filteredRoadmap = filter === 'all' 
    ? roadmapItems 
    : roadmapItems.filter(item => item.status === filter)

  const statusLabels: Record<string, string> = {
    done: 'Terminé',
    in_progress: 'En cours',
    planned: 'Planifié',
    considering: 'À l\'étude',
  }

  const statusColors: Record<string, string> = {
    done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    planned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    considering: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">💡</div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            Feedback & Roadmap
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Aidez-nous à améliorer ThermoGestion
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Feedback Form */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Proposer une idée
              </h2>

              {submitted ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Merci pour votre feedback !
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Votre suggestion a été enregistrée. Nous la prendrons en compte dans nos prochaines mises à jour.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Proposer une autre idée
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Type de feedback
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            selectedCategory === cat.id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-2xl block mb-1">{cat.icon}</span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {cat.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Titre
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Résumez votre idée en quelques mots"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez votre idée en détail. Comment cela vous aiderait-il au quotidien ?"
                      rows={5}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedCategory}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 disabled:opacity-50 transition-all"
                  >
                    {submitting ? 'Envoi en cours...' : 'Envoyer mon feedback'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Roadmap */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Roadmap
                </h2>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Tous</option>
                  <option value="in_progress">En cours</option>
                  <option value="planned">Planifié</option>
                  <option value="considering">À l'étude</option>
                  <option value="done">Terminé</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredRoadmap.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                            {statusLabels[item.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                      <button className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:border-orange-500 transition-colors">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{item.votes}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredRoadmap.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucun élément dans cette catégorie
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <p className="text-3xl font-black text-orange-500">156</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Idées proposées</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <p className="text-3xl font-black text-green-500">42</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Fonctionnalités livrées</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <p className="text-3xl font-black text-blue-500">8</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">En développement</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <p className="text-3xl font-black text-gray-500">1,247</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Votes au total</p>
          </div>
        </div>
      </div>
    </div>
  )
}
