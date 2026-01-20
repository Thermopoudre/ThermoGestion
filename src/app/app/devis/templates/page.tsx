import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TemplatesList } from '@/components/devis/TemplatesList'

export default async function TemplatesPage() {
  const supabase = await createServerClient()
  
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger l'atelier de l'utilisateur
  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', authUser.id)
    .single()

  if (!userData) {
    redirect('/auth/login')
  }

  // Charger les templates
  const { data: templates } = await supabase
    .from('devis_templates')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Templates de devis</h1>
            <p className="mt-2 text-gray-600">
              Gérez vos templates personnalisés pour les devis
            </p>
          </div>
          <Link
            href="/app/devis/templates/new"
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Nouveau template
          </Link>
        </div>
      </div>

      <TemplatesList templates={templates || []} />
    </div>
  )
}
