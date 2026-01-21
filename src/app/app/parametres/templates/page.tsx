import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateCustomizer } from '@/components/settings/TemplateCustomizer'

export default async function TemplatesPage() {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', authUser.id)
    .single()

  if (!userData) {
    redirect('/app/complete-profile')
  }

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', userData.atelier_id)
    .single()

  const settings = atelier?.settings || {}
  
  const initialSettings = {
    template: settings.pdf_template || 'industrial',
    primaryColor: settings.pdf_primary_color || '#dc2626',
    accentColor: settings.pdf_accent_color || '#f97316',
    showLogo: settings.pdf_show_logo !== false,
    fontFamily: settings.pdf_font_family || 'inter',
    cgvText: settings.pdf_cgv_text || 'Devis valable 30 jours. Paiement à réception de facture.',
    paymentTerms: settings.pdf_payment_terms || '30 jours',
    footerText: settings.pdf_footer_text || '',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/parametres"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium mb-4 inline-flex items-center gap-1"
          >
            ← Retour aux paramètres
          </a>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
            Personnalisation des PDF
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Personnalisez l'apparence de vos devis et factures (format A4)
          </p>
        </div>

        <TemplateCustomizer 
          atelierId={userData.atelier_id} 
          initialSettings={initialSettings}
          atelierLogo={atelier?.logo}
        />
      </div>
    </div>
  )
}
