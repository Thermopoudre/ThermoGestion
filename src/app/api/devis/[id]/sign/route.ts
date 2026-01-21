import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { onDevisSigned } from '@/lib/automatisations/devis-signed'
import { notifyDevisSigned } from '@/lib/notifications/triggers'

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

    // Vérifier que le devis appartient à l'atelier
    const { data: devis } = await supabase
      .from('devis')
      .select('id, atelier_id, status, signed_at')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (!devis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }

    // Vérifier que le devis n'est pas déjà signé
    if (devis.signed_at) {
      return NextResponse.json({ error: 'Devis déjà signé' }, { status: 400 })
    }

    const body = await request.json()
    const { signature_url, signature_method, ip_address } = body

    // 1. Mettre à jour le devis avec la signature
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        signed_at: new Date().toISOString(),
        signed_by: authUser.id,
        signed_ip: ip_address,
        signature_data: {
          method: signature_method,
          url: signature_url,
          timestamp: new Date().toISOString(),
        },
        status: 'accepte',
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 2. Déclencher l'automatisation : création du projet
    const autoResult = await onDevisSigned(
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      params.id,
      authUser.id
    )

    // 3. Envoyer notification push à l'atelier
    try {
      const { data: devisData } = await supabase
        .from('devis')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (devisData) {
        await notifyDevisSigned(userData.atelier_id, devisData)
      }
    } catch (notifError) {
      // Ne pas bloquer si la notification échoue
      console.error('Erreur notification devis signé:', notifError)
    }

    // 4. Journal d'audit pour la signature
    await supabase.from('audit_logs').insert({
      atelier_id: userData.atelier_id,
      user_id: authUser.id,
      action: 'sign',
      table_name: 'devis',
      record_id: params.id,
      new_data: { 
        signed_at: new Date().toISOString(),
        signature_method,
        projet_created: autoResult.projetCreated,
        projet_id: autoResult.projetId,
      },
      ip_address,
    })

    return NextResponse.json({
      success: true,
      message: 'Devis signé avec succès',
      projetCreated: autoResult.projetCreated,
      projetId: autoResult.projetId,
      projetNumero: autoResult.projetNumero,
    })

  } catch (error: any) {
    console.error('Erreur signature devis:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
