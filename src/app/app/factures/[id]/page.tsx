import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FactureDetail } from '@/components/factures/FactureDetail'

export default async function FactureDetailPage({
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

  // Récupérer la facture
  const { data: facture, error: factureError } = await supabase
    .from('factures')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone,
        address,
        type,
        siret
      ),
      projets (
        id,
        name,
        numero
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (factureError || !facture) {
    redirect('/app/factures?error=not_found')
  }

  // Récupérer les paiements
  const { data: paiements } = await supabase
    .from('paiements')
    .select('*')
    .eq('facture_id', params.id)
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
