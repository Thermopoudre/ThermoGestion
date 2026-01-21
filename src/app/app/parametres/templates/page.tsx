import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateSelector } from '@/components/settings/TemplateSelector'

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

  const currentTemplate = atelier?.settings?.pdf_template || 'industrial'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/parametres"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour aux paramètres
          </a>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
            🎨 Templates PDF
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choisissez le design de vos devis et factures
          </p>
        </div>

        <TemplateSelector 
          atelierId={userData.atelier_id} 
          currentTemplate={currentTemplate}
        />
      </div>
    </div>
  )
}
