import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScanUpdateStatus } from '@/components/scan/ScanUpdateStatus'
import { Package, User, Calendar, Palette, CheckCircle2, Clock, MapPin } from 'lucide-react'

// Page de scan pour mise à jour rapide du statut projet
// Accessible via QR code sans authentification complète
// Accepte soit un ID de projet, soit un QR token

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  devis: { label: 'Devis en cours', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  en_cours: { label: 'En production', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  en_cuisson: { label: 'En cuisson', color: 'text-red-600', bgColor: 'bg-red-100' },
  qc: { label: 'Contrôle qualité', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  pret: { label: 'Prêt à retirer', color: 'text-green-600', bgColor: 'bg-green-100' },
  livre: { label: 'Livré', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  annule: { label: 'Annulé', color: 'text-red-600', bgColor: 'bg-red-100' }
}

export default async function ScanPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()

  // Essayer d'abord par QR token, puis par ID
  let projet: any = null
  let error: any = null

  // Vérifier si c'est un UUID (ID) ou un token (hex string de 32 caractères)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)
  
  if (isUUID) {
    // Récupérer par ID
    const result = await supabase
      .from('projets')
      .select(`
        id,
        numero,
        name,
        description,
        status,
        client_id,
        atelier_id,
        created_at,
        date_souhaite,
        surface_m2,
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
          address
        ),
        poudres (
          reference,
          ral,
          finition,
          marque
        )
      `)
      .eq('id', params.id)
      .single()
    
    projet = result.data
    error = result.error
  } else {
    // Récupérer par QR token
    const result = await supabase
      .from('projets')
      .select(`
        id,
        numero,
        name,
        description,
        status,
        client_id,
        atelier_id,
        created_at,
        date_souhaite,
        surface_m2,
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
          address
        ),
        poudres (
          reference,
          ral,
          finition,
          marque
        )
      `)
      .eq('qr_token', params.id)
      .single()
    
    projet = result.data
    error = result.error
  }

  if (error || !projet) {
    notFound()
  }

  const statusInfo = statusConfig[projet.status] || statusConfig.en_cours

  // Si c'est un accès via QR token (public), afficher la vue client
  if (!isUUID) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {projet.numero}
                </h1>
                <p className="text-sm text-gray-500">{projet.ateliers?.name}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Statut */}
          <div className={`${statusInfo.bgColor} rounded-xl p-6 text-center`}>
            <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 ${statusInfo.color}`} />
            <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
              {statusInfo.label}
            </h2>
            {projet.status === 'pret' && (
              <p className="mt-2 text-gray-600">
                Vous pouvez venir récupérer votre commande !
              </p>
            )}
          </div>

          {/* Infos projet */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Détails du projet
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Nom du projet</p>
                <p className="font-medium text-gray-900 dark:text-white">{projet.name}</p>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {projet.clients?.full_name}
                  </p>
                </div>
              </div>

              {projet.poudres && (
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Couleur</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {projet.poudres.ral ? `RAL ${projet.poudres.ral}` : projet.poudres.reference}
                      {projet.poudres.finition && ` - ${projet.poudres.finition}`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Date de création</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(projet.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {projet.date_souhaite && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Date souhaitée</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(projet.date_souhaite).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline du statut */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Progression
            </h3>
            
            <div className="space-y-3">
              {['devis', 'en_cours', 'en_cuisson', 'qc', 'pret', 'livre'].map((status, index) => {
                const info = statusConfig[status]
                const statusOrder = ['devis', 'en_cours', 'en_cuisson', 'qc', 'pret', 'livre']
                const currentIndex = statusOrder.indexOf(projet.status)
                const stepIndex = statusOrder.indexOf(status)
                const isCompleted = stepIndex < currentIndex
                const isCurrent = stepIndex === currentIndex
                
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? `${info.bgColor} ${info.color}` :
                      'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm ${
                      isCurrent ? 'font-semibold text-gray-900 dark:text-white' : 
                      isCompleted ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {info.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Contact atelier */}
          {projet.ateliers && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Contact
              </h3>
              
              <div className="space-y-3">
                <p className="font-medium">{projet.ateliers.name}</p>
                
                {projet.ateliers.phone && (
                  <a 
                    href={`tel:${projet.ateliers.phone}`}
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    📞 {projet.ateliers.phone}
                  </a>
                )}
                
                {projet.ateliers.address && (
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <span className="text-sm">{projet.ateliers.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pt-4">
            Powered by ThermoGestion
          </p>
        </main>
      </div>
    )
  }

  // Sinon, afficher la vue opérateur pour mise à jour du statut
  return (
    <ScanUpdateStatus 
      projet={projet}
      client={projet.clients}
      atelier={projet.ateliers}
    />
  )
}
