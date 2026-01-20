import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConvertDevisToProjet } from '@/components/devis/ConvertDevisToProjet'

export default async function ConvertDevisPage({ params }: { params: { id: string } }) {
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

  // Charger le devis
  const { data: devis, error } = await supabase
    .from('devis')
    .select(`
      *,
      clients (
        id,
        full_name
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !devis) {
    notFound()
  }

  // Vérifier que le devis peut être converti
  if (devis.status === 'converted') {
    redirect(`/app/devis/${devis.id}`)
  }

  // Charger les poudres pour sélection
  const { data: poudres } = await supabase
    .from('poudres')
    .select('id, marque, reference, finition, ral')
    .eq('atelier_id', userData.atelier_id)
    .order('marque', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href={`/app/devis/${devis.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour au devis
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Convertir le devis en projet
          </h1>
          <p className="text-gray-600">
            Devis #{devis.numero} - {devis.clients?.full_name || 'Client'}
          </p>
        </div>

        <ConvertDevisToProjet
          devis={devis}
          poudres={poudres || []}
          atelierId={userData.atelier_id}
          userId={authUser.id}
        />
      </div>
    </div>
  )
}
