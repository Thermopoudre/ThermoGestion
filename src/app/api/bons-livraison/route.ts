import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET - Liste des bons de livraison
export async function GET() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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

  const { data: bons, error } = await supabase
    .from('bons_livraison')
    .select(`
      *,
      projets (id, numero, name),
      clients (id, full_name, email)
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(bons)
}

// POST - Créer un bon de livraison
export async function POST(request: Request) {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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

  try {
    const body = await request.json()
    const { projet_id, adresse_livraison, transporteur, observations, items } = body

    // Récupérer le projet pour obtenir le client_id
    const { data: projet, error: projetError } = await supabase
      .from('projets')
      .select('client_id, pieces, numero, name')
      .eq('id', projet_id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (projetError || !projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    // Générer le numéro de BL
    const { data: numeroData } = await supabase.rpc('generate_bl_numero', {
      p_atelier_id: userData.atelier_id,
    })

    let numero = numeroData
    if (!numero) {
      // Fallback
      const year = new Date().getFullYear()
      const { data: lastBL } = await supabase
        .from('bons_livraison')
        .select('numero')
        .eq('atelier_id', userData.atelier_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastNum = lastBL?.numero 
        ? parseInt(lastBL.numero.split('-')[2] || '0')
        : 0
      numero = `BL-${year}-${String(lastNum + 1).padStart(4, '0')}`
    }

    // Créer le bon de livraison
    const { data: bl, error: blError } = await supabase
      .from('bons_livraison')
      .insert({
        atelier_id: userData.atelier_id,
        projet_id,
        client_id: projet.client_id,
        numero,
        date_livraison: new Date().toISOString().split('T')[0],
        adresse_livraison,
        transporteur: transporteur || 'Retrait sur place',
        items: items || projet.pieces || [],
        observations,
        created_by: user.id,
      })
      .select()
      .single()

    if (blError) {
      return NextResponse.json({ error: blError.message }, { status: 500 })
    }

    // Mettre à jour le projet avec la ref du BL
    await supabase
      .from('projets')
      .update({ bl_id: bl.id })
      .eq('id', projet_id)

    // Audit log
    await supabase.from('audit_logs').insert({
      atelier_id: userData.atelier_id,
      user_id: user.id,
      action: 'create',
      table_name: 'bons_livraison',
      record_id: bl.id,
      new_data: { numero, projet_id },
    })

    return NextResponse.json(bl)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
