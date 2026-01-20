import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ClientDetail } from '@/components/clients/ClientDetail'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
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

  // Charger le client
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !client) {
    notFound()
  }

  // Charger les projets et devis du client
  const [projets, devis] = await Promise.all([
    supabase
      .from('projets')
      .select('id, numero, name, status, created_at, date_promise')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('devis')
      .select('id, numero, status, total_ttc, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                {client.full_name}
              </h1>
              <p className="text-gray-600">
                Fiche client
              </p>
            </div>
            <a
              href={`/app/clients/${client.id}/edit`}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
            >
              Modifier
            </a>
          </div>
        </div>

        <ClientDetail
          client={client}
          projets={projets.data || []}
          devis={devis.data || []}
        />
      </div>
    </div>
  )
}
