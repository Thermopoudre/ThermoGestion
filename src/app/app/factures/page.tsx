import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'
import Link from 'next/link'

// Force dynamic rendering to avoid caching issues
export const dynamic = 'force-dynamic'

// Page d'erreur pour afficher quand le profil est incomplet
function ProfileIncompleteError({ email, reason }: { email: string; reason: string }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔥</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Profil incomplet</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{reason}</p>
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-orange-800 dark:text-orange-300"><strong>Email :</strong> {email}</p>
        </div>
        <div className="space-y-3">
          <Link href="/app/complete-profile" className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all text-center shadow-lg shadow-orange-500/30">
            Compléter mon profil
          </Link>
          <Link href="/auth/logout" className="block w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-center">
            Se déconnecter
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function FacturesPage() {
  const supabase = await createServerClient()

  // EXACTEMENT comme le dashboard
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger les données utilisateur avec l'atelier - EXACTEMENT comme le dashboard
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select(`*, ateliers (*)`)
    .eq('id', authUser.id)
    .single()

  if (userError || !userData) {
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Votre compte d'authentification existe mais votre profil utilisateur n'a pas été créé."
      />
    )
  }

  // Extraire l'atelier - EXACTEMENT comme le dashboard
  let atelier = Array.isArray(userData.ateliers) ? userData.ateliers[0] : userData.ateliers

  if ((!atelier || !atelier.id) && userData.atelier_id) {
    const { data: atelierDirect } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()
    atelier = atelierDirect
  }

  if (!atelier || !atelier.id) {
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Aucun atelier n'est associé à votre compte."
      />
    )
  }

  // Récupérer les factures - EXACTEMENT comme le dashboard
  const { data: facturesData, error: facturesError } = await supabase
    .from('factures')
    .select('id, numero, client_id, type, status, payment_status, total_ht, total_ttc, tva_rate, due_date, paid_at, items, notes, created_at')
    .eq('atelier_id', atelier.id)
    .order('created_at', { ascending: false })

  // Debug logging
  console.log('[Factures Page] atelier.id:', atelier.id)
  console.log('[Factures Page] facturesData:', facturesData?.length || 0, 'factures')
  if (facturesError) {
    console.error('[Factures Page] Erreur:', facturesError)
  }

  // Récupérer les clients séparément si des factures existent
  let factures = facturesData || []
  
  if (factures.length > 0) {
    const clientIds = [...new Set(factures.map(f => f.client_id).filter(Boolean))]
    
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .in('id', clientIds)
      
      const clientsMap = new Map(clientsData?.map(c => [c.id, c]) || [])
      
      factures = factures.map(f => ({
        ...f,
        clients: clientsMap.get(f.client_id) || null
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Factures</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Gérez vos factures et paiements</p>
          </div>
          <a
            href="/app/factures/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouvelle facture
          </a>
        </div>

        <FacturesList factures={factures || []} />
      </div>
    </div>
  )
}
