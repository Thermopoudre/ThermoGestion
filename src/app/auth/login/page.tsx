'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needs2FA, setNeeds2FA] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // L'utilisateur est déjà connecté, rediriger vers le dashboard
          const redirect = searchParams.get('redirect') || '/app/dashboard'
          router.push(redirect)
          router.refresh()
        }
      } catch (err) {
        console.error('Erreur vérification auth:', err)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router, supabase.auth, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (data.session) {
        // Attendre un court instant pour s'assurer que les cookies sont bien stockés
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Vérifier que la session est bien établie
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        if (currentSession) {
          // Vérifier si 2FA est activée pour cet utilisateur
          const { data: userData } = await supabase
            .from('users')
            .select('two_factor_enabled')
            .eq('id', currentSession.user.id)
            .single()

          if (userData?.two_factor_enabled) {
            setNeeds2FA(true)
            setLoading(false)
            return
          }

          // Pas de 2FA — redirection directe
          const redirect = searchParams.get('redirect') || '/app/dashboard'
          window.location.href = redirect
        } else {
          throw new Error('Session non établie après connexion')
        }
      }
    } catch (err: any) {
      // Messages d'erreur plus précis pour aider l'utilisateur
      const msg = err?.message || ''
      if (msg.includes('Email not confirmed')) {
        setError('Votre email n\'a pas été confirmé. Vérifiez votre boîte de réception (et spams).')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect. Vérifiez vos identifiants ou créez un compte.')
      } else if (msg.includes('Too many requests') || msg.includes('rate limit')) {
        setError('Trop de tentatives. Réessayez dans quelques minutes.')
      } else {
        setError('Erreur de connexion. Vérifiez vos identifiants ou créez un compte.')
      }
      setLoading(false)
    }
  }

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Code incorrect')
        setLoading(false)
        return
      }

      // 2FA validée — redirection
      const redirect = searchParams.get('redirect') || '/app/dashboard'
      window.location.href = redirect
    } catch {
      setError('Erreur de connexion')
      setLoading(false)
    }
  }

  // Afficher un loader pendant la vérification de l'auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🔥</span>
          </div>
          <p className="text-gray-400">Vérification de la session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Effets de fond */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-orange-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Card de connexion */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-orange-500/20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
              <span className="text-3xl">🔥</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              Thermo<span className="text-orange-400">Gestion</span>
            </h1>
            <p className="text-gray-400">Connexion à votre atelier</p>
          </div>

          {!needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email
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
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Mot de passe
                  </label>
                  <a
                    href="/auth/forgot-password"
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
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
                    Connexion...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>
          ) : (
            /* Étape 2FA */
            <form onSubmit={handle2FAVerify} className="space-y-6">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <p className="text-gray-300 text-sm">
                  Vérification en deux étapes
                </p>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium text-gray-300 mb-2">
                  Code d&apos;authentification
                </label>
                <input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9A-Z\-]{6,9}"
                  maxLength={9}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9A-Za-z\-]/g, '').slice(0, 9))}
                  className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="000000"
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Entrez le code de votre application (Google Authenticator, Authy...) ou un code de secours.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Vérification...
                  </span>
                ) : (
                  'Vérifier'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setNeeds2FA(false); setTotpCode(''); setError(null) }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a href="/auth/inscription" className="text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors">
              Créer un compte atelier →
            </a>
          </div>
        </div>

        {/* Lien retour site */}
        <div className="mt-6 text-center">
          <a href="/" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  )
}
