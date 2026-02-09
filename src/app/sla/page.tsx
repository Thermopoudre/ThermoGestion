import { Shield, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SLA — Engagements de service — ThermoGestion',
  description: 'Nos engagements de niveau de service (SLA) : uptime garanti, temps de réponse, compensation.',
}

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-blue-300" />
          <h1 className="text-4xl font-black mb-4">Engagements de Service (SLA)</h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Votre activité dépend de nos services. Nous nous engageons contractuellement sur la disponibilité et la performance.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Uptime garanti */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Disponibilité garantie
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-lg mb-2">Plan Lite</h3>
              <div className="text-5xl font-black text-blue-600 mb-2">99,5%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Soit maximum <strong>3h36 de downtime</strong> par mois
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-800">
              <h3 className="font-bold text-lg mb-2">Plan Pro</h3>
              <div className="text-5xl font-black text-orange-600 mb-2">99,9%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Soit maximum <strong>43 minutes de downtime</strong> par mois
              </p>
            </div>
          </div>
        </section>

        {/* Temps de réponse */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            Temps de réponse
          </h2>
          <div className="space-y-4">
            {[
              { metric: 'Temps de réponse application', target: '< 2 secondes', desc: '95% des requêtes' },
              { metric: 'Génération PDF', target: '< 5 secondes', desc: 'Devis et factures' },
              { metric: 'Temps de réponse API', target: '< 500 ms', desc: '99% des appels API' },
              { metric: 'Upload photos', target: '< 10 secondes', desc: 'Compression et stockage' },
            ].map(({ metric, target, desc }) => (
              <div key={metric} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <div className="font-medium">{metric}</div>
                  <div className="text-sm text-gray-500">{desc}</div>
                </div>
                <div className="font-mono font-bold text-green-600">{target}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Maintenance */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Maintenance planifiée</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div><strong>Fenêtre de maintenance :</strong> Dimanche 2h00 - 6h00 (heure de Paris)</div>
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div><strong>Notification préalable :</strong> 48h minimum avant toute maintenance planifiée</div>
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div><strong>Impact SLA :</strong> La maintenance planifiée dans la fenêtre horaire ne compte pas comme downtime</div>
            </li>
          </ul>
        </section>

        {/* Compensation */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Compensation en cas de non-respect
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Uptime mensuel</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Crédit facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[
                  { range: '99,0% - 99,5% (Lite) / 99,5% - 99,9% (Pro)', credit: '10%' },
                  { range: '95,0% - 99,0%', credit: '25%' },
                  { range: '< 95,0%', credit: '50%' },
                ].map(row => (
                  <tr key={row.range}>
                    <td className="px-4 py-3 text-sm">{row.range}</td>
                    <td className="px-4 py-3 text-center font-bold text-orange-600">{row.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Le crédit est automatiquement appliqué sur la prochaine facture d&apos;abonnement.
          </p>
        </section>

        {/* Gestion incidents */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Gestion des incidents</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { severity: 'Critique', time: '< 30 min', desc: 'Service indisponible. Communication < 30 min aux ateliers.', color: 'border-red-500' },
              { severity: 'Majeur', time: '< 2h', desc: 'Fonctionnalité importante dégradée. Résolution sous 24h.', color: 'border-amber-500' },
              { severity: 'Mineur', time: '< 24h', desc: 'Anomalie non bloquante. Correction planifiée.', color: 'border-blue-500' },
            ].map(({ severity, time, desc, color }) => (
              <div key={severity} className={`rounded-xl p-4 border-l-4 ${color} bg-gray-50 dark:bg-gray-700/50`}>
                <div className="font-bold">{severity}</div>
                <div className="text-sm font-mono text-orange-600 mb-2">Réponse: {time}</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Post-mortem */}
        <section className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-4">Post-mortem public</h2>
          <p className="text-gray-600 dark:text-gray-400">
            En cas d&apos;incident majeur (&gt; 1h de downtime), un rapport post-mortem public est publié sous 72h, détaillant les causes, les actions correctives et les mesures préventives mises en place. Ces rapports sont disponibles sur notre <a href="/status" className="text-blue-600 hover:underline">page de statut</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
