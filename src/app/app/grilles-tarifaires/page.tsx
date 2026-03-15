import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function GrillesTarifairesPage() {
  const { atelierId } = await getAuthorizedUser({ requiredRoles: ['owner', 'admin'] })
  const supabase = await createServerClient()

  const { data: grilles } = await supabase
    .from('grilles_tarifaires_industrielles')
    .select('*, clients(full_name)')
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: false })

  const items = grilles || []

  const typeLabels: Record<string, string> = {
    surface: 'Au m²',
    poids: 'Au kg',
    piece: 'A la pièce',
    forfait: 'Forfait',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">Grilles Tarifaires</h1>
            <p className="text-gray-600 dark:text-gray-400">Configurez vos tarifs par client ou par défaut</p>
          </div>
          <Link
            href="/app/grilles-tarifaires/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all shadow-lg shadow-orange-500/30"
          >
            + Nouvelle grille
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((grille) => {
            const paliers = (grille.paliers as any[]) || []

            return (
              <div key={grille.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{grille.nom}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {grille.clients?.full_name || 'Grille par défaut'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${grille.actif ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600'}`}>
                    {grille.actif ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                    {typeLabels[grille.type] || grille.type}
                  </span>
                  {grille.remise_volume_percent > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                      -{grille.remise_volume_percent}% volume
                    </span>
                  )}
                </div>

                {paliers.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-gray-500">De</th>
                          <th className="px-3 py-1.5 text-left text-gray-500">À</th>
                          <th className="px-3 py-1.5 text-right text-gray-500">Prix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {paliers.slice(0, 5).map((p: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-900 dark:text-white">{p.min}</td>
                            <td className="px-3 py-1.5 text-gray-900 dark:text-white">{p.max || '∞'}</td>
                            <td className="px-3 py-1.5 text-right font-medium text-orange-600">{Number(p.prix_unitaire).toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {grille.valide_du && (
                  <p className="text-xs text-gray-400 mt-3">
                    Valide du {new Date(grille.valide_du).toLocaleDateString('fr-FR')}
                    {grille.valide_au && ` au ${new Date(grille.valide_au).toLocaleDateString('fr-FR')}`}
                  </p>
                )}
              </div>
            )
          })}

          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              Aucune grille tarifaire configurée.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
