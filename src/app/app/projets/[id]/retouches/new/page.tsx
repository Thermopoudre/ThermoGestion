import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DeclarerRetoucheForm } from '@/components/retouches/DeclarerRetoucheForm'

export default async function NewRetouchePage({
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

  // Récupérer le projet
  const { data: projet, error: projetError } = await supabase
    .from('projets')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (projetError || !projet) {
    redirect('/app/projets?error=not_found')
  }

  // Récupérer les types de défauts
  const { data: defautTypes } = await supabase
    .from('defaut_types')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Déclarer une retouche</h1>
        <p className="text-gray-600">Projet: {projet.name} (#{projet.numero})</p>
      </div>

      <DeclarerRetoucheForm
        projet={projet}
        defautTypes={defautTypes || []}
        atelierId={userData.atelier_id}
        userId={user.id}
      />
    </div>
  )
}
