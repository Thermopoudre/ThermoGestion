import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjetDetail } from '@/components/projets/ProjetDetail'

export default async function ProjetDetailPage({ params }: { params: { id: string } }) {
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
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone
      ),
      poudres (
        id,
        marque,
        reference,
        finition,
        ral,
        temp_cuisson,
        duree_cuisson
      ),
      devis (
        id,
        numero,
        total_ttc
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !projet) {
    notFound()
  }

  // Charger les photos
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('projet_id', projet.id)
    .order('created_at', { ascending: false })

  // Charger les retouches du projet
  const { data: retouches } = await supabase
    .from('retouches')
    .select(`
      *,
      defaut_types (
        id,
        name
      )
    `)
    .eq('projet_id', projet.id)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })

  // Charger l'atelier pour quota
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('storage_quota_gb, storage_used_gb')
    .eq('id', userData.atelier_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/projets"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour à la liste
          </a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Projet #{projet.numero}
              </h1>
              <p className="text-gray-600">
                {projet.name} • {projet.clients?.full_name || 'Client supprimé'}
              </p>
            </div>
            <a
              href={`/app/projets/${projet.id}/edit`}
              className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
            >
              Modifier
            </a>
          </div>
        </div>

        <ProjetDetail
          projet={projet}
          photos={photos || []}
          retouches={retouches || []}
          storageQuota={atelier?.storage_quota_gb || 20}
          storageUsed={Number(atelier?.storage_used_gb || 0)}
          userId={authUser.id}
        />
      </div>
    </div>
  )
}
