import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generatePDF, prepareFactureData } from '@/lib/pdf-templates/generator'
import type { TemplateName } from '@/lib/pdf-templates'

/**
 * Route PDF accessible aux clients (ownership vérifié via client_users)
 */
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

    // Vérifier que c'est un client
    const { data: clientUser } = await supabase
      .from('client_users')
      .select('client_id, atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Accès réservé aux clients' }, { status: 403 })
    }

    // Charger la facture avec vérification ownership
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
          city,
          postal_code
        )
      `)
      .eq('id', params.id)
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Charger l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', clientUser.atelier_id)
      .single()

    if (!atelier) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Charger le template
    const { data: templateConfig } = await supabase
      .from('atelier_settings')
      .select('pdf_template')
      .eq('atelier_id', clientUser.atelier_id)
      .single()

    const templateName: TemplateName = (templateConfig?.pdf_template as TemplateName) || 'modern'

    const pdfData = prepareFactureData(facture, atelier)
    const pdfBytes = await generatePDF(pdfData, templateName)

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="facture-${facture.numero || facture.id}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('Erreur PDF client facture:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
