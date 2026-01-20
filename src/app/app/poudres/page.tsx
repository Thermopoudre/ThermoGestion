import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PoudresList } from '@/components/poudres/PoudresList'

export default async function PoudresPage() {
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

  // Charger les poudres avec leur stock
  const { data: poudres, error } = await supabase
    .from('poudres')
    .select(`
      *,
      stock_poudres (
        stock_theorique_kg,
        stock_reel_kg,
        dernier_pesee_at
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('marque', { ascending: true })
    .order('reference', { ascending: true })

  if (error) {
    console.error('Erreur chargement poudres:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">
              Catalogue poudres
            </h1>
            <p className="text-gray-600">
              Gérez votre catalogue de poudres et leur stock
            </p>
          </div>
          <div className="flex gap-4">
            <a
              href="/app/poudres/import"
              className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
            >
              Importer
            </a>
            <a
              href="/app/poudres/new"
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
            >
              + Nouvelle poudre
            </a>
          </div>
        </div>

        <PoudresList poudres={poudres || []} />
      </div>
    </div>
  )
}
