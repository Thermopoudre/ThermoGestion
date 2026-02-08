import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateCustomizer } from '@/components/settings/TemplateCustomizer'
import { SettingsNav } from '@/components/settings/SettingsNav'

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
    cgvDevis: settings.cgv_devis || settings.pdf_cgv_text || '',
    cgvFacture: settings.cgv_facture || '',
    paymentTerms: settings.pdf_payment_terms || '30 jours',
    footerText: settings.pdf_footer_text || '',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Personnalisez l'apparence de vos devis et factures (format A4)
          </p>
        </div>

        <SettingsNav />

        <TemplateCustomizer 
          atelierId={userData.atelier_id} 
          initialSettings={initialSettings}
          atelierLogo={atelier?.logo}
        />
      </div>
    </div>
  )
}
