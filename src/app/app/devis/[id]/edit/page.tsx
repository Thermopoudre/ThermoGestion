import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { DevisForm } from '@/components/devis/DevisForm'

export default async function EditDevisPage({ params }: { params: { id: string } }) {
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
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !devis) {
    notFound()
  }

  if (devis.status !== 'brouillon') {
    redirect(`/app/devis/${devis.id}`)
  }

  // Charger les clients, poudres et settings atelier
  const [clients, poudres, atelier] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email')
      .eq('atelier_id', userData.atelier_id)
      .order('full_name', { ascending: true }),
    supabase
      .from('poudres')
      .select('id, marque, reference, finition, ral, prix_kg, consommation_m2, rendement_m2_kg')
      .eq('atelier_id', userData.atelier_id)
      .order('marque', { ascending: true }),
    supabase
      .from('ateliers')
      .select('settings')
      .eq('id', userData.atelier_id)
      .single(),
  ])

  // Extraire les settings devis avec valeurs par défaut
  const atelierSettings = atelier.data?.settings?.devis || {
    taux_mo_heure: 35,
    temps_mo_m2: 0.15,
    cout_consommables_m2: 2,
    marge_poudre_pct: 30,
    marge_mo_pct: 50,
    tva_rate: 20,
  }

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
            Modifier le devis #{devis.numero}
          </h1>
          <p className="text-gray-600">
            Modifiez les informations du devis
          </p>
        </div>

        <DevisForm
          atelierId={userData.atelier_id}
          userId={authUser.id}
          clients={clients.data || []}
          poudres={poudres.data || []}
          devisId={devis.id}
          initialData={devis}
          atelierSettings={atelierSettings}
        />
      </div>
    </div>
  )
}
