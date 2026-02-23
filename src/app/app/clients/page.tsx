import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import { ClientsList } from '@/components/clients/ClientsList'

const PAGE_SIZE = 50

export default async function ClientsPage({ searchParams }: { searchParams: { page?: string; search?: string } }) {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchParams.search) {
    query = query.or(`full_name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%`)
  }

  const { data: clients, count, error } = await query
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)

  if (error) {
    console.error('Erreur chargement clients:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2">
              Clients
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Gérez vos clients et leurs informations
              {count !== null && <span className="ml-2 text-xs text-gray-400">({count} total)</span>}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <a
              href="/app/clients/import"
              className="flex-1 sm:flex-none text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm sm:text-base"
            >
              <span className="hidden sm:inline">Importer CSV</span>
              <span className="sm:hidden">📥 Import</span>
            </a>
            <a
              href="/app/clients/new"
              className="flex-1 sm:flex-none text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all text-sm sm:text-base"
            >
              <span className="hidden sm:inline">+ Nouveau client</span>
              <span className="sm:hidden">+ Ajouter</span>
            </a>
          </div>
        </div>

        <ClientsList clients={clients || []} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={`/app/clients?page=${page - 1}${searchParams.search ? `&search=${encodeURIComponent(searchParams.search)}` : ''}`}
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
                href={`/app/clients?page=${page + 1}${searchParams.search ? `&search=${encodeURIComponent(searchParams.search)}` : ''}`}
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
