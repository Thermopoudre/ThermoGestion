import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Eye, CheckCircle2, Clock, XCircle, Send } from 'lucide-react'

export default async function ClientDevisPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/auth/login')
  }

  const { data: clientUser } = await supabase
    .from('client_users')
    .select('client_id, atelier_id')
    .eq('id', user.id)
    .single()

  if (!clientUser) {
    redirect('/client/auth/login')
  }

  const { data: devis } = await supabase
    .from('devis')
    .select('*')
    .eq('client_id', clientUser.client_id)
    .eq('atelier_id', clientUser.atelier_id)
    .order('created_at', { ascending: false })

  const allDevis = devis || []
  
  const devisEnAttente = allDevis.filter(d => d.status === 'sent' || d.status === 'envoye')
  const totalEnAttente = devisEnAttente.reduce((sum, d) => sum + (d.total_ttc || 0), 0)

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
      case 'brouillon':
        return { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock }
      case 'sent':
      case 'envoye':
        return { label: 'En attente', color: 'bg-blue-100 text-blue-700', icon: Clock }
      case 'signed':
      case 'accepte':
        return { label: 'Accepté', color: 'bg-green-100 text-green-700', icon: CheckCircle2 }
      case 'refused':
      case 'refuse':
        return { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: XCircle }
      case 'expired':
      case 'expire':
        return { label: 'Expiré', color: 'bg-orange-100 text-orange-700', icon: Clock }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes devis</h1>
          <p className="text-gray-600">Consultez et signez vos devis en ligne</p>
        </div>
        <Link 
          href="/client/demande-devis"
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          Demander un devis
        </Link>
      </div>

      {/* Résumé devis en attente */}
      {devisEnAttente.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-lg font-semibold text-blue-800">
                {devisEnAttente.length} devis en attente de signature
              </p>
              <p className="text-blue-600">
                Montant total : {totalEnAttente.toFixed(2)} € TTC
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Liste des devis */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Numéro</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Validité</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Montant</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allDevis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="mb-4">Aucun devis pour le moment</p>
                    <Link 
                      href="/client/demande-devis"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Demander un devis
                    </Link>
                  </td>
                </tr>
              ) : (
                allDevis.map(devis => {
                  const statusInfo = getStatusInfo(devis.status)
                  const StatusIcon = statusInfo.icon
                  const isExpired = devis.valid_until && new Date(devis.valid_until) < new Date()
                  
                  return (
                    <tr key={devis.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">#{devis.numero}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(devis.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        {devis.valid_until ? (
                          <span className={isExpired && devis.status !== 'signed' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {new Date(devis.valid_until).toLocaleDateString('fr-FR')}
                            {isExpired && devis.status !== 'signed' && ' (expiré)'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {devis.total_ttc?.toFixed(2)} €
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/p/${devis.public_token}`}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Voir le devis"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          {(devis.status === 'sent' || devis.status === 'envoye') && !isExpired && (
                            <Link
                              href={`/p/${devis.public_token}/sign`}
                              className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Signer
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
