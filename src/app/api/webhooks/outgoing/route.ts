import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { WebhookCreateSchema, validateBody } from '@/lib/validations'
import crypto from 'crypto'

// ── GET: List webhooks for current atelier ──────────────────

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || !['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: webhooks })
  } catch (error) {
    console.error('Erreur GET webhooks:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── POST: Create a new webhook ──────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || !['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(WebhookCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.errors }, { status: 400 })
    }

    const { url, events, active } = validation.data
    const secret = validation.data.secret || crypto.randomBytes(32).toString('hex')

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        atelier_id: userData.atelier_id,
        url,
        events,
        secret,
        active,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data: webhook }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST webhook:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── Webhook dispatcher (called internally) ──────────────────

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
