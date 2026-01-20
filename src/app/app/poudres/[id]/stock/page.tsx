import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StockPoudreDetail } from '@/components/poudres/StockPoudreDetail'

export default async function StockPoudrePage({ params }: { params: { id: string } }) {
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

  // Charger la poudre avec son stock
  const { data: poudre, error: poudreError } = await supabase
    .from('poudres')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (poudreError || !poudre) {
    notFound()
  }

  const { data: stock, error: stockError } = await supabase
    .from('stock_poudres')
    .select('*')
    .eq('poudre_id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (stockError && stockError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, on créera le stock si nécessaire
    console.error('Erreur chargement stock:', stockError)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/poudres"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour au catalogue
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Gestion stock - {poudre.marque} {poudre.reference}
          </h1>
          <p className="text-gray-600">
            Gérer le stock théorique et réel de la poudre
          </p>
        </div>

        <StockPoudreDetail
          poudre={poudre}
          stock={stock || null}
          atelierId={userData.atelier_id}
        />
      </div>
    </div>
  )
}
