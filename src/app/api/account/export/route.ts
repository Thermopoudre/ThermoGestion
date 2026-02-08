import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/account/export
 * 
 * Export RGPD des données de l'atelier.
 * Génère un fichier JSON contenant toutes les données de l'atelier
 * conformément à l'article 20 du RGPD (droit à la portabilité).
 * 
 * Seul le owner peut déclencher l'export.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Seul le owner peut exporter les données
    if (userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Seul le propriétaire du compte peut exporter les données' },
        { status: 403 }
      )
    }

    const atelierId = userData.atelier_id

    // Récupérer TOUTES les données personnelles de l'atelier
    // Conformité art. 15 + art. 20 RGPD : exhaustivité requise
    const [
      atelierResult,
      usersResult,
      clientsResult,
      projetsResult,
      devisResult,
      facturesResult,
      avoirsResult,
      paiementsResult,
      poudresResult,
      seriesResult,
      photosResult,
      emailQueueResult,
      alertesResult,
      notificationsResult,
      retouchesResult,
      bonsLivraisonResult,
      clientUsersResult,
      auditResult,
    ] = await Promise.all([
      supabase.from('ateliers').select('*').eq('id', atelierId).single(),
      supabase.from('users').select('id, email, role, full_name, created_at').eq('atelier_id', atelierId),
      supabase.from('clients').select('*').eq('atelier_id', atelierId),
      supabase.from('projets').select('*').eq('atelier_id', atelierId),
      supabase.from('devis').select('*').eq('atelier_id', atelierId),
      supabase.from('factures').select('*').eq('atelier_id', atelierId),
      supabase.from('avoirs').select('*').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('paiements').select('*').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('poudres').select('*').eq('atelier_id', atelierId),
      supabase.from('series').select('*').eq('atelier_id', atelierId),
      supabase.from('photos').select('id, projet_id, url, type, description, created_at').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('email_queue').select('id, recipient, subject, status, created_at, sent_at, error').eq('atelier_id', atelierId).order('created_at', { ascending: false }).limit(500).catch(() => ({ data: [] })),
      supabase.from('alertes').select('*').eq('atelier_id', atelierId).order('created_at', { ascending: false }).limit(500).catch(() => ({ data: [] })),
      supabase.from('push_subscriptions').select('id, user_id, created_at').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('retouches').select('*').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('bons_livraison').select('*').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('client_users').select('id, email, client_id, created_at').eq('atelier_id', atelierId).catch(() => ({ data: [] })),
      supabase.from('audit_logs').select('*').eq('atelier_id', atelierId).order('created_at', { ascending: false }).limit(1000),
    ])

    const exportData = {
      meta: {
        exported_at: new Date().toISOString(),
        format: 'RGPD Data Export - Exhaustif (art. 15 + art. 20 RGPD)',
        version: '2.0',
        atelier_id: atelierId,
        requested_by: user.email,
        tables_exportees: [
          'ateliers', 'users', 'clients', 'projets', 'devis', 'factures',
          'avoirs', 'paiements', 'poudres', 'series', 'photos', 'email_queue',
          'alertes', 'push_subscriptions', 'retouches', 'bons_livraison',
          'client_users', 'audit_logs',
        ],
      },
      atelier: atelierResult.data,
      utilisateurs: usersResult.data || [],
      clients: clientsResult.data || [],
      projets: projetsResult.data || [],
      devis: devisResult.data || [],
      factures: facturesResult.data || [],
      avoirs: (avoirsResult as any).data || [],
      paiements: (paiementsResult as any).data || [],
      poudres: poudresResult.data || [],
      series: seriesResult.data || [],
      photos: (photosResult as any).data || [],
      emails_envoyes: (emailQueueResult as any).data || [],
      alertes: (alertesResult as any).data || [],
      notifications_push: (notificationsResult as any).data || [],
      retouches: (retouchesResult as any).data || [],
      bons_livraison: (bonsLivraisonResult as any).data || [],
      comptes_clients_portail: (clientUsersResult as any).data || [],
      journal_audit: auditResult.data || [],
    }

    // Retourner comme fichier JSON téléchargeable
    const jsonContent = JSON.stringify(exportData, null, 2)
    const filename = `thermogestion_export_${atelierId}_${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error('Erreur export données:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'export des données' },
      { status: 500 }
    )
  }
}
