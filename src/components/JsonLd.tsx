import { SITE_URL } from "@/lib/env";
import { OFFRES, PRIX_SIEGE_MENSUEL, SIEGES_INCLUS } from "@/lib/abonnement";

/**
 * Données structurées schema.org.
 *
 * `JSON.stringify` est injecté tel quel dans un `<script type="application/ld+json">` : le seul
 * risque d'échappement est la séquence `</script>` à l'intérieur d'une chaîne, qui refermerait
 * la balise. On la neutralise plutôt que de faire confiance aux données.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** L'éditeur. Signal d'autorité : c'est un distributeur de matériel de thermolaquage, pas un éditeur généraliste. */
export const ORGANISATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Thermogestion",
  legalName: "SASU Royal Motorbike",
  alternateName: "Thermopoudre",
  url: SITE_URL,
  // URL absolue vers un PNG réellement présent dans `public/` (Lot G, point 4) : un moteur de
  // réponse qui résout `logo` en relatif ou vers un fichier inexistant l'ignore silencieusement.
  logo: `${SITE_URL}/icon-512.png`,
  email: "contact@thermopoudre.fr",
  vatID: "FR26884381047",
  taxID: "884381047",
  address: {
    "@type": "PostalAddress",
    streetAddress: "120 place des Palmiers",
    postalCode: "83150",
    addressLocality: "Bandol",
    addressCountry: "FR",
  },
  sameAs: ["https://thermopoudre.fr"],
};

/** Le produit et ses deux formules. Les moteurs de réponse citent ce qui est chiffré. */
export const LOGICIEL = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Thermogestion",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Gestion d'atelier de thermolaquage et de rénovation de jantes",
  operatingSystem: "Web (navigateur, iOS, Android, Windows, macOS)",
  url: SITE_URL,
  inLanguage: "fr-FR",
  featureList: [
    "Devis au m², au mètre linéaire et au pouce",
    "Signature électronique des devis par le client",
    "Suivi de production par QR code",
    "Rénovation de jantes : suivi jante par jante, teinte d'origine constructeur, bon de prise en charge signé",
    "Stock de poudre décompté à la cuisson",
    "Facturation Factur-X (PDF/A-3)",
    "Contrôles qualité Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco",
  ],
  publisher: { "@type": "Organization", name: "SASU Royal Motorbike", url: SITE_URL },
  // Les offres sont lues dans `lib/abonnement.ts` : un tarif changé à un seul endroit, sinon le
  // moteur de réponse cite un prix que la page ne pratique plus.
  //
  // `priceSpecification` porte le siège supplémentaire : un moteur de réponse qui ne citerait que
  // le prix de la formule laisserait croire à un forfait tout compris, et l'écart se découvrirait
  // à la première facture. Le nombre d'utilisateurs compris est déclaré dans `eligibleQuantity`.
  offers: [
    ...OFFRES.map((o) => ({
      "@type": "Offer",
      name: o.nom,
      price: String(o.prixMensuel),
      priceCurrency: "EUR",
      category: "Abonnement mensuel HT",
      description: `${o.argument} ${SIEGES_INCLUS[o.code]} utilisateurs inclus, puis ${PRIX_SIEGE_MENSUEL} € HT par utilisateur et par mois.`,
      url: `${SITE_URL}/#tarifs`,
      availability: "https://schema.org/InStock",
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        value: SIEGES_INCLUS[o.code],
        unitText: "utilisateurs inclus",
      },
    })),
    {
      "@type": "Offer",
      name: "Utilisateur supplémentaire",
      price: String(PRIX_SIEGE_MENSUEL),
      priceCurrency: "EUR",
      category: "Abonnement mensuel HT",
      description:
        "Utilisateur au-delà de ceux compris dans la formule, facturé à l'unité et résiliable à tout moment.",
      url: `${SITE_URL}/#tarifs`,
      availability: "https://schema.org/InStock",
    },
  ],
};

/**
 * Bloc `FAQPage` à monter sur la page qui porte réellement les questions — le balisage doit
 * reprendre mot pour mot ce que le visiteur lit, sinon Google le rejette.
 *
 * Utilisation depuis la page d'accueil :
 *   <JsonLd data={faqJsonLd(FAQ.map((f) => ({ question: f.q, reponse: f.r })))} />
 */
export function faqJsonLd(questions: { question: string; reponse: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, reponse }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: reponse },
    })),
  };
}
