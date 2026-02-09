/**
 * API interne: Déclencheur de webhooks
 * 
 * POST /api/webhooks/trigger
 * Body: { event: string, atelier_id: string, payload: object }
 * 
 * Events supportés:
 * - devis.created, devis.accepted, devis.refused
 * - projet.created, projet.status_changed, projet.completed
 * - facture.created, facture.paid
 * - stock.low, stock.reorder
 * - paiement.received
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

interface WebhookConfig {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
}

export async function POST(request: Request) {
  try {
    const { event, atelier_id, payload } = await request.json()

    if (!event || !atelier_id) {
      return NextResponse.json({ error: 'event et atelier_id requis' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Récupérer les webhooks actifs pour cet atelier et cet événement
    const { data: webhooks } = await supabase
      .from('webhooks_config')
      .select('*')
      .eq('atelier_id', atelier_id)
      .eq('active', true)

    if (!webhooks || webhooks.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const results = []

    for (const webhook of webhooks as WebhookConfig[]) {
      // Vérifier que l'événement est dans la liste
      if (!webhook.events.includes(event) && !webhook.events.includes('*')) {
        continue
      }

      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        atelier_id,
        data: payload,
      })

      // Signature HMAC-SHA256
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex')

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': event,
            'X-Webhook-ID': webhook.id,
            'User-Agent': 'ThermoGestion-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(10000), // Timeout 10s
        })

        await supabase.from('webhooks_config').update({
          last_triggered_at: new Date().toISOString(),
          last_status: response.status,
        }).eq('id', webhook.id)

        results.push({ webhook_id: webhook.id, status: response.status, success: response.ok })
      } catch (error: any) {
        await supabase.from('webhooks_config').update({
          last_triggered_at: new Date().toISOString(),
          last_status: 0,
        }).eq('id', webhook.id)

        results.push({ webhook_id: webhook.id, status: 0, success: false, error: error.message })
      }
    }

    return NextResponse.json({ sent: results.length, results })

  } catch (error: any) {
    console.error('Webhook trigger error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
