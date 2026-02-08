import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * API pour générer le rapport final PDF d'un projet
 * GET /api/projets/[id]/rapport-pdf
 * 
 * Contenu du rapport :
 * - Informations projet (numéro, dates, client)
 * - Poudre utilisée (référence, RAL, finition, couches)
 * - Liste des pièces traitées
 * - Photos avant/après
 * - Contrôle qualité
 * - Signature / validation
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()

    // Vérifier authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Récupérer le projet complet
    const { data: projet, error: projetError } = await supabase
      .from('projets')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          phone,
          company,
          address_line1,
          address_line2,
          city,
          postal_code
        ),
        poudres (
          id,
          marque,
          reference,
          type,
          finition,
          ral
        ),
        devis (
          id,
          numero,
          total_ht,
          total_ttc,
          tva_rate
        )
      `)
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (projetError || !projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    // Récupérer les photos du projet
    const { data: photos } = await supabase
      .from('photos')
      .select('id, url, type, description, created_at')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: true })

    // Récupérer l'atelier pour les infos de l'en-tête
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('name, email, phone, address, siret, logo_url')
      .eq('id', userData.atelier_id)
      .single()

    // Récupérer le contrôle qualité
    const { data: qualityCheck } = await supabase
      .from('quality_checks')
      .select('*')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Générer les données du rapport
    const rapport = {
      generatedAt: new Date().toISOString(),
      atelier: atelier || { name: 'Atelier', email: '' },
      projet: {
        numero: projet.numero,
        name: projet.name,
        status: projet.status,
        description: projet.description,
        created_at: projet.created_at,
        date_promise: projet.date_promise,
        date_livre: projet.date_livre,
        couches: projet.couches || 1,
        pieces: projet.pieces || [],
      },
      client: projet.clients || null,
      poudre: projet.poudres || null,
      devis: projet.devis || null,
      photos: (photos || []).map((p: { id: string; url: string; type: string; description: string | null; created_at: string }) => ({
        id: p.id,
        url: p.url,
        type: p.type,
        description: p.description,
        date: p.created_at,
      })),
      qualityCheck: qualityCheck || null,
      photosAvant: (photos || []).filter((p: { type: string }) => p.type === 'avant'),
      photosApres: (photos || []).filter((p: { type: string }) => p.type === 'apres'),
      photosNonConformite: (photos || []).filter((p: { type: string }) => p.type === 'non_conformite'),
    }

    // Retourner les données JSON du rapport
    // Le PDF est généré côté client avec une librairie comme jsPDF ou react-pdf
    return NextResponse.json({
      success: true,
      rapport,
    })
  } catch (error: unknown) {
    console.error('Erreur génération rapport:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    )
  }
}
