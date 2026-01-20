import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RetouchesList } from '@/components/retouches/RetouchesList'

export default async function RetouchesPage() {
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

  // Récupérer les retouches
  const { data: retouches, error } = await supabase
    .from('retouches')
    .select(`
      *,
      projets (
        id,
        name,
        numero,
        status
      ),
      defaut_types (
        id,
        name,
        category
      ),
      created_by_user:users!retouches_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur récupération retouches:', error)
  }

  // Récupérer les statistiques
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 1)
  const endDate = new Date()

  const { data: stats } = await supabase.rpc('calculate_nc_rate', {
    p_atelier_id: userData.atelier_id,
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Retouches / Non-conformités</h1>
        <p className="text-gray-600">Déclarez et suivez les retouches sur vos projets</p>
      </div>

      {/* Statistiques */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Taux de NC</p>
            <p className="text-3xl font-bold text-red-600">
              {Number(stats[0].taux_nc).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats[0].projets_avec_nc} projet(s) sur {stats[0].total_projets}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Total retouches</p>
            <p className="text-3xl font-bold text-gray-900">{stats[0].total_retouches}</p>
            <p className="text-xs text-gray-500 mt-1">Derniers 30 jours</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Projets avec NC</p>
            <p className="text-3xl font-bold text-orange-600">{stats[0].projets_avec_nc}</p>
            <p className="text-xs text-gray-500 mt-1">Sur {stats[0].total_projets} projets</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600 mb-1">Total projets</p>
            <p className="text-3xl font-bold text-blue-600">{stats[0].total_projets}</p>
            <p className="text-xs text-gray-500 mt-1">Derniers 30 jours</p>
          </div>
        </div>
      )}

      <RetouchesList retouches={retouches || []} atelierId={userData.atelier_id} />
    </div>
  )
}
