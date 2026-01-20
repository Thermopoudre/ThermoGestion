import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientForm } from '@/components/clients/ClientForm'

export default async function NewClientPage() {
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
    redirect('/app/complete-profile')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/clients"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour à la liste
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Nouveau client
          </h1>
          <p className="text-gray-600">
            Ajoutez un nouveau client à votre atelier
          </p>
        </div>

        <ClientForm atelierId={userData.atelier_id} />
      </div>
    </div>
  )
}
