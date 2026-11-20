import { JOURS_CORBEILLE } from "@/lib/corbeille";
import { JOURS_JOURNAL } from "@/lib/journal";
import { MAJ_LEGAL, MajLegal } from "@/app/legal/maj";

/**
 * Politique de confidentialité.
 *
 * Trois écarts relevés au contre-audit du 21/08 sont corrigés ici, tous du même genre : le texte
 * décrivait une infrastructure et un périmètre de données qui n'étaient plus ceux du logiciel.
 *
 *  - l'article 5 annonçait « Hostinger (hébergement applicatif) — UE » alors que l'application
 *    est passée sur Vercel, dont les fonctions s'exécutent par défaut aux États-Unis. Les
 *    mentions légales, elles, disaient déjà Vercel : deux pages du même site se contredisaient ;
 *  - la liste des sous-traitants en comptait trois, le logiciel en appelle huit ;
 *  - l'article 2 omettait ce que l'application collecte de plus sensible : l'adresse IP et
 *    l'image manuscrite du signataire d'un devis, et le relevé nominatif des temps de travail
 *    des opérateurs.
 */

export const metadata = {
  title: "Confidentialité (RGPD) — Thermogestion",
  description:
    "Politique de confidentialité de Thermogestion : données collectées, hébergement, sous-traitants, durées de conservation et exercice de vos droits.",
};

export default function Confidentialite() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <MajLegal />

      <h2>1. Qui traite quoi</h2>
      <p>
        Pour les données de <b>votre compte</b> (identité, email, facturation de l&apos;abonnement, usage du service),
        Thermopoudre est <b>responsable de traitement</b>. Pour les données que <b>vous saisissez dans
        l&apos;application</b> (vos clients, leurs coordonnées, vos devis, les photos de pièces, les temps de vos
        opérateurs), <b>vous êtes responsable de traitement</b> et Thermopoudre agit comme <b>sous-traitant</b> au
        sens de l&apos;article 28 du RGPD.
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>Compte : email, nom, données de l&apos;atelier, journal de connexion.</li>
        <li>
          Usage : événements de navigation internes, hébergés dans notre base européenne, sans cookie tiers, sans
          revente et sans publicité.
        </li>
        <li>
          Contenu métier saisi sous votre contrôle : clients et leurs coordonnées, devis, projets, photos de pièces,
          stock, factures et règlements.
        </li>
        <li>
          <b>Signature électronique</b> : lorsqu&apos;un de vos clients signe un devis, une réception ou un bon de
          livraison depuis un lien de partage, l&apos;application conserve son nom, l&apos;image de sa signature
          manuscrite, la date et l&apos;heure, son adresse IP et son navigateur. Ces éléments constituent la preuve
          de l&apos;accord et sont conservés avec le document.
        </li>
        <li>
          <b>Temps de travail</b> : le pointage des étapes de production enregistre quel opérateur a réalisé quelle
          étape et pendant combien de temps. C&apos;est une donnée relative à vos salariés, dont vous restez
          responsable — information et base légale du traitement vous incombent.
        </li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <p>
        Fourniture du service (exécution du contrat), facturation de l&apos;abonnement (obligation légale),
        amélioration du produit et statistiques internes (intérêt légitime), emails transactionnels — devis signé,
        avancement d&apos;un chantier, relance, récapitulatif quotidien — (exécution du contrat). Pas de prospection
        sans consentement, pas de vente de données, pas de publicité.
      </p>

      <h2>4. Engagements de sous-traitance (art. 28 RGPD)</h2>
      <p>
        Thermopoudre ne traite les données saisies que sur instruction de l&apos;atelier ; garantit la confidentialité
        et la sécurité (chiffrement en transit et au repos, cloisonnement strict par atelier appliqué au niveau de la
        base de données, journalisation des modifications) ; recourt aux sous-traitants ultérieurs listés à
        l&apos;article 5 ; assiste l&apos;atelier pour répondre aux demandes d&apos;exercice de droits de ses propres
        clients ; notifie toute violation de données dans les 48 heures ; supprime ou restitue les données à la fin
        du contrat dans les conditions de l&apos;article 7.
      </p>

      <h2>5. Sous-traitants ultérieurs et localisation</h2>
      <ul>
        <li>
          <b>Supabase</b> — base de données, authentification et stockage des fichiers. Infrastructure AWS, région
          Paris (eu-west-3), Union européenne. C&apos;est là que réside l&apos;ensemble de vos données.
        </li>
        <li>
          <b>Vercel</b> — exécution de l&apos;application. Société américaine ; les traitements qui passent par le
          serveur (génération des PDF, exports, appels aux services ci-dessous) peuvent s&apos;exécuter aux
          États-Unis. Ce transfert est encadré par la certification de Vercel au <i>EU-U.S. Data Privacy Framework</i>.
        </li>
        <li>
          <b>Stripe</b> — paiement de votre abonnement, et, si vous l&apos;activez, encaissement de vos propres
          factures par carte. Stripe est destinataire des données de facturation ; aucune donnée de carte ne transite
          par Thermogestion.
        </li>
        <li>
          <b>Brevo</b> — envoi des emails d&apos;authentification (confirmation d&apos;inscription, réinitialisation
          de mot de passe). Société française, hébergement européen.
        </li>
        <li>
          <b>Serveur de messagerie thermopoudre.fr</b> — envoi des emails transactionnels métier adressés à vous et à
          vos clients. Serveur situé dans l&apos;Union européenne.
        </li>
        <li>
          <b>api.gouv.fr</b> — vérification d&apos;adresse (Base Adresse Nationale) et de numéro SIREN (Recherche
          d&apos;entreprises), à votre demande lors d&apos;une saisie. France.
        </li>
        <li>
          <b>Boutique thermopoudre.fr</b> — uniquement si vous passez une commande de poudre depuis
          l&apos;application : les coordonnées de votre atelier sont alors transmises au fournisseur pour traiter la
          commande. France.
        </li>
      </ul>

      <h2>6. Durées de conservation</h2>
      <ul>
        <li>Compte et contenu métier : pendant toute la durée du contrat.</li>
        <li>
          Corbeille : {JOURS_CORBEILLE} jours après suppression d&apos;un document, restaurable pendant ce délai, puis
          effacement définitif.
        </li>
        <li>
          Journal des modifications : {JOURS_JOURNAL} jours ({Math.round(JOURS_JOURNAL / 365)} ans), purgé
          automatiquement chaque nuit.
        </li>
        <li>Données de facturation : 10 ans, au titre de l&apos;obligation comptable.</li>
        <li>Journaux techniques d&apos;authentification et d&apos;accès : conservés par nos hébergeurs, 12 mois au plus.</li>
      </ul>

      <h2>7. Fin du contrat</h2>
      <p>
        Après résiliation, et tant que le compte existe, vous conservez la faculté d&apos;exporter l&apos;intégralité
        de vos données depuis l&apos;application. La suppression définitive du compte et des données s&apos;obtient
        sur demande à contact@thermopoudre.fr et est exécutée sous 30 jours, à l&apos;exception des données que la loi
        nous impose de conserver.
      </p>

      <h2>8. Vos droits</h2>
      <p>
        Accès, rectification, effacement, portabilité, limitation, opposition : contact@thermopoudre.fr. Réclamation
        possible auprès de la CNIL (cnil.fr). Si vous êtes le client d&apos;un atelier utilisateur de Thermogestion,
        adressez-vous d&apos;abord à cet atelier, qui est responsable de vos données ; nous l&apos;assistons pour vous
        répondre.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Uniquement des cookies techniques de session (authentification). Aucun cookie publicitaire, aucun traceur
        tiers — c&apos;est pourquoi il n&apos;y a pas de bandeau cookies.
      </p>

      <p className="mt-6 text-xs text-gray-500">Version en vigueur au {MAJ_LEGAL}.</p>
    </>
  );
}
