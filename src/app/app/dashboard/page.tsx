import { createServerClient, getAuthorizedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KPICards } from '@/components/dashboard/KPICards'
import { ChartCA } from '@/components/dashboard/ChartCA'
import { AlertsPanel } from '@/components/dashboard/AlertsPanel'
import { ProjectsOverview } from '@/components/dashboard/ProjectsOverview'
import { TopPoudres } from '@/components/dashboard/TopPoudres'
import { ConversionStats } from '@/components/dashboard/ConversionStats'
import { TopClients } from '@/components/dashboard/TopClients'
import Link from 'next/link'

// Page d'erreur pour afficher quand le profil est incomplet
function ProfileIncompleteError({ email, reason }: { email: string; reason: string }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔥</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Profil incomplet</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{reason}</p>
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-orange-800 dark:text-orange-300"><strong>Email :</strong> {email}</p>
        </div>
        <div className="space-y-3">
          <Link href="/app/complete-profile" className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-400 hover:to-red-500 transition-all text-center shadow-lg shadow-orange-500/30">
            Compléter mon profil
          </Link>
          <Link href="/auth/logout" className="block w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-center">
            Se déconnecter
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger les données utilisateur avec l'atelier
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select(`*, ateliers (*)`)
    .eq('id', authUser.id)
    .single()

  if (userError || !userData) {
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Votre compte d'authentification existe mais votre profil utilisateur n'a pas été créé."
      />
    )
  }

  let atelier = Array.isArray(userData.ateliers) ? userData.ateliers[0] : userData.ateliers

  if ((!atelier || !atelier.id) && userData.atelier_id) {
    const { data: atelierDirect } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()
    atelier = atelierDirect
  }

  if (!atelier || !atelier.id) {
    return (
      <ProfileIncompleteError 
        email={authUser.email || ''} 
        reason="Aucun atelier n'est associé à votre compte."
      />
    )
  }

  // Dates pour les calculs
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const today = now.toISOString().split('T')[0]

  // Charger toutes les données en parallèle
  const [
    facturesThisMonth,
    facturesLastMonth,
    facturesImpayees,
    projetsEnCours,
    projetsEnRetard,
    projetsAVenir,
    devisEnAttente,
    devisTotal,
    devisConverted,
    topPoudres,
    caByMonth,
    devisRefuses,
    devisSignes,
    facturesParClient,
  ] = await Promise.all([
    // CA du mois
    supabase
      .from('factures')
      .select('total_ttc')
      .eq('atelier_id', atelier.id)
      .eq('payment_status', 'paid')
      .gte('paid_at', startOfMonth.toISOString()),
    
    // CA du mois dernier
    supabase
      .from('factures')
      .select('total_ttc')
      .eq('atelier_id', atelier.id)
      .eq('payment_status', 'paid')
      .gte('paid_at', startOfLastMonth.toISOString())
      .lte('paid_at', endOfLastMonth.toISOString()),
    
    // Factures impayées
    supabase
      .from('factures')
      .select('id, total_ttc')
      .eq('atelier_id', atelier.id)
      .eq('payment_status', 'unpaid'),
    
    // Projets en cours
    supabase
      .from('projets')
      .select('id')
      .eq('atelier_id', atelier.id)
      .in('status', ['en_cours', 'en_cuisson', 'qc']),
    
    // Projets en retard
    supabase
      .from('projets')
      .select('id, numero, name, status, date_promise, clients(full_name)')
      .eq('atelier_id', atelier.id)
      .in('status', ['en_cours', 'en_cuisson', 'qc'])
      .lt('date_promise', today)
      .not('date_promise', 'is', null)
      .order('date_promise', { ascending: true })
      .limit(10),
    
    // Projets à venir (7 prochains jours)
    supabase
      .from('projets')
      .select('id, numero, name, status, date_promise, clients(full_name)')
      .eq('atelier_id', atelier.id)
      .in('status', ['en_cours', 'en_cuisson', 'qc', 'pret'])
      .gte('date_promise', today)
      .lte('date_promise', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date_promise', { ascending: true })
      .limit(10),
    
    // Devis en attente
    supabase
      .from('devis')
      .select('id')
      .eq('atelier_id', atelier.id)
      .in('status', ['brouillon', 'envoye']),
    
    // Total devis pour taux de conversion
    supabase
      .from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('atelier_id', atelier.id),
    
    // Devis convertis
    supabase
      .from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('atelier_id', atelier.id)
      .in('status', ['accepte', 'converted']),
    
    // Top poudres utilisées
    supabase
      .from('projets')
      .select('poudre_id, poudres(reference, nom)')
      .eq('atelier_id', atelier.id)
      .not('poudre_id', 'is', null),
    
    // CA par mois (12 derniers mois)
    supabase
      .from('factures')
      .select('total_ttc, paid_at')
      .eq('atelier_id', atelier.id)
      .eq('payment_status', 'paid')
      .gte('paid_at', new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString())
      .order('paid_at', { ascending: true }),
    
    // Devis refusés
    supabase
      .from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('atelier_id', atelier.id)
      .eq('status', 'refuse'),
    
    // Devis avec date de signature pour calcul temps moyen
    supabase
      .from('devis')
      .select('created_at, signed_at, total_ht')
      .eq('atelier_id', atelier.id)
      .not('signed_at', 'is', null),
    
    // Top clients par CA (factures payées)
    supabase
      .from('factures')
      .select('client_id, total_ttc, clients(id, full_name)')
      .eq('atelier_id', atelier.id)
      .eq('payment_status', 'paid'),
  ])

  // Calculer les KPIs
  const caMonth = (facturesThisMonth.data || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0)
  const caLastMonth = (facturesLastMonth.data || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0)
  const nbFacturesImpayees = facturesImpayees.data?.length || 0
  const montantImpaye = (facturesImpayees.data || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0)
  const nbProjetsEnCours = projetsEnCours.data?.length || 0
  const nbProjetsEnRetard = projetsEnRetard.data?.length || 0
  const nbDevisEnAttente = devisEnAttente.data?.length || 0
  const totalDevis = devisTotal.count || 0
  const convertedDevis = devisConverted.count || 0
  const refusedDevis = devisRefuses.count || 0
  const tauxConversion = totalDevis > 0 ? (convertedDevis / totalDevis) * 100 : 0

  // Calculer temps moyen de signature
  let tempsSignatureMoyen = 0
  let montantMoyenDevis = 0
  if (devisSignes.data && devisSignes.data.length > 0) {
    const tempsTotal = devisSignes.data.reduce((sum, d) => {
      const created = new Date(d.created_at)
      const signed = new Date(d.signed_at!)
      return sum + (signed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    }, 0)
    tempsSignatureMoyen = tempsTotal / devisSignes.data.length
    montantMoyenDevis = devisSignes.data.reduce((sum, d) => sum + Number(d.total_ht || 0), 0) / devisSignes.data.length
  }

  // Calculer top clients par CA
  const clientCAMap: Record<string, { id: string; name: string; ca: number; projets: number }> = {}
  for (const f of facturesParClient.data || []) {
    const client = f.clients as any
    if (!client?.id) continue
    if (!clientCAMap[client.id]) {
      clientCAMap[client.id] = { id: client.id, name: client.full_name || 'Client inconnu', ca: 0, projets: 0 }
    }
    clientCAMap[client.id].ca += Number(f.total_ttc || 0)
    clientCAMap[client.id].projets++
  }
  const topClientsData = Object.values(clientCAMap)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)

  // Formater les projets en retard
  const formattedProjetsEnRetard = (projetsEnRetard.data || []).map((p: any) => ({
    id: p.id,
    numero: p.numero,
    name: p.name,
    status: p.status,
    date_promise: p.date_promise,
    client_name: p.clients?.full_name || 'Client inconnu',
    isLate: true,
  }))

  // Formater les projets à venir
  const formattedProjetsAVenir = (projetsAVenir.data || []).map((p: any) => ({
    id: p.id,
    numero: p.numero,
    name: p.name,
    status: p.status,
    date_promise: p.date_promise,
    client_name: p.clients?.full_name || 'Client inconnu',
    isLate: false,
  }))

  // Calculer les top poudres
  const poudreCount: Record<string, { reference: string; count: number }> = {}
  for (const p of topPoudres.data || []) {
    const ref = (p.poudres as any)?.reference || 'Inconnue'
    if (!poudreCount[ref]) {
      poudreCount[ref] = { reference: ref, count: 0 }
    }
    poudreCount[ref].count++
  }
  const topPoudresData = Object.values(poudreCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((p) => ({ name: p.reference, reference: p.reference, count: p.count, color: '' }))

  // Calculer le CA par mois
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  const caByMonthMap: Record<string, number> = {}
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    caByMonthMap[key] = 0
  }
  
  for (const f of caByMonth.data || []) {
    if (f.paid_at) {
      const d = new Date(f.paid_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (caByMonthMap[key] !== undefined) {
        caByMonthMap[key] += Number(f.total_ttc || 0)
      }
    }
  }
  
  const chartData = Object.entries(caByMonthMap).map(([key, ca]) => {
    const [year, month] = key.split('-')
    return {
      month: `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`,
      ca,
      factures: 0,
    }
  })

  // Générer les alertes
  const alerts: Array<{ id: string; type: 'warning' | 'danger' | 'info'; title: string; message: string; link?: string; linkText?: string }> = []
  
  if (nbFacturesImpayees > 0) {
    alerts.push({
      id: 'factures-impayees',
      type: 'danger',
      title: `${nbFacturesImpayees} facture(s) impayée(s)`,
      message: `Montant total: ${montantImpaye.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`,
      link: '/app/factures',
      linkText: 'Voir les factures',
    })
  }
  
  if (nbProjetsEnRetard > 0) {
    alerts.push({
      id: 'projets-retard',
      type: 'warning',
      title: `${nbProjetsEnRetard} projet(s) en retard`,
      message: 'Dates de livraison dépassées',
      link: '/app/projets',
      linkText: 'Voir les projets',
    })
  }
  
  // Alerte stock bas (simplifié - à améliorer avec vraie logique)
  const { data: stockBas } = await supabase
    .from('poudres')
    .select('id')
    .eq('atelier_id', atelier.id)
    .lt('stock_reel_kg', 1)
    
  if (stockBas && stockBas.length > 0) {
    alerts.push({
      id: 'stock-bas',
      type: 'warning',
      title: `${stockBas.length} poudre(s) en rupture`,
      message: 'Stock inférieur à 1 kg',
      link: '/app/poudres',
      linkText: 'Voir les poudres',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">Tableau de bord</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Bienvenue, <span className="hidden sm:inline">{userData.full_name || authUser.email} • </span>{atelier.name}
          </p>
          {atelier.trial_ends_at && new Date(atelier.trial_ends_at) > new Date() && (
            <div className="mt-3 sm:mt-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                🎉 <strong>Essai gratuit actif</strong> jusqu'au {new Date(atelier.trial_ends_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <KPICards
          caMonth={caMonth}
          caLastMonth={caLastMonth}
          facturesImpayees={nbFacturesImpayees}
          montantImpaye={montantImpaye}
          projetsEnCours={nbProjetsEnCours}
          projetsEnRetard={nbProjetsEnRetard}
          devisEnAttente={nbDevisEnAttente}
          tauxConversion={tauxConversion}
        />

        {/* Graphique CA + Alertes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <ChartCA data={chartData} />
          </div>
          <div className="order-1 lg:order-2">
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

        {/* Projets Overview */}
        <div className="mt-6 sm:mt-8">
          <ProjectsOverview
            projetsEnRetard={formattedProjetsEnRetard}
            projetsAVenir={formattedProjetsAVenir}
          />
        </div>

        {/* Conversion Stats + Top Clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <ConversionStats
            totalDevis={totalDevis}
            devisAcceptes={convertedDevis}
            devisRefuses={refusedDevis}
            tauxConversion={tauxConversion}
            tempsSignatureMoyen={tempsSignatureMoyen}
            montantMoyenDevis={montantMoyenDevis}
          />
          <TopClients clients={topClientsData} />
        </div>

        {/* Top Poudres + Actions rapides */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <TopPoudres data={topPoudresData} />
          
          {/* Actions rapides - Style thermolaquage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🔥 Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Link
                href="/app/projets/new"
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
              >
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">🔧</span>
                <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Nouveau projet</span>
              </Link>
              <Link
                href="/app/devis/new"
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
              >
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">📝</span>
                <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Nouveau devis</span>
              </Link>
              <Link
                href="/app/clients/new"
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
              >
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">👤</span>
                <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Nouveau client</span>
              </Link>
              <Link
                href="/app/factures/new"
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
              >
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">📄</span>
                <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Nouvelle facture</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
