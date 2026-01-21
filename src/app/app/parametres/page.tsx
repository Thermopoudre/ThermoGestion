import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AtelierSettingsForm } from '@/components/settings/AtelierSettingsForm'

export default async function ParametresPage() {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id, role')
    .eq('id', authUser.id)
    .single()

  if (!userData?.atelier_id) {
    redirect('/app/complete-profile')
  }

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', userData.atelier_id)
    .single()

  if (!atelier) {
    redirect('/app/complete-profile')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres de l'atelier</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configurez les informations de votre atelier pour les documents légaux
        </p>
      </div>

      <AtelierSettingsForm atelier={atelier} />
    </div>
  )
}
