import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'

export default async function FacturesPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/complete-profile')
  }

  // Récupérer les factures
  const { data: factures, error } = await supabase
    .from('factures')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      ),
      projets (
        id,
        name,
        numero
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur récupération factures:', error)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Factures</h1>
          <p className="text-gray-600">Gérez vos factures et paiements</p>
        </div>
        <a
          href="/app/factures/new"
          className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
        >
          + Nouvelle facture
        </a>
      </div>

      <FacturesList factures={factures || []} />
    </div>
  )
}
