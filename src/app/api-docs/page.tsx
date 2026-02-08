import { Code, Key, Book, Zap, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const endpoints = [
  {
    method: 'GET',
    path: '/api/v1/clients',
    description: 'Liste tous vos clients',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/v1/clients',
    description: 'Créer un nouveau client',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/devis',
    description: 'Liste tous vos devis',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/v1/devis',
    description: 'Créer un nouveau devis',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/projets',
    description: 'Liste tous vos projets',
    auth: true,
  },
  {
    method: 'PATCH',
    path: '/api/v1/projets/:id/status',
    description: 'Mettre à jour le statut d\'un projet',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/factures',
    description: 'Liste toutes vos factures',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/poudres',
    description: 'Liste votre catalogue de poudres',
    auth: true,
  },
]

const webhookEvents = [
  { event: 'devis.created', description: 'Un nouveau devis a été créé' },
  { event: 'devis.signed', description: 'Un devis a été signé par le client' },
  { event: 'projet.status_changed', description: 'Le statut d\'un projet a changé' },
  { event: 'projet.completed', description: 'Un projet est terminé' },
  { event: 'facture.created', description: 'Une nouvelle facture a été créée' },
  { event: 'facture.paid', description: 'Une facture a été payée' },
]

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-10 h-10 text-orange-400" />
            <h1 className="text-4xl font-black">API Documentation</h1>
          </div>
          <p className="text-xl text-gray-300 mb-6">
            Intégrez ThermoGestion à vos outils existants
          </p>
          <div className="flex gap-4">
            <a 
              href="#getting-started" 
              className="px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors"
            >
              Commencer
            </a>
            <a 
              href="#endpoints" 
              className="px-6 py-3 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-colors"
            >
              Voir les endpoints
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Getting Started */}
        <section id="getting-started" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            🚀 Démarrage rapide
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-500" />
              1. Obtenir votre clé API
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Générez une clé API depuis votre dashboard : 
              <strong> Paramètres → Intégrations → Clés API</strong>
            </p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400">
              <span className="text-gray-500"># Votre clé API ressemble à ceci</span><br/>
              tg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-500" />
              2. Authentification
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Incluez votre clé API dans le header de chaque requête :
            </p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <span className="text-purple-400">curl</span> <span className="text-green-400">-X GET</span> \<br/>
              &nbsp;&nbsp;<span className="text-yellow-400">"https://api.thermogestion.fr/v1/clients"</span> \<br/>
              &nbsp;&nbsp;<span className="text-blue-400">-H</span> <span className="text-green-400">"Authorization: Bearer tg_live_xxxxx"</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              3. Votre première requête
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Récupérez la liste de vos clients :
            </p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <span className="text-gray-500">{/* Response */}</span><br/>
              {'{'}<br/>
              &nbsp;&nbsp;<span className="text-blue-400">"data"</span>: [<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;{'{'}<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-400">"id"</span>: <span className="text-green-400">"uuid-xxx"</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-400">"full_name"</span>: <span className="text-green-400">"Jean Dupont"</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-400">"email"</span>: <span className="text-green-400">"jean@example.com"</span><br/>
              &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
              &nbsp;&nbsp;],<br/>
              &nbsp;&nbsp;<span className="text-blue-400">"total"</span>: <span className="text-yellow-400">42</span><br/>
              {'}'}
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            📡 Endpoints disponibles
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {endpoints.map((endpoint, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                        endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                        endpoint.method === 'PATCH' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white">
                      {endpoint.path}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {endpoint.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Webhooks */}
        <section id="webhooks" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            🔔 Webhooks
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Recevez des notifications en temps réel lorsque des événements se produisent dans ThermoGestion.
              Configurez vos webhooks dans <strong>Paramètres → Intégrations → Webhooks</strong>.
            </p>
            
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Événements disponibles</h3>
            <div className="space-y-2">
              {webhookEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <code className="text-sm font-mono text-orange-600 dark:text-orange-400">{event.event}</code>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{event.description}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            ⚡ Limites de taux
          </h2>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <ul className="space-y-2 text-yellow-800 dark:text-yellow-200">
              <li>• <strong>100 requêtes / minute</strong> pour le plan Atelier</li>
              <li>• <strong>1000 requêtes / minute</strong> pour le plan Pro</li>
              <li>• Headers de réponse : <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">X-RateLimit-Remaining</code></li>
            </ul>
          </div>
        </section>

        {/* Support */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-8 text-white text-center">
          <Book className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Besoin d'aide ?</h2>
          <p className="mb-6 opacity-90">Notre équipe technique est là pour vous accompagner</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:api@thermogestion.fr"
              className="px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
            >
              api@thermogestion.fr
            </a>
            <Link
              href="/app/aide"
              className="px-6 py-3 border-2 border-white text-white font-bold rounded-lg hover:bg-white/10 transition-colors"
            >
              Centre d'aide
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
