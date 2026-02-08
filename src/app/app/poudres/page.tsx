import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import { PoudresList } from '@/components/poudres/PoudresList'

export default async function PoudresPage() {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  // Charger les poudres avec leur stock - isolation par atelier garantie
  const { data: poudres, error } = await supabase
    .from('poudres')
    .select(`
      *,
      stock_poudres (
        stock_theorique_kg,
        stock_reel_kg,
        dernier_pesee_at
      )
    `)
    .eq('atelier_id', atelierId)
    .order('marque', { ascending: true })
    .order('reference', { ascending: true })

  if (error) {
    console.error('Erreur chargement poudres:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2">
              Catalogue poudres
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Gérez votre catalogue de poudres et leur stock
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a
              href="/app/poudres/import"
              className="w-full sm:w-auto text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Importer
            </a>
            <a
              href="/app/poudres/new"
              className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all"
            >
              + Nouvelle poudre
            </a>
          </div>
        </div>

        <PoudresList poudres={poudres || []} />
      </div>
    </div>
  )
}
