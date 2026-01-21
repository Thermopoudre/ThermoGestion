import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportPoudres } from '@/components/poudres/ImportPoudres'

export default async function ImportPoudresPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/poudres"
            className="text-orange-500 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour au catalogue
          </a>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Importer des poudres
          </h1>
          <p className="text-gray-600">
            Importez votre catalogue depuis un fichier CSV ou connectez-vous à Thermopoudre
          </p>
        </div>

        <ImportPoudres atelierId={userData.atelier_id} />
      </div>
    </div>
  )
}
