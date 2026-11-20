/**
 * Journal des modifications — la traduction du technique vers le français de l'atelier.
 *
 * Le trigger `trg_journal` en base enregistre la vérité brute : un nom de colonne, une valeur
 * avant, une valeur après. C'est ce qu'il faut pour prouver, ce n'est pas ce qu'il faut pour
 * lire. Un exploitant à qui l'on montre
 *
 *     {"total_ttc": {"avant": 1400.00, "apres": 1780.00}}
 *
 * n'a rien gagné : il lui faut « Julien a fait passer le total TTC de 1 400,00 € à 1 780,00 € ».
 * Tout ce fichier ne fait que ça, et il ne fait que ça côté client : **il ne protège rien**. La
 * lecture du journal est réservée au responsable par la politique `owner_select`, et l'écriture
 * n'est possible que depuis le trigger. Ici, on met en français.
 *
 * Deux règles de rédaction, tenues partout :
 *  1. **le vocabulaire est celui du métier**, jamais celui de la base : « le prix au m² », pas
 *     `prix_m2` ; « la date promise », pas `date_promise` ;
 *  2. **on ne montre pas ce qu'on ne sait pas lire.** Une colonne sans libellé n'est pas affichée
 *     sous son nom technique — elle est comptée dans un « et 2 autres champs ». Montrer
 *     `stripe_payment_link` à un patron d'atelier ne l'aide pas, ça l'inquiète.
 */

import { LIBELLE_ROLE, estRole } from "@/lib/roles";
import { STATUS_DEVIS, STATUS_FACTURE, STATUS_PROJET, dateFr, eur, heureFr, nombreFr } from "@/lib/utils";

/** Une ligne du journal telle que PostgREST la rend. */
export type LigneJournal = {
  id: number;
  created_at: string;
  acteur: "utilisateur" | "systeme" | "public";
  auteur_nom: string | null;
  action: "creation" | "modification" | "suppression";
  entity: string;
  entity_id: string | null;
  payload: {
    champs?: Record<string, { avant: unknown; apres: unknown }>;
    apercu?: Record<string, unknown>;
    ligne?: Record<string, unknown>;
  } | null;
};

/**
 * Durée de conservation, en jours. Doublon assumé de `public.jours_journal()` : la base est la
 * seule à décider, cette constante ne sert qu'à l'écrire à l'écran. Si l'une change, changer
 * l'autre — c'est le seul endroit à surveiller.
 */
export const JOURS_JOURNAL = 730;

/** Les entités qui portent un panneau « Historique ». */
export type EntiteJournal = "clients" | "projets" | "devis" | "factures";

/* ------------------------------------------------------------------------------------------- *
 * Libellés de champs
 * ------------------------------------------------------------------------------------------- */

/** Colonnes communes à plusieurs tables : un seul libellé, pour ne pas dériver. */
const CHAMPS_COMMUNS: Record<string, string> = {
  nom: "le nom",
  numero: "le numéro",
  notes: "les notes",
  note: "la note",
  status: "le statut",
  actif: "l'activation",
  ordre: "l'ordre d'affichage",
  client_id: "le client",
  projet_id: "le chantier",
  devis_id: "le devis d'origine",
  poudre_id: "la teinte",
  grille_id: "la grille tarifaire",
  created_by: "l'auteur",
  items: "les lignes",
  remise: "la remise",
  total_ht: "le total HT",
  total_tva: "la TVA",
  total_ttc: "le total TTC",
  public_token: "le lien public",
  delai_paiement_jours: "le délai de paiement",
  // Traité à part par `phraseChangement` : la corbeille mérite sa propre phrase.
  deleted_at: "la mise à la corbeille",
};

/**
 * Libellés propres à chaque table. Ce qui n'est pas ici n'est pas affiché : c'est le filet de
 * sécurité de la règle n° 2 en tête de fichier.
 */
const CHAMPS: Record<string, Record<string, string>> = {
  devis: {
    validite_jours: "la durée de validité",
    envoye_at: "la date d'envoi",
    signed_at: "la date de signature",
    signed_by: "le signataire",
    relances_actives: "les relances automatiques",
    version: "la version",
    parent_id: "le devis remplacé",
  },
  factures: {
    type: "le type de facture",
    facture_liee_id: "la facture liée",
    due_date: "l'échéance",
    emise_at: "la date d'émission",
    nature_operation: "la nature de l'opération",
    nature_operation_forcee: "la nature d'opération forcée à la main",
    recapitulative: "le caractère récapitulatif",
    periode_debut: "le début de période",
    periode_fin: "la fin de période",
    motif_annulation: "le motif d'annulation",
    annulee_at: "la date d'annulation",
    relances_actives: "les relances automatiques",
  },
  projets: {
    etape_courante: "l'étape en cours",
    pieces: "les pièces à traiter",
    surface_m2: "la surface",
    couches: "le nombre de couches",
    poudre_conso_kg: "la poudre consommée",
    stock_decremente_at: "le décompte du stock",
    date_reception: "la date de réception",
    date_promise: "la date promise",
    date_livraison: "la date de livraison",
    teinte_origine: "la teinte d'origine",
    lot_poudre: "le lot de poudre",
    lot_id: "le lot de poudre",
  },
  clients: {
    type: "le type de client",
    contact: "le contact",
    email: "l'adresse électronique",
    telephone: "le téléphone",
    adresse: "l'adresse",
    code_postal: "le code postal",
    ville: "la ville",
    pays: "le pays",
    siret: "le SIRET",
    siren: "le SIREN",
    tva_intra: "le numéro de TVA",
    archive: "l'archivage",
    remise_pct: "la remise permanente",
    facturation_mensuelle: "la facturation mensuelle",
    adresse_livraison: "l'adresse de livraison",
    code_postal_livraison: "le code postal de livraison",
    ville_livraison: "la ville de livraison",
  },
  grilles_tarifaires: {
    forfait_minimum: "le forfait minimum",
    is_default: "le statut de grille par défaut",
  },
  grille_paliers: {
    surface_min: "la surface minimale du palier",
    surface_max: "la surface maximale du palier",
    prix_m2: "le prix au m²",
  },
  grille_coefs: {
    categorie: "la catégorie",
    code: "le code",
    libelle: "le libellé",
    coef: "le coefficient",
  },
  prestations: {
    code: "le code",
    description: "la description",
    unite: "l'unité",
    prix_unitaire_ht: "le prix unitaire HT",
    tva_rate: "le taux de TVA",
    categorie: "la catégorie",
    nature: "la nature",
  },
  client_tarifs: {
    prix_ht: "le prix négocié",
    prestation_id: "la prestation",
  },
  poudre_couts: { prix_kg: "le prix d'achat au kilo" },
  poudre_lot_couts: { prix_kg: "le prix d'achat au kilo du lot" },
  ateliers_couts: {
    taux_horaire: "le taux horaire",
    frais_generaux_pct: "les frais généraux",
  },
  ateliers: {
    forme_juridique: "la forme juridique",
    capital_social: "le capital social",
    adresse: "l'adresse",
    code_postal: "le code postal",
    ville: "la ville",
    telephone: "le téléphone",
    email: "l'adresse électronique",
    siret: "le SIRET",
    siren: "le SIREN",
    tva_intra: "le numéro de TVA",
    assujetti_tva: "l'assujettissement à la TVA",
    penalites_taux: "le taux de pénalités de retard",
    escompte_texte: "la mention d'escompte",
    tva_sur_debits: "la TVA sur les débits",
    prix_kwh: "le prix du kWh",
    four_capacite_m2: "la capacité du four",
    four_conso_kwh: "la consommation du four",
    garantie_mois: "la durée de garantie",
    couleur: "la couleur de l'atelier",
  },
  users: {
    role: "le rôle",
    actif: "l'accès au logiciel",
    email: "l'adresse électronique",
  },
  subscriptions: {
    plan: "la formule",
    status: "l'état de l'abonnement",
    sieges_supp: "les sièges supplémentaires",
    periode: "la périodicité",
    trial_end: "la fin de l'essai",
    cancel_at_period_end: "la résiliation en fin de période",
    current_period_end: "la fin de période",
  },
};

/** Libellé métier d'une colonne, ou `null` si on ne sait pas le dire en français. */
export function libelleChamp(entite: string, champ: string): string | null {
  return CHAMPS[entite]?.[champ] ?? CHAMPS_COMMUNS[champ] ?? null;
}

/** Nom de l'entité, au singulier, avec son article. */
const ENTITES: Record<string, string> = {
  devis: "le devis",
  factures: "la facture",
  projets: "le chantier",
  clients: "la fiche client",
  grilles_tarifaires: "la grille tarifaire",
  grille_paliers: "le palier tarifaire",
  grille_coefs: "le coefficient de grille",
  prestations: "la prestation",
  client_tarifs: "le tarif négocié",
  poudre_couts: "le prix d'achat de la teinte",
  poudre_lot_couts: "le prix d'achat du lot",
  ateliers_couts: "les coûts de l'atelier",
  ateliers: "la fiche de l'entreprise",
  users: "le compte d'un membre",
  subscriptions: "l'abonnement",
};

export function libelleEntite(entite: string): string {
  return ENTITES[entite] ?? "la fiche";
}

/* ------------------------------------------------------------------------------------------- *
 * Mise en forme des valeurs
 * ------------------------------------------------------------------------------------------- */

const CHAMPS_EUROS = new Set([
  "total_ht", "total_tva", "total_ttc", "prix_m2", "prix_ht", "prix_kg", "prix_unitaire_ht",
  "forfait_minimum", "taux_horaire", "prix_kwh", "montant", "cout_estime", "prix_jante_ht", "prix_ml",
]);

const CHAMPS_POURCENTS = new Set([
  "remise_pct", "tva_rate", "penalites_taux", "frais_generaux_pct", "four_remplissage_moyen_pct",
]);

const CHAMPS_SURFACES = new Set(["surface_m2", "surface_min", "surface_max", "four_capacite_m2"]);

/** Statuts, par table, dans le vocabulaire déjà affiché sur les badges. */
const STATUTS: Record<string, Record<string, { label: string }>> = {
  devis: STATUS_DEVIS,
  factures: STATUS_FACTURE,
  projets: STATUS_PROJET,
};

/**
 * Une valeur du journal, en français.
 *
 * Les valeurs volumineuses ont été remplacées en base par une phrase entre parenthèses : elle
 * ressort telle quelle, c'est déjà du français.
 */
export function valeurFr(entite: string, champ: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vide";

  if (champ === "status" && typeof v === "string") {
    return STATUTS[entite]?.[v]?.label ?? v;
  }
  if (champ === "role" && estRole(v)) return LIBELLE_ROLE[v].titre;

  if (typeof v === "boolean") return v ? "oui" : "non";

  if (typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v)))) {
    const n = Number(v);
    if (CHAMPS_EUROS.has(champ)) return eur(n);
    if (CHAMPS_POURCENTS.has(champ)) return `${nombreFr(n)} %`;
    if (CHAMPS_SURFACES.has(champ)) return `${nombreFr(n, 2)} m²`;
    if (champ.endsWith("_kg")) return `${nombreFr(n, 2)} kg`;
    if (champ.endsWith("_jours")) return `${nombreFr(n)} jours`;
    if (champ.endsWith("_mois")) return `${nombreFr(n)} mois`;
    // Un identifiant numérique ou un compteur : tel quel, sans unité inventée.
    if (typeof v === "number" || /^-?\d+([.,]\d+)?$/.test(v)) return nombreFr(n, 2);
  }

  if (typeof v === "string") {
    // Horodatage ISO : la date suffit, l'heure est déjà celle de la ligne du journal.
    if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(v)) return dateFr(v);
    // Un identifiant technique n'apprend rien : on dit qu'il a changé, pas lequel.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "une autre valeur";
    return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return "aucune ligne";
    return `${v.length} ligne${v.length > 1 ? "s" : ""}`;
  }

  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // La remise est le seul objet que l'atelier lit vraiment.
    if (o.type === "pct") return `${nombreFr(o.valeur)} %`;
    if (o.type === "montant") return eur(Number(o.valeur));
    return "une autre valeur";
  }

  return String(v);
}

/* ------------------------------------------------------------------------------------------- *
 * Phrases
 * ------------------------------------------------------------------------------------------- */

/**
 * « le 18/08/2026 à 14h12 » — l'heure compte autant que la date dans un litige.
 *
 * Recette navigateur (vague 2) : recomposait jusqu'ici sa propre heure à la main
 * (`toLocaleTimeString(...).replace(":", " h ")`, soit « 14 h 12 »), un cinquième format à côté du
 * « 09:00 » de `/relances` — mis en capitales par le `uppercase` CSS d'`Historique.tsx`, d'où le
 * « À 12 H 25 » relevé à l'écran. `heureFr` (lib/utils.ts) est désormais la seule source : « 14h12 ».
 */
export function horodatageFr(iso: string): string {
  return `le ${dateFr(iso)} à ${heureFr(iso)}`;
}

/**
 * Qui a écrit.
 *
 * Les trois cas ne sont pas décoratifs. « Le logiciel » recouvre les écritures du cron et des
 * fonctions serveur : les attribuer à un membre serait un faux témoignage, et c'est exactement ce
 * qu'un journal ne doit jamais faire. « Le client, depuis le lien public » désigne la signature
 * d'un devis ou d'un bon de livraison, faite par quelqu'un qui n'appartient pas à l'atelier.
 */
export function auteurFr(l: Pick<LigneJournal, "acteur" | "auteur_nom">): string {
  if (l.acteur === "systeme") return "Le logiciel";
  if (l.acteur === "public") return "Le client, depuis le lien public";
  return l.auteur_nom ?? "Un membre de l'atelier";
}

/**
 * Une modification, en une phrase, sans son auteur ni sa date — ceux-là coiffent le groupe.
 * Renvoie `null` quand le champ n'a pas de libellé métier : voir la règle n° 2 en tête de fichier.
 */
export function phraseChangement(entite: string, champ: string, avant: unknown, apres: unknown): string | null {
  // La corbeille n'est pas « une date qui passe de vide à 18/08 » : c'est un geste, et il a un nom.
  if (champ === "deleted_at") {
    return apres ? "a mis la fiche à la corbeille" : "a restauré la fiche depuis la corbeille";
  }
  if (champ === "archive" && entite === "clients") {
    return apres ? "a archivé le client" : "a réactivé le client";
  }

  const libelle = libelleChamp(entite, champ);
  if (!libelle) return null;

  const vide = (v: unknown) => v === null || v === undefined || v === "";
  const av = valeurFr(entite, champ, avant);
  const ap = valeurFr(entite, champ, apres);

  if (vide(avant)) return `a renseigné ${libelle} : ${ap}`;
  if (vide(apres)) return `a effacé ${libelle} (c'était ${av})`;
  return `a fait passer ${libelle} de ${av} à ${ap}`;
}

/** Ce qu'un écran affiche pour une ligne du journal. */
export type EntreeJournal = {
  id: number;
  quand: string;
  qui: string;
  /** Les phrases lisibles, dans l'ordre des champs. */
  phrases: string[];
  /** Champs modifiés qu'on n'a pas su nommer : comptés, jamais affichés sous leur nom technique. */
  nonTraduits: number;
};

export function entreeJournal(l: LigneJournal): EntreeJournal {
  const base = { id: l.id, quand: horodatageFr(l.created_at), qui: auteurFr(l) };

  if (l.action === "creation") {
    return { ...base, phrases: [`a créé ${libelleEntite(l.entity)}`], nonTraduits: 0 };
  }
  if (l.action === "suppression") {
    return { ...base, phrases: [`a supprimé définitivement ${libelleEntite(l.entity)}`], nonTraduits: 0 };
  }

  const champs = l.payload?.champs ?? {};
  const phrases: string[] = [];
  let nonTraduits = 0;
  for (const [champ, d] of Object.entries(champs)) {
    const p = phraseChangement(l.entity, champ, d?.avant, d?.apres);
    if (p) phrases.push(p);
    else nonTraduits += 1;
  }
  // Une écriture n'ayant touché que des champs sans libellé reste visible : c'est une écriture,
  // et la taire donnerait un journal qui saute des lignes.
  if (phrases.length === 0 && nonTraduits > 0) {
    phrases.push(`a modifié ${libelleEntite(l.entity)}`);
    nonTraduits = 0;
  }
  return { ...base, phrases, nonTraduits };
}

/** La phrase complète, auteur et date compris — celle qu'on lit à voix haute devant un client. */
export function phraseComplete(l: LigneJournal): string {
  const e = entreeJournal(l);
  const majuscule = e.quand.charAt(0).toUpperCase() + e.quand.slice(1);
  return `${majuscule}, ${e.qui} ${e.phrases.join(", ")}.`;
}
