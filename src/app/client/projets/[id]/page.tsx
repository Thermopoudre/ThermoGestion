import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProjetClientDetail } from '@/components/client/ProjetClientDetail'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Détail projet - Espace Client',
}

export default async function ClientProjetDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/auth/login')
  }

  // Vérifier que c'est un compte client
  const { data: clientUser, error: clientError } = await supabase
    .from('client_users')
    .select('client_id, atelier_id')
    .eq('id', user.id)
    .single()

  if (clientError || !clientUser) {
    redirect('/client/auth/login?error=not_client')
  }

  // Récupérer le projet avec toutes les infos
  const { data: projet, error: projetError } = await supabase
    .from('projets')
    .select(`
      *,
      devis (
        id,
        numero,
        total_ht,
        total_ttc,
        status,
        signed_at
      ),
      photos (
        id,
        url,
        type,
        step_index,
        created_at
      )
    `)
    .eq('id', params.id)
    .eq('client_id', clientUser.client_id)
    .eq('atelier_id', clientUser.atelier_id)
    .single()

  if (projetError || !projet) {
    redirect('/client/projets?error=not_found')
  }

  // Récupérer l'atelier pour afficher les infos
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('name, email, phone, address')
    .eq('id', clientUser.atelier_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs items={[
          { label: 'Projets', href: '/client/projets' },
          { label: projet.numero || projet.name || 'Projet' },
        ]} />
        <ProjetClientDetail projet={projet} atelier={atelier} />
      </div>
    </div>
  )
}
