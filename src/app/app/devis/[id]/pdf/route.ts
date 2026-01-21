import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generatePDF, prepareDevisData } from '@/lib/pdf-templates/generator'
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

    // Charger l'atelier de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Charger le devis
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          phone,
          address,
          siret,
          type
        )
      `)
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (devisError || !devis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }

    // Charger l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()

    // Récupérer le template choisi (depuis l'URL ou les paramètres atelier)
    const url = new URL(request.url)
    const templateParam = url.searchParams.get('template') as TemplateName | null
    
    // Template par défaut depuis les paramètres atelier ou 'industrial' (adapté au thermolaquage)
    const defaultTemplate = (atelier?.settings?.pdf_template as TemplateName) || 'industrial'
    const templateName: TemplateName = templateParam || defaultTemplate

    // Préparer les données
    const templateData = prepareDevisData(devis, atelier, devis.clients)

    // Générer le HTML
    const html = generatePDF(templateName, templateData)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Erreur génération PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
