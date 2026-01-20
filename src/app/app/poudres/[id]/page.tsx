import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PoudreDetail } from '@/components/poudres/PoudreDetail'

export default async function PoudreDetailPage({ params }: { params: { id: string } }) {
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
  const { data: poudre, error } = await supabase
    .from('poudres')
    .select(`
      *,
      stock_poudres (
        stock_theorique_kg,
        stock_reel_kg,
        dernier_pesee_at
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !poudre) {
    notFound()
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                {poudre.marque} {poudre.reference}
              </h1>
              <p className="text-gray-600">
                {poudre.finition} {poudre.ral && `• RAL ${poudre.ral}`}
              </p>
            </div>
            <div className="flex gap-4">
              <a
                href={`/app/poudres/${poudre.id}/stock`}
                className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
              >
                Gérer stock
              </a>
              <a
                href={`/app/poudres/${poudre.id}/edit`}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
              >
                Modifier
              </a>
            </div>
          </div>
        </div>

        <PoudreDetail poudre={poudre} />
      </div>
    </div>
  )
}
