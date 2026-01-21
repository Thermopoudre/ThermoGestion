import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningCalendar } from '@/components/planning/PlanningCalendar'

export default async function PlanningPage() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) redirect('/app/complete-profile')

  // Charger les projets avec dates
  const { data: projets } = await supabase
    .from('projets')
    .select(`
      id,
      numero,
      name,
      status,
      date_depot,
      date_promise,
      current_step,
      clients(full_name),
      poudres(reference)
    `)
    .eq('atelier_id', userData.atelier_id)
    .not('status', 'eq', 'livre')
    .order('date_promise', { ascending: true })

  // Charger les devis non convertis avec dates
  const { data: devis } = await supabase
    .from('devis')
    .select(`
      id,
      numero,
      status,
      valid_until,
      clients(full_name)
    `)
    .eq('atelier_id', userData.atelier_id)
    .in('status', ['brouillon', 'envoye'])
    .order('valid_until', { ascending: true })

  const events = [
    // Projets avec date promise
    ...(projets || [])
      .filter((p: any) => p.date_promise)
      .map((p: any) => ({
        id: p.id,
        title: `${p.numero} - ${p.name}`,
        date: p.date_promise,
        type: 'projet' as const,
        status: p.status,
        client: p.clients?.full_name || 'Client',
        poudre: p.poudres?.reference,
        link: `/app/projets/${p.id}`,
      })),
    // Projets avec date dépôt
    ...(projets || [])
      .filter((p: any) => p.date_depot && p.date_depot !== p.date_promise)
      .map((p: any) => ({
        id: `${p.id}-depot`,
        title: `📥 Dépôt: ${p.numero}`,
        date: p.date_depot,
        type: 'depot' as const,
        status: p.status,
        client: p.clients?.full_name || 'Client',
        link: `/app/projets/${p.id}`,
      })),
    // Devis avec date d'expiration
    ...(devis || [])
      .filter((d: any) => d.valid_until)
      .map((d: any) => ({
        id: d.id,
        title: `📝 Devis: ${d.numero}`,
        date: d.valid_until,
        type: 'devis' as const,
        status: d.status,
        client: d.clients?.full_name || 'Client',
        link: `/app/devis/${d.id}`,
      })),
  ]

  // Statistiques de charge
  const statusCounts = {
    en_cours: (projets || []).filter((p: any) => p.status === 'en_cours').length,
    en_cuisson: (projets || []).filter((p: any) => p.status === 'en_cuisson').length,
    qc: (projets || []).filter((p: any) => p.status === 'qc').length,
    pret: (projets || []).filter((p: any) => p.status === 'pret').length,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📅 Planning</h1>
          <p className="mt-1 text-gray-600">Vue calendrier des projets et échéances</p>
        </div>
      </div>

      {/* Charge atelier */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-orange-500 font-medium">En cours</p>
          <p className="text-2xl font-bold text-blue-700">{statusCounts.en_cours}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-600 font-medium">En cuisson</p>
          <p className="text-2xl font-bold text-orange-700">{statusCounts.en_cuisson}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">Contrôle qualité</p>
          <p className="text-2xl font-bold text-purple-700">{statusCounts.qc}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Prêts à livrer</p>
          <p className="text-2xl font-bold text-green-700">{statusCounts.pret}</p>
        </div>
      </div>

      <PlanningCalendar events={events} />
    </div>
  )
}
