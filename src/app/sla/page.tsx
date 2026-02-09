import { Shield, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export const metadata: Metadata = {
  title: 'SLA — Engagements de service — ThermoGestion',
  description: 'Nos engagements de niveau de service (SLA) : uptime garanti, temps de réponse, compensation.',
}

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-orange-500/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Engagements de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Service (SLA)</span></h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Votre activité dépend de nos services. Nous nous engageons contractuellement sur la disponibilité et la performance.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-16 space-y-10">
        {/* Uptime garanti */}
        <section className="bg-gray-900/80 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
            <CheckCircle className="w-6 h-6 text-green-500" />
            Disponibilité garantie
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="font-bold text-lg mb-2 text-gray-300">Plan Lite</h3>
              <div className="text-5xl font-black text-orange-400 mb-2">99,5%</div>
              <p className="text-sm text-gray-500">
                Soit maximum <strong className="text-gray-300">3h36 de downtime</strong> par mois
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-500/20">
              <h3 className="font-bold text-lg mb-2 text-orange-300">Plan Pro</h3>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2">99,9%</div>
              <p className="text-sm text-gray-400">
                Soit maximum <strong className="text-gray-200">43 minutes de downtime</strong> par mois
              </p>
            </div>
          </div>
        </section>

        {/* Temps de réponse */}
        <section className="bg-gray-900/80 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
            <Clock className="w-6 h-6 text-orange-400" />
            Temps de réponse
          </h2>
          <div className="space-y-1">
            {[
              { metric: 'Temps de réponse application', target: '< 2 secondes', desc: '95% des requêtes' },
              { metric: 'Génération PDF', target: '< 5 secondes', desc: 'Devis et factures' },
              { metric: 'Temps de réponse API', target: '< 500 ms', desc: '99% des appels API' },
              { metric: 'Upload photos', target: '< 10 secondes', desc: 'Compression et stockage' },
            ].map(({ metric, target, desc }) => (
              <div key={metric} className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
                <div>
                  <div className="font-medium text-gray-200">{metric}</div>
                  <div className="text-sm text-gray-500">{desc}</div>
                </div>
                <div className="font-mono font-bold text-green-400">{target}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Maintenance */}
        <section className="bg-gray-900/80 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-2xl font-bold mb-6 text-white">Maintenance planifiée</h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-gray-300"><strong className="text-white">Fenêtre de maintenance :</strong> Dimanche 2h00 - 6h00 (heure de Paris)</div>
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-gray-300"><strong className="text-white">Notification préalable :</strong> 48h minimum avant toute maintenance planifiée</div>
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-gray-300"><strong className="text-white">Impact SLA :</strong> La maintenance planifiée dans la fenêtre horaire ne compte pas comme downtime</div>
            </li>
          </ul>
        </section>

        {/* Compensation */}
        <section className="bg-gray-900/80 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Compensation en cas de non-respect
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uptime mensuel</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Crédit facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { range: '99,0% - 99,5% (Lite) / 99,5% - 99,9% (Pro)', credit: '10%' },
                  { range: '95,0% - 99,0%', credit: '25%' },
                  { range: '< 95,0%', credit: '50%' },
                ].map(row => (
                  <tr key={row.range}>
                    <td className="px-4 py-3 text-sm text-gray-400">{row.range}</td>
                    <td className="px-4 py-3 text-center font-bold text-orange-400">{row.credit}</td>
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
        <section className="bg-gray-900/80 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-2xl font-bold mb-6 text-white">Gestion des incidents</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { severity: 'Critique', time: '< 30 min', desc: 'Service indisponible. Communication < 30 min aux ateliers.', color: 'border-red-500/50 bg-red-500/5' },
              { severity: 'Majeur', time: '< 2h', desc: 'Fonctionnalité importante dégradée. Résolution sous 24h.', color: 'border-amber-500/50 bg-amber-500/5' },
              { severity: 'Mineur', time: '< 24h', desc: 'Anomalie non bloquante. Correction planifiée.', color: 'border-blue-500/50 bg-blue-500/5' },
            ].map(({ severity, time, desc, color }) => (
              <div key={severity} className={`rounded-xl p-4 border-l-4 ${color}`}>
                <div className="font-bold text-white">{severity}</div>
                <div className="text-sm font-mono text-orange-400 mb-2">Réponse: {time}</div>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Post-mortem */}
        <section className="bg-gray-800/30 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 text-white">Post-mortem public</h2>
          <p className="text-gray-400">
            En cas d&apos;incident majeur (&gt; 1h de downtime), un rapport post-mortem public est publié sous 72h, détaillant les causes, les actions correctives et les mesures préventives mises en place. Ces rapports sont disponibles sur notre <a href="/status" className="text-orange-400 hover:underline">page de statut</a>.
          </p>
        </section>
      </div>

      <VitrineFooter />
    </div>
  )
}
