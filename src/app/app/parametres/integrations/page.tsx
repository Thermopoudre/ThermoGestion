import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'

export default async function IntegrationsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) redirect('/app/complete-profile')

  // Charger les intégrations de l'atelier
  const { data: atelier } = await supabase
    .from('ateliers')
    .select(`
      id,
      name,
      stripe_account_id,
      stripe_account_status,
      paypal_email,
      paypal_merchant_id,
      google_calendar_connected,
      google_calendar_id,
      outlook_connected,
      google_review_link,
      auto_review_enabled,
      review_delay_days
    `)
    .eq('id', userData.atelier_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/parametres"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour aux paramètres
          </a>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
            🔗 Intégrations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connectez vos comptes de paiement et calendriers
          </p>
        </div>

        <IntegrationsSettings 
          atelier={atelier}
          userId={user.id}
        />
      </div>
    </div>
  )
}
