import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { removePushSubscription } from '@/lib/notifications/push'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requis' }, { status: 400 })
    }

    const result = await removePushSubscription(user.id, endpoint)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur suppression abonnement push:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
