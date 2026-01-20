import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Route API pour initialiser les templates pour les ateliers existants
// À appeler une fois après la migration
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est owner ou admin
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', authUser.id)
      .single()

    if (!userData || (userData.role !== 'owner' && userData.role !== 'admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Vérifier si des templates existent déjà pour cet atelier
    const { data: existingTemplates } = await supabase
      .from('devis_templates')
      .select('id')
      .eq('atelier_id', userData.atelier_id)
      .limit(1)

    if (existingTemplates && existingTemplates.length > 0) {
      return NextResponse.json({ 
        message: 'Les templates existent déjà pour cet atelier',
        already_exists: true 
      })
    }

    // Appeler la fonction SQL pour créer les templates par défaut
    const { error } = await supabase.rpc('create_default_devis_templates', {
      p_atelier_id: userData.atelier_id
    })

    if (error) {
      console.error('Erreur création templates:', error)
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la création des templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Templates créés avec succès',
      atelier_id: userData.atelier_id
    })
  } catch (error: any) {
    console.error('Erreur init templates:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
