import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
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

    // Vérifier que la facture appartient à l'atelier
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('id, total_ttc, payment_status')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('factures')
      .update({
        status: 'payee',
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Facture marquée comme payée' })
  } catch (error: any) {
    console.error('Erreur marquer facture payée:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}
