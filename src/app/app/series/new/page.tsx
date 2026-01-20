import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateSerieForm } from '@/components/series/CreateSerieForm'

export default async function NewSeriePage({
  searchParams,
}: {
  searchParams: { poudre_id?: string; projets?: string }
}) {
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

  // Récupérer la poudre si fournie
  let poudre = null
  if (searchParams.poudre_id) {
    const { data } = await supabase
      .from('poudres')
      .select('*')
      .eq('id', searchParams.poudre_id)
      .eq('atelier_id', userData.atelier_id)
      .single()
    poudre = data
  }

  // Récupérer les projets sélectionnés
  let projetsSelectionnes: any[] = []
  if (searchParams.projets) {
    const projetsIds = searchParams.projets.split(',')
    const { data } = await supabase
      .from('projets')
      .select(`
        *,
        poudres (
          id,
          reference,
          finition,
          type
        )
      `)
      .eq('atelier_id', userData.atelier_id)
      .in('id', projetsIds)
    projetsSelectionnes = data || []
  }

  // Récupérer tous les projets disponibles pour cette poudre
  let projetsDisponibles: any[] = []
  if (searchParams.poudre_id) {
    const { data } = await supabase
      .from('projets')
      .select(`
        *,
        poudres (
          id,
          reference,
          finition,
          type
        )
      `)
      .eq('atelier_id', userData.atelier_id)
      .eq('poudre_id', searchParams.poudre_id)
      .in('status', ['en_cours', 'en_cuisson'])
    projetsDisponibles = data || []
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Créer une série</h1>
        <p className="text-gray-600">
          Regroupez plusieurs projets avec la même poudre pour optimiser la production
        </p>
      </div>

      <CreateSerieForm
        atelierId={userData.atelier_id}
        poudre={poudre}
        projetsDisponibles={projetsDisponibles}
        projetsSelectionnes={projetsSelectionnes}
      />
    </div>
  )
}
