import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST: Activer le mode demo pour un atelier (apres inscription)
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Inscription requise pour la démo' }, { status: 401 })
    }

    // Get user's atelier
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Only owner can activate demo
    if (userData.role !== 'owner') {
      return NextResponse.json({ error: 'Seul le propriétaire peut activer la démo' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Mark as demo atelier
    const demoExpires = new Date()
    demoExpires.setDate(demoExpires.getDate() + 7) // Demo lasts 7 days

    await admin
      .from('ateliers')
      .update({
        is_demo: true,
        demo_expires_at: demoExpires.toISOString(),
      })
      .eq('id', userData.atelier_id)

    // Seed demo data using the SQL function
    const { error: seedError } = await admin.rpc('seed_demo_data', {
      p_atelier_id: userData.atelier_id,
      p_user_id: user.id,
    })

    if (seedError) {
      console.error('Erreur seed demo:', seedError)
      // Fallback: seed manually if function doesn't exist yet
      await seedDemoDataManual(admin, userData.atelier_id, user.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Données de démonstration chargées avec succès',
      demo_expires_at: demoExpires.toISOString(),
    })
  } catch (error) {
    console.error('Erreur setup demo:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function seedDemoDataManual(admin: ReturnType<typeof createAdminClient>, atelierId: string, userId: string) {
  // Insert demo clients
  const { data: clients } = await admin.from('clients').insert([
    { atelier_id: atelierId, full_name: 'Acier Plus SAS', email: 'contact@acierplus-demo.fr', phone: '01 23 45 67 89', type: 'professionnel', siret: '12345678901234' },
    { atelier_id: atelierId, full_name: 'MetalPro Industries', email: 'commandes@metalpro-demo.fr', phone: '01 98 76 54 32', type: 'professionnel', siret: '98765432109876' },
    { atelier_id: atelierId, full_name: 'Jean Dupont', email: 'jean.dupont@demo-email.fr', phone: '06 12 34 56 78', type: 'particulier' },
  ]).select()

  // Insert demo poudres
  const { data: poudres } = await admin.from('poudres').insert([
    { atelier_id: atelierId, marque: 'IGP', reference: 'IGP-9005-M', type: 'polyester', ral: '9005', finition: 'mat', densite: 1.4, temp_cuisson: 200, duree_cuisson: 15, consommation_m2: 0.12, stock_theorique_kg: 25, stock_reel_kg: 22.5, prix_kg: 12.50 },
    { atelier_id: atelierId, marque: 'AkzoNobel', reference: 'INT-7016-S', type: 'epoxy-polyester', ral: '7016', finition: 'satin', densite: 1.5, temp_cuisson: 190, duree_cuisson: 20, consommation_m2: 0.15, stock_theorique_kg: 40, stock_reel_kg: 38, prix_kg: 14.00 },
    { atelier_id: atelierId, marque: 'Tiger', reference: 'TIG-9016-B', type: 'polyester', ral: '9016', finition: 'brillant', densite: 1.3, temp_cuisson: 180, duree_cuisson: 15, consommation_m2: 0.11, stock_theorique_kg: 15, stock_reel_kg: 12, prix_kg: 11.00 },
  ]).select()

  if (!clients?.length || !poudres?.length) return

  // Insert demo projects
  await admin.from('projets').insert([
    { atelier_id: atelierId, client_id: clients[0].id, numero: 'PROJ-DEMO-001', name: 'Portail acier 2m x 1.5m', status: 'en_cours', poudre_id: poudres[0].id, couches: 2, temp_cuisson: 200, duree_cuisson: 15, date_depot: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], date_promise: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], created_by: userId },
    { atelier_id: atelierId, client_id: clients[1].id, numero: 'PROJ-DEMO-002', name: 'Lot 50 équerres industrielles', status: 'en_cuisson', poudre_id: poudres[1].id, couches: 1, temp_cuisson: 190, duree_cuisson: 20, date_depot: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], date_promise: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], created_by: userId },
    { atelier_id: atelierId, client_id: clients[0].id, numero: 'PROJ-DEMO-003', name: 'Garde-corps balcon', status: 'qc', poudre_id: poudres[0].id, couches: 2, temp_cuisson: 200, duree_cuisson: 15, date_depot: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], date_promise: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0], created_by: userId },
    { atelier_id: atelierId, client_id: clients[2].id, numero: 'PROJ-DEMO-004', name: 'Jantes 4x 17 pouces', status: 'pret', poudre_id: poudres[2].id, couches: 2, temp_cuisson: 180, duree_cuisson: 15, date_depot: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], date_promise: new Date().toISOString().split('T')[0], created_by: userId },
  ])

  // Insert demo invoices
  await admin.from('factures').insert([
    { atelier_id: atelierId, client_id: clients[0].id, numero: 'FACT-DEMO-001', type: 'complete', status: 'envoyee', payment_status: 'paid', total_ht: 850, total_ttc: 1020, tva_rate: 20, paid_at: new Date().toISOString(), created_by: userId },
    { atelier_id: atelierId, client_id: clients[1].id, numero: 'FACT-DEMO-002', type: 'acompte', status: 'envoyee', payment_status: 'unpaid', total_ht: 1200, total_ttc: 1440, tva_rate: 20, created_by: userId },
  ])
}
