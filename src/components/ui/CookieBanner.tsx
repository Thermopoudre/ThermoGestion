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
      console.log('Analytics enabled')
      // initGoogleAnalytics()
    }
    if (consent.marketing) {
      console.log('Marketing enabled')
      // initMarketingPixels()
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {!showSettings ? (
            // Simple view
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                    Ce site utilise des cookies 🍪
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser le contenu.
                    Vous pouvez choisir les cookies que vous acceptez.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={acceptAll}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
                    >
                      Tout accepter
                    </button>
                    <button
                      onClick={rejectAll}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Personnaliser
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Detailed settings view
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Paramètres des cookies
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Necessary */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Cookies essentiels</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nécessaires au fonctionnement du site. Ne peuvent pas être désactivés.
                    </p>
                  </div>
                  <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>

                {/* Analytics */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Cookies analytiques</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nous aident à comprendre comment vous utilisez le site.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                {/* Marketing */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Cookies marketing</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Permettent d'afficher des publicités pertinentes.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={acceptSelected}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
                >
                  Enregistrer mes choix
                </button>
                <button
                  onClick={acceptAll}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Tout accepter
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                En savoir plus dans notre{' '}
                <Link href="/cookies" className="text-orange-500 hover:underline">
                  politique de cookies
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
