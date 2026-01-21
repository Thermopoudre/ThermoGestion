import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ClientForm } from '@/components/clients/ClientForm'

export default async function EditClientPage({ params }: { params: { id: string } }) {
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

  // Charger le client
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !client) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href={`/app/clients/${client.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour au client
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Modifier le client
          </h1>
          <p className="text-gray-600">
            Modifiez les informations de {client.full_name}
          </p>
        </div>

        <ClientForm
          atelierId={userData.atelier_id}
          clientId={client.id}
          initialData={{
            full_name: client.full_name,
            email: client.email,
            phone: client.phone || undefined,
            address: client.address || undefined,
            type: client.type as 'particulier' | 'professionnel',
            siret: client.siret || undefined,
            tags: client.tags || undefined,
            notes: client.notes || undefined,
            facture_trigger: (client.facture_trigger as 'pret' | 'livre') || 'pret',
          }}
        />
      </div>
    </div>
  )
}
