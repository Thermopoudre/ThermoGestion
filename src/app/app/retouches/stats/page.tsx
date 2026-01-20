import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RetouchesStats } from '@/components/retouches/RetouchesStats'

export default async function RetouchesStatsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/complete-profile')
  }

  // Récupérer les statistiques (30 derniers jours)
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 1)
  const endDate = new Date()

  const { data: stats } = await supabase.rpc('calculate_nc_rate', {
    p_atelier_id: userData.atelier_id,
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
  })

  // Récupérer les causes principales
  const { data: causes } = await supabase.rpc('get_main_nc_causes', {
    p_atelier_id: userData.atelier_id,
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
    p_limit: 10,
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Statistiques Retouches / NC</h1>
        <p className="text-gray-600">Analysez les causes et tendances des retouches</p>
      </div>

      <RetouchesStats
        stats={stats && stats.length > 0 ? stats[0] : null}
        causes={causes || []}
        atelierId={userData.atelier_id}
      />
    </div>
  )
}
