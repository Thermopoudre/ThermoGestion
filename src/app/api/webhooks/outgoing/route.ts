import { createServerClient } from '@/lib/supabase/server'
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

// triggerWebhooks est disponible dans @/lib/webhooks
