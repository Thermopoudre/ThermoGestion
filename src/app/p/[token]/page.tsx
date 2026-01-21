import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PublicProjectView } from '@/components/public/PublicProjectView'

// Page publique pour voir un projet sans compte
// Accessible via /p/{token}

export default async function PublicProjectPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createServerClient()
  
  // Chercher d'abord dans les projets
  const { data: projet } = await supabase
    .from('projets')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone
      ),
      devis (
        id,
        numero,
        status,
        total_ht,
        total_ttc,
        signed_at,
        public_token
      ),
      ateliers (
        id,
        name,
        phone,
        email,
        address
      )
    `)
    .eq('public_token', params.token)
    .single()

  // Si pas de projet, chercher dans les devis
  if (!projet) {
    const { data: devis } = await supabase
      .from('devis')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          phone
        ),
        ateliers (
          id,
          name,
          phone,
          email,
          address
        )
      `)
      .eq('public_token', params.token)
      .single()

    if (!devis) {
      notFound()
    }

    // C'est un devis, rediriger vers la page de signature si pas encore signé
    if (!devis.signed_at) {
      return (
        <PublicDevisView 
          devis={devis} 
          atelier={devis.ateliers}
          client={devis.clients}
        />
      )
    }

    // Devis signé mais pas encore de projet
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Devis accepté !
            </h1>
            <p className="text-gray-600 mb-6">
              Votre devis <strong>{devis.numero}</strong> a été accepté le{' '}
              {new Date(devis.signed_at).toLocaleDateString('fr-FR')}.
            </p>
            <p className="text-gray-500 text-sm">
              Votre projet est en cours de préparation. Vous recevrez un email dès qu'il sera disponible.
            </p>
            
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-gray-500 mb-4">
                Créez un compte pour suivre tous vos projets
              </p>
              <Link
                href={`/client/auth/inscription?email=${encodeURIComponent(devis.clients?.email || '')}&from=devis`}
                className="inline-block bg-orange-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Créer mon compte client
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PublicProjectView 
      projet={projet}
      devis={projet.devis}
      atelier={projet.ateliers}
      client={projet.clients}
    />
  )
}

// Composant pour afficher un devis non signé
function PublicDevisView({ 
  devis, 
  atelier, 
  client 
}: { 
  devis: any
  atelier: any
  client: any
}) {
  const items = devis.items || []
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🔥</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{atelier?.name}</h1>
              <p className="text-xs text-gray-500">{atelier?.email}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500">Devis</span>
            <p className="font-bold text-gray-900">{devis.numero}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
            ✍️
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-amber-900">En attente de votre signature</h2>
            <p className="text-sm text-amber-700">
              Consultez ce devis et signez-le pour démarrer votre projet
            </p>
          </div>
          <Link
            href={`/p/${devis.public_token}/sign`}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all shadow-lg"
          >
            Signer le devis →
          </Link>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-lg">👤</span> Vos informations
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Nom</span>
              <p className="font-medium text-gray-900">{client?.full_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Email</span>
              <p className="font-medium text-gray-900">{client?.email}</p>
            </div>
          </div>
        </div>

        {/* Devis Details */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="p-6 border-b">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="text-lg">📋</span> Détail du devis
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Créé le {new Date(devis.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Désignation</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qté</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{item.designation}</p>
                      {item.description && (
                        <p className="text-sm text-gray-500">{item.description}</p>
                      )}
                    </td>
                    <td className="text-center px-4 py-4 text-gray-600">{item.quantite}</td>
                    <td className="text-right px-6 py-4 font-semibold text-gray-900">
                      {(item.total_ht || 0).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Totals */}
          <div className="bg-gray-50 p-6">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total HT</span>
                <span className="font-medium">{Number(devis.total_ht).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA ({devis.tva_rate}%)</span>
                <span className="font-medium">
                  {(Number(devis.total_ttc) - Number(devis.total_ht)).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total TTC</span>
                <span className="text-orange-600">{Number(devis.total_ttc).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {devis.notes && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-2">📝 Notes</h3>
            <p className="text-gray-600 whitespace-pre-line">{devis.notes}</p>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl shadow-lg p-8 text-center text-white">
          <h3 className="text-xl font-bold mb-2">Prêt à démarrer ?</h3>
          <p className="text-orange-100 mb-6">
            Signez ce devis pour lancer votre projet de thermolaquage
          </p>
          <Link
            href={`/p/${devis.public_token}/sign`}
            className="inline-block bg-white text-orange-600 font-bold py-3 px-8 rounded-lg hover:bg-orange-50 transition-colors"
          >
            ✍️ Signer le devis
          </Link>
        </div>

        {/* Create Account */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-3">
            Vous avez plusieurs projets ?
          </p>
          <Link
            href={`/client/auth/inscription?email=${encodeURIComponent(client?.email || '')}&from=devis`}
            className="text-orange-600 hover:text-orange-700 font-medium text-sm"
          >
            Créer un compte pour tout gérer →
          </Link>
        </div>
      </main>
    </div>
  )
}
