import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SerieDetail } from '@/components/series/SerieDetail'

export default async function SerieDetailPage({
  params,
}: {
  params: { id: string }
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

  // Récupérer la série
  const { data: serie, error: serieError } = await supabase
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
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (serieError || !serie) {
    redirect('/app/series?error=not_found')
  }

  // Récupérer les projets de la série
  const { data: projets, error: projetsError } = await supabase
    .from('projets')
    .select(`
      *,
      clients (
        id,
        full_name,
        email
      )
    `)
    .eq('atelier_id', userData.atelier_id)
    .in('id', serie.projets_ids)

  if (projetsError) {
    console.error('Erreur récupération projets:', projetsError)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SerieDetail serie={serie} projets={projets || []} />
    </div>
  )
}
