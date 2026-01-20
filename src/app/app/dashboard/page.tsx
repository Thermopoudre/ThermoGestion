import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentActivity } from '@/components/dashboard/RecentActivity'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger les données utilisateur avec l'atelier
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select(`
      *,
      ateliers (*)
    `)
    .eq('id', authUser.id)
    .single()

  if (userError || !userData) {
    // Si l'utilisateur n'existe pas dans la table users, rediriger vers complétion profil
    redirect('/app/complete-profile')
  }

  const atelier = userData.ateliers

  // Charger les statistiques
  const [clientsCount, projetsCount, devisCount] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
    supabase.from('projets').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
    supabase.from('devis').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Tableau de bord
          </h1>
          <p className="text-gray-600">
            Bienvenue, {userData.full_name || authUser.email} • {atelier.name}
          </p>
          {atelier.trial_ends_at && new Date(atelier.trial_ends_at) > new Date() && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                🎉 <strong>Essai gratuit actif</strong> jusqu'au {new Date(atelier.trial_ends_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>

        <DashboardStats
          clients={clientsCount.count || 0}
          projets={projetsCount.count || 0}
          devis={devisCount.count || 0}
          storageUsed={Number(atelier.storage_used_gb)}
          storageQuota={atelier.storage_quota_gb}
        />

        <div className="mt-8">
          <RecentActivity atelierId={atelier.id} />
        </div>
      </div>
    </div>
  )
}
