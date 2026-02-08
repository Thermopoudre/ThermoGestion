import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SubscriptionActions } from '@/components/settings/SubscriptionActions'
import { PLANS } from '@/lib/stripe/billing'

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

  // Get atelier (pour trial_ends_at)
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('id, plan, trial_ends_at, stripe_customer_id, subscription_status')
    .eq('id', userData.atelier_id)
    .single()

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
    lite: 'Plan Lite',
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

  // Déterminer le statut actuel
  const currentPlan = atelier?.plan || 'trial'
  const isTrial = currentPlan === 'pro' && atelier?.trial_ends_at && !subscription?.stripe_subscription_id
  const trialEndsAt = atelier?.trial_ends_at ? new Date(atelier.trial_ends_at) : null
  const isTrialExpired = trialEndsAt ? trialEndsAt < new Date() : false
  const displayPlan = isTrial ? 'trial' : currentPlan
  const subscriptionStatus = subscription?.status || (isTrial ? 'active' : 'expired')
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userData.role)
  const hasStripeCustomer = !!atelier?.stripe_customer_id

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
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[subscriptionStatus] || statusColors.active}`}>
              {isTrial ? 'Essai gratuit' : statusLabels[subscriptionStatus] || subscriptionStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {planLabels[displayPlan] || displayPlan}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Prix mensuel</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {isTrial ? 'Gratuit' 
                  : subscription?.price_monthly && subscription.price_monthly > 0 
                    ? `${subscription.price_monthly} € HT` 
                    : currentPlan === 'lite' ? '29 € HT' 
                    : currentPlan === 'pro' ? '49 € HT' 
                    : 'Gratuit'}
              </p>
            </div>

            {/* Essai gratuit */}
            {isTrial && trialEndsAt && (
              <div className="md:col-span-2">
                <div className={`border rounded-lg p-4 ${
                  isTrialExpired 
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                    : 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'
                }`}>
                  {isTrialExpired ? (
                    <>
                      <p className="text-red-800 dark:text-red-300 font-medium">
                        Votre essai gratuit est terminé
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Choisissez un plan pour continuer à utiliser ThermoGestion
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-orange-800 dark:text-orange-300">
                        <span className="font-medium">Essai gratuit</span> jusqu'au{' '}
                        {format(trialEndsAt, 'dd MMMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        Profitez de toutes les fonctionnalités Pro pendant votre période d'essai
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Prochaine facturation */}
            {subscription?.current_period_end && !isTrial && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subscription.cancel_at_period_end ? 'Fin de l\'abonnement' : 'Prochaine facturation'}
                </p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale: fr })}
                </p>
                {subscription.cancel_at_period_end && (
                  <p className="text-sm text-red-500 mt-1">Annulation programmée</p>
                )}
              </div>
            )}
          </div>

          {/* Boutons d'action (côté client) */}
          {isOwnerOrAdmin && (
            <SubscriptionActions 
              currentPlan={displayPlan}
              hasStripeCustomer={hasStripeCustomer}
              isTrial={!!isTrial}
              isTrialExpired={isTrialExpired}
              cancelAtPeriodEnd={subscription?.cancel_at_period_end || false}
            />
          )}
        </div>

        {/* Comparaison des plans */}
        {(isTrial || isTrialExpired || currentPlan === 'lite') && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Comparer les plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan Lite */}
              <div className={`border-2 rounded-xl p-6 ${
                currentPlan === 'lite' && !isTrial
                  ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{PLANS.lite.name}</h3>
                <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">
                  29 <span className="text-base font-normal text-gray-500">€ HT/mois</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {PLANS.lite.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Pro */}
              <div className={`border-2 rounded-xl p-6 relative ${
                currentPlan === 'pro' && !isTrial
                  ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Populaire
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{PLANS.pro.name}</h3>
                <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">
                  49 <span className="text-base font-normal text-gray-500">€ HT/mois</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {PLANS.pro.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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
                  {saasInvoices.map((invoice: Record<string, unknown>) => (
                    <tr key={invoice.id as string} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                        {invoice.numero as string}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {invoice.period_start && invoice.period_end ? (
                          <>
                            {format(new Date(invoice.period_start as string), 'MMM yyyy', { locale: fr })}
                          </>
                        ) : (
                          format(new Date(invoice.created_at as string), 'dd/MM/yyyy', { locale: fr })
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                        {(invoice.amount_ttc as number)?.toFixed(2)} €
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
                            href={invoice.pdf_url as string} 
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
