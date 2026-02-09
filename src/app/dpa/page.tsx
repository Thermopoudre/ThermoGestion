import type { Metadata } from 'next'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export const metadata: Metadata = {
  title: 'DPA — Accord de traitement des données — ThermoGestion',
  description: 'Data Processing Agreement (DPA) conforme RGPD pour les clients de ThermoGestion.',
}

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />

      <section className="pt-32 pb-20 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
            Accord de Traitement des Données (DPA)
          </h1>
          <p className="text-gray-400 mb-2">Data Processing Agreement — Conforme RGPD (Règlement UE 2016/679)</p>
          <p className="text-sm text-gray-500 mb-12">Dernière mise à jour : 8 février 2026</p>

          <div className="space-y-8">
            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 1 — Objet</h2>
              <p className="text-gray-300 leading-relaxed">Le présent accord de traitement des données (&quot;DPA&quot;) complète les Conditions Générales d&apos;Utilisation de ThermoGestion et définit les obligations des parties concernant la protection des données à caractère personnel, conformément au Règlement Général sur la Protection des Données (RGPD).</p>
              <ul className="mt-4 space-y-2 text-gray-300">
                <li><strong className="text-white">Responsable de traitement :</strong> L&apos;Atelier client (ci-après &quot;le Client&quot;)</li>
                <li><strong className="text-white">Sous-traitant :</strong> ThermoGestion SAS (ci-après &quot;le Prestataire&quot;)</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 2 — Données traitées</h2>
              <p className="text-gray-300 mb-4">Le Prestataire traite les catégories de données suivantes pour le compte du Client :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li><strong className="text-white">Données clients finaux :</strong> Nom, prénom, email, téléphone, adresse, SIRET (professionnels)</li>
                <li><strong className="text-white">Données projets :</strong> Descriptions, photos, paramètres techniques de thermolaquage</li>
                <li><strong className="text-white">Données financières :</strong> Devis, factures, paiements (via Stripe — sous-traitant ultérieur)</li>
                <li><strong className="text-white">Données de connexion :</strong> Logs d&apos;accès, adresses IP, timestamps</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 3 — Finalités du traitement</h2>
              <p className="text-gray-300 mb-4">Les données sont exclusivement traitées pour :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li>La gestion des devis, projets et factures du Client</li>
                <li>La communication avec les clients finaux du Client (emails, portail client)</li>
                <li>La génération de statistiques et rapports pour le Client</li>
                <li>La maintenance technique et la sécurité du service</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 4 — Durée de conservation</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Type de données</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Durée</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Base légale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-3 text-gray-400">Factures et pièces comptables</td><td className="px-4 py-3 text-orange-400 font-medium">10 ans</td><td className="px-4 py-3 text-gray-500">Obligation légale (Code de commerce)</td></tr>
                    <tr><td className="px-4 py-3 text-gray-400">Devis non acceptés</td><td className="px-4 py-3 text-orange-400 font-medium">3 ans</td><td className="px-4 py-3 text-gray-500">Prescription commerciale</td></tr>
                    <tr><td className="px-4 py-3 text-gray-400">Données clients actifs</td><td className="px-4 py-3 text-orange-400 font-medium">Durée du contrat + 3 ans</td><td className="px-4 py-3 text-gray-500">Intérêt légitime</td></tr>
                    <tr><td className="px-4 py-3 text-gray-400">Logs d&apos;audit</td><td className="px-4 py-3 text-orange-400 font-medium">2 ans</td><td className="px-4 py-3 text-gray-500">Sécurité</td></tr>
                    <tr><td className="px-4 py-3 text-gray-400">Logs applicatifs</td><td className="px-4 py-3 text-orange-400 font-medium">90 jours</td><td className="px-4 py-3 text-gray-500">Maintenance technique</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 5 — Sous-traitants ultérieurs</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Sous-traitant</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Service</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-700">Localisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-3 text-gray-300 font-medium">Supabase (AWS)</td><td className="px-4 py-3 text-gray-400">Base de données, authentification, stockage</td><td className="px-4 py-3 text-green-400">UE (eu-west-1)</td></tr>
                    <tr><td className="px-4 py-3 text-gray-300 font-medium">Vercel</td><td className="px-4 py-3 text-gray-400">Hébergement application</td><td className="px-4 py-3 text-green-400">UE (cdg1)</td></tr>
                    <tr><td className="px-4 py-3 text-gray-300 font-medium">Stripe</td><td className="px-4 py-3 text-gray-400">Paiements</td><td className="px-4 py-3 text-green-400">UE</td></tr>
                    <tr><td className="px-4 py-3 text-gray-300 font-medium">Resend</td><td className="px-4 py-3 text-gray-400">Envoi d&apos;emails transactionnels</td><td className="px-4 py-3 text-yellow-400">US (SCCs)</td></tr>
                    <tr><td className="px-4 py-3 text-gray-300 font-medium">Sentry</td><td className="px-4 py-3 text-gray-400">Monitoring erreurs (données anonymisées)</td><td className="px-4 py-3 text-yellow-400">US (SCCs)</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Pour les transferts hors UE, des Clauses Contractuelles Types (SCCs) approuvées par la Commission européenne sont en place.
              </p>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 6 — Sécurité</h2>
              <p className="text-gray-300 mb-4">Le Prestataire met en œuvre les mesures suivantes :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li>Chiffrement des données en transit (TLS 1.3) et au repos (AES-256)</li>
                <li>Isolation des données par atelier (Row Level Security PostgreSQL)</li>
                <li>Authentification à deux facteurs (2FA) pour les administrateurs</li>
                <li>Sauvegardes quotidiennes avec rétention 30 jours</li>
                <li>Monitoring continu avec alertes en temps réel (Sentry)</li>
                <li>Headers de sécurité OWASP (CSP, HSTS, X-Frame-Options)</li>
                <li>Audit de sécurité des dépendances automatisé (CI/CD)</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 7 — Droits des personnes concernées</h2>
              <p className="text-gray-300 mb-4">Le Prestataire assiste le Client dans l&apos;exercice des droits des personnes concernées :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li><strong className="text-white">Droit d&apos;accès :</strong> Export des données depuis le dashboard (format JSON/CSV)</li>
                <li><strong className="text-white">Droit de rectification :</strong> Modification directe dans l&apos;interface</li>
                <li><strong className="text-white">Droit à l&apos;effacement :</strong> Suppression sous 30 jours (sauf obligations légales)</li>
                <li><strong className="text-white">Droit à la portabilité :</strong> Export complet des données en format structuré</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 8 — Notification de violation</h2>
              <p className="text-gray-300 mb-4">En cas de violation de données à caractère personnel, le Prestataire s&apos;engage à :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li>Notifier le Client dans un délai maximum de <strong className="text-white">48 heures</strong> après prise de connaissance</li>
                <li>Fournir toutes les informations nécessaires (nature, catégories de données, mesures correctives)</li>
                <li>Assister le Client dans sa notification à la CNIL si nécessaire</li>
              </ul>
            </section>

            <section className="bg-gray-900/80 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 9 — Fin du contrat</h2>
              <p className="text-gray-300 mb-4">À la fin du contrat, le Prestataire s&apos;engage à :</p>
              <ul className="space-y-2 text-gray-300 list-disc ml-6">
                <li>Mettre à disposition un export complet des données sous 30 jours</li>
                <li>Supprimer toutes les données dans un délai de 90 jours (sauf obligations légales)</li>
                <li>Fournir une attestation de suppression sur demande</li>
              </ul>
            </section>

            <section className="bg-gray-800/30 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4">Article 10 — Contact DPO</h2>
              <p className="text-gray-300 mb-2">Pour toute question relative à la protection des données :</p>
              <p className="font-medium text-orange-400">dpo@thermogestion.fr</p>
            </section>
          </div>
        </div>
      </section>

      <VitrineFooter />
    </div>
  )
}
