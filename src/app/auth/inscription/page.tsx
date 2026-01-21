'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InscriptionPage() {
  const [atelierName, setAtelierName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleInscription = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          atelierName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription')
      }

      // Rediriger vers vérification email
      router.push(`/auth/verification-email?email=${encodeURIComponent(email)}`)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Effets de fond */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-orange-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Card d'inscription */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-orange-500/20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
              <span className="text-3xl">🔥</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              Créer votre <span className="text-orange-400">atelier</span>
            </h1>
            <p className="text-gray-400">Essai gratuit 30 jours en mode Pro complet</p>
          </div>

          <form onSubmit={handleInscription} className="space-y-5">
            {error && (
              <div className="bg-red-900/50 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="atelierName" className="block text-sm font-medium text-gray-300 mb-2">
                Nom de l'atelier *
              </label>
              <input
                id="atelierName"
                type="text"
                value={atelierName}
                onChange={(e) => setAtelierName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="Mon Atelier de Thermolaquage"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe * (min. 8 caractères)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-4">
              <p className="mb-2 text-gray-300">En créant un compte, vous acceptez :</p>
              <ul className="list-disc list-inside space-y-1">
                <li><a href="/cgu" className="text-orange-400 hover:text-orange-300 transition-colors">Conditions Générales d'Utilisation</a></li>
                <li><a href="/confidentialite" className="text-orange-400 hover:text-orange-300 transition-colors">Politique de confidentialité</a></li>
                <li><a href="/cgv" className="text-orange-400 hover:text-orange-300 transition-colors">Conditions Générales de Vente</a></li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 transform hover:scale-[1.02]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Création en cours...
                </span>
              ) : (
                '🚀 Créer mon compte (Essai gratuit)'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/auth/login" className="text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors">
              Déjà un compte ? Se connecter →
            </a>
          </div>
        </div>

        {/* Avantages */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>✅ Sans carte bancaire • ✅ Support inclus • ✅ Formation offerte</p>
        </div>

        {/* Lien retour site */}
        <div className="mt-4 text-center">
          <a href="/" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  )
}
