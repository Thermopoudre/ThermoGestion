'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Atelier {
  id: string
  name: string
  stripe_account_id?: string | null
  stripe_account_status?: string | null
  paypal_email?: string | null
  paypal_merchant_id?: string | null
  google_calendar_connected?: boolean | null
  google_calendar_id?: string | null
  outlook_connected?: boolean | null
  google_review_link?: string | null
  auto_review_enabled?: boolean | null
  review_delay_days?: number | null
}

interface IntegrationsSettingsProps {
  atelier: Atelier | null
  userId: string
}

export function IntegrationsSettings({ atelier, userId }: IntegrationsSettingsProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // États pour les formulaires
  const [googleReviewLink, setGoogleReviewLink] = useState(atelier?.google_review_link || '')
  const [autoReviewEnabled, setAutoReviewEnabled] = useState(atelier?.auto_review_enabled || false)
  const [reviewDelayDays, setReviewDelayDays] = useState(atelier?.review_delay_days || 2)

  const handleConnectStripe = async () => {
    setLoading('stripe')
    setError(null)

    try {
      // Rediriger vers Stripe Connect OAuth
      const response = await fetch('/api/integrations/stripe/connect', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Erreur de connexion Stripe')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleDisconnectStripe = async () => {
    if (!confirm('Déconnecter votre compte Stripe ? Vous ne pourrez plus recevoir de paiements en ligne.')) return

    setLoading('stripe')
    try {
      await supabase
        .from('ateliers')
        .update({
          stripe_account_id: null,
          stripe_account_status: null,
        })
        .eq('id', atelier?.id)

      window.location.reload()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleConnectGoogle = async () => {
    setLoading('google')
    setError(null)

    try {
      const response = await fetch('/api/integrations/google/connect', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Erreur de connexion Google')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleSaveGoogleReview = async () => {
    setLoading('review')
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('ateliers')
        .update({
          google_review_link: googleReviewLink || null,
          auto_review_enabled: autoReviewEnabled,
          review_delay_days: reviewDelayDays,
        })
        .eq('id', atelier?.id)

      if (updateError) throw updateError

      setSuccess('Paramètres d\'avis Google enregistrés')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
          {success}
        </div>
      )}

      {/* Paiements */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          💳 Paiements en ligne
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Connectez votre compte pour recevoir les paiements de vos clients directement sur votre compte bancaire.
        </p>

        <div className="space-y-4">
          {/* Stripe */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💜</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Stripe</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Carte bancaire, Apple Pay, Google Pay
                </p>
                {atelier?.stripe_account_id && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Connecté • {atelier.stripe_account_status || 'Actif'}
                  </p>
                )}
              </div>
            </div>
            
            {atelier?.stripe_account_id ? (
              <button
                onClick={handleDisconnectStripe}
                disabled={loading === 'stripe'}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Déconnecter
              </button>
            ) : (
              <button
                onClick={handleConnectStripe}
                disabled={loading === 'stripe'}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading === 'stripe' ? 'Connexion...' : 'Connecter Stripe'}
              </button>
            )}
          </div>

          {/* PayPal */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🅿️</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">PayPal</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Paiement PayPal
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              Bientôt disponible
            </span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            💡 <strong>Commission :</strong> Stripe prélève ~1.4% + 0.25€ par transaction. 
            ThermoGestion ne prend aucune commission sur vos paiements.
          </p>
        </div>
      </div>

      {/* Calendriers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          📅 Calendriers
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Synchronisez vos projets avec votre agenda pour voir vos dates de livraison.
        </p>

        <div className="space-y-4">
          {/* Google Calendar */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📆</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Google Calendar</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sync dates de livraison
                </p>
                {atelier?.google_calendar_connected && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Connecté
                  </p>
                )}
              </div>
            </div>
            
            {atelier?.google_calendar_connected ? (
              <button
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Déconnecter
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={loading === 'google'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading === 'google' ? 'Connexion...' : 'Connecter'}
              </button>
            )}
          </div>

          {/* Outlook */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📧</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Outlook / Microsoft 365</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sync calendrier Outlook
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              Bientôt disponible
            </span>
          </div>
        </div>
      </div>

      {/* Avis Google */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          ⭐ Avis Google
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Envoyez automatiquement une demande d'avis à vos clients après livraison.
        </p>

        <div className="space-y-6">
          {/* Lien avis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lien vers vos avis Google
            </label>
            <input
              type="url"
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/r/xxx/review"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Trouvez ce lien dans Google My Business → Accueil → Obtenir plus d'avis
            </p>
          </div>

          {/* Activation */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Envoi automatique
              </h3>
              <p className="text-sm text-gray-500">
                Email envoyé automatiquement après livraison
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoReviewEnabled}
                onChange={(e) => setAutoReviewEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Délai */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Délai après livraison
            </label>
            <select
              value={reviewDelayDays}
              onChange={(e) => setReviewDelayDays(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={1}>1 jour</option>
              <option value={2}>2 jours</option>
              <option value={3}>3 jours</option>
              <option value={5}>5 jours</option>
              <option value={7}>1 semaine</option>
            </select>
          </div>

          <button
            onClick={handleSaveGoogleReview}
            disabled={loading === 'review'}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50"
          >
            {loading === 'review' ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </button>
        </div>
      </div>

      {/* Comptabilité */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          📊 Comptabilité
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Exportez vos données vers votre logiciel comptable.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Sage', 'EBP', 'Cegid', 'Quadra'].map((software) => (
            <a
              key={software}
              href={`/api/factures/export/comptable?format=${software.toLowerCase()}`}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl block mb-2">📥</span>
              <span className="font-medium text-gray-900 dark:text-white">{software}</span>
            </a>
          ))}
        </div>

        <a
          href="/api/factures/export/fec"
          className="mt-4 block w-full p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="text-2xl block mb-1">🏛️</span>
          <span className="font-bold text-gray-900 dark:text-white">Export FEC</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Fichier des Écritures Comptables (obligatoire contrôle fiscal)
          </p>
        </a>
      </div>
    </div>
  )
}
