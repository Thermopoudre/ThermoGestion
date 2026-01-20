import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PoudreForm } from '@/components/poudres/PoudreForm'

export default async function EditPoudrePage({ params }: { params: { id: string } }) {
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

  // Charger la poudre
  const { data: poudre, error } = await supabase
    .from('poudres')
    .select('*')
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !poudre) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href={`/app/poudres/${poudre.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour à la poudre
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Modifier la poudre
          </h1>
          <p className="text-gray-600">
            Modifiez les informations de {poudre.marque} {poudre.reference}
          </p>
        </div>

        <PoudreForm
          atelierId={userData.atelier_id}
          poudreId={poudre.id}
          initialData={{
            marque: poudre.marque,
            reference: poudre.reference,
            type: poudre.type,
            ral: poudre.ral || undefined,
            finition: poudre.finition,
            densite: poudre.densite ? Number(poudre.densite) : undefined,
            epaisseur_conseillee: poudre.epaisseur_conseillee ? Number(poudre.epaisseur_conseillee) : undefined,
            consommation_m2: poudre.consommation_m2 ? Number(poudre.consommation_m2) : undefined,
            temp_cuisson: poudre.temp_cuisson || undefined,
            duree_cuisson: poudre.duree_cuisson || undefined,
            source: poudre.source as any,
          }}
        />
      </div>
    </div>
  )
}
