// Utilitaires pour notifications push (Web Push API)

import webpush from 'web-push'
import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']

// Configuration Web Push (VAPID keys) - Initialisation lazy
let webPushConfigured = false

function getWebPush() {
  if (!webPushConfigured) {
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@thermogestion.fr'

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
        webPushConfigured = true
      } catch (error) {
        console.error('Erreur configuration VAPID:', error)
      }
    }
  }
  return webPushConfigured ? webpush : null
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: any
  tag?: string
  requireInteraction?: boolean
}

/**
 * Envoyer une notification push à un utilisateur
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const wp = getWebPush()
    
    if (!wp) {
      return { success: false, error: 'VAPID keys non configurées' }
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo-icon.svg',
      badge: payload.badge || '/logo-icon.svg',
      data: payload.data || {},
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
    })

    await wp.sendNotification(pushSubscription, notificationPayload)

    return { success: true }
  } catch (error: any) {
    console.error('Erreur envoi notification push:', error)
    
    // Si l'abonnement est invalide, le supprimer
    if (error.statusCode === 410 || error.statusCode === 404) {
      const supabase = await createServerClient()
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscription.id)
    }

    return { success: false, error: error.message || 'Erreur lors de l\'envoi' }
  }
}

/**
 * Envoyer une notification push à tous les utilisateurs d'un atelier
 */
export async function sendPushNotificationToAtelier(
  atelierId: string,
  payload: PushNotificationPayload,
  userIds?: string[] // Filtrer par utilisateurs spécifiques
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  const supabase = await createServerClient()

  let query = supabase
    .from('push_subscriptions')
    .select('*')
    .eq('atelier_id', atelierId)

  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds)
  }

  const { data: subscriptions, error } = await query

  if (error || !subscriptions || subscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, error: 'Aucun abonnement trouvé' }
  }

  let sent = 0
  let failed = 0

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(subscription, payload)
    
    // Enregistrer dans l'historique
    await supabase.from('push_notifications').insert({
      atelier_id: atelierId,
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data,
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error || null,
    })

    if (result.success) {
      sent++
    } else {
      failed++
    }
  }

  return { success: sent > 0, sent, failed }
}

/**
 * Enregistrer un abonnement push
 */
export async function savePushSubscription(
  userId: string,
  atelierId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        atelier_id: atelierId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
      },
      {
        onConflict: 'user_id,endpoint',
      }
    )
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, subscriptionId: data.id }
}

/**
 * Supprimer un abonnement push
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
