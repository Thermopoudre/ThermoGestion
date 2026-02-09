import { Rocket, CheckCircle, Clock, Zap, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export const metadata: Metadata = {
  title: 'Roadmap — ThermoGestion',
  description: 'Découvrez les fonctionnalités à venir sur ThermoGestion. Transparence totale sur notre feuille de route.',
}

const ROADMAP = [
  {
    status: 'released',
    label: 'Disponible',
    color: 'bg-green-500',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    items: [
      { title: 'Devis & Factures PDF pro', desc: 'Templates personnalisables, signature électronique, Factur-X' },
      { title: 'Portail client', desc: 'Espace client avec suivi projets, documents, messages' },
      { title: 'Gestion stock poudres', desc: 'Stock intelligent, pesées, alertes, péremption' },
      { title: 'Planning & séries', desc: 'Calendrier, batching par couleur, capacity planning' },
      { title: 'QR codes & scan atelier', desc: 'Étiquettes imprimables, scan pour mise à jour statut' },
      { title: 'Exports comptables', desc: 'CSV, FEC, exports comptables conformes' },
      { title: 'Dashboard & statistiques', desc: 'KPIs, CA, conversion devis, top clients/poudres' },
      { title: 'Contrôle qualité', desc: 'Checklist configurable, retouches, mesure épaisseur µm' },
      { title: 'Notifications push & email', desc: 'Alertes temps réel, emails automatiques' },
      { title: 'Mode hors ligne (PWA)', desc: 'Utilisation sans connexion, sync automatique' },
      { title: 'Écran atelier TV', desc: 'Dashboard temps réel pour grands écrans' },
      { title: 'Consommables', desc: 'Gestion filtres, EPI, produits chimiques' },
      { title: 'Conformité RGPD', desc: 'DPA, politique retention, export/suppression données' },
    ],
  },
  {
    status: 'in_progress',
    label: 'En cours',
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    items: [
      { title: 'Certifications QUALICOAT/Qualimarine', desc: 'Badge certification, traçabilité audit, rapport inspection' },
      { title: 'Maintenance préventive équipements', desc: 'Alertes révision four/cabine, historique maintenances' },
      { title: 'Grille tarifaire avancée', desc: 'Prix par palier, majorations finition, forfaits minimum' },
      { title: 'Optimisation chargement four', desc: 'Suggestion optimisation pièces dans le four' },
      { title: 'Prévisionnel CA', desc: 'Projection mensuelle basée sur devis + taux conversion' },
    ],
  },
  {
    status: 'planned',
    label: 'Planifié',
    color: 'bg-orange-500',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    items: [
      { title: 'Connexion Pennylane', desc: 'Synchronisation comptabilité automatique' },
      { title: 'API publique REST', desc: 'API documentée pour intégrations tierces' },
      { title: 'Webhooks configurables', desc: 'Événements temps réel vers vos outils' },
      { title: 'Blog & ressources SEO', desc: 'Articles métier thermolaquage, guides' },
      { title: 'Multi-langue', desc: 'Anglais, espagnol, italien' },
      { title: 'Paiement SEPA GoCardless', desc: 'Prélèvement SEPA pour clients B2B' },
      { title: 'Module Jantes complet', desc: 'Gestion jantes, véhicules de prêt, tarification' },
    ],
  },
  {
    status: 'future',
    label: 'Futur',
    color: 'bg-purple-500',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    items: [
      { title: 'Application mobile native', desc: 'iOS & Android avec scan caméra optimisé' },
      { title: 'Intégration machines (IoT)', desc: 'Connexion four, balance, cabine' },
      { title: 'Marketplace poudres', desc: 'Commander poudres directement depuis l\'app' },
      { title: 'IA prédictive avancée', desc: 'Prédiction délais, détection anomalies, chatbot' },
      { title: 'Multi-sites', desc: 'Gestion de plusieurs ateliers, stats consolidées' },
    ],
  },
]

const statusIcons = {
  released: CheckCircle,
  in_progress: Zap,
  planned: Clock,
  future: Rocket,
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-orange-500/20 rounded-2xl flex items-center justify-center">
            <Rocket className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Roadmap <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">ThermoGestion</span></h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Notre feuille de route est publique. Découvrez les fonctionnalités disponibles, en cours et à venir.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        {ROADMAP.map(section => {
          const Icon = statusIcons[section.status as keyof typeof statusIcons]
          return (
            <section key={section.status}>
              <div className="flex items-center gap-3 mb-6">
                <span className={`w-3 h-3 rounded-full ${section.color}`} />
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Icon className={`w-6 h-6 ${section.textColor}`} />
                  {section.label}
                </h2>
                <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-sm text-gray-400">
                  {section.items.length}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {section.items.map(item => (
                  <div key={item.title} className={`bg-gray-900/80 rounded-xl p-5 border border-gray-800 hover:${section.borderColor} hover:shadow-md transition-all`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${section.color}`} />
                      <div>
                        <h3 className="font-bold text-white">{item.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        <section className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl p-8 text-center border border-orange-500/20">
          <h3 className="text-xl font-bold mb-2 text-white">Une idée de fonctionnalité ?</h3>
          <p className="text-gray-400 mb-4">
            Vos retours orientent notre développement. Partagez vos besoins !
          </p>
          <a href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-400 hover:to-red-500 font-bold transition-all">
            Suggérer une fonctionnalité <ArrowRight className="w-4 h-4" />
          </a>
        </section>
      </div>

      <VitrineFooter />
    </div>
  )
}
