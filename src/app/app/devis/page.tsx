import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DevisList } from '@/components/devis/DevisList'

export default async function DevisPage({ searchParams }: { searchParams: { client?: string } }) {
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

  // Charger les devis
  let query = supabase
    .from('devis')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (searchParams.client) {
    query = query.eq('client_id', searchParams.client)
  }

  const { data: devis, error } = await query

  if (error) {
    console.error('Erreur chargement devis:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2">
              Devis
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Créez et gérez vos devis
            </p>
          </div>
          <a
            href="/app/devis/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouveau devis
          </a>
        </div>

        <DevisList devis={devis || []} />
      </div>
    </div>
  )
}
