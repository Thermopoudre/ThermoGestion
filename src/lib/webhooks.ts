import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * Déclenche les webhooks sortants enregistrés pour un atelier.
 * Appelé en interne depuis les routes API (projets, devis, etc.).
 */
export async function triggerWebhooks(
  atelierId: string,
  event: string,
  payload: Record<string, unknown>
) {
  try {
    const admin = createAdminClient()
    const { data: webhooks } = await admin
      .from('webhooks')
      .select('*')
      .eq('atelier_id', atelierId)
      .eq('active', true)
      .contains('events', [event])

    if (!webhooks || webhooks.length === 0) return

    const results = await Promise.allSettled(
      webhooks.map(async (wh) => {
        const timestamp = Date.now().toString()
        const body = JSON.stringify({ event, timestamp, data: payload })
        const signature = crypto
          .createHmac('sha256', wh.secret || '')
          .update(body)
          .digest('hex')

        const startTime = Date.now()
        const response = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': event,
            'X-Webhook-Timestamp': timestamp,
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        })

        const duration = Date.now() - startTime
        const success = response.ok
        const responseBody = await response.text().catch(() => '')

        // Log the webhook delivery
        await admin.from('webhook_logs').insert({
          webhook_id: wh.id,
          atelier_id: atelierId,
          event,
          payload,
          response_status: response.status,
          response_body: responseBody.slice(0, 1000),
          duration_ms: duration,
          success,
        })

        // Update webhook status
        await admin.from('webhooks').update({
          last_triggered_at: new Date().toISOString(),
          last_status: response.status,
          failure_count: success ? 0 : (wh.failure_count || 0) + 1,
        }).eq('id', wh.id)

        // Disable webhook after 10 consecutive failures
        if (!success && (wh.failure_count || 0) >= 9) {
          await admin.from('webhooks').update({ active: false }).eq('id', wh.id)
        }

        return { webhookId: wh.id, success, status: response.status }
      })
    )

    return results
  } catch (error) {
    console.error('Erreur triggerWebhooks:', error)
  }
}
