'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Monitor, Zap } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios')
    } else if (/android/.test(userAgent)) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Show prompt after a delay if user hasn't dismissed it
      const dismissed = localStorage.getItem('pwa_prompt_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 30000) // Show after 30 seconds
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowPrompt(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  function dismiss() {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  if (isInstalled || !showPrompt) return null

  // iOS specific instructions
  if (platform === 'ios') {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Installer ThermoGestion
                </h3>
                <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                Pour installer sur iOS :
              </p>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>1. Appuyez sur <span className="inline-flex items-center px-1 bg-gray-100 dark:bg-gray-700 rounded">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L12 14M12 2L8 6M12 2L16 6M5 10L5 20C5 21.1046 5.89543 22 7 22L17 22C18.1046 22 19 21.1046 19 20L19 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                </span> (Partager)</li>
                <li>2. Faites défiler et appuyez sur "Sur l'écran d'accueil"</li>
                <li>3. Appuyez sur "Ajouter"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Android/Desktop prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
            {platform === 'android' ? (
              <Smartphone className="w-6 h-6 text-white" />
            ) : (
              <Monitor className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">
                Installer ThermoGestion
              </h3>
              <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Accès rapide depuis votre {platform === 'android' ? 'écran d\'accueil' : 'bureau'}, fonctionne même hors ligne !
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                Installer
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-around text-center">
          <div>
            <Zap className="w-5 h-5 text-orange-500 mx-auto" />
            <span className="text-xs text-gray-500 mt-1 block">Plus rapide</span>
          </div>
          <div>
            <Download className="w-5 h-5 text-orange-500 mx-auto" />
            <span className="text-xs text-gray-500 mt-1 block">Hors ligne</span>
          </div>
          <div>
            <Smartphone className="w-5 h-5 text-orange-500 mx-auto" />
            <span className="text-xs text-gray-500 mt-1 block">1 clic</span>
          </div>
        </div>
      </div>
    </div>
  )
}
