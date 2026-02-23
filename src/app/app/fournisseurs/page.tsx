import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function FournisseursPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string }
}) {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  const page = Math.max(1, parseInt(searchParams.page || '1'))
  const limit = 25
  const from = (page - 1) * limit

  let query = supabase
    .from('fournisseurs')
    .select('*', { count: 'exact' })
    .eq('atelier_id', atelierId)
    .order('nom', { ascending: true })
    .range(from, from + limit - 1)

  if (searchParams.search) {
    query = query.or(`nom.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%`)
  }

  const { data: fournisseurs, count, error } = await query
  const totalPages = Math.ceil((count || 0) / limit)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">Fournisseurs</h1>
            <p className="text-gray-600 dark:text-gray-400">Gérez vos fournisseurs de poudres et consommables</p>
          </div>
          <Link
            href="/app/fournisseurs/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all shadow-lg shadow-orange-500/30"
          >
            + Nouveau fournisseur
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300">
            Erreur: {error.message}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Nom</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white hidden md:table-cell">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Délai</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Note</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(fournisseurs || []).map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{f.nom}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{f.contact_nom || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{f.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{f.delai_livraison_jours ? `${f.delai_livraison_jours}j` : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={`text-sm ${star <= (f.note_qualite || 0) ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.active !== false ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'}`}>
                        {f.active !== false ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!fournisseurs || fournisseurs.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      Aucun fournisseur enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Page {page}/{totalPages} ({count} résultats)</p>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/app/fournisseurs?page=${page - 1}`} className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm">Précédent</Link>}
                {page < totalPages && <Link href={`/app/fournisseurs?page=${page + 1}`} className="px-3 py-1 rounded bg-orange-500 text-white text-sm">Suivant</Link>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
