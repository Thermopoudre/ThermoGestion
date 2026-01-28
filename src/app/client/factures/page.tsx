import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Download, CreditCard, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

export default async function ClientFacturesPage() {
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

  const { data: factures } = await supabase
    .from('factures')
    .select('*')
    .eq('client_id', clientUser.client_id)
    .eq('atelier_id', clientUser.atelier_id)
    .order('created_at', { ascending: false })

  const allFactures = factures || []
  const totalImpaye = allFactures
    .filter(f => f.payment_status === 'unpaid')
    .reduce((sum, f) => sum + (f.total_ttc || 0), 0)

  const isOverdue = (facture: any) => {
    if (!facture.due_date || facture.payment_status === 'paid') return false
    return new Date(facture.due_date) < new Date()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes factures</h1>
        <p className="text-gray-600">Consultez et payez vos factures en ligne</p>
      </div>

      {/* Résumé */}
      {totalImpaye > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-lg font-semibold text-amber-800">
                  Montant total à régler
                </p>
                <p className="text-3xl font-bold text-amber-900">{totalImpaye.toFixed(2)} € TTC</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Tout payer
            </button>
          </div>
        </div>
      )}

      {/* Liste des factures */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Numéro</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Échéance</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Montant</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allFactures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Aucune facture pour le moment</p>
                  </td>
                </tr>
              ) : (
                allFactures.map(facture => (
                  <tr key={facture.id} className={`hover:bg-gray-50 ${isOverdue(facture) ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">#{facture.numero}</p>
                      <p className="text-sm text-gray-500">{facture.type === 'acompte' ? 'Acompte' : 'Facture'}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(facture.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {facture.due_date ? (
                        <span className={isOverdue(facture) ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {new Date(facture.due_date).toLocaleDateString('fr-FR')}
                          {isOverdue(facture) && ' (en retard)'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {facture.total_ttc?.toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 text-center">
                      {facture.payment_status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Payée
                        </span>
                      ) : isOverdue(facture) ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" /> En retard
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                          <Clock className="w-4 h-4" /> À payer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/app/factures/${facture.id}/pdf`}
                          target="_blank"
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Télécharger PDF"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                        {facture.payment_status !== 'paid' && (
                          <Link
                            href={`/client/factures/${facture.id}/payer`}
                            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1"
                          >
                            <CreditCard className="w-4 h-4" />
                            Payer
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
