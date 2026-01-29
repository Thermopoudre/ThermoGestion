import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FactureDetail } from '@/components/factures/FactureDetail'

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
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

  // Récupérer la facture - requête simple pour éviter les problèmes RLS avec les jointures
  const { data: factureData, error: factureError } = await supabase
    .from('factures')
    .select('*')
    .eq('id', resolvedParams.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (factureError || !factureData) {
    console.error('Erreur récupération facture:', factureError)
    redirect('/app/factures?error=not_found')
  }

  // Récupérer le client séparément
  let client = null
  if (factureData.client_id) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, full_name, email, phone, address, type, siret')
      .eq('id', factureData.client_id)
      .single()
    client = clientData
  }

  // Récupérer le projet séparément
  let projet = null
  if (factureData.projet_id) {
    const { data: projetData } = await supabase
      .from('projets')
      .select('id, name, numero')
      .eq('id', factureData.projet_id)
      .single()
    projet = projetData
  }

  const facture = {
    ...factureData,
    clients: client,
    projets: projet
  }

  // Récupérer les paiements
  const { data: paiements } = await supabase
    .from('paiements')
    .select('*')
    .eq('facture_id', resolvedParams.id)
    .order('created_at', { ascending: false })

  // Récupérer l'atelier
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', userData.atelier_id)
    .single()

  return (
    <div className="container mx-auto px-4 py-8">
      <FactureDetail
        facture={facture}
        atelier={atelier}
        paiements={paiements || []}
        atelierId={userData.atelier_id}
      />
    </div>
  )
}
