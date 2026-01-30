import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SettingsNav } from '@/components/settings/SettingsNav'

export const dynamic = 'force-dynamic'

export default async function AbonnementPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) {
    redirect('/app/complete-profile')
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .single()

  // Get SaaS invoices
  const { data: saasInvoices } = await supabase
    .from('saas_invoices')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  const planLabels: Record<string, string> = {
    trial: 'Essai gratuit',
    atelier: 'Plan Atelier',
    pro: 'Plan Pro'
  }

  const statusLabels: Record<string, string> = {
    active: 'Actif',
    past_due: 'Paiement en retard',
    cancelled: 'Annulé',
    expired: 'Expiré'
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez votre abonnement ThermoGestion et consultez vos factures
          </p>
        </div>

        <SettingsNav />

        {/* Current subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Votre abonnement actuel
            </h2>
            {subscription && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[subscription.status] || statusColors.active}`}>
                {statusLabels[subscription.status] || subscription.status}
              </span>
            )}
          </div>

          {subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {planLabels[subscription.plan] || subscription.plan}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Prix mensuel</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {subscription.price_monthly > 0 ? `${subscription.price_monthly} € HT` : 'Gratuit'}
                </p>
              </div>

              {subscription.plan === 'trial' && subscription.trial_end && (
                <div className="md:col-span-2">
                  <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <p className="text-orange-800 dark:text-orange-300">
                      <span className="font-medium">🎉 Essai gratuit</span> jusqu'au{' '}
                      {format(new Date(subscription.trial_end), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      Profitez de toutes les fonctionnalités Pro pendant votre période d'essai
                    </p>
                  </div>
                </div>
              )}

              {subscription.current_period_end && subscription.plan !== 'trial' && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Prochaine facturation</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                Aucun abonnement actif
              </p>
            </div>
          )}

          {/* Upgrade button */}
          {subscription?.plan === 'trial' && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all">
                Passer au Plan Pro
              </button>
            </div>
          )}
        </div>

        {/* SaaS Invoices */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Factures d'abonnement
          </h2>

          {saasInvoices && saasInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Numéro</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Période</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Montant TTC</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Statut</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {saasInvoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                        {invoice.numero}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {invoice.period_start && invoice.period_end ? (
                          <>
                            {format(new Date(invoice.period_start), 'MMM yyyy', { locale: fr })}
                          </>
                        ) : (
                          format(new Date(invoice.created_at), 'dd/MM/yyyy', { locale: fr })
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                        {invoice.amount_ttc?.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'paid' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {invoice.status === 'paid' ? 'Payée' : invoice.status === 'pending' ? 'En attente' : 'Échec'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.pdf_url && (
                          <a 
                            href={invoice.pdf_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 text-sm font-medium"
                          >
                            Télécharger
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Aucune facture d'abonnement pour le moment
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Les factures apparaîtront ici après votre premier paiement
              </p>
            </div>
          )}
        </div>

        {/* Help section */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
            Besoin d'aide ?
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Pour toute question concernant votre abonnement ou vos factures, contactez-nous à{' '}
            <a href="mailto:contact@thermogestion.fr" className="underline font-medium">
              contact@thermogestion.fr
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
