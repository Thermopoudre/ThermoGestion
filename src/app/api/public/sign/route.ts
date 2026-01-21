import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// API publique pour signer un devis via token
// Pas besoin d'authentification, le token fait office de preuve

export async function POST(request: Request) {
  try {
    const { token, signatureData, acceptedTerms } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    if (!signatureData) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
    }

    if (!acceptedTerms) {
      return NextResponse.json({ error: 'Vous devez accepter les conditions' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Récupérer le devis par token
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select('id, status, signed_at, atelier_id, client_id, clients(email, full_name)')
      .eq('public_token', token)
      .single()

    if (devisError || !devis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }

    // Vérifier que le devis n'est pas déjà signé
    if (devis.signed_at) {
      return NextResponse.json({ error: 'Ce devis a déjà été signé' }, { status: 400 })
    }

    // Mettre à jour le devis avec la signature
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        status: 'accepte',
        signed_at: new Date().toISOString(),
        signature_data: signatureData,
        signature_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        signature_user_agent: request.headers.get('user-agent') || 'unknown',
      })
      .eq('id', devis.id)

    if (updateError) {
      console.error('Erreur mise à jour devis:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
    }

    // Créer une alerte pour l'atelier
    await supabase.from('alertes').insert({
      atelier_id: devis.atelier_id,
      type: 'devis_signe',
      titre: 'Devis signé !',
      message: `Le client ${(devis.clients as any)?.full_name || 'Inconnu'} a signé son devis.`,
      lien: `/app/devis/${devis.id}`,
      data: { devis_id: devis.id, client_id: devis.client_id },
    })

    return NextResponse.json({
      success: true,
      message: 'Devis signé avec succès',
    })
  } catch (error: any) {
    console.error('Erreur signature publique:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
