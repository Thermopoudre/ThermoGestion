import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createPaymentLink, createAcomptePaymentLink, createSoldePaymentLink } from '@/lib/stripe/payment-links'

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

    // Récupérer la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const { type } = body // 'acompte', 'solde', ou 'complete'

    let result

    if (type === 'acompte') {
      const acompteAmount = facture.acompte_amount || Number(facture.total_ttc) * 0.3 // 30% par défaut
      result = await createAcomptePaymentLink(facture, Number(acompteAmount))
    } else if (type === 'solde') {
      const acompte = facture.acompte_amount || 0
      const soldeAmount = Number(facture.total_ttc) - acompte
      result = await createSoldePaymentLink(facture, soldeAmount)
    } else {
      // Paiement complet
      result = await createPaymentLink(facture, Number(facture.total_ttc))
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Mettre à jour la facture avec le lien de paiement
    await supabase
      .from('factures')
      .update({
        stripe_payment_link_id: result.paymentLinkId,
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      paymentLinkId: result.paymentLinkId,
      paymentLinkUrl: result.paymentLinkUrl,
    })
  } catch (error: any) {
    console.error('Erreur création lien paiement:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du lien de paiement' },
      { status: 500 }
    )
  }
}
