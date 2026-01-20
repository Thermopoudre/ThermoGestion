import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateFactureForm } from '@/components/factures/CreateFactureForm'

export default async function NewFacturePage({
  searchParams,
}: {
  searchParams: { projet_id?: string; client_id?: string }
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

  // Récupérer les clients de l'atelier
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, email, type')
    .eq('atelier_id', userData.atelier_id)
    .order('full_name', { ascending: true })

  // Récupérer les projets si client_id fourni
  let projets: any[] = []
  if (searchParams.client_id) {
    const { data } = await supabase
      .from('projets')
      .select('id, name, numero, total_ttc')
      .eq('atelier_id', userData.atelier_id)
      .eq('client_id', searchParams.client_id)
      .in('status', ['pret', 'livre'])
    projets = data || []
  }

  // Récupérer le projet si projet_id fourni
  let projet: any = null
  if (searchParams.projet_id) {
    const { data } = await supabase
      .from('projets')
      .select(`
        *,
        devis (
          id,
          numero,
          total_ht,
          total_ttc,
          items
        )
      `)
      .eq('id', searchParams.projet_id)
      .eq('atelier_id', userData.atelier_id)
      .single()
    projet = data
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nouvelle facture</h1>
        <p className="text-gray-600">Créez une facture pour un client</p>
      </div>

      <CreateFactureForm
        atelierId={userData.atelier_id}
        clients={clients || []}
        projets={projets}
        projetInitial={projet}
      />
    </div>
  )
}
