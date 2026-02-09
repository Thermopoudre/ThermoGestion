import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DPA — Accord de traitement des données — ThermoGestion',
  description: 'Data Processing Agreement (DPA) conforme RGPD pour les clients de ThermoGestion.',
}

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          Accord de Traitement des Données (DPA)
        </h1>
        <p className="text-gray-500 mb-8">Data Processing Agreement — Conforme RGPD (Règlement UE 2016/679)</p>
        <p className="text-sm text-gray-400 mb-12">Dernière mise à jour : 8 février 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold">Article 1 — Objet</h2>
            <p>Le présent accord de traitement des données (&quot;DPA&quot;) complète les Conditions Générales d&apos;Utilisation de ThermoGestion et définit les obligations des parties concernant la protection des données à caractère personnel, conformément au Règlement Général sur la Protection des Données (RGPD).</p>
            <ul>
              <li><strong>Responsable de traitement :</strong> L&apos;Atelier client (ci-après &quot;le Client&quot;)</li>
              <li><strong>Sous-traitant :</strong> ThermoGestion SAS (ci-après &quot;le Prestataire&quot;)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 2 — Données traitées</h2>
            <p>Le Prestataire traite les catégories de données suivantes pour le compte du Client :</p>
            <ul>
              <li><strong>Données clients finaux :</strong> Nom, prénom, email, téléphone, adresse, SIRET (professionnels)</li>
              <li><strong>Données projets :</strong> Descriptions, photos, paramètres techniques de thermolaquage</li>
              <li><strong>Données financières :</strong> Devis, factures, paiements (via Stripe — sous-traitant ultérieur)</li>
              <li><strong>Données de connexion :</strong> Logs d&apos;accès, adresses IP, timestamps</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 3 — Finalités du traitement</h2>
            <p>Les données sont exclusivement traitées pour :</p>
            <ul>
              <li>La gestion des devis, projets et factures du Client</li>
              <li>La communication avec les clients finaux du Client (emails, portail client)</li>
              <li>La génération de statistiques et rapports pour le Client</li>
              <li>La maintenance technique et la sécurité du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 4 — Durée de conservation</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-4 py-2 text-left border">Type de données</th>
                  <th className="px-4 py-2 text-left border">Durée</th>
                  <th className="px-4 py-2 text-left border">Base légale</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border">Factures et pièces comptables</td><td className="px-4 py-2 border">10 ans</td><td className="px-4 py-2 border">Obligation légale (Code de commerce)</td></tr>
                <tr><td className="px-4 py-2 border">Devis non acceptés</td><td className="px-4 py-2 border">3 ans</td><td className="px-4 py-2 border">Prescription commerciale</td></tr>
                <tr><td className="px-4 py-2 border">Données clients actifs</td><td className="px-4 py-2 border">Durée du contrat + 3 ans</td><td className="px-4 py-2 border">Intérêt légitime</td></tr>
                <tr><td className="px-4 py-2 border">Logs d&apos;audit</td><td className="px-4 py-2 border">2 ans</td><td className="px-4 py-2 border">Sécurité</td></tr>
                <tr><td className="px-4 py-2 border">Logs applicatifs</td><td className="px-4 py-2 border">90 jours</td><td className="px-4 py-2 border">Maintenance technique</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 5 — Sous-traitants ultérieurs</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-4 py-2 text-left border">Sous-traitant</th>
                  <th className="px-4 py-2 text-left border">Service</th>
                  <th className="px-4 py-2 text-left border">Localisation</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2 border">Supabase (AWS)</td><td className="px-4 py-2 border">Base de données, authentification, stockage</td><td className="px-4 py-2 border">UE (eu-west-1)</td></tr>
                <tr><td className="px-4 py-2 border">Vercel</td><td className="px-4 py-2 border">Hébergement application</td><td className="px-4 py-2 border">UE (cdg1)</td></tr>
                <tr><td className="px-4 py-2 border">Stripe</td><td className="px-4 py-2 border">Paiements</td><td className="px-4 py-2 border">UE</td></tr>
                <tr><td className="px-4 py-2 border">Resend</td><td className="px-4 py-2 border">Envoi d&apos;emails transactionnels</td><td className="px-4 py-2 border">US (SCCs)</td></tr>
                <tr><td className="px-4 py-2 border">Sentry</td><td className="px-4 py-2 border">Monitoring erreurs (données anonymisées)</td><td className="px-4 py-2 border">US (SCCs)</td></tr>
              </tbody>
            </table>
            <p className="text-sm text-gray-500 mt-2">
              Pour les transferts hors UE, des Clauses Contractuelles Types (SCCs) approuvées par la Commission européenne sont en place.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 6 — Sécurité</h2>
            <p>Le Prestataire met en œuvre les mesures suivantes :</p>
            <ul>
              <li>Chiffrement des données en transit (TLS 1.3) et au repos (AES-256)</li>
              <li>Isolation des données par atelier (Row Level Security PostgreSQL)</li>
              <li>Authentification à deux facteurs (2FA) pour les administrateurs</li>
              <li>Sauvegardes quotidiennes avec rétention 30 jours</li>
              <li>Monitoring continu avec alertes en temps réel (Sentry)</li>
              <li>Headers de sécurité OWASP (CSP, HSTS, X-Frame-Options)</li>
              <li>Audit de sécurité des dépendances automatisé (CI/CD)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 7 — Droits des personnes concernées</h2>
            <p>Le Prestataire assiste le Client dans l&apos;exercice des droits des personnes concernées :</p>
            <ul>
              <li><strong>Droit d&apos;accès :</strong> Export des données depuis le dashboard (format JSON/CSV)</li>
              <li><strong>Droit de rectification :</strong> Modification directe dans l&apos;interface</li>
              <li><strong>Droit à l&apos;effacement :</strong> Suppression sous 30 jours (sauf obligations légales)</li>
              <li><strong>Droit à la portabilité :</strong> Export complet des données en format structuré</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 8 — Notification de violation</h2>
            <p>En cas de violation de données à caractère personnel, le Prestataire s&apos;engage à :</p>
            <ul>
              <li>Notifier le Client dans un délai maximum de <strong>48 heures</strong> après prise de connaissance</li>
              <li>Fournir toutes les informations nécessaires (nature, catégories de données, mesures correctives)</li>
              <li>Assister le Client dans sa notification à la CNIL si nécessaire</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 9 — Fin du contrat</h2>
            <p>À la fin du contrat, le Prestataire s&apos;engage à :</p>
            <ul>
              <li>Mettre à disposition un export complet des données sous 30 jours</li>
              <li>Supprimer toutes les données dans un délai de 90 jours (sauf obligations légales)</li>
              <li>Fournir une attestation de suppression sur demande</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Article 10 — Contact DPO</h2>
            <p>Pour toute question relative à la protection des données :</p>
            <p className="font-medium">dpo@thermogestion.fr</p>
          </section>
        </div>
      </div>
    </div>
  )
}
