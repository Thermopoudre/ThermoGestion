import { createServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { 
  Receipt, Download, CreditCard, CheckCircle2, Clock, AlertTriangle,
  ArrowLeft, Calendar, Building, FileText
} from 'lucide-react'
import { getFacturePaymentLabel, getFacturePaymentColor } from '@/lib/status-labels'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Détail facture - Espace Client | ThermoGestion',
}

export default async function ClientFactureDetailPage({
  params,
}: {
  params: { id: string }
}) {
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

  // Vérification ownership : on ne charge que les factures du client
  const { data: facture, error } = await supabase
    .from('factures')
    .select(`
      *,
      clients (full_name, email, phone, address, city, postal_code),
      projets (id, numero, name)
    `)
    .eq('id', params.id)
    .eq('client_id', clientUser.client_id)
    .eq('atelier_id', clientUser.atelier_id)
    .single()

  if (error || !facture) {
    redirect('/client/factures?error=not_found')
  }

  const isOverdue = facture.due_date && facture.payment_status !== 'paid' && new Date(facture.due_date) < new Date()

  // Déterminer le statut effectif
  const effectiveStatus = isOverdue ? 'overdue' : (facture.payment_status || 'unpaid')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: 'Factures', href: '/client/factures' },
        { label: `#${facture.numero || facture.id.slice(0, 8)}` },
      ]} />

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Facture #{facture.numero}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {facture.type === 'acompte' ? 'Facture d\'acompte' : 'Facture'}
            {' — '}
            Émise le {new Date(facture.created_at).toLocaleDateString('fr-FR', { 
              day: 'numeric', month: 'long', year: 'numeric' 
            })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ${getFacturePaymentColor(effectiveStatus)}`}>
          {effectiveStatus === 'paid' && <CheckCircle2 className="w-4 h-4" />}
          {effectiveStatus === 'overdue' && <AlertTriangle className="w-4 h-4" />}
          {effectiveStatus === 'unpaid' && <Clock className="w-4 h-4" />}
          {getFacturePaymentLabel(effectiveStatus)}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="md:col-span-2 space-y-6">
          {/* Montants */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-orange-500" />
              Détails financiers
            </h2>
            <div className="space-y-3">
              {facture.total_ht != null && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Total HT</span>
                  <span className="font-medium text-gray-900 dark:text-white">{facture.total_ht.toFixed(2)} €</span>
                </div>
              )}
              {facture.tva_amount != null && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">TVA ({facture.tva_rate || 20}%)</span>
                  <span className="font-medium text-gray-900 dark:text-white">{facture.tva_amount.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-lg">
                <span className="font-bold text-gray-900 dark:text-white">Total TTC</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{facture.total_ttc?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Lignes de la facture */}
          {facture.items && Array.isArray(facture.items) && facture.items.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Détail des prestations
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Description</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Qté</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">P.U. HT</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(facture.items as any[]).map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">{item.description || item.name}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{item.quantity || item.qty || 1}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{(item.unit_price || item.prix_unitaire || 0).toFixed(2)} €</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">{(item.total || ((item.quantity || 1) * (item.unit_price || 0))).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Projet lié */}
          {facture.projets && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Building className="w-5 h-5 text-orange-500" />
                Projet associé
              </h2>
              <Link 
                href={`/client/projets/${(facture.projets as any).id}`}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{(facture.projets as any).name || 'Projet'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">#{(facture.projets as any).numero}</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
              </Link>
            </div>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Actions</h2>
            
            <a
              href={`/api/client/factures/${facture.id}/pdf`}
              target="_blank"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Download className="w-5 h-5" />
              Télécharger PDF
            </a>

            {facture.payment_status !== 'paid' && (
              <Link
                href={`/client/factures/${facture.id}/payer`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Payer maintenant
              </Link>
            )}
          </div>

          {/* Informations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Informations</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Émise le {new Date(facture.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              {facture.due_date && (
                <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Échéance : {new Date(facture.due_date).toLocaleDateString('fr-FR')}
                    {isOverdue && ' (en retard)'}
                  </span>
                </div>
              )}
              {facture.payment_method && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  <span>Mode : {facture.payment_method}</span>
                </div>
              )}
              {facture.paid_at && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Payée le {new Date(facture.paid_at).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
