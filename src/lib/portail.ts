import type { TonBadge } from "@/lib/tons";

/**
 * L'espace client — le contrat partagé entre la base, la page publique et la fiche client.
 *
 * Ce qui existait déjà : six pages à jeton, une par **document** (`/d/`, `/f/`, `/bl/`, `/rc/`,
 * `/s/`, `/jt/`). Elles répondent à « où en est cette pièce-là ». Elles ne répondent pas à la
 * question que pose un carrossier qui dépose quinze jeux de jantes par mois : « où en sont mes
 * pièces, et où est ma facture de mars ». Aujourd'hui il écrit un mail, et quelqu'un à l'atelier
 * arrête ce qu'il fait pour aller chercher.
 *
 * Le portail répond à ça, et à rien d'autre : **voir**. Pas de compte, pas de mot de passe —
 * un artisan n'installera jamais un logiciel qui oblige ses clients à créer un compte, et la
 * veille du marché le confirme. Pas de messagerie, pas de paiement.
 *
 * Le jeton est **par client**, et c'est toute la différence : il ouvre un historique commercial
 * complet là où un jeton de document n'ouvre qu'une pièce. Il est donc d'une autre nature —
 * 32 octets d'entropie au lieu de 16, préfixé `pc_` pour être reconnaissable dans un journal de
 * serveur — et il est fermé par défaut : c'est l'atelier qui décide de l'ouvrir, client par
 * client, depuis la fiche.
 */

/** Longueur minimale d'un jeton de portail : `pc_` + 64 caractères hexadécimaux. */
export const LONGUEUR_JETON_PORTAIL = 67;

/**
 * Le jeton a-t-il la forme attendue ?
 *
 * Sert à éviter un aller-retour réseau sur une URL manifestement tronquée (un lien coupé par un
 * client de messagerie, par exemple). Ce n'est **pas** un contrôle de sécurité : la base refuse
 * de toute façon tout jeton de moins de 48 caractères, et elle seule sait s'il existe.
 */
export function formeDeJetonPortail(jeton: string | null | undefined): boolean {
  return typeof jeton === "string" && /^pc_[0-9a-f]{64}$/.test(jeton);
}

/** L'adresse à donner au client. Une seule définition : la fiche client et les tests la partagent. */
export function urlPortail(base: string, jeton: string): string {
  return `${base.replace(/\/$/, "")}/portail/${jeton}`;
}

export type RubriquePortail =
  | "chantiers"
  | "jantes"
  | "devis"
  | "livraisons"
  | "factures"
  | "documents";

/**
 * Les rubriques, dans l'ordre où elles s'affichent.
 *
 * L'ordre n'est pas alphabétique : il suit la question qu'on se pose en ouvrant le lien. « Où en
 * sont mes pièces » d'abord (chantiers, jantes), « qu'est-ce que j'ai à répondre » ensuite
 * (devis), puis ce qui est parti et ce qui est dû. « Tous les documents » ferme la marche : c'est
 * la rubrique du classement, pas celle du suivi.
 */
export const RUBRIQUES_PORTAIL: { code: RubriquePortail; onglet: string; pluriel: string; vide: string }[] = [
  { code: "chantiers", onglet: "Chantiers", pluriel: "chantiers", vide: "Aucun chantier pour l'instant." },
  { code: "jantes", onglet: "Jantes", pluriel: "jeux de jantes", vide: "Aucun jeu de jantes déposé." },
  { code: "devis", onglet: "Devis", pluriel: "devis", vide: "Aucun devis en cours." },
  { code: "livraisons", onglet: "Livraisons", pluriel: "bons de livraison", vide: "Aucune livraison enregistrée." },
  { code: "factures", onglet: "Factures", pluriel: "factures", vide: "Aucune facture." },
  { code: "documents", onglet: "Documents", pluriel: "documents", vide: "Aucun document à retrouver." },
];

export function estRubriquePortail(v: unknown): v is RubriquePortail {
  return RUBRIQUES_PORTAIL.some((r) => r.code === v);
}

/** L'en-tête rendu par `portail_client()`. Volontairement pauvre : voir le commentaire de la RPC. */
export type EnTetePortail = {
  client: { nom: string };
  atelier: {
    nom: string;
    logo_url: string | null;
    couleur: string | null;
    telephone: string | null;
    email: string | null;
    adresse: string | null;
    code_postal: string | null;
    ville: string | null;
  };
  resume: {
    chantiers_en_cours: number;
    jeux_en_cours: number;
    devis_a_repondre: number;
    factures_a_regler: number;
    /** Somme due, avoirs et règlements partiels déduits. */
    reste_du: number | string;
  };
};

export type LigneChantier = {
  numero: string | null;
  nom: string;
  status: string;
  etape_courante: string | null;
  etapes_total: number;
  etapes_faites: number;
  date_reception: string | null;
  date_promise: string | null;
  date_livraison: string | null;
  /** Jeton de la page de suivi `/s/` déjà existante — le portail n'ouvre aucune seconde route. */
  jeton: string;
};

export type LigneJeuJantes = {
  numero: string | null;
  statut: string;
  nb_jantes: number;
  diametre_pouces: number | string;
  largeur_pouces: number | string | null;
  finition: string;
  teinte: string | null;
  date_promise: string | null;
  created_at: string;
  jantes_pretes: number;
  vehicule: { marque: string | null; modele: string | null; immatriculation: string | null } | null;
  jeton: string;
};

export type LigneDevis = {
  numero: string | null;
  status: string;
  total_ttc: number | string;
  created_at: string;
  expire_le: string | null;
  signed_at: string | null;
  jeton: string;
};

export type LigneLivraison = {
  numero: string | null;
  status: string;
  livre_at: string | null;
  created_at: string;
  nb_colis: number | null;
  poids_kg: number | string | null;
  signed_at: string | null;
  recu_par: string | null;
  jeton: string;
};

export type LigneFacture = {
  numero: string | null;
  type: string;
  status: string;
  total_ttc: number | string;
  due_date: string | null;
  emise_at: string | null;
  regle: number | string;
  reste_du: number | string;
  jeton: string;
};

export type LigneDocument = {
  piece: "devis" | "facture" | "avoir" | "livraison" | "jantes";
  numero: string | null;
  date: string | null;
  montant_ttc: number | string | null;
  /** Préfixe de la page à jeton correspondante : `d`, `f`, `bl`, `jt`. */
  prefixe: string;
  jeton: string;
};

export type LignePortail =
  | LigneChantier
  | LigneJeuJantes
  | LigneDevis
  | LigneLivraison
  | LigneFacture
  | LigneDocument;

/** Ce que rend `portail_liste()` : une page, et le total pour savoir s'il en reste. */
export type PagePortail = { total: number; lignes: LignePortail[] };

/** Libellés des types de pièce dans la rubrique « Documents ». */
export const LIBELLE_PIECE: Record<LigneDocument["piece"], string> = {
  devis: "Devis",
  facture: "Facture",
  avoir: "Avoir",
  livraison: "Bon de livraison",
  jantes: "Prise en charge",
};

/**
 * L'état d'un jeu de jantes, en français et du point de vue du client.
 *
 * Les statuts internes (`recu`, `en_cours`, `pret`, `livre`) sont écrits pour l'atelier. « Reçu »
 * ne dit rien à un garagiste qui, lui, veut savoir si ses jantes sont chez lui ou pas encore.
 */
export const STATUT_JEU_CLIENT: Record<string, { label: string; ton: TonBadge }> = {
  recu: { label: "Réceptionné", ton: "neutral" },
  en_cours: { label: "En atelier", ton: "info" },
  pret: { label: "Prêt à récupérer", ton: "success" },
  // « Restitué » et « Livré et facturé » portaient `bg-gray-200 text-gray-500`, soit 3,90:1 :
  // sous les 4,5:1 exigés par WCAG 1.4.3. C'est l'écran que voit le client du client, celui sur
  // lequel l'atelier ne peut rien rattraper de vive voix.
  livre: { label: "Restitué", ton: "neutral" },
  annule: { label: "Annulé", ton: "danger" },
};

/** Idem pour le bon de livraison : « émis » est un mot d'atelier. */
export const STATUT_BL_CLIENT: Record<string, { label: string; ton: TonBadge }> = {
  emis: { label: "Prêt à partir", ton: "info" },
  livre: { label: "Livré", ton: "success" },
  facture: { label: "Livré et facturé", ton: "neutral" },
};
