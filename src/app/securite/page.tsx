import { Shield, Lock, Server, Eye, FileCheck, Users, Globe, Clock } from 'lucide-react'

const securityFeatures = [
  {
    icon: Lock,
    title: 'Chiffrement de bout en bout',
    description: 'Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256).',
  },
  {
    icon: Server,
    title: 'Infrastructure sécurisée',
    description: 'Hébergement sur Vercel et Supabase avec certifications SOC 2 Type II et ISO 27001.',
  },
  {
    icon: Eye,
    title: 'Protection des données',
    description: 'Accès aux données strictement limité. Aucune donnée n\'est partagée avec des tiers.',
  },
  {
    icon: FileCheck,
    title: 'Sauvegardes automatiques',
    description: 'Sauvegardes quotidiennes avec rétention de 30 jours. Récupération possible à tout moment.',
  },
  {
    icon: Users,
    title: 'Gestion des accès',
    description: 'Système de rôles granulaire (Admin, Commercial, Opérateur) avec isolation des données.',
  },
  {
    icon: Globe,
    title: 'Hébergement en Europe',
    description: 'Données hébergées dans des datacenters européens, conformes au RGPD.',
  },
]

const certifications = [
  { name: 'RGPD', description: 'Conforme au Règlement Général sur la Protection des Données' },
  { name: 'SOC 2 Type II', description: 'Via notre partenaire Supabase' },
  { name: 'ISO 27001', description: 'Via notre partenaire Vercel' },
  { name: 'PCI DSS', description: 'Paiements sécurisés via Stripe' },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-green-400" />
          <h1 className="text-4xl font-black mb-4">
            Sécurité & Confidentialité
          </h1>
          <p className="text-xl text-gray-300">
            La protection de vos données est notre priorité absolue
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Security Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Certifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Certifications & Conformité
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {certifications.map((cert, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white">{cert.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RGPD Section */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
            🇪🇺 Conformité RGPD
          </h2>
          <div className="space-y-4 text-blue-800 dark:text-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-green-500">✓</span>
              <div>
                <strong>Droit d'accès</strong>
                <p className="text-sm opacity-80">Exportez toutes vos données à tout moment depuis votre compte</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500">✓</span>
              <div>
                <strong>Droit de rectification</strong>
                <p className="text-sm opacity-80">Modifiez vos informations personnelles à tout moment</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500">✓</span>
              <div>
                <strong>Droit à l'effacement</strong>
                <p className="text-sm opacity-80">Demandez la suppression complète de vos données</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500">✓</span>
              <div>
                <strong>Droit à la portabilité</strong>
                <p className="text-sm opacity-80">Récupérez vos données dans un format standard (JSON, CSV)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Infrastructure technique
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-6 h-6 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Hébergement application</p>
                  <p className="text-sm text-gray-500">Vercel (Edge Network)</p>
                </div>
              </div>
              <span className="text-green-500">✓ SOC 2</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-6 h-6 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Base de données</p>
                  <p className="text-sm text-gray-500">Supabase (PostgreSQL)</p>
                </div>
              </div>
              <span className="text-green-500">✓ SOC 2 Type II</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Paiements</p>
                  <p className="text-sm text-gray-500">Stripe</p>
                </div>
              </div>
              <span className="text-green-500">✓ PCI DSS Level 1</span>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-8 mb-12">
          <div className="flex items-center gap-4 mb-4">
            <Clock className="w-8 h-8 text-green-600" />
            <div>
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-100">99.9% Uptime</h2>
              <p className="text-green-700 dark:text-green-300">Disponibilité garantie</p>
            </div>
          </div>
          <p className="text-green-800 dark:text-green-200">
            Consultez notre <a href="/status" className="underline font-medium">page de statut</a> pour suivre 
            la disponibilité de nos services en temps réel.
          </p>
        </div>

        {/* Contact */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Questions sur la sécurité ?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Notre équipe est disponible pour répondre à vos questions
          </p>
          <a
            href="mailto:securite@thermogestion.fr"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Shield className="w-5 h-5" />
            securite@thermogestion.fr
          </a>
        </div>
      </div>
    </div>
  )
}
