'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search, Book, MessageSquare, Settings, FileText, Users,
  Package, BarChart3, Shield, CreditCard, ChevronRight,
  ChevronDown, ExternalLink, HelpCircle, Lightbulb, Zap
} from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

interface HelpCategory {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  link?: string
  faqs: FAQItem[]
}

const helpCategories: HelpCategory[] = [
  {
    id: 'demarrage',
    title: 'Démarrage rapide',
    icon: <Zap className="w-6 h-6" />,
    description: 'Premiers pas avec ThermoGestion',
    link: '/app/onboarding',
    faqs: [
      {
        question: 'Comment configurer mon atelier ?',
        answer: 'Rendez-vous dans Paramètres > Informations atelier. Renseignez votre SIRET, adresse, logo et coordonnées bancaires. Ces informations apparaîtront sur vos devis et factures.'
      },
      {
        question: 'Comment ajouter mes premières poudres ?',
        answer: 'Allez dans Stock > Poudres > Nouvelle poudre. Renseignez le nom, la couleur RAL, le prix au kg et la couverture au m². Vous pourrez ensuite les sélectionner lors de la création de devis.'
      },
      {
        question: 'Mon essai gratuit dure combien de temps ?',
        answer: 'Votre essai gratuit dure 30 jours et inclut toutes les fonctionnalités du Plan Pro. Vous pouvez choisir votre plan à tout moment dans Paramètres > Abonnement.'
      },
    ],
  },
  {
    id: 'devis-factures',
    title: 'Devis & Factures',
    icon: <FileText className="w-6 h-6" />,
    description: 'Créer, envoyer et gérer vos documents',
    faqs: [
      {
        question: 'Comment créer un devis ?',
        answer: 'Cliquez sur Devis > Nouveau devis. Sélectionnez un client, ajoutez des lignes (pièces, surfaces, poudres), et le calcul se fait automatiquement. Vous pouvez prévisualiser et envoyer par email.'
      },
      {
        question: 'Comment transformer un devis en facture ?',
        answer: 'Ouvrez le devis accepté et cliquez sur "Convertir en facture". Toutes les informations sont reprisées. Vous pouvez aussi générer la facture depuis le projet associé.'
      },
      {
        question: 'Puis-je personnaliser mes templates PDF ?',
        answer: 'Oui ! Allez dans Paramètres > Templates. Vous avez 4 designs au choix (Classic, Modern, Industrial, Premium) avec possibilité d\'ajouter votre logo et personnaliser les couleurs.'
      },
      {
        question: 'Les mentions légales sont-elles incluses ?',
        answer: 'Oui, automatiquement. Vos factures incluent les CGV, pénalités de retard (art. L441-10), indemnité forfaitaire de 40€ (art. D441-5). Les devis B2C incluent le droit de rétractation 14 jours.'
      },
    ],
  },
  {
    id: 'projets',
    title: 'Suivi de projets',
    icon: <Package className="w-6 h-6" />,
    description: 'Gérer le cycle de vie de vos projets',
    faqs: [
      {
        question: 'Comment suivre l\'avancement d\'un projet ?',
        answer: 'Chaque projet a une timeline visuelle montrant les étapes : Réception → Préparation → Production → Cuisson → Contrôle Qualité → Livraison. Vous pouvez ajouter des photos et commentaires à chaque étape.'
      },
      {
        question: 'Mes clients peuvent-ils suivre leurs projets ?',
        answer: 'Oui ! Activez le portail client dans Paramètres. Vos clients reçoivent un lien pour suivre l\'avancement en temps réel, voir les photos et communiquer avec vous via la messagerie intégrée.'
      },
      {
        question: 'Comment gérer les retouches ?',
        answer: 'Si un contrôle qualité révèle un défaut, marquez le projet en "Retouche". Le système crée automatiquement une sous-tâche et notifie l\'équipe.'
      },
    ],
  },
  {
    id: 'clients',
    title: 'Gestion clients (CRM)',
    icon: <Users className="w-6 h-6" />,
    description: 'Gérer vos contacts et relations client',
    faqs: [
      {
        question: 'Comment importer mes clients existants ?',
        answer: 'Pour l\'instant, les clients se créent un par un via Clients > Nouveau client. L\'import CSV est prévu dans une prochaine version.'
      },
      {
        question: 'Quelle est la différence entre client particulier et professionnel ?',
        answer: 'Les clients professionnels peuvent avoir un SIRET, une TVA intracommunautaire, et les mentions légales sur les devis sont adaptées (pas de droit de rétractation). Les particuliers bénéficient des protections du Code de la consommation.'
      },
    ],
  },
  {
    id: 'stock',
    title: 'Gestion du stock',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'Suivre vos poudres, pesées et alertes',
    faqs: [
      {
        question: 'Comment fonctionnent les pesées ?',
        answer: 'Dans Stock > Pesées, enregistrez le poids de chaque pot de poudre. Le système calcule automatiquement la consommation et les écarts par rapport aux estimations théoriques.'
      },
      {
        question: 'Comment configurer les alertes de stock ?',
        answer: 'Pour chaque poudre, définissez un seuil minimum dans sa fiche. Quand le stock passe sous ce seuil, une alerte apparaît sur le dashboard et une notification est envoyée.'
      },
    ],
  },
  {
    id: 'equipe',
    title: 'Équipe & Permissions',
    icon: <Shield className="w-6 h-6" />,
    description: 'Gérer les accès et rôles',
    faqs: [
      {
        question: 'Quels sont les différents rôles ?',
        answer: 'Owner (accès total), Admin (gestion complète sauf suppression atelier), Manager (devis/factures/projets), Opérateur (production/stock uniquement), Commercial (clients/devis uniquement).'
      },
      {
        question: 'Comment inviter un collaborateur ?',
        answer: 'Allez dans Équipe > Inviter. Renseignez l\'email et le rôle souhaité. La personne recevra un email d\'invitation avec un lien de connexion.'
      },
    ],
  },
  {
    id: 'facturation',
    title: 'Paiement & Abonnement',
    icon: <CreditCard className="w-6 h-6" />,
    description: 'Gérer votre abonnement ThermoGestion',
    faqs: [
      {
        question: 'Quels sont les plans disponibles ?',
        answer: 'Plan Lite à 29€/mois HT (CRM, devis, factures, suivi projets) et Plan Pro à 49€/mois HT (tout Lite + séries, stock intelligent, reporting avancé, portail client, templates personnalisables).'
      },
      {
        question: 'Puis-je changer de plan ?',
        answer: 'Oui, à tout moment dans Paramètres > Abonnement. Le changement est immédiat et le prorata est calculé automatiquement.'
      },
      {
        question: 'Comment annuler mon abonnement ?',
        answer: 'Dans Paramètres > Abonnement > Gérer. L\'annulation prend effet à la fin de la période en cours. Vos données restent accessibles pendant 30 jours supplémentaires.'
      },
    ],
  },
  {
    id: 'parametres',
    title: 'Paramètres',
    icon: <Settings className="w-6 h-6" />,
    description: 'Configurer l\'application',
    faqs: [
      {
        question: 'Comment configurer l\'envoi d\'emails ?',
        answer: 'Dans Paramètres > Email. Vous pouvez utiliser le service intégré (Resend) ou configurer votre propre serveur SMTP. L\'email de l\'expéditeur sera celui de votre atelier.'
      },
      {
        question: 'Comment changer mon mot de passe ?',
        answer: 'Allez dans Paramètres > Sécurité ou cliquez sur votre avatar > Mon compte. Vous pouvez aussi activer l\'authentification à deux facteurs (2FA) pour plus de sécurité.'
      },
    ],
  },
]

export default function AidePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('demarrage')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  // Filtrer les FAQs par recherche
  const filteredCategories = searchQuery
    ? helpCategories
        .map(cat => ({
          ...cat,
          faqs: cat.faqs.filter(
            faq =>
              faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(cat => cat.faqs.length > 0)
    : helpCategories

  const totalFaqs = helpCategories.reduce((acc, cat) => acc + cat.faqs.length, 0)

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl mb-4">
          <HelpCircle className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          Centre d&apos;aide
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {totalFaqs} articles pour vous aider à maîtriser ThermoGestion
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="relative max-w-2xl mx-auto mb-10">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher dans l'aide..."
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
          aria-label="Rechercher dans le centre d'aide"
        />
      </div>

      {/* Raccourcis rapides */}
      {!searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <Link
            href="/app/onboarding"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-xl hover:shadow-md transition-all"
          >
            <Zap className="w-8 h-8 text-orange-500" />
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Guide de démarrage</p>
              <p className="text-xs text-gray-500">Configuration pas à pas</p>
            </div>
          </Link>
          <Link
            href="/app/parametres"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:shadow-md transition-all"
          >
            <Settings className="w-8 h-8 text-blue-500" />
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Paramètres atelier</p>
              <p className="text-xs text-gray-500">Logo, SIRET, templates</p>
            </div>
          </Link>
          <a
            href="mailto:support@thermogestion.fr"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl hover:shadow-md transition-all"
          >
            <MessageSquare className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Contacter le support</p>
              <p className="text-xs text-gray-500">Réponse sous 24h</p>
            </div>
          </a>
        </div>
      )}

      {/* Catégories & FAQs */}
      <div className="space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Aucun résultat pour &quot;{searchQuery}&quot;
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Essayez avec d&apos;autres termes ou{' '}
              <a href="mailto:support@thermogestion.fr" className="text-orange-500 hover:underline">
                contactez le support
              </a>
            </p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Catégorie header */}
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === category.id ? null : category.id)
                }
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                aria-expanded={expandedCategory === category.id}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-500">
                    {category.icon}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">{category.title}</h2>
                    <p className="text-sm text-gray-500">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-1 rounded-full">
                    {category.faqs.length} articles
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedCategory === category.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* FAQs */}
              {expandedCategory === category.id && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {category.faqs.map((faq, faqIndex) => {
                    const faqKey = `${category.id}-${faqIndex}`
                    return (
                      <div
                        key={faqIndex}
                        className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <button
                          onClick={() =>
                            setExpandedFaq(expandedFaq === faqKey ? null : faqKey)
                          }
                          className="w-full flex items-center justify-between p-4 pl-20 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                          aria-expanded={expandedFaq === faqKey}
                        >
                          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm pr-4">
                            {faq.question}
                          </span>
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                              expandedFaq === faqKey ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        {expandedFaq === faqKey && (
                          <div className="px-20 pb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Lien vers la page de config si pertinent */}
                  {category.link && (
                    <div className="p-4 pl-20 bg-gray-50 dark:bg-gray-700/30">
                      <Link
                        href={category.link}
                        className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600 font-medium"
                      >
                        Accéder à cette section
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bloc contact */}
      <div className="mt-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-8 text-white text-center">
        <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-90" />
        <h2 className="text-2xl font-bold mb-2">Besoin d&apos;aide supplémentaire ?</h2>
        <p className="opacity-90 mb-6 max-w-lg mx-auto">
          Notre équipe est disponible du lundi au vendredi, de 9h à 18h. 
          Réponse garantie sous 24 heures ouvrées.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:support@thermogestion.fr"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Envoyer un email
          </a>
          <Link
            href="/app/onboarding"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-colors"
          >
            <Book className="w-4 h-4" />
            Revoir le guide
          </Link>
        </div>
      </div>
    </div>
  )
}
