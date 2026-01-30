import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'

// In production, this would come from a monitoring service like UptimeRobot, Pingdom, or custom monitoring
const services = [
  {
    name: 'Application Web',
    description: 'Interface principale ThermoGestion',
    status: 'operational',
    uptime: 99.98,
  },
  {
    name: 'API',
    description: 'Endpoints REST pour les intégrations',
    status: 'operational',
    uptime: 99.95,
  },
  {
    name: 'Base de données',
    description: 'Stockage et récupération des données',
    status: 'operational',
    uptime: 99.99,
  },
  {
    name: 'Authentification',
    description: 'Connexion et gestion des sessions',
    status: 'operational',
    uptime: 99.97,
  },
  {
    name: 'Envoi d\'emails',
    description: 'Notifications et relances automatiques',
    status: 'operational',
    uptime: 99.90,
  },
  {
    name: 'Génération PDF',
    description: 'Création des devis et factures',
    status: 'operational',
    uptime: 99.85,
  },
  {
    name: 'Paiements (Stripe)',
    description: 'Traitement des paiements en ligne',
    status: 'operational',
    uptime: 99.99,
  },
  {
    name: 'Stockage fichiers',
    description: 'Upload et stockage des documents',
    status: 'operational',
    uptime: 99.95,
  },
]

const incidents = [
  {
    id: 1,
    date: '2026-01-15',
    title: 'Maintenance planifiée',
    description: 'Mise à jour de la base de données pour améliorer les performances.',
    status: 'resolved',
    duration: '15 min',
  },
  {
    id: 2,
    date: '2026-01-10',
    title: 'Ralentissement API',
    description: 'Temps de réponse élevés sur certains endpoints. Résolu par optimisation des requêtes.',
    status: 'resolved',
    duration: '45 min',
  },
]

const uptimeHistory = [
  { date: 'Aujourd\'hui', status: 'operational' },
  { date: 'Hier', status: 'operational' },
  { date: '19 Jan', status: 'operational' },
  { date: '18 Jan', status: 'operational' },
  { date: '17 Jan', status: 'operational' },
  { date: '16 Jan', status: 'operational' },
  { date: '15 Jan', status: 'maintenance' },
  { date: '14 Jan', status: 'operational' },
  { date: '13 Jan', status: 'operational' },
  { date: '12 Jan', status: 'operational' },
  { date: '11 Jan', status: 'operational' },
  { date: '10 Jan', status: 'degraded' },
  { date: '9 Jan', status: 'operational' },
  { date: '8 Jan', status: 'operational' },
]

export default function StatusPage() {
  const allOperational = services.every(s => s.status === 'operational')
  const avgUptime = (services.reduce((acc, s) => acc + s.uptime, 0) / services.length).toFixed(2)

  const statusConfig = {
    operational: { label: 'Opérationnel', color: 'text-green-600', bg: 'bg-green-500', icon: CheckCircle },
    degraded: { label: 'Dégradé', color: 'text-yellow-600', bg: 'bg-yellow-500', icon: AlertTriangle },
    outage: { label: 'Panne', color: 'text-red-600', bg: 'bg-red-500', icon: XCircle },
    maintenance: { label: 'Maintenance', color: 'text-blue-600', bg: 'bg-blue-500', icon: Clock },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className={`${allOperational ? 'bg-green-500' : 'bg-yellow-500'} text-white py-16`}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {allOperational ? (
              <CheckCircle className="w-12 h-12" />
            ) : (
              <AlertTriangle className="w-12 h-12" />
            )}
          </div>
          <h1 className="text-4xl font-black mb-2">
            {allOperational ? 'Tous les systèmes sont opérationnels' : 'Certains systèmes rencontrent des problèmes'}
          </h1>
          <p className="opacity-90">
            Uptime moyen sur 30 jours : {avgUptime}%
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Uptime History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Historique des 14 derniers jours
          </h2>
          <div className="flex gap-1">
            {uptimeHistory.map((day, index) => (
              <div key={index} className="flex-1 group relative">
                <div 
                  className={`h-10 rounded ${statusConfig[day.status as keyof typeof statusConfig]?.bg || 'bg-gray-300'}`}
                  title={`${day.date}: ${statusConfig[day.status as keyof typeof statusConfig]?.label}`}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {day.date}: {statusConfig[day.status as keyof typeof statusConfig]?.label}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>14 jours</span>
            <span>Aujourd'hui</span>
          </div>
        </div>

        {/* Services Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            État des services
          </h2>
          <div className="space-y-4">
            {services.map((service, index) => {
              const config = statusConfig[service.status as keyof typeof statusConfig]
              const Icon = config?.icon || CheckCircle
              return (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <Icon className={`w-6 h-6 ${config?.color}`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{service.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      service.status === 'operational' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {config?.label}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{service.uptime}% uptime</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Incidents récents
          </h2>
          {incidents.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Aucun incident récent
            </p>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white">{incident.title}</h3>
                    <span className="text-sm text-gray-500">{incident.date}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{incident.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded">
                      Résolu
                    </span>
                    <span className="text-xs text-gray-500">Durée : {incident.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscribe */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 text-white text-center">
          <h2 className="text-xl font-bold mb-2">Recevoir les alertes de statut</h2>
          <p className="opacity-90 mb-4">Soyez notifié en cas d'incident ou de maintenance</p>
          <div className="flex max-w-md mx-auto gap-2">
            <input
              type="email"
              placeholder="votre@email.com"
              className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-white"
            />
            <button className="px-6 py-2 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors">
              S'abonner
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Dernière mise à jour : {new Date().toLocaleString('fr-FR')}</p>
          <p className="mt-2">
            <a href="/" className="text-orange-500 hover:underline">← Retour à ThermoGestion</a>
          </p>
        </div>
      </div>
    </div>
  )
}
