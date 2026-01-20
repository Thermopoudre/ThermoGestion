import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateFactureNumero } from '@/lib/facturation/numerotation'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { atelier_id } = body

    if (!atelier_id) {
      return NextResponse.json({ error: 'atelier_id requis' }, { status: 400 })
    }

    // Vérifier que l'utilisateur appartient à cet atelier
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData || userData.atelier_id !== atelier_id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const numero = await generateFactureNumero(atelier_id)

    return NextResponse.json({ numero })
  } catch (error: any) {
    console.error('Erreur génération numéro facture:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération du numéro' },
      { status: 500 }
    )
  }
}
