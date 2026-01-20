import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateFacturePdfHtml } from '@/lib/facturation/pdf'

export async function GET(
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

    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          phone,
          address,
          type,
          siret
        ),
        projets (
          id,
          name,
          numero
        )
      `)
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()

    const html = generateFacturePdfHtml(facture, atelier)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Erreur génération PDF facture:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
