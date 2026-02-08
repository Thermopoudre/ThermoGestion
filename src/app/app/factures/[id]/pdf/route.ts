import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generatePDF, prepareFactureData } from '@/lib/pdf-templates/generator'
import type { TemplateName } from '@/lib/pdf-templates'

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
          siret,
          tva_intra,
          adresse_livraison
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

    // Récupérer le template choisi (depuis l'URL ou les paramètres atelier)
    const url = new URL(request.url)
    const templateParam = url.searchParams.get('template') as TemplateName | null
    const defaultTemplate = (atelier?.settings?.pdf_template as TemplateName) || 'industrial'
    const templateName: TemplateName = templateParam || defaultTemplate

    // Préparer les données (inclut les CGV depuis atelier.settings.cgv_facture)
    const templateData = prepareFactureData(facture, atelier, facture.clients)

    // Générer le HTML avec le même système de templates que les devis
    const html = generatePDF(templateName, templateData)

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
