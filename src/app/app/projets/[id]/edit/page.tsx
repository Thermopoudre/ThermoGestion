import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjetForm } from '@/components/projets/ProjetForm'

export default async function EditProjetPage({ params }: { params: { id: string } }) {
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

  // Charger le projet
  const { data: projet, error } = await supabase
    .from('projets')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !projet) {
    notFound()
  }

  // Charger les clients et poudres
  const [clients, poudres] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email')
      .eq('atelier_id', userData.atelier_id)
      .order('full_name', { ascending: true }),
    supabase
      .from('poudres')
      .select('id, marque, reference, finition, ral')
      .eq('atelier_id', userData.atelier_id)
      .order('marque', { ascending: true }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href={`/app/projets/${projet.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour au projet
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Modifier le projet
          </h1>
          <p className="text-gray-600">
            Modifiez les informations de {projet.name}
          </p>
        </div>

        <ProjetForm
          atelierId={userData.atelier_id}
          userId={authUser.id}
          clients={clients.data || []}
          poudres={poudres.data || []}
          projetId={projet.id}
          initialData={projet}
        />
      </div>
    </div>
  )
}
