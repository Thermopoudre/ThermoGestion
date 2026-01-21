import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()

    // Vérifier l'authentification
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Récupérer le devis original
    const { data: originalDevis, error: fetchError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (fetchError || !originalDevis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }

    // Générer un nouveau numéro
    const { data: lastDevis } = await supabase
      .from('devis')
      .select('numero')
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const year = new Date().getFullYear()
    const lastNum = lastDevis?.numero
      ? parseInt(lastDevis.numero.split('-')[2] || '0')
      : 0
    const newNumero = `DEV-${year}-${String(lastNum + 1).padStart(4, '0')}`

    // Créer le nouveau devis (copie)
    const { data: newDevis, error: insertError } = await supabase
      .from('devis')
      .insert({
        atelier_id: originalDevis.atelier_id,
        client_id: originalDevis.client_id,
        numero: newNumero,
        status: 'brouillon', // Toujours en brouillon pour la copie
        total_ht: originalDevis.total_ht,
        total_ttc: originalDevis.total_ttc,
        tva_rate: originalDevis.tva_rate,
        items: originalDevis.items,
        notes: originalDevis.notes ? `[Copie de ${originalDevis.numero}] ${originalDevis.notes}` : `[Copie de ${originalDevis.numero}]`,
        remise: originalDevis.remise,
        total_revient: originalDevis.total_revient,
        marge_pct: originalDevis.marge_pct,
        created_by: authUser.id,
        // Ne pas copier: signed_at, signature_data, sent_at, valid_until
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erreur duplication devis:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la duplication' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      devis: newDevis,
      message: `Devis dupliqué avec succès: ${newNumero}`,
    })
  } catch (error) {
    console.error('Erreur serveur duplication:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
