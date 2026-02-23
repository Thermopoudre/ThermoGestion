import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { changeProjetStatus } from '@/lib/automatisations/projet-status'
import { StatusChangeSchema, VALID_STATUS_TRANSITIONS, validateBody } from '@/lib/validations'

export async function PATCH(
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
      .select('atelier_id, role')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Validate UUID format for project ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(params.id)) {
      return NextResponse.json({ error: 'ID projet invalide' }, { status: 400 })
    }

    // Verify project belongs to atelier
    const { data: projet } = await supabase
      .from('projets')
      .select('id, atelier_id, status')
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (!projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    const body = await request.json()

    // Validate input with Zod
    const validation = validateBody(StatusChangeSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Statut invalide', details: validation.errors },
        { status: 400 }
      )
    }

    const { status: newStatus } = validation.data

    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[projet.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transition invalide: ${projet.status} → ${newStatus}. Transitions autorisées: ${allowedTransitions.join(', ')}` },
        { status: 422 }
      )
    }

    // Check role-based permission for certain transitions
    if (newStatus === 'annule' && !['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Seul un administrateur peut annuler un projet' },
        { status: 403 }
      )
    }

    // Call automation service
    const result = await changeProjetStatus(
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      params.id,
      newStatus,
      authUser.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Statut mis à jour',
      factureCreated: result.factureCreated,
      factureId: result.factureId,
      stockUpdated: result.stockUpdated,
    })

  } catch (error: unknown) {
    console.error('Erreur changement statut projet:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
