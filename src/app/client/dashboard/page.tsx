import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, FileText, Receipt, Clock, CheckCircle2, AlertTriangle, ArrowRight, Send } from 'lucide-react'

export default async function ClientDashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/auth/login')
  }

  // Vérifier que c'est un compte client
  const { data: clientUser, error: clientError } = await supabase
    .from('client_users')
    .select('client_id, atelier_id, clients(full_name)')
    .eq('id', user.id)
    .single()

  if (clientError || !clientUser) {
    redirect('/client/auth/login?error=not_client')
  }

  // Récupérer les stats
  const [projetsResult, devisResult, facturesResult] = await Promise.all([
    supabase
      .from('projets')
      .select('id, numero, name, status, date_promise, created_at')
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('devis')
      .select('id, numero, status, total_ttc, created_at')
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('factures')
      .select('id, numero, status, payment_status, total_ttc, due_date, created_at')
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const projets = projetsResult.data || []
  const devis = devisResult.data || []
  const factures = facturesResult.data || []

  // Calculs
  const projetsEnCours = projets.filter(p => ['en_cours', 'en_cuisson', 'qc'].includes(p.status)).length
  const projetsPrets = projets.filter(p => p.status === 'pret').length
  const devisEnAttente = devis.filter(d => d.status === 'sent' || d.status === 'draft').length
  const facturesImpayees = factures.filter(f => f.payment_status === 'unpaid')
  const totalImpaye = facturesImpayees.reduce((sum, f) => sum + (f.total_ttc || 0), 0)

  const statusLabels: Record<string, string> = {
    devis: 'Devis',
    en_cours: 'En production',
    en_cuisson: 'Cuisson',
    qc: 'Contrôle',
    pret: 'Prêt à retirer',
    livre: 'Livré',
  }

  const statusColors: Record<string, string> = {
    devis: 'bg-gray-100 text-gray-700',
    en_cours: 'bg-blue-100 text-blue-700',
    en_cuisson: 'bg-orange-100 text-orange-700',
    qc: 'bg-purple-100 text-purple-700',
    pret: 'bg-green-100 text-green-700',
    livre: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Bonjour, {(clientUser.clients as any)?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-600 mt-1">Voici un aperçu de vos projets et documents</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{projetsEnCours}</p>
              <p className="text-sm text-gray-500">En cours</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{projetsPrets}</p>
              <p className="text-sm text-gray-500">Prêts à retirer</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{devisEnAttente}</p>
              <p className="text-sm text-gray-500">Devis en attente</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <Receipt className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalImpaye.toFixed(0)}€</p>
              <p className="text-sm text-gray-500">À régler</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerte projets prêts */}
      {projetsPrets > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-4">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-800">
              {projetsPrets} projet{projetsPrets > 1 ? 's' : ''} prêt{projetsPrets > 1 ? 's' : ''} à retirer !
            </p>
            <p className="text-sm text-green-600">Vous pouvez venir les récupérer à l'atelier.</p>
          </div>
          <Link 
            href="/client/projets?status=pret"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Voir
          </Link>
        </div>
      )}

      {/* Alerte factures impayées */}
      {facturesImpayees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              {facturesImpayees.length} facture{facturesImpayees.length > 1 ? 's' : ''} en attente de paiement
            </p>
            <p className="text-sm text-amber-600">Total : {totalImpaye.toFixed(2)} € TTC</p>
          </div>
          <Link 
            href="/client/factures?status=unpaid"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Payer
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Derniers projets */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Derniers projets
            </h2>
            <Link href="/client/projets" className="text-sm text-orange-500 hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {projets.length === 0 ? (
              <p className="p-6 text-center text-gray-500">Aucun projet pour le moment</p>
            ) : (
              projets.slice(0, 4).map(projet => (
                <Link 
                  key={projet.id} 
                  href={`/client/projets/${projet.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{projet.name}</p>
                    <p className="text-sm text-gray-500">#{projet.numero}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[projet.status] || 'bg-gray-100'}`}>
                    {statusLabels[projet.status] || projet.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Dernières factures */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-orange-500" />
              Dernières factures
            </h2>
            <Link href="/client/factures" className="text-sm text-orange-500 hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {factures.length === 0 ? (
              <p className="p-6 text-center text-gray-500">Aucune facture pour le moment</p>
            ) : (
              factures.slice(0, 4).map(facture => (
                <Link 
                  key={facture.id} 
                  href={`/client/factures/${facture.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">#{facture.numero}</p>
                    <p className="text-sm text-gray-500">{facture.total_ttc?.toFixed(2)} € TTC</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    facture.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {facture.payment_status === 'paid' ? 'Payée' : 'À payer'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CTA Demande de devis */}
      <div className="mt-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-8 text-white text-center">
        <Send className="w-12 h-12 mx-auto mb-4 opacity-80" />
        <h2 className="text-2xl font-bold mb-2">Besoin d'un nouveau devis ?</h2>
        <p className="text-orange-100 mb-6">Décrivez votre projet et recevez un devis rapidement</p>
        <Link 
          href="/client/demande-devis"
          className="inline-block px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
        >
          Demander un devis
        </Link>
      </div>
    </div>
  )
}
