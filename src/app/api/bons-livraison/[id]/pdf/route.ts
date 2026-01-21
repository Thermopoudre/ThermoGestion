import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateBonLivraisonTemplate, type BonLivraisonData } from '@/lib/pdf-templates/bon-livraison'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
  }

  // Récupérer le bon de livraison avec ses relations
  const { data: bl, error } = await supabase
    .from('bons_livraison')
    .select(`
      *,
      projets (id, numero, name),
      clients (id, full_name, address, phone, email)
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !bl) {
    return NextResponse.json({ error: 'BL non trouvé' }, { status: 404 })
  }

  // Récupérer l'atelier
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', userData.atelier_id)
    .single()

  // Récupérer les couleurs personnalisées
  const customColors = atelier?.settings?.pdf_primary_color ? {
    primary: atelier.settings.pdf_primary_color,
    accent: atelier.settings.pdf_accent_color,
  } : undefined

  // Préparer les données pour le template
  const templateData: BonLivraisonData = {
    numero: bl.numero,
    date_livraison: bl.date_livraison,
    client: {
      nom: (bl.clients as any)?.full_name || 'Client',
      adresse: (bl.clients as any)?.address,
      telephone: (bl.clients as any)?.phone,
      email: (bl.clients as any)?.email,
    },
    atelier: {
      nom: atelier?.name || 'Atelier',
      adresse: atelier?.address,
      telephone: atelier?.phone,
      email: atelier?.email,
      siret: atelier?.siret,
    },
    projet: {
      numero: (bl.projets as any)?.numero || '',
      name: (bl.projets as any)?.name || '',
    },
    adresse_livraison: bl.adresse_livraison,
    transporteur: bl.transporteur,
    items: (bl.items as any[]) || [],
    observations: bl.observations,
    etat_pieces: bl.etat_pieces as 'conforme' | 'reserve' | 'non_conforme',
    reserves: bl.reserves,
    signed: bl.signed_at ? {
      nom_signataire: bl.signature_client,
      date: bl.signed_at,
    } : undefined,
  }

  // Générer le HTML
  const html = generateBonLivraisonTemplate(templateData, customColors)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
