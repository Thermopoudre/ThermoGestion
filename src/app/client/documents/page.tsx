import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FileText, Receipt, Download, Eye, CheckCircle, Clock, XCircle } from 'lucide-react'

export default async function ClientDocumentsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/client/auth/login')
  }

  const { data: clientUser, error } = await supabase
    .from('client_users')
    .select('client_id, atelier_id')
    .eq('id', user.id)
    .single()

  if (error || !clientUser) {
    redirect('/client/auth/login')
  }

  // Récupérer tous les documents
  const [devisResult, facturesResult] = await Promise.all([
    supabase
      .from('devis')
      .select('id, numero, status, total_ttc, created_at, signed_at')
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('factures')
      .select('id, numero, status, payment_status, total_ttc, created_at, paid_at')
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .order('created_at', { ascending: false }),
  ])

  const devis = devisResult.data || []
  const factures = facturesResult.data || []

  // Combine and sort all documents
  const allDocuments = [
    ...devis.map(d => ({ ...d, type: 'devis' as const })),
    ...factures.map(f => ({ ...f, type: 'facture' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const statusConfig = {
    devis: {
      draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
      sent: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      signed: { label: 'Signé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      refused: { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: XCircle },
    },
    facture: {
      paid: { label: 'Payée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      unpaid: { label: 'À payer', color: 'bg-red-100 text-red-700', icon: Clock },
      partial: { label: 'Partiel', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    },
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mes Documents</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Retrouvez tous vos devis et factures
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{devis.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Devis</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {devis.filter(d => d.status === 'signed').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Devis signés</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{factures.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Factures</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {factures.filter(f => f.payment_status === 'paid').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Factures payées</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium">
          Tous
        </button>
        <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
          Devis
        </button>
        <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
          Factures
        </button>
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {allDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Aucun document pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {allDocuments.map((doc) => {
              const config = doc.type === 'devis' 
                ? statusConfig.devis[doc.status as keyof typeof statusConfig.devis]
                : statusConfig.facture[doc.payment_status as keyof typeof statusConfig.facture]
              
              const StatusIcon = config?.icon || Clock
              
              return (
                <div key={`${doc.type}-${doc.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        doc.type === 'devis' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'
                      }`}>
                        {doc.type === 'devis' 
                          ? <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          : <Receipt className="w-5 h-5 text-green-600 dark:text-green-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {doc.type === 'devis' ? 'Devis' : 'Facture'} #{doc.numero}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config?.color || 'bg-gray-100 text-gray-700'}`}>
                            {config?.label || doc.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(doc.created_at), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {doc.total_ttc?.toFixed(2)} €
                      </p>
                      <div className="flex gap-2">
                        <Link
                          href={doc.type === 'devis' ? `/client/devis/${doc.id}` : `/client/factures/${doc.id}`}
                          className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <a
                          href={doc.type === 'devis' ? `/app/devis/${doc.id}/pdf` : `/app/factures/${doc.id}/pdf`}
                          target="_blank"
                          className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Help */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
          Besoin d'aide ?
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          Pour toute question concernant un document, contactez directement votre atelier. 
          Les devis peuvent être signés en ligne en cliquant sur "Voir".
        </p>
      </div>
    </div>
  )
}
