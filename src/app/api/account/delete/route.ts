import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/billing'

/**
 * POST /api/account/delete
 * 
 * Suppression du compte atelier et de toutes les données associées.
 * Conforme à l'article 17 du RGPD (droit à l'effacement).
 * 
 * Processus :
 * 1. Annuler l'abonnement Stripe si actif
 * 2. Supprimer toutes les données BDD de l'atelier
 * 3. Supprimer les fichiers Storage
 * 4. Supprimer les utilisateurs auth
 * 
 * Seul le owner peut supprimer le compte.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const adminSupabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single<{ atelier_id: string; role: string }>()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    const atelierId = userData.atelier_id
    const userRole = userData.role

    if (!atelierId) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    if (userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Seul le propriétaire du compte peut supprimer le compte' },
        { status: 403 }
      )
    }

    // Vérifier la confirmation
    const body = await request.json()
    if (body.confirmation !== 'SUPPRIMER MON COMPTE') {
      return NextResponse.json(
        { error: 'Confirmation requise. Tapez exactement "SUPPRIMER MON COMPTE".' },
        { status: 400 }
      )
    }

    // ─── 1. Annuler l'abonnement Stripe ───
    const { data: atelier } = await adminSupabase
      .from('ateliers')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', atelierId)
      .single()

    if (atelier?.stripe_subscription_id) {
      try {
        const stripe = getStripe()
        if (stripe) {
          await stripe.subscriptions.cancel(atelier.stripe_subscription_id)
        }
      } catch (err) {
        console.error('Erreur annulation Stripe:', err)
        // Continue quand même la suppression
      }
    }

    // ─── 2. Récupérer les utilisateurs de l'atelier avant suppression ───
    const { data: atelierUsers } = await adminSupabase
      .from('users')
      .select('id')
      .eq('atelier_id', atelierId)

    // ─── 3. Supprimer les données en cascade ───
    // L'ordre est important pour respecter les contraintes FK
    const tablesToClean = [
      'email_queue',
      'alertes',
      'audit_logs',
      'pesees',
      'retouches',
      'paiements',
      'saas_invoices',
      'subscriptions',
      'photos',
      'quality_checks',
      'serie_projets',
      'series',
      'factures',
      'projets',
      'devis',
      'client_users',
      'clients',
      'poudres',
      'notifications',
      'users',
    ]

    for (const table of tablesToClean) {
      try {
        await adminSupabase
          .from(table)
          .delete()
          .eq('atelier_id', atelierId)
      } catch (err) {
        console.warn(`Erreur suppression table ${table}:`, err)
        // Continuer avec les autres tables
      }
    }

    // ─── 4. Supprimer l'atelier ───
    await adminSupabase
      .from('ateliers')
      .delete()
      .eq('id', atelierId)

    // ─── 5. Supprimer les fichiers Storage ───
    try {
      const buckets = ['photos', 'pdfs', 'signatures']
      for (const bucket of buckets) {
        const { data: files } = await adminSupabase.storage
          .from(bucket)
          .list(atelierId)

        if (files && files.length > 0) {
          const filePaths = files.map(f => `${atelierId}/${f.name}`)
          await adminSupabase.storage.from(bucket).remove(filePaths)
        }
      }
    } catch (err) {
      console.warn('Erreur suppression fichiers Storage:', err)
    }

    // ─── 6. Supprimer les utilisateurs auth ───
    if (atelierUsers) {
      for (const atelierUser of atelierUsers) {
        try {
          await adminSupabase.auth.admin.deleteUser(atelierUser.id)
        } catch (err) {
          console.warn(`Erreur suppression auth user ${atelierUser.id}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Compte et toutes les données supprimés avec succès.',
    })
  } catch (error: unknown) {
    console.error('Erreur suppression compte:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte. Contactez le support.' },
      { status: 500 }
    )
  }
}
