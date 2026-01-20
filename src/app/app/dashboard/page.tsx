import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import Link from 'next/link'

// Page d'erreur pour afficher quand le profil est incomplet
function ProfileIncompleteError({ email, reason }: { email: string; reason: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          Profil incomplet
        </h1>
        
        <p className="text-gray-600 mb-6">
          {reason}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Email :</strong> {email}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/app/complete-profile"
            className="block w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-center"
          >
            Compléter mon profil
          </Link>
          <Link
            href="/auth/logout"
            className="block w-full bg-gray-100 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-200 transition-colors text-center"
          >
            Se déconnecter
          </Link>
        </div>
      </div>
    </div>
  )
}

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
    // Si l'utilisateur n'existe pas dans la table users, afficher une erreur
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Votre compte d'authentification existe mais votre profil utilisateur n'a pas été créé. Veuillez compléter votre profil ou contacter le support."
      />
    )
  }

  // Vérifier que l'atelier existe (peut être null si relation non chargée ou si pas d'atelier)
  let atelier = Array.isArray(userData.ateliers) 
    ? userData.ateliers[0] 
    : userData.ateliers

  // Si l'atelier n'est pas chargé via la relation mais atelier_id existe, charger directement
  if ((!atelier || !atelier.id) && userData.atelier_id) {
    const { data: atelierDirect, error: atelierError } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()
    
    if (atelierError || !atelierDirect) {
      // L'atelier_id existe mais l'atelier n'existe pas (relation cassée)
      console.error('Atelier not found for atelier_id:', userData.atelier_id, atelierError)
      return (
        <ProfileIncompleteError 
          email={authUser.email || ''} 
          reason="Votre atelier n'a pas pu être chargé. Il peut y avoir un problème de configuration. Veuillez contacter le support."
        />
      )
    }
    
    atelier = atelierDirect
  }

  if (!atelier || !atelier.id) {
    // Si pas d'atelier du tout, afficher une erreur
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Aucun atelier n'est associé à votre compte. Veuillez compléter votre profil pour créer ou rejoindre un atelier."
      />
    )
  }

  // Charger les statistiques avec gestion d'erreur
  let clientsCount = { count: 0 }
  let projetsCount = { count: 0 }
  let devisCount = { count: 0 }

  try {
    const [clientsResult, projetsResult, devisResult] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
      supabase.from('projets').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
      supabase.from('devis').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
    ])

    clientsCount = clientsResult
    projetsCount = projetsResult
    devisCount = devisResult
  } catch (statsError) {
    console.error('Erreur chargement statistiques:', statsError)
    // Continuer avec des valeurs par défaut
  }

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
          storageUsed={Number(atelier.storage_used_gb || 0)}
          storageQuota={atelier.storage_quota_gb || 20}
        />

        <div className="mt-8">
          <RecentActivity atelierId={atelier.id} />
        </div>
      </div>
    </div>
  )
}
