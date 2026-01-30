import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FacturesPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Get user's atelier
  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) {
    redirect('/app/complete-profile')
  }

  // Get factures - query simple sans jointures
  const { data: facturesData, error } = await supabase
    .from('factures')
    .select('id, numero, client_id, projet_id, type, status, payment_status, total_ht, total_ttc, tva_rate, due_date, paid_at, items, notes, created_at')
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  // Get clients separately
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              Factures Clients
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Gérez vos factures et paiements clients
            </p>
          </div>
          <a
            href="/app/factures/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouvelle facture
          </a>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded-lg text-red-700 dark:text-red-200">
            Erreur: {error.message}
          </div>
        )}

        <FacturesList factures={factures} />
      </div>
    </div>
  )
}
