'use client'

import { useState } from 'react'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      })

      if (res.ok) {
        setFormState('success')
        setName('')
        setEmail('')
        setPhone('')
        setSubject('')
        setMessage('')
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Erreur lors de l\'envoi')
        setFormState('error')
      }
    } catch {
      setErrorMsg('Impossible de joindre le serveur. Veuillez réessayer.')
      setFormState('error')
    }
  }

  const inputClass =
    'w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors'

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />

      <section className="relative min-h-screen pt-16 overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-red-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-20">
          {/* Hero header */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <span className="inline-block px-4 py-1 bg-orange-600/20 border border-orange-500/50 rounded-full text-orange-400 text-sm font-medium mb-6">
              📧 Contactez-nous
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 leading-tight">
              NOUS SOMMES<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-yellow-500">
                LÀ POUR VOUS
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Une question ? Besoin d&apos;une démo ? Notre équipe vous répond sous 24h.
            </p>
          </div>

          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Formulaire */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">
                Envoyez-nous un message
              </h2>

              {formState === 'success' ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Message envoyé !</h3>
                  <p className="text-gray-300 mb-6">
                    Nous avons bien reçu votre message et vous répondrons sous 24h ouvrées.
                  </p>
                  <button
                    onClick={() => setFormState('idle')}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      placeholder="Votre nom"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="votre@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                      placeholder="06 12 34 56 78"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sujet *
                    </label>
                    <select
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sélectionnez un sujet</option>
                      <option value="demo">Demande de démo</option>
                      <option value="support">Support technique</option>
                      <option value="commercial">Question commerciale</option>
                      <option value="partenaire">Devenir partenaire</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={inputClass}
                      placeholder="Votre message..."
                    />
                  </div>

                  {formState === 'error' && errorMsg && (
                    <div className="px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formState === 'loading'}
                    className="w-full px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-500 transition-all transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {formState === 'loading' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Envoi en cours…
                      </span>
                    ) : (
                      'Envoyer le message'
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Informations de contact */}
            <div className="space-y-6">
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">📧 Email</h3>
                <p className="text-gray-300 mb-2">Pour toute question générale :</p>
                <a
                  href="mailto:contact@thermogestion.fr"
                  className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                >
                  contact@thermogestion.fr
                </a>
              </div>

              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">📞 Téléphone</h3>
                <p className="text-gray-300 mb-2">Du lundi au vendredi, 9h-18h :</p>
                <a
                  href="tel:+33674921975"
                  className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                >
                  06 74 92 19 75
                </a>
              </div>

              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">📍 Adresse</h3>
                <p className="text-gray-300">
                  120 PLACE DES PALMIERS<br />
                  83150 BANDOL, France
                </p>
              </div>

              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">⏱️ Délais de réponse</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>✅ Support email : 24h ouvrées</li>
                  <li>✅ Support prioritaire (Plan Pro) : 12h ouvrées</li>
                  <li>✅ Urgences : Téléphone direct</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VitrineFooter />
    </div>
  )
}
