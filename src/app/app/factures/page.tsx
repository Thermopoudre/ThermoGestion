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

  // Charger l'atelier de l'utilisateur avec une jointure ateliers
  const { data: userData } = await supabase
    .from('users')
    .select(`atelier_id, ateliers (id)`)
    .eq('id', user.id)
    .single()

  if (!userData || !userData.atelier_id) {
    redirect('/complete-profile')
  }

  const atelierId = userData.atelier_id

  // Récupérer les factures - requête simple sans jointure pour RLS
  const { data: facturesData, error: facturesError } = await supabase
    .from('factures')
    .select('*')
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: false })

  // Récupérer les clients séparément si des factures existent
  let factures = facturesData || []
  
  if (factures.length > 0) {
    const clientIds = [...new Set(factures.map(f => f.client_id).filter(Boolean))]
    
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .in('id', clientIds)
      
      const clientsMap = new Map(clientsData?.map(c => [c.id, c]) || [])
      
      factures = factures.map(f => ({
        ...f,
        clients: clientsMap.get(f.client_id) || null
      }))
    }
  }

  if (facturesError) {
    console.error('Erreur récupération factures:', facturesError)
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Factures</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Gérez vos factures et paiements</p>
          </div>
          <a
            href="/app/factures/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouvelle facture
          </a>
        </div>

        <FacturesList factures={factures || []} />
      </div>
    </div>
  )
}
