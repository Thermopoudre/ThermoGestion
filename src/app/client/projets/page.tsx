import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProjetsClientList } from '@/components/client/ProjetsClientList'

export default async function ClientProjetsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/auth/login')
  }

  // Vérifier que c'est un compte client
  const { data: clientUser, error: clientError } = await supabase
    .from('client_users')
    .select('client_id, atelier_id')
    .eq('id', user.id)
    .single()

  if (clientError || !clientUser) {
    redirect('/client/auth/login?error=not_client')
  }

  // Récupérer les projets du client
  const { data: projets, error: projetsError } = await supabase
    .from('projets')
    .select(`
      *,
      devis (
        id,
        numero,
        total_ttc
      )
    `)
    .eq('client_id', clientUser.client_id)
    .eq('atelier_id', clientUser.atelier_id)
    .order('created_at', { ascending: false })

  if (projetsError) {
    console.error('Erreur récupération projets:', projetsError)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes projets</h1>
          <p className="text-gray-600">Suivez l'avancement de vos projets de thermolaquage</p>
        </div>

        <ProjetsClientList projets={projets || []} />
      </div>
    </div>
  )
}
