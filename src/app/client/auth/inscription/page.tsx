'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'

function InscriptionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()
  
  // Paramètres depuis l'URL
  const emailParam = searchParams.get('email')
  const fromParam = searchParams.get('from') // 'devis', 'projet', etc.
  const refParam = searchParams.get('ref') // ID du devis/projet de référence
  
  const [email, setEmail] = useState(emailParam || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'success'>('form')

  // Pre-fill email from URL
  useEffect(() => {
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
  }, [emailParam])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      setLoading(false)
      return
    }

    try {
      // Créer le compte auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            role: 'client',
          },
        },
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Erreur lors de la création du compte')
      }

      // Chercher les clients existants avec cet email pour les rattacher
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, atelier_id')
        .eq('email', email)

      if (existingClients && existingClients.length > 0) {
        // Créer les liens client_users pour chaque atelier
        for (const client of existingClients) {
          await supabase
            .from('client_users')
            .upsert({
              id: authData.user.id,
              client_id: client.id,
              atelier_id: client.atelier_id,
              email: email,
              full_name: fullName,
            }, { 
              onConflict: 'id,atelier_id' 
            })
        }
      }

      // Si référence à un devis/projet spécifique
      if (refParam) {
        const { data: devis } = await supabase
          .from('devis')
          .select('client_id, atelier_id')
          .eq('id', refParam)
          .single()

        if (devis) {
          await supabase
            .from('client_users')
            .upsert({
              id: authData.user.id,
              client_id: devis.client_id,
              atelier_id: devis.atelier_id,
              email: email,
              full_name: fullName,
            }, { 
              onConflict: 'id,atelier_id' 
            })
        }
      }

      setStep('success')
    } catch (err: any) {
      console.error('Erreur inscription:', err)
      if (err.message?.includes('already registered')) {
        setError('Un compte existe déjà avec cet email. Essayez de vous connecter.')
      } else {
        setError(err.message || 'Erreur lors de l\'inscription')
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Vérifiez votre email
          </h1>
          <p className="text-gray-600 mb-6">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            <br />
            Cliquez sur le lien pour activer votre compte.
          </p>
          <div className="space-y-3">
            <Link
              href="/client/auth/login"
              className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all"
            >
              Se connecter
            </Link>
            <p className="text-xs text-gray-500">
              Vous n'avez pas reçu l'email ? Vérifiez vos spams ou réessayez.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🔥</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Créer votre compte
          </h1>
          <p className="text-gray-600">
            {fromParam === 'devis' 
              ? 'Pour suivre vos devis et projets' 
              : 'Accédez à tous vos projets en un clic'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom complet *
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="Jean Dupont"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="votre@email.com"
              />
              {emailParam && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Email pré-rempli depuis votre devis
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Téléphone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmer le mot de passe *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3.5 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Création en cours...
                </>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          {/* Avantages */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Avantages du compte client
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Suivez l'avancement de tous vos projets
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Signez vos devis en ligne
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Accédez à vos factures à tout moment
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Notifications de mise à jour par email
              </li>
            </ul>
          </div>
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link href="/client/auth/login" className="text-orange-600 hover:text-orange-700 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ClientInscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Chargement...</div>
      </div>
    }>
      <InscriptionForm />
    </Suspense>
  )
}
