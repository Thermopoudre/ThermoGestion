import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import { FacturesList } from '@/components/factures/FacturesList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 50

export default async function FacturesPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('factures')
    .select('id, numero, client_id, projet_id, type, status, payment_status, total_ht, total_ttc, tva_rate, due_date, paid_at, items, notes, created_at', { count: 'exact' })
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchParams.status) {
    query = query.eq('payment_status', searchParams.status)
  }

  const { data: facturesData, count, error } = await query
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)

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
              {count !== null && <span className="ml-2 text-xs text-gray-400">({count} total)</span>}
            </p>
          </div>
          <a
            href="/app/factures/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={`/app/factures?page=${page - 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Précédent
              </a>
            )}
            <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              Page {page} / {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/app/factures?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Suivant
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
