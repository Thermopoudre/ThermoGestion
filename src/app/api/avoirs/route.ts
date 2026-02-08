/**
 * API Avoirs (Notes de crédit)
 * Art. L441-9 Code de commerce : on ne peut pas supprimer une facture émise
 * Il faut créer un avoir pour l'annuler.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le rôle
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || !['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
    }

    const body = await request.json()
    const { facture_id, motif, motif_detail, type, items, montant_ht, montant_tva, montant_ttc, remboursement_method, notes } = body

    if (!facture_id || !motif) {
      return NextResponse.json({ error: 'facture_id et motif requis' }, { status: 400 })
    }

    // Vérifier que la facture existe et appartient à l'atelier
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('id, numero, status, total_ht, total_ttc, tva_rate, client_id, items')
      .eq('id', facture_id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    // Vérifier que la facture est émise (sinon on peut juste la supprimer comme brouillon)
    if (facture.status === 'brouillon') {
      return NextResponse.json(
        { error: 'Les brouillons peuvent être supprimés directement. Un avoir n\'est nécessaire que pour les factures émises.' },
        { status: 400 }
      )
    }

    // Générer le numéro d'avoir
    const { data: numeroData, error: numeroError } = await supabase
      .rpc('generate_avoir_numero', { p_atelier_id: userData.atelier_id })

    if (numeroError) {
      return NextResponse.json({ error: 'Erreur génération numéro avoir' }, { status: 500 })
    }

    // Calculer les montants
    const avoirMontantHt = type === 'total' ? Number(facture.total_ht) : Number(montant_ht || 0)
    const avoirMontantTtc = type === 'total' ? Number(facture.total_ttc) : Number(montant_ttc || 0)
    const avoirMontantTva = type === 'total'
      ? (Number(facture.total_ttc) - Number(facture.total_ht))
      : Number(montant_tva || 0)
    const avoirItems = type === 'total' ? facture.items : (items || [])

    // Créer l'avoir
    const { data: avoir, error: avoirError } = await supabase
      .from('avoirs')
      .insert({
        atelier_id: userData.atelier_id,
        facture_id,
        client_id: facture.client_id,
        numero: numeroData,
        motif,
        motif_detail: motif_detail || null,
        type: type || 'total',
        items: avoirItems,
        montant_ht: avoirMontantHt,
        montant_tva: avoirMontantTva,
        montant_ttc: avoirMontantTtc,
        tva_rate: facture.tva_rate,
        remboursement_method: remboursement_method || null,
        notes: notes || null,
        status: 'emis',
        created_by: user.id,
      })
      .select('id, numero')
      .single()

    if (avoirError) {
      console.error('Erreur création avoir:', avoirError)
      return NextResponse.json({ error: 'Erreur lors de la création de l\'avoir' }, { status: 500 })
    }

    // Mettre à jour le statut de la facture si avoir total
    if (type === 'total') {
      await supabase
        .from('factures')
        .update({
          status: 'remboursee',
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', facture_id)
    }

    // Log d'audit
    await supabase.from('audit_logs').insert({
      atelier_id: userData.atelier_id,
      user_id: user.id,
      action: 'avoir_created',
      entity_type: 'avoir',
      entity_id: avoir.id,
      details: {
        avoir_numero: avoir.numero,
        facture_numero: facture.numero,
        motif,
        type: type || 'total',
        montant_ttc: avoirMontantTtc,
      },
    })

    return NextResponse.json({
      success: true,
      avoir: {
        id: avoir.id,
        numero: avoir.numero,
      },
    })
  } catch (error: unknown) {
    console.error('Erreur API avoirs:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
