import Link from 'next/link'

const releases = [
  {
    version: '2.5.0',
    date: '21 janvier 2026',
    type: 'major',
    title: 'Nouvelles pages SaaS',
    changes: [
      { type: 'new', text: 'Page onboarding interactive pour les nouveaux utilisateurs' },
      { type: 'new', text: 'Centre d\'aide avec FAQ complète' },
      { type: 'new', text: 'Page de gestion du compte personnel' },
      { type: 'new', text: 'Page de changelog pour suivre les mises à jour' },
      { type: 'new', text: 'Page d\'abonnement avec factures SaaS' },
      { type: 'improved', text: 'Navigation unifiée dans les paramètres' },
    ]
  },
  {
    version: '2.4.0',
    date: '15 janvier 2026',
    type: 'major',
    title: 'Améliorations UX & Navigation',
    changes: [
      { type: 'new', text: 'Menu utilisateur avec notifications et déconnexion' },
      { type: 'new', text: 'Highlight du menu actif en orange' },
      { type: 'improved', text: 'Uniformisation des menus sans emojis' },
      { type: 'improved', text: 'Cloche de notifications repositionnée' },
      { type: 'fixed', text: 'Espacement du logo ThermoGestion' },
    ]
  },
  {
    version: '2.3.0',
    date: '10 janvier 2026',
    type: 'major',
    title: 'Templates PDF & Personnalisation',
    changes: [
      { type: 'new', text: '4 templates PDF professionnels (Industriel, Moderne, Minimal, Classique)' },
      { type: 'new', text: 'Personnalisation des couleurs des documents' },
      { type: 'new', text: 'Format A4 optimisé pour impression' },
      { type: 'improved', text: 'Aperçu en temps réel des modifications' },
    ]
  },
  {
    version: '2.2.0',
    date: '5 janvier 2026',
    type: 'major',
    title: 'Calcul avancé des devis',
    changes: [
      { type: 'new', text: 'Prix de la poudre lié à chaque référence' },
      { type: 'new', text: 'Calcul automatique de la consommation selon la surface' },
      { type: 'new', text: 'Gestion des marges (poudre et main d\'œuvre)' },
      { type: 'new', text: 'Support des couches multiples (primaire, base, vernis)' },
      { type: 'improved', text: 'Affichage du prix de revient et marge sur les devis' },
    ]
  },
  {
    version: '2.1.0',
    date: '28 décembre 2025',
    type: 'minor',
    title: 'Intégrations paiement',
    changes: [
      { type: 'new', text: 'Intégration Stripe Connect pour les paiements' },
      { type: 'new', text: 'Intégration PayPal Business' },
      { type: 'new', text: 'Lien de paiement sur les factures' },
      { type: 'new', text: 'Notification automatique de paiement reçu' },
    ]
  },
  {
    version: '2.0.0',
    date: '20 décembre 2025',
    type: 'major',
    title: 'Dashboard & Statistiques',
    changes: [
      { type: 'new', text: 'Dashboard personnalisable avec widgets' },
      { type: 'new', text: 'Graphiques de CA et tendances' },
      { type: 'new', text: 'KPIs en temps réel' },
      { type: 'new', text: 'Page statistiques détaillées' },
      { type: 'improved', text: 'Performance globale de l\'application' },
    ]
  },
  {
    version: '1.5.0',
    date: '10 décembre 2025',
    type: 'minor',
    title: 'QR Codes & Suivi atelier',
    changes: [
      { type: 'new', text: 'QR Code unique par projet' },
      { type: 'new', text: 'Mise à jour du statut par scan' },
      { type: 'new', text: 'Notification client automatique' },
      { type: 'improved', text: 'Interface de suivi projet' },
    ]
  },
  {
    version: '1.4.0',
    date: '1 décembre 2025',
    type: 'minor',
    title: 'Gestion des séries',
    changes: [
      { type: 'new', text: 'Création de séries de production' },
      { type: 'new', text: 'Regroupement par couleur RAL' },
      { type: 'new', text: 'Optimisation du planning four' },
    ]
  },
  {
    version: '1.3.0',
    date: '20 novembre 2025',
    type: 'minor',
    title: 'Multi-utilisateurs',
    changes: [
      { type: 'new', text: 'Système de rôles (Admin, Commercial, Opérateur)' },
      { type: 'new', text: 'Invitation par email' },
      { type: 'new', text: 'Gestion des permissions' },
    ]
  },
  {
    version: '1.0.0',
    date: '1 novembre 2025',
    type: 'major',
    title: 'Lancement de ThermoGestion',
    changes: [
      { type: 'new', text: 'Gestion des clients' },
      { type: 'new', text: 'Création de devis' },
      { type: 'new', text: 'Gestion des projets' },
      { type: 'new', text: 'Facturation' },
      { type: 'new', text: 'Catalogue de poudres' },
    ]
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">✨</div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            Nouveautés
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Découvrez les dernières fonctionnalités et améliorations
          </p>
        </div>

        {/* Subscribe to updates */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 mb-12 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">Restez informé des nouveautés</h3>
              <p className="opacity-90 text-sm">Recevez un email à chaque mise à jour importante</p>
            </div>
            <button className="px-6 py-2 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
              S'abonner aux mises à jour
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

          {/* Releases */}
          <div className="space-y-8">
            {releases.map((release, index) => (
              <div key={index} className="relative pl-20">
                {/* Dot */}
                <div className={`absolute left-6 w-5 h-5 rounded-full border-4 border-white dark:border-gray-900 ${
                  release.type === 'major' 
                    ? 'bg-orange-500' 
                    : 'bg-gray-400 dark:bg-gray-600'
                }`}></div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          release.type === 'major'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          v{release.version}
                        </span>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {release.title}
                        </h3>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {release.date}
                      </span>
                    </div>
                  </div>

                  {/* Changes */}
                  <div className="px-6 py-4">
                    <ul className="space-y-2">
                      {release.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="flex items-start gap-3">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                            change.type === 'new'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : change.type === 'improved'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}>
                            {change.type === 'new' ? 'Nouveau' : change.type === 'improved' ? 'Amélioration' : 'Correction'}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{change.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Vous avez une idée de fonctionnalité ?
          </p>
          <Link
            href="/app/feedback"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Proposer une idée
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
