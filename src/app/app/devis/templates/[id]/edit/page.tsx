import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateForm } from '@/components/devis/TemplateForm'

export default async function EditTemplatePage({
  params,
}: {
  params: { id: string }
}) {
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

  // Charger le template
  const { data: template } = await supabase
    .from('devis_templates')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (!template) {
    redirect('/app/devis/templates')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {template.is_system ? 'Voir template' : 'Modifier template'}
        </h1>
        <p className="mt-2 text-gray-600">
          {template.name} - {template.description || 'Aucune description'}
        </p>
      </div>

      <TemplateForm 
        atelierId={userData.atelier_id} 
        userId={authUser.id}
        templateId={template.id}
        initialData={template}
        isSystem={template.is_system || false}
      />
    </div>
  )
}
