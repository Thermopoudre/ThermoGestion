import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsOverview } from '@/components/stats/StatsOverview'
import { ChartCAMensuel } from '@/components/stats/ChartCAMensuel'
import { TopClients } from '@/components/stats/TopClients'
import { TopPoudresStats } from '@/components/stats/TopPoudresStats'
import { PerformanceProjet } from '@/components/stats/PerformanceProjet'

export default async function StatsPage() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) redirect('/app/complete-profile')

  const atelierId = userData.atelier_id
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // Charger toutes les données en parallèle
  const [
    facturesData,
    projetsData,
    clientsData,
    poudresData,
    devisData,
  ] = await Promise.all([
    // Factures de l'année
    supabase
      .from('factures')
      .select('id, total_ht, total_ttc, payment_status, paid_at, created_at, client_id')
      .eq('atelier_id', atelierId)
      .gte('created_at', startOfYear.toISOString()),
    
    // Projets de l'année
    supabase
      .from('projets')
      .select('id, status, created_at, poudre_id, client_id, date_depot, date_promise')
      .eq('atelier_id', atelierId)
      .gte('created_at', startOfYear.toISOString()),
    
    // Clients avec leur CA
    supabase
      .from('clients')
      .select('id, full_name, type')
      .eq('atelier_id', atelierId),
    
    // Poudres avec utilisation
    supabase
      .from('poudres')
      .select('id, reference, nom')
      .eq('atelier_id', atelierId),
    
    // Devis de l'année
    supabase
      .from('devis')
      .select('id, status, total_ttc, created_at')
      .eq('atelier_id', atelierId)
      .gte('created_at', startOfYear.toISOString()),
  ])

  // Calculer les stats
  const factures = facturesData.data || []
  const projets = projetsData.data || []
  const clients = clientsData.data || []
  const poudres = poudresData.data || []
  const devis = devisData.data || []

  // CA total année
  const caTotal = factures
    .filter(f => f.payment_status === 'paid')
    .reduce((sum, f) => sum + Number(f.total_ttc || 0), 0)

  // CA par mois
  const caByMonth: Record<string, number> = {}
  for (let i = 0; i < 12; i++) {
    const key = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`
    caByMonth[key] = 0
  }
  for (const f of factures) {
    if (f.payment_status === 'paid' && f.paid_at) {
      const d = new Date(f.paid_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (caByMonth[key] !== undefined) {
        caByMonth[key] += Number(f.total_ttc || 0)
      }
    }
  }

  // Top clients par CA
  const clientCA: Record<string, number> = {}
  for (const f of factures) {
    if (f.payment_status === 'paid' && f.client_id) {
      clientCA[f.client_id] = (clientCA[f.client_id] || 0) + Number(f.total_ttc || 0)
    }
  }
  const topClients = clients
    .map(c => ({ ...c, ca: clientCA[c.id] || 0 }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)

  // Top poudres par utilisation
  const poudreCount: Record<string, number> = {}
  for (const p of projets) {
    if (p.poudre_id) {
      poudreCount[p.poudre_id] = (poudreCount[p.poudre_id] || 0) + 1
    }
  }
  const topPoudres = poudres
    .map(p => ({ ...p, count: poudreCount[p.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Stats projets
  const projetsTermines = projets.filter(p => p.status === 'livre').length
  const projetsTaux = projets.length > 0 ? (projetsTermines / projets.length) * 100 : 0

  // Taux de conversion devis
  const devisConverted = devis.filter(d => ['accepte', 'converted'].includes(d.status)).length
  const tauxConversion = devis.length > 0 ? (devisConverted / devis.length) * 100 : 0

  // Délai moyen projet (dépôt -> livré)
  const projetsAvecDelai = projets.filter(p => p.date_depot && p.status === 'livre')
  let delaiMoyen = 0
  if (projetsAvecDelai.length > 0) {
    const totalJours = projetsAvecDelai.reduce((sum, p) => {
      const depot = new Date(p.date_depot!)
      const created = new Date(p.created_at)
      return sum + Math.ceil((created.getTime() - depot.getTime()) / (1000 * 60 * 60 * 24))
    }, 0)
    delaiMoyen = Math.abs(totalJours / projetsAvecDelai.length)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Statistiques</h1>
          <p className="mt-1 text-gray-600">Rapports et analyses de votre activité</p>
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          <option value="year">Cette année ({now.getFullYear()})</option>
          <option value="month">Ce mois</option>
          <option value="quarter">Ce trimestre</option>
        </select>
      </div>

      {/* KPIs */}
      <StatsOverview
        caTotal={caTotal}
        nbProjets={projets.length}
        nbClients={clients.length}
        tauxConversion={tauxConversion}
        projetsTaux={projetsTaux}
        delaiMoyen={delaiMoyen}
      />

      {/* Graphique CA */}
      <div className="mt-8">
        <ChartCAMensuel data={caByMonth} />
      </div>

      {/* Top clients et poudres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <TopClients clients={topClients} />
        <TopPoudresStats poudres={topPoudres} />
      </div>

      {/* Performance projets */}
      <div className="mt-8">
        <PerformanceProjet
          projets={projets.map(p => ({
            id: p.id,
            status: p.status,
            date_depot: p.date_depot,
            date_promise: p.date_promise,
          }))}
        />
      </div>
    </div>
  )
}
