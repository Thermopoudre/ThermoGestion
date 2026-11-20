import {
  MOIS_OFFERTS_ANNUEL,
  OFFRES,
  PRIX_SIEGE_ANNUEL,
  PRIX_SIEGE_MENSUEL,
  SIEGES_INCLUS,
} from "@/lib/abonnement";
import { JOURS_CORBEILLE } from "@/lib/corbeille";
import { JOURS_JOURNAL } from "@/lib/journal";
import { VALIDITE_DEVIS_DEFAUT } from "@/lib/devis";
import { MAJ_LEGAL, MajLegal } from "@/app/legal/maj";

/**
 * CGU / CGV.
 *
 * **Les prix ne sont pas réécrits ici.** Ils sont lus dans `src/lib/abonnement.ts`, la source
 * unique dont vivent déjà la vitrine, la page tarifs, l'écran d'abonnement et les `lookup_key`
 * Stripe. C'est précisément parce qu'ils avaient été recopiés à la main que cet article a
 * annoncé pendant des semaines deux formules — « Solo 59 € » et « Atelier 89 € » — dont aucune
 * n'a jamais existé dans le logiciel, et qu'il ignorait complètement la facturation au siège.
 * Un prix faux dans des conditions de vente n'est pas une coquille : c'est ce que le client
 * oppose.
 *
 * En revanche la page reste de la prose : des phrases, des listes courtes, rien qui ne
 * s'imprime pas. Une condition générale se lit, se copie et s'archive — ce n'est pas un
 * tableau de bord.
 */

export const metadata = {
  title: "CGU / CGV — Thermogestion",
  description:
    "Conditions générales d'utilisation et de vente de Thermogestion : abonnement, essai de 30 jours, résiliation, propriété et export des données de l'atelier.",
};

export default function Cgu() {
  return (
    <>
      <h1>Conditions générales d&apos;utilisation et de vente</h1>
      <MajLegal />
      <p>Applicables à tout compte créé sur Thermogestion.</p>

      <h2>1. Objet</h2>
      <p>
        Thermogestion est un logiciel en ligne (SaaS) de gestion destiné aux professionnels du traitement de surface
        (devis, suivi de production, stock, qualité, facturation). Le service est édité par la SASU Royal Motorbike,
        dont les coordonnées figurent dans les <a href="/legal/mentions">mentions légales</a>. Il est réservé aux
        professionnels (B2B) ; en créant un compte, vous confirmez agir dans le cadre de votre activité
        professionnelle.
      </p>

      <h2>2. Compte et essai</h2>
      <p>
        L&apos;essai gratuit dure 30 jours, sans carte bancaire ni engagement, et donne accès à l&apos;ensemble des
        fonctions du logiciel. À l&apos;issue de l&apos;essai, et à défaut d&apos;abonnement, l&apos;atelier passe en
        lecture seule : vos documents restent consultables, imprimables et exportables, mais aucun nouveau document ne
        peut être créé. Rien n&apos;est effacé de ce fait.
      </p>
      <p>
        Vous êtes responsable de la confidentialité de vos identifiants et des actions réalisées via votre compte. Les
        comptes de votre équipe sont créés par invitation, sous votre responsabilité, et chacun dispose d&apos;un rôle
        qui détermine ce qu&apos;il peut voir et écrire.
      </p>

      <h2>3. Formules, prix et paiement</h2>
      <p>
        Trois formules, au choix, en paiement mensuel ou annuel d&apos;avance (l&apos;engagement annuel vaut{" "}
        {MOIS_OFFERTS_ANNUEL} mois offerts) :
      </p>
      <ul>
        {OFFRES.map((o) => (
          <li key={o.code}>
            <b>{o.nom}</b> — {o.prixMensuel} € HT par mois, ou {o.prixAnnuel} € HT par an.{" "}
            {SIEGES_INCLUS[o.code]} utilisateurs compris.
          </li>
        ))}
      </ul>
      <p>
        Au-delà des utilisateurs compris dans la formule, chaque utilisateur supplémentaire est facturé{" "}
        {PRIX_SIEGE_MENSUEL} € HT par mois, ou {PRIX_SIEGE_ANNUEL} € HT par an, sur le même abonnement. Le nombre
        d&apos;utilisateurs s&apos;ajuste depuis l&apos;application ; la facturation suit à la période suivante, au
        prorata appliqué par notre prestataire de paiement.
      </p>
      <p>
        Tous les prix s&apos;entendent hors taxes ; la TVA applicable s&apos;ajoute au taux en vigueur. Le paiement
        s&apos;effectue par carte bancaire, par l&apos;intermédiaire de Stripe : nous n&apos;hébergeons aucune donnée
        de carte. Les prix sont révisables avec un préavis de 30 jours ; à défaut de résiliation avant
        l&apos;échéance suivante, le nouveau tarif s&apos;applique.
      </p>

      <h2>4. Durée et résiliation</h2>
      <p>
        L&apos;abonnement est sans engagement de durée. La résiliation s&apos;effectue depuis l&apos;espace
        Abonnement de l&apos;application, qui ouvre le portail client de Stripe — c&apos;est également là que se
        changent la carte bancaire et que se téléchargent vos factures d&apos;abonnement. Elle prend effet à la fin de
        la période déjà payée, sans remboursement au prorata. Passé cette date, l&apos;atelier repasse en lecture
        seule, dans les mêmes conditions qu&apos;à l&apos;issue de l&apos;essai.
      </p>

      <h2>5. Niveau de service</h2>
      <p>
        Le service est fourni « en l&apos;état » et peut être interrompu pour maintenance, mise à jour ou incident
        technique, y compris chez nos hébergeurs. Nous nous efforçons de réduire ces interruptions et de les annoncer
        lorsqu&apos;elles sont programmées, sans engagement chiffré de disponibilité. En cas d&apos;interruption
        majeure qui nous serait imputable et dépasserait 48 heures, une prolongation d&apos;abonnement équivalente
        est accordée sur demande.
      </p>

      <h2>6. Vos données, export et réversibilité</h2>
      <p>
        Les données saisies dans l&apos;application — clients, devis, projets, production, stock, factures —
        appartiennent à l&apos;atelier. Vous pouvez en obtenir une copie complète <b>à tout moment et sans nous la
        demander</b>, depuis Réglages : une archive ZIP contenant un fichier JSON complet et un fichier CSV par
        table. S&apos;y ajoute un export comptable au format CSV ou FEC, sur la période de votre choix. Les fichiers
        joints (photos de pièces, documents, logo) ne sont pas inclus dans l&apos;archive : leurs noms et
        emplacements y figurent, et les fichiers eux-mêmes vous sont remis sur demande.
      </p>
      <p>
        Cette faculté d&apos;export subsiste après la résiliation, tant que le compte existe. La suppression
        définitive de votre compte et de vos données s&apos;obtient sur simple demande à contact@thermopoudre.fr ;
        elle est exécutée sous 30 jours, sous réserve des données que la loi nous impose de conserver (voir
        l&apos;article suivant).
      </p>

      <h2>7. Conservation</h2>
      <ul>
        <li>
          Corbeille : un document supprimé y reste {JOURS_CORBEILLE} jours, restaurable, avant effacement définitif.
        </li>
        <li>
          Journal des modifications : {JOURS_JOURNAL} jours ({Math.round(JOURS_JOURNAL / 365)} ans). Il enregistre qui
          a modifié quoi et quand sur les clients, devis, factures et projets ; il est consultable par le responsable
          de l&apos;atelier et ne peut être ni modifié ni effacé, y compris par lui.
        </li>
        <li>Données de facturation : 10 ans, au titre de l&apos;obligation comptable.</li>
      </ul>
      <p>
        Le détail du traitement des données personnelles, la liste des sous-traitants et les durées complètes
        figurent dans la <a href="/legal/confidentialite">politique de confidentialité</a>, qui porte également les
        engagements de sous-traitance de l&apos;article 28 du RGPD.
      </p>

      <h2>8. Accès donnés à des tiers par l&apos;atelier</h2>
      <p>
        L&apos;application permet d&apos;ouvrir deux types d&apos;accès à des tiers, sous votre seule responsabilité :
      </p>
      <ul>
        <li>
          <b>Accès expert-comptable</b> — jusqu&apos;à deux accès gratuits, qui ne consomment aucun utilisateur payant.
          Le cabinet accède, en lecture seule, à votre journal des ventes et à vos exports comptables ; il ne voit ni
          vos devis, ni vos projets, ni vos marges, ni vos coordonnées bancaires.
        </li>
        <li>
          <b>Portail client et liens de partage</b> — un devis, une facture, un bon de livraison ou un suivi de
          chantier peut être rendu consultable par votre client au moyen d&apos;un lien contenant un jeton. Toute
          personne disposant du lien accède au document : sa diffusion relève de votre responsabilité.
        </li>
      </ul>

      <h2>9. Documents produits par le logiciel</h2>
      <p>
        Thermogestion est un outil d&apos;aide à la gestion : l&apos;atelier reste seul responsable de ses devis,
        prix, factures et obligations légales, comptables et fiscales. Il lui appartient de vérifier les mentions
        obligatoires renseignées dans ses réglages, qui sont reprises telles quelles sur les documents.
      </p>
      <p>
        Un devis émis porte une durée de validité, fixée par l&apos;atelier ({VALIDITE_DEVIS_DEFAUT} jours à défaut) et
        imprimée sur le document : passé ce délai, la signature en ligne est refusée et le devis doit être réédité.
        Un devis signé et une facture émise ne sont plus modifiables : la correction passe par une nouvelle version du
        devis ou par un avoir sur la facture.
      </p>

      <h2>10. Responsabilité</h2>
      <p>
        La responsabilité de l&apos;éditeur est limitée aux sommes versées au titre de l&apos;abonnement au cours des
        12 derniers mois. Elle ne couvre pas les dommages indirects, ni les conséquences d&apos;une saisie erronée,
        d&apos;une perte d&apos;identifiants ou d&apos;une diffusion de lien de partage par l&apos;atelier.
      </p>

      <h2>11. Résiliation par l&apos;éditeur</h2>
      <p>
        En cas d&apos;impayé non régularisé sous 15 jours après relance, ou d&apos;usage frauduleux ou illicite,
        l&apos;accès peut être suspendu puis résilié. L&apos;export des données reste possible pendant la période de
        suspension.
      </p>

      <h2>12. Droit applicable</h2>
      <p>Droit français. Tribunal de commerce du siège de l&apos;éditeur, après tentative de résolution amiable.</p>

      <p className="mt-6 text-xs text-gray-500">
        Version en vigueur au {MAJ_LEGAL}. Les versions antérieures sont communiquées sur demande.
      </p>
    </>
  );
}
