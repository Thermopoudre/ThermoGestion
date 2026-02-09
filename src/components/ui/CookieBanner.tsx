'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X, Check, Settings } from 'lucide-react'

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieBanner() {
  const [show, setShow] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      // Small delay before showing banner
      setTimeout(() => setShow(true), 1000)
    }
  }, [])

  function acceptAll() {
    const allConsent: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
    }
    saveConsent(allConsent)
  }

  function acceptSelected() {
    saveConsent(preferences)
  }

  function rejectAll() {
    const minimalConsent: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
    }
    saveConsent(minimalConsent)
  }

  function saveConsent(consent: CookiePreferences) {
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShow(false)
    
    // Here you would initialize analytics/marketing scripts based on consent
    if (consent.analytics) {
      // initGoogleAnalytics()
    }
    if (consent.marketing) {
      // initMarketingPixels()
    }
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop pour le mode settings uniquement */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={() => setShowSettings(false)} />
      )}

      {!showSettings ? (
        // Barre compacte en bas — ne bloque pas le contenu
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              🍪 Ce site utilise des cookies pour améliorer votre expérience.{' '}
              <Link href="/cookies" className="text-orange-500 hover:underline">En savoir plus</Link>
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 inline mr-1" />
                Paramétrer
              </button>
              <button
                onClick={rejectAll}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Refuser
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
              >
                Tout accepter
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Modale de paramétrage centrée (ouverte via le bouton)
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  🍪 Paramètres des cookies
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                {/* Necessary */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Essentiels</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fonctionnement du site</p>
                  </div>
                  <div className="w-10 h-5 bg-green-500 rounded-full flex items-center justify-end px-0.5">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>

                {/* Analytics */}
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Analytiques</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Statistiques d'utilisation</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                {/* Marketing */}
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Marketing</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Publicités personnalisées</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={acceptSelected}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
                >
                  Enregistrer
                </button>
                <button
                  onClick={acceptAll}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Tout accepter
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-3 text-center">
                <Link href="/cookies" className="text-orange-500 hover:underline">
                  Politique de cookies
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
