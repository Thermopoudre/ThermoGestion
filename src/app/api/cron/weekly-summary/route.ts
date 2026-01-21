import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// API pour envoyer le résumé hebdomadaire à chaque atelier
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET || process.env.EMAIL_QUEUE_SECRET_KEY
  
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const results: any[] = []

  try {
    // Récupérer tous les ateliers actifs
    const { data: ateliers } = await supabase
      .from('ateliers')
      .select('id, name, email')
      .not('email', 'is', null)

    for (const atelier of ateliers || []) {
      // Récupérer les utilisateurs propriétaires de l'atelier
      const { data: owners } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('atelier_id', atelier.id)
        .eq('is_owner', true)

      // Stats de la semaine
      const [
        nouveauxClients,
        nouveauxProjets,
        devisEnvoyes,
        devisSignes,
        facturesPaid,
        facturesImpayees,
        stockBas,
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelier.id).gte('created_at', weekAgo.toISOString()),
        supabase.from('projets').select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelier.id).gte('created_at', weekAgo.toISOString()),
        supabase.from('devis').select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelier.id).eq('status', 'envoye').gte('created_at', weekAgo.toISOString()),
        supabase.from('devis').select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelier.id).in('status', ['accepte', 'converted']).gte('signed_at', weekAgo.toISOString()),
        supabase.from('factures').select('total_ttc')
          .eq('atelier_id', atelier.id).eq('payment_status', 'paid').gte('paid_at', weekAgo.toISOString()),
        supabase.from('factures').select('id, total_ttc', { count: 'exact' })
          .eq('atelier_id', atelier.id).eq('payment_status', 'unpaid'),
        supabase.from('poudres').select('id', { count: 'exact', head: true })
          .eq('atelier_id', atelier.id).lt('stock_reel_kg', 1),
      ])

      const caPaid = (facturesPaid.data || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0)
      const montantImpaye = (facturesImpayees.data || []).reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0)

      // Envoyer l'email à chaque owner
      for (const owner of owners || []) {
        await supabase.from('email_queue').insert({
          atelier_id: atelier.id,
          to_email: owner.email,
          to_name: owner.full_name,
          subject: `📊 Résumé hebdomadaire - ${atelier.name}`,
          template: 'weekly_summary',
          variables: {
            atelier_name: atelier.name,
            user_name: owner.full_name,
            period: `${weekAgo.toLocaleDateString('fr-FR')} - ${now.toLocaleDateString('fr-FR')}`,
            nouveaux_clients: nouveauxClients.count || 0,
            nouveaux_projets: nouveauxProjets.count || 0,
            devis_envoyes: devisEnvoyes.count || 0,
            devis_signes: devisSignes.count || 0,
            ca_semaine: caPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
            factures_impayees: facturesImpayees.count || 0,
            montant_impaye: montantImpaye.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
            stock_bas: stockBas.count || 0,
          },
          priority: 'low',
        })

        results.push({
          atelier: atelier.name,
          user: owner.email,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} résumé(s) hebdomadaire(s) planifié(s)`,
      results,
    })

  } catch (error: any) {
    console.error('Erreur résumé hebdomadaire:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
