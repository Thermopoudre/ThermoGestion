import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateTemplateHTML, type TemplateConfig, type DevisData } from '@/lib/devis-templates'

// Route pour générer un PDF du devis
// Utilise les templates personnalisables

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

    // Charger le template (ou utiliser le template par défaut)
    let templateConfig: TemplateConfig | null = null
    
    if (devis.template_id) {
      const { data: template } = await supabase
        .from('devis_templates')
        .select('*')
        .eq('id', devis.template_id)
        .eq('atelier_id', userData.atelier_id)
        .single()
      
      if (template && template.config) {
        templateConfig = template.config as TemplateConfig
      }
    }
    
    // Si pas de template ou template non trouvé, utiliser le template par défaut
    if (!templateConfig) {
      const { data: defaultTemplate } = await supabase
        .from('devis_templates')
        .select('*')
        .eq('atelier_id', userData.atelier_id)
        .eq('is_default', true)
        .single()
      
      if (defaultTemplate && defaultTemplate.config) {
        templateConfig = defaultTemplate.config as TemplateConfig
      } else {
        // Template par défaut hardcodé si aucun template n'existe
        templateConfig = {
          header: {
            show_logo: true,
            show_atelier_info: true,
            layout: 'left'
          },
          colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#0ea5e9'
          },
          body: {
            show_client_info: true,
            table_style: 'striped',
            column_widths: {}
          },
          footer: {
            show_cgv: true,
            cgv_text: 'Devis valable 30 jours. Conditions générales de vente disponibles sur demande.',
            show_signature: true,
            custom_text: ''
          },
          layout: {
            page_size: 'A4',
            margins: { top: 40, right: 40, bottom: 40, left: 40 },
            font_family: 'Arial, sans-serif',
            font_size: 12
          }
        }
      }
    }

    // Préparer les données pour le template
    const devisData: DevisData = {
      numero: devis.numero,
      created_at: devis.created_at,
      total_ht: Number(devis.total_ht),
      total_ttc: Number(devis.total_ttc),
      tva_rate: Number(devis.tva_rate),
      signed_at: devis.signed_at || undefined,
      items: (devis.items as any) || [],
      clients: devis.clients || undefined,
      atelier: atelier || undefined
    }

    // Générer le HTML avec le template
    const html = generateTemplateHTML(templateConfig, devisData)

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
