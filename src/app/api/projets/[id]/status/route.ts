import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { changeProjetStatus } from '@/lib/automatisations/projet-status'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Vérifier que le projet appartient à l'atelier
    const { data: projet } = await supabase
      .from('projets')
      .select('id, atelier_id')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (!projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    const body = await request.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'Statut requis' }, { status: 400 })
    }

    // Appeler le service d'automatisation avec la clé de service
    const result = await changeProjetStatus(
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      params.id,
      newStatus,
      authUser.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Statut mis à jour',
      factureCreated: result.factureCreated,
      factureId: result.factureId,
      stockUpdated: result.stockUpdated,
    })

  } catch (error: any) {
    console.error('Erreur changement statut projet:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
