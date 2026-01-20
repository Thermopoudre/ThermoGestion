import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProjetsList } from '@/components/projets/ProjetsList'

export default async function ProjetsPage({ searchParams }: { searchParams: { client?: string; status?: string } }) {
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

  // Charger les projets
  let query = supabase
    .from('projets')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      ),
      poudres (
        id,
        marque,
        reference,
        finition
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (searchParams.client) {
    query = query.eq('client_id', searchParams.client)
  }

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: projets, error } = await query

  if (error) {
    console.error('Erreur chargement projets:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">
              Projets
            </h1>
            <p className="text-gray-600">
              Suivez vos projets de thermolaquage
            </p>
          </div>
          <a
            href="/app/projets/new"
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouveau projet
          </a>
        </div>

        <ProjetsList projets={projets || []} />
      </div>
    </div>
  )
}
