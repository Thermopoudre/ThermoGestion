import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'

// Force dynamic rendering to avoid caching issues
export const dynamic = 'force-dynamic'

export default async function FacturesPage() {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger l'atelier de l'utilisateur - EXACTEMENT comme la page projets
  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', authUser.id)
    .single()

  if (!userData) {
    redirect('/app/complete-profile')
  }

  // Charger les factures - AVEC jointures comme la page projets
  const { data: factures, error } = await supabase
    .from('factures')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      ),
      projets (
        id,
        name,
        numero
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur chargement factures:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Debug info */}
        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded text-sm">
          <p>Atelier ID: {userData.atelier_id}</p>
          <p>Factures: {factures?.length || 0}</p>
          {error && <p className="text-red-600">Erreur: {error.message}</p>}
        </div>

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
