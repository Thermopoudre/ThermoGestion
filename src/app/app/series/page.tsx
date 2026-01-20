import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SeriesRecommandees } from '@/components/series/SeriesRecommandees'

export default async function SeriesPage() {
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

  // Récupérer les projets en cours qui peuvent être regroupés
  const { data: projets, error: projetsError } = await supabase
    .from('projets')
    .select(`
      id,
      name,
      numero,
      status,
      date_promise,
      poudre_id,
      couches,
      poudres (
        id,
        reference,
        finition,
        type,
        ral
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .in('status', ['en_cours', 'en_cuisson'])
    .not('poudre_id', 'is', null)

  if (projetsError) {
    console.error('Erreur récupération projets:', projetsError)
  }

  // Récupérer les séries existantes
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select(`
      *,
      poudres (
        id,
        reference,
        finition,
        type,
        ral
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  if (seriesError) {
    console.error('Erreur récupération séries:', seriesError)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Séries (Batch)</h1>
        <p className="text-gray-600">
          Regroupez vos projets par poudre identique pour optimiser la production
        </p>
      </div>

      <SeriesRecommandees 
        projets={projets || []} 
        series={series || []}
        atelierId={userData.atelier_id}
      />
    </div>
  )
}
