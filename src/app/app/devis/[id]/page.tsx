import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { DevisDetail } from '@/components/devis/DevisDetail'

export default async function DevisDetailPage({ params }: { params: { id: string } }) {
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

  // Charger le devis avec client
  const { data: devis, error } = await supabase
    .from('devis')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone,
        address,
        siret,
        type
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (error || !devis) {
    notFound()
  }

  // Charger l'atelier pour informations
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', userData.atelier_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <a
            href="/app/devis"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Retour à la liste
          </a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Devis #{devis.numero}
              </h1>
              <p className="text-gray-600">
                {devis.clients?.full_name || 'Client supprimé'}
              </p>
            </div>
            <div className="flex gap-4">
              {devis.status === 'brouillon' && (
                <a
                  href={`/app/devis/${devis.id}/edit`}
                  className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Modifier
                </a>
              )}
              <a
                href={`/app/devis/${devis.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
              >
                Générer PDF
              </a>
            </div>
          </div>
        </div>

        <DevisDetail devis={devis} atelier={atelier} />
      </div>
    </div>
  )
}
