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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2">
              Clients
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Gérez vos clients et leurs informations
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <a
              href="/app/clients/import"
              className="flex-1 sm:flex-none text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm sm:text-base"
            >
              <span className="hidden sm:inline">Importer CSV</span>
              <span className="sm:hidden">📥 Import</span>
            </a>
            <a
              href="/app/clients/new"
              className="flex-1 sm:flex-none text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-sm sm:text-base"
            >
              <span className="hidden sm:inline">+ Nouveau client</span>
              <span className="sm:hidden">+ Ajouter</span>
            </a>
          </div>
        </div>

        <ClientsList clients={clients || []} />
      </div>
    </div>
  )
}
