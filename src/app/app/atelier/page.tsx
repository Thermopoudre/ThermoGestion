import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import WorkshopScreen from '@/components/atelier/WorkshopScreen'

export const dynamic = 'force-dynamic'

export default async function AtelierPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Récupérer l'utilisateur et son atelier
  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id, atelier:ateliers(ecran_atelier_config)')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) redirect('/app/complete-profile')

  // Récupérer les projets
  const { data: projets } = await supabase
    .from('projets')
    .select(`
      id,
      numero,
      name,
      status,
      date_souhaite,
      priority,
      surface_m2,
      client:clients(full_name),
      poudre:poudres(ral, reference)
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  // Calculer les stats
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const projetsJour = projets?.filter(p => 
    p.status !== 'livre' && p.status !== 'annule'
  ).length || 0

  const { count: projetsSemaine } = await supabase
    .from('projets')
    .select('id', { count: 'exact', head: true })
    .eq('atelier_id', userData.atelier_id)
    .gte('created_at', weekAgo)

  const surfaceJour = projets
    ?.filter(p => !['livre', 'annule'].includes(p.status))
    .reduce((sum, p) => sum + (p.surface_m2 || 0), 0) || 0

  // Taux de retouche (mock pour l'instant)
  const tauxRetouche = 2.5

  // Alertes
  const alerts = []
  
  // Alerte stock bas (exemple)
  const { data: stockBas } = await supabase
    .from('poudres')
    .select('reference')
    .eq('atelier_id', userData.atelier_id)
    .lt('stock_reel_kg', 5)
    .limit(3)

  if (stockBas && stockBas.length > 0) {
    alerts.push({
      id: 'stock-bas',
      type: 'stock' as const,
      message: `Stock bas: ${stockBas.map(p => p.reference).join(', ')}`,
      severity: 'warning' as const
    })
  }

  // Alertes retard
  const projetsEnRetard = projets?.filter(p => {
    if (!p.date_souhaite || ['livre', 'annule'].includes(p.status)) return false
    return new Date(p.date_souhaite) < new Date()
  }) || []

  if (projetsEnRetard.length > 0) {
    alerts.push({
      id: 'retard',
      type: 'delai' as const,
      message: `${projetsEnRetard.length} projet(s) en retard`,
      severity: projetsEnRetard.length > 3 ? 'critical' as const : 'warning' as const
    })
  }

  const config = userData.atelier?.ecran_atelier_config as any

  return (
    <WorkshopScreen
      projets={projets || []}
      alerts={alerts}
      stats={{
        projetsJour,
        projetsSemaine: projetsSemaine || 0,
        surfaceJour: Math.round(surfaceJour),
        tauxRetouche
      }}
      config={config}
    />
  )
}
