import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { savePushSubscription } from '@/lib/notifications/push'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const body = await request.json()
    const { subscription, userAgent } = body

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 })
    }

    const result = await savePushSubscription(
      user.id,
      userData.atelier_id,
      subscription,
      userAgent
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, subscriptionId: result.subscriptionId })
  } catch (error: any) {
    console.error('Erreur enregistrement abonnement push:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}
