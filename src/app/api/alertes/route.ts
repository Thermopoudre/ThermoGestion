import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Récupérer les alertes de l'atelier
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Récupérer les alertes non lues et récentes
    const { data: alertes, error } = await supabase
      .from('alertes')
      .select('*')
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Erreur récupération alertes:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    const nonLues = alertes?.filter(a => !a.lu).length || 0

    return NextResponse.json({
      alertes: alertes || [],
      non_lues: nonLues,
    })
  } catch (error) {
    console.error('Erreur API alertes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: Marquer des alertes comme lues
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { alerte_ids, mark_all } = body

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    if (mark_all) {
      // Marquer toutes les alertes comme lues
      const { error } = await supabase
        .from('alertes')
        .update({
          lu: true,
          lu_at: new Date().toISOString(),
          lu_par: authUser.id,
        })
        .eq('atelier_id', userData.atelier_id)
        .eq('lu', false)

      if (error) throw error
    } else if (alerte_ids && alerte_ids.length > 0) {
      // Marquer des alertes spécifiques
      const { error } = await supabase
        .from('alertes')
        .update({
          lu: true,
          lu_at: new Date().toISOString(),
          lu_par: authUser.id,
        })
        .eq('atelier_id', userData.atelier_id)
        .in('id', alerte_ids)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur PATCH alertes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
