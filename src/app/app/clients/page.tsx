import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientsList } from '@/components/clients/ClientsList'

export default async function ClientsPage() {
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

  // Charger les clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur chargement clients:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">
              Clients
            </h1>
            <p className="text-gray-600">
              Gérez vos clients et leurs informations
            </p>
          </div>
          <div className="flex gap-4">
            <a
              href="/app/clients/import"
              className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
            >
              Importer CSV
            </a>
            <a
              href="/app/clients/new"
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
            >
              + Nouveau client
            </a>
          </div>
        </div>

        <ClientsList clients={clients || []} />
      </div>
    </div>
  )
}
