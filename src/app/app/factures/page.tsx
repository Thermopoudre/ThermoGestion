import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'

// Force dynamic rendering to avoid caching issues
export const dynamic = 'force-dynamic'

export default async function FacturesPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Charger l'atelier de l'utilisateur avec jointure complète comme dans le dashboard
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*, ateliers (*)')
    .eq('id', user.id)
    .single()

  if (userError || !userData || !userData.atelier_id) {
    redirect('/complete-profile')
  }

  // Extraire l'atelier comme dans le dashboard
  let atelier = Array.isArray(userData.ateliers) ? userData.ateliers[0] : userData.ateliers
  if ((!atelier || !atelier.id) && userData.atelier_id) {
    const { data: atelierDirect } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()
    atelier = atelierDirect
  }

  const atelierId = atelier?.id || userData.atelier_id

  // Récupérer les factures - colonnes spécifiques pour éviter les problèmes RLS
  const { data: facturesData, error: facturesError } = await supabase
    .from('factures')
    .select('id, numero, client_id, projet_id, type, status, payment_status, total_ht, total_ttc, tva_rate, due_date, paid_at, items, notes, created_at, updated_at, atelier_id')
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

  // Debug logging
  console.log('[Factures Page] atelierId:', atelierId)
  console.log('[Factures Page] facturesData count:', facturesData?.length || 0)
  if (facturesError) {
    console.error('[Factures Page] Erreur récupération factures:', facturesError)
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
