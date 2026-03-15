import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import { ProjetsList } from '@/components/projets/ProjetsList'

const PAGE_SIZE = 50

export default async function ProjetsPage({ searchParams }: { searchParams: { client?: string; status?: string; page?: string } }) {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('projets')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      ),
      poudres (
        id,
        marque,
        reference,
        finition
      )
    `, { count: 'exact' })
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchParams.client) {
    query = query.eq('client_id', searchParams.client)
  }

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: projets, count, error } = await query
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)

  if (error) {
    console.error('Erreur chargement projets:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2">
              Projets
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Suivez vos projets de thermolaquage
              {count !== null && <span className="ml-2 text-xs text-gray-400">({count} total)</span>}
            </p>
          </div>
          <a
            href="/app/projets/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all shadow-lg shadow-orange-500/30"
          >
            + Nouveau projet
          </a>
        </div>

        <ProjetsList projets={projets || []} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={`/app/projets?page=${page - 1}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.client ? `&client=${searchParams.client}` : ''}`}
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
                href={`/app/projets?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.client ? `&client=${searchParams.client}` : ''}`}
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
