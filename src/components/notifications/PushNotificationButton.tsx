'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function PushNotificationButton() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    // Vérifier support Web Push
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true)
        checkSubscription()
      }
    } catch (err) {
      console.error('Erreur vérification support Web Push:', err)
      setIsSupported(false)
    }
  }, [])

  const checkSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) return
      const registration = await navigator.serviceWorker.ready
      if (!registration) return
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (err) {
      console.error('Erreur vérification abonnement:', err)
      setIsSubscribed(false)
    }
  }

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      setError('Les notifications ne sont pas supportées par ce navigateur')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setError('Permission refusée pour les notifications')
      return
    }

    return permission
  }

  const subscribe = async () => {
    setLoading(true)
    setError(null)

    try {
      // Demander permission
      await requestPermission()

      // Enregistrer service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Vérifier que la clé VAPID est configurée
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        throw new Error('Configuration notifications push manquante')
      }

      // Créer abonnement
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // Envoyer au serveur
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
              auth: arrayBufferToBase64(subscription.getKey('auth')!),
            },
          },
          userAgent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'enregistrement')
      }

      setIsSubscribed(true)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'abonnement')
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Notifier le serveur
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        })

        setIsSubscribed(false)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du désabonnement')
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported) {
    return null // Ne pas afficher si non supporté
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {isSubscribed ? (
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          {loading ? 'Désabonnement...' : 'Désactiver notifications'}
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="text-sm text-orange-500 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? 'Abonnement...' : 'Activer notifications'}
        </button>
      )}
    </div>
  )
}

// Utilitaires pour conversion clés VAPID
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}
