'use client'

import Link from 'next/link'

interface PublicProjectViewProps {
  projet: any
  devis?: any
  atelier: any
  client: any
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; progress: number }> = {
  en_attente: { label: 'En attente', color: 'bg-gray-100 text-gray-700', icon: '⏳', progress: 10 },
  en_preparation: { label: 'En préparation', color: 'bg-blue-100 text-blue-700', icon: '📦', progress: 25 },
  en_traitement: { label: 'En traitement', color: 'bg-amber-100 text-amber-700', icon: '🔥', progress: 50 },
  sechage: { label: 'Séchage', color: 'bg-orange-100 text-orange-700', icon: '☀️', progress: 70 },
  controle_qualite: { label: 'Contrôle qualité', color: 'bg-purple-100 text-purple-700', icon: '🔍', progress: 85 },
  pret: { label: 'Prêt à récupérer', color: 'bg-green-100 text-green-700', icon: '✅', progress: 95 },
  livre: { label: 'Livré', color: 'bg-emerald-100 text-emerald-700', icon: '🎉', progress: 100 },
}

export function PublicProjectView({ projet, devis, atelier, client }: PublicProjectViewProps) {
  const status = STATUS_CONFIG[projet.status] || STATUS_CONFIG.en_attente
  const steps = [
    { key: 'en_attente', label: 'Réception', icon: '📥' },
    { key: 'en_preparation', label: 'Préparation', icon: '📦' },
    { key: 'en_traitement', label: 'Thermolaquage', icon: '🔥' },
    { key: 'controle_qualite', label: 'Contrôle', icon: '🔍' },
    { key: 'pret', label: 'Prêt', icon: '✅' },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === projet.status)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🔥</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{atelier?.name}</h1>
              <p className="text-xs text-gray-500">Suivi de votre projet</p>
            </div>
          </div>
          <Link
            href={`/client/auth/inscription?email=${encodeURIComponent(client?.email || '')}`}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Créer un compte →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          {/* Status Header */}
          <div className={`p-6 ${status.color.replace('text-', 'bg-').replace('-700', '-500')} bg-opacity-10`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl ${status.color} flex items-center justify-center text-3xl`}>
                  {status.icon}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut actuel</p>
                  <h2 className="text-2xl font-bold text-gray-900">{status.label}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Référence</p>
                <p className="font-bold text-gray-900">{projet.numero || `PRJ-${projet.id.slice(0, 8)}`}</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="p-6 border-t">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              
              {/* Steps */}
              <div className="relative flex justify-between">
                {steps.map((step, idx) => {
                  const isCompleted = idx <= currentStepIndex
                  const isCurrent = idx === currentStepIndex
                  
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                          isCompleted 
                            ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg' 
                            : 'bg-gray-100 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-orange-200' : ''}`}
                      >
                        {step.icon}
                      </div>
                      <span className={`mt-2 text-xs font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Project Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Client Info */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-lg">👤</span> Vos informations
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Nom</span>
                <p className="font-medium text-gray-900">{client?.full_name}</p>
              </div>
              {client?.email && (
                <div>
                  <span className="text-gray-500">Email</span>
                  <p className="font-medium text-gray-900">{client.email}</p>
                </div>
              )}
              {client?.phone && (
                <div>
                  <span className="text-gray-500">Téléphone</span>
                  <p className="font-medium text-gray-900">{client.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Info */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-lg">📋</span> Projet
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Description</span>
                <p className="font-medium text-gray-900">{projet.description || 'Thermolaquage'}</p>
              </div>
              <div>
                <span className="text-gray-500">Date de création</span>
                <p className="font-medium text-gray-900">
                  {new Date(projet.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              {projet.date_livraison_prevue && (
                <div>
                  <span className="text-gray-500">Livraison estimée</span>
                  <p className="font-medium text-orange-600">
                    {new Date(projet.date_livraison_prevue).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Devis Info */}
        {devis && devis.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="p-6 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <span className="text-lg">📄</span> Devis associé
              </h3>
            </div>
            <div className="p-6">
              {devis.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{d.numero}</p>
                    <p className="text-sm text-gray-500">
                      {d.signed_at 
                        ? `Signé le ${new Date(d.signed_at).toLocaleDateString('fr-FR')}`
                        : 'En attente de signature'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{Number(d.total_ttc).toFixed(2)} €</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      d.signed_at 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {d.signed_at ? '✓ Accepté' : '⏳ En attente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Card */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl shadow-lg p-8 text-white">
          <h3 className="text-xl font-bold mb-2">Une question ?</h3>
          <p className="text-orange-100 mb-6">
            Contactez-nous pour toute information sur votre projet
          </p>
          <div className="flex flex-wrap gap-4">
            {atelier?.phone && (
              <a 
                href={`tel:${atelier.phone}`}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                📞 {atelier.phone}
              </a>
            )}
            {atelier?.email && (
              <a 
                href={`mailto:${atelier.email}`}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                ✉️ {atelier.email}
              </a>
            )}
          </div>
        </div>

        {/* Create Account CTA */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 text-center">
          <h3 className="font-bold text-gray-900 mb-2">
            Accédez à tous vos projets
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            Créez un compte pour voir l'historique de tous vos projets et gérer vos devis
          </p>
          <Link
            href={`/client/auth/inscription?email=${encodeURIComponent(client?.email || '')}`}
            className="inline-block bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-8 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all"
          >
            Créer mon compte client
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} {atelier?.name}. Propulsé par ThermoGestion.</p>
        </div>
      </footer>
    </div>
  )
}
