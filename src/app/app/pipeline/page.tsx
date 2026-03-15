import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import Link from 'next/link'

const ETAPES = [
  { id: 'prospect', label: 'Prospects', color: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300' },
  { id: 'qualification', label: 'Qualification', color: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-700 dark:text-blue-300' },
  { id: 'proposition', label: 'Proposition', color: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-700 dark:text-orange-300' },
  { id: 'negociation', label: 'Négociation', color: 'bg-yellow-50 dark:bg-yellow-900/20', textColor: 'text-yellow-700 dark:text-yellow-300' },
  { id: 'gagne', label: 'Gagné', color: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-700 dark:text-green-300' },
  { id: 'perdu', label: 'Perdu', color: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-700 dark:text-red-300' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export default async function PipelinePage() {
  const { atelierId } = await getAuthorizedUser()
  const supabase = await createServerClient()

  const { data: opportunities } = await supabase
    .from('crm_pipeline')
    .select('*')
    .eq('atelier_id', atelierId)
    .order('updated_at', { ascending: false })

  const items = opportunities || []

  // Calcul KPIs
  const totalValue = items.filter(o => o.etape !== 'perdu').reduce((sum, o) => sum + Number(o.valeur_estimee || 0), 0)
  const weightedValue = items.filter(o => !['gagne', 'perdu'].includes(o.etape)).reduce((sum, o) => sum + Number(o.valeur_estimee || 0) * (o.probabilite || 50) / 100, 0)
  const wonValue = items.filter(o => o.etape === 'gagne').reduce((sum, o) => sum + Number(o.valeur_estimee || 0), 0)
  const nbActive = items.filter(o => !['gagne', 'perdu'].includes(o.etape)).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">Pipeline Commercial</h1>
            <p className="text-gray-600 dark:text-gray-400">Suivez vos opportunités commerciales</p>
          </div>
          <Link
            href="/app/pipeline/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all shadow-lg shadow-orange-500/30"
          >
            + Nouvelle opportunité
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pipe total</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pondéré</p>
            <p className="text-2xl font-black text-orange-600">{formatCurrency(weightedValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Gagné</p>
            <p className="text-2xl font-black text-green-600">{formatCurrency(wonValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Opportunités actives</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{nbActive}</p>
          </div>
        </div>

        {/* Kanban pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {ETAPES.map(etape => {
            const etapeItems = items.filter(o => o.etape === etape.id)
            const etapeTotal = etapeItems.reduce((sum, o) => sum + Number(o.valeur_estimee || 0), 0)

            return (
              <div key={etape.id} className={`${etape.color} rounded-xl p-4 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold text-sm ${etape.textColor}`}>{etape.label}</h3>
                  <span className={`text-xs font-medium ${etape.textColor} opacity-70`}>{etapeItems.length}</span>
                </div>
                {etapeTotal > 0 && (
                  <p className={`text-xs font-medium ${etape.textColor} mb-3`}>{formatCurrency(etapeTotal)}</p>
                )}
                <div className="space-y-2">
                  {etapeItems.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {item.prospect_entreprise || item.prospect_nom || 'Prospect'}
                      </p>
                      {item.valeur_estimee > 0 && (
                        <p className="text-xs font-bold text-orange-600 mt-1">{formatCurrency(item.valeur_estimee)}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{item.probabilite}%</span>
                        {item.date_prochaine_action && (
                          <span className="text-xs text-gray-400">{new Date(item.date_prochaine_action).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
