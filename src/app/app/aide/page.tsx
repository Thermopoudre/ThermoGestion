import Link from 'next/link'

const faqs = [
  {
    category: 'Premiers pas',
    icon: '🚀',
    questions: [
      {
        q: 'Comment créer mon premier devis ?',
        a: 'Allez dans Devis > Nouveau devis. Sélectionnez un client, ajoutez les lignes de prestation avec les dimensions et la poudre, puis générez le PDF.'
      },
      {
        q: 'Comment configurer mon atelier ?',
        a: 'Dans Paramètres > Atelier, renseignez vos informations légales (SIRET, adresse, etc.) qui apparaîtront sur vos documents.'
      },
      {
        q: 'Comment ajouter mes poudres ?',
        a: 'Allez dans Poudres > Nouvelle poudre. Indiquez le nom, la référence RAL, le prix au kg et la couverture au m².'
      },
    ]
  },
  {
    category: 'Devis & Factures',
    icon: '📄',
    questions: [
      {
        q: 'Comment envoyer un devis à un client ?',
        a: 'Ouvrez le devis et cliquez sur "Envoyer par email". Le client recevra un lien pour consulter et signer le devis en ligne.'
      },
      {
        q: 'Comment convertir un devis en projet ?',
        a: 'Une fois le devis signé, cliquez sur "Convertir en projet". Un projet sera créé automatiquement avec toutes les informations du devis.'
      },
      {
        q: 'Comment créer une facture d\'acompte ?',
        a: 'Lors de la création de la facture, sélectionnez "Acompte" et indiquez le pourcentage (ex: 30%). La facture de solde sera générée automatiquement.'
      },
      {
        q: 'Mes factures sont-elles conformes à la réglementation française ?',
        a: 'Oui, nos factures incluent toutes les mentions légales obligatoires : numéro de facture, SIRET, TVA, conditions de paiement, etc.'
      },
    ]
  },
  {
    category: 'Projets & Production',
    icon: '🏭',
    questions: [
      {
        q: 'Comment suivre l\'avancement d\'un projet ?',
        a: 'Chaque projet a un statut que vous pouvez mettre à jour : En attente, En préparation, En cours, Terminé, Livré. Le client est notifié à chaque changement.'
      },
      {
        q: 'Comment utiliser le QR Code projet ?',
        a: 'Chaque projet génère un QR Code unique. Scannez-le avec votre téléphone pour mettre à jour le statut directement depuis l\'atelier.'
      },
      {
        q: 'Comment gérer les séries de production ?',
        a: 'Créez une série pour regrouper plusieurs projets par couleur RAL. Cela optimise votre production en thermolaquage.'
      },
    ]
  },
  {
    category: 'Gestion des poudres',
    icon: '🎨',
    questions: [
      {
        q: 'Comment calculer la consommation de poudre ?',
        a: 'La consommation est calculée automatiquement selon la surface de la pièce et le taux de couverture de la poudre (g/m²).'
      },
      {
        q: 'Comment gérer le stock de poudres ?',
        a: 'Allez dans Poudres > Stock pour voir les niveaux. Configurez des alertes de stock bas dans les paramètres.'
      },
      {
        q: 'Puis-je utiliser plusieurs couches de poudre ?',
        a: 'Oui, vous pouvez ajouter plusieurs couches (primaire, base, vernis) dans un devis. Chaque couche est facturée séparément.'
      },
    ]
  },
  {
    category: 'Clients & Équipe',
    icon: '👥',
    questions: [
      {
        q: 'Comment inviter un collaborateur ?',
        a: 'Dans Équipe > Inviter, entrez l\'email de votre collaborateur et choisissez son rôle (Admin, Commercial, Opérateur).'
      },
      {
        q: 'Quels sont les différents rôles ?',
        a: 'Admin : accès complet. Commercial : clients, devis, factures. Opérateur : projets et production uniquement.'
      },
      {
        q: 'Comment un client peut-il suivre son projet ?',
        a: 'Le client reçoit un lien unique pour suivre son projet en temps réel. Il peut aussi créer un compte pour voir tous ses projets.'
      },
    ]
  },
  {
    category: 'Paiements & Facturation',
    icon: '💳',
    questions: [
      {
        q: 'Comment activer le paiement en ligne ?',
        a: 'Dans Paramètres > Intégrations, connectez votre compte Stripe ou PayPal. Vos clients pourront payer directement depuis la facture.'
      },
      {
        q: 'Comment exporter mes factures pour la comptabilité ?',
        a: 'Allez dans Factures > Export et choisissez le format (CSV, FEC). Vous pouvez filtrer par période.'
      },
      {
        q: 'Comment gérer les relances de factures impayées ?',
        a: 'Les relances automatiques sont configurables dans Paramètres. Définissez les délais (J+7, J+14, J+30) et le contenu des emails.'
      },
    ]
  },
]

const tutorials = [
  {
    title: 'Créer un devis en 5 minutes',
    description: 'Apprenez à créer un devis professionnel de A à Z',
    duration: '5 min',
    icon: '📝',
    link: '/app/onboarding',
  },
  {
    title: 'Configurer les paiements en ligne',
    description: 'Connectez Stripe et recevez des paiements',
    duration: '10 min',
    icon: '💳',
    link: '/app/parametres/integrations',
  },
  {
    title: 'Gérer une équipe',
    description: 'Invitez des collaborateurs et gérez les accès',
    duration: '5 min',
    icon: '👥',
    link: '/app/equipe',
  },
  {
    title: 'Optimiser la production',
    description: 'Utilisez les séries et le planning',
    duration: '15 min',
    icon: '🏭',
    link: '/app/series',
  },
]

export default function AidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">💡</div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            Centre d'aide
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Trouvez rapidement les réponses à vos questions
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher dans l'aide..."
              className="w-full px-6 py-4 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Link href="/app/onboarding" className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-2">🚀</div>
            <p className="font-medium text-gray-900 dark:text-white">Guide de démarrage</p>
          </Link>
          <Link href="/app/changelog" className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-2">✨</div>
            <p className="font-medium text-gray-900 dark:text-white">Nouveautés</p>
          </Link>
          <Link href="/app/feedback" className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-2">💬</div>
            <p className="font-medium text-gray-900 dark:text-white">Feedback</p>
          </Link>
          <a href="mailto:contact@thermogestion.fr" className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-2">📧</div>
            <p className="font-medium text-gray-900 dark:text-white">Contact support</p>
          </a>
        </div>

        {/* Tutorials */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Tutoriels rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tutorials.map((tutorial, index) => (
              <Link 
                key={index}
                href={tutorial.link}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="text-3xl mb-3">{tutorial.icon}</div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{tutorial.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{tutorial.description}</p>
                <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 px-2 py-1 rounded-full">
                  {tutorial.duration}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Questions fréquentes
          </h2>
          
          <div className="space-y-8">
            {faqs.map((category, catIndex) => (
              <div key={catIndex} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{category.icon}</span>
                    {category.category}
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {category.questions.map((item, qIndex) => (
                    <details key={qIndex} className="group">
                      <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                        <span className="font-medium text-gray-900 dark:text-white">{item.q}</span>
                        <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-6 pb-4 text-gray-600 dark:text-gray-400">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Vous n'avez pas trouvé votre réponse ?</h2>
          <p className="mb-6 opacity-90">Notre équipe est là pour vous aider</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:contact@thermogestion.fr"
              className="px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Envoyer un email
            </a>
            <a 
              href="tel:+33123456789"
              className="px-6 py-3 border-2 border-white text-white font-bold rounded-lg hover:bg-white/10 transition-colors"
            >
              Appeler le support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
