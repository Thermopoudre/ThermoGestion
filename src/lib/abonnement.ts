export type PlanCode = "atelier" | "equipe" | "certifie";
export type Periode = "mois" | "an";

export type Offre = {
  code: PlanCode;
  nom: string;
  prixMensuel: number;
  prixAnnuel: number;
  argument: string;
  /** Ce que la formule ajoute à la précédente. La première liste est le métier complet. */
  inclus: string[];
  /** Phrase qui explique *pourquoi* on paie plus, et qui n'est jamais « plus de fonctions ». */
  raison: string;
};

/**
 * Source unique des formules : la vitrine, la page tarifs et l'écran d'abonnement lisent la même
 * liste, sinon elles divergent et le prospect découvre l'écart après avoir payé.
 *
 * Le principe de segmentation, décidé par Alexis : **ce qui fait payer plus n'est jamais le
 * métier, c'est le nombre de personnes et le niveau de preuve exigé par les clients.** Le module
 * jantes est donc dans la formule d'entrée : un rénovateur de jantes qui travaille seul a tout
 * son métier à 79 €, sans avoir à financer des fonctions d'équipe dont il n'a pas l'usage.
 *
 * « Paiement en ligne des factures » et « portail client » n'apparaissent nulle part, et c'est
 * volontaire : le premier est écrit et testé mais `STRIPE_SECRET_KEY` est absente en production
 * (audit fonctionnel #25), le second n'existe pas du tout (#38). Une fonction vendue et
 * indisponible se paie en démonstration.
 */
export const OFFRES: Offre[] = [
  {
    code: "atelier",
    nom: "Atelier",
    prixMensuel: 79,
    prixAnnuel: 790,
    argument: "Le métier complet, jantes et industrie, quelle que soit la taille de l'atelier.",
    raison: "Tout ce qu'il faut pour chiffrer, produire, livrer et facturer.",
    inclus: [
      "Devis au m², au ml et au pouce + signature en ligne",
      "Dossier jantes complet : véhicule, jeu, suivi roue par roue, teinte d'origine constructeur",
      "Bon de prise en charge photographié et signé",
      "Suivi de production et QR par projet",
      "Stock poudres : lots, DLU, décompte à la cuisson",
      "Réception avec photos",
      "Bon de livraison signé",
      "Factures, Factur-X et export comptable FEC",
      "2 utilisateurs inclus, puis 5 € HT par utilisateur",
    ],
  },
  {
    code: "equipe",
    nom: "Équipe",
    prixMensuel: 129,
    prixAnnuel: 1290,
    argument: "Ce que la taille impose, quand on n'est plus seul devant le four.",
    raison: "On ne paie pas plus de métier : on paie ce que l'organisation d'une équipe réclame.",
    inclus: [
      "Tout le plan Atelier, plus :",
      "5 utilisateurs inclus, puis 5 € HT par utilisateur",
      "Facturation mensuelle récapitulative",
      "Tarifs négociés par client",
      "Planification des fournées et capacité du four",
      "Prix de revient réel et rentabilité par client",
      "Relances automatiques des devis et des impayés",
      "Commande de poudre au catalogue Thermopoudre",
    ],
  },
  {
    code: "certifie",
    nom: "Certifié",
    prixMensuel: 249,
    prixAnnuel: 2490,
    argument: "Ce que la réglementation impose, et que personne d'autre ne vend.",
    raison: "La preuve opposable que votre donneur d'ordre et votre auditeur réclament.",
    inclus: [
      "Tout le plan Équipe, plus :",
      "10 utilisateurs inclus, puis 5 € HT par utilisateur",
      "Cahier de contrôles avec seuils paramétrables",
      "Registre des bains et étalonnage des instruments",
      "Non-conformités et Pareto des défauts",
      "Certificat de conformité opposable",
      "Fiche de cuisson tracée",
      "Registre des déchets ICPE",
      "Classeur FDS",
    ],
  },
];

/** Deux mois offerts sur l'engagement annuel : la remise est portée par les prix, pas par un calcul. */
export const MOIS_OFFERTS_ANNUEL = 2;

/**
 * Sièges compris dans chaque formule. Miroir exact de `sieges_inclus()` en base, comparé par un test.
 *
 * Le nombre d'utilisateurs n'est plus une marche entre formules : c'est un compteur linéaire.
 * L'ancienne règle — 2 utilisateurs sur Atelier, illimité au-dessus — faisait payer 63 % de plus
 * à un atelier qui embauchait un troisième opérateur, pour un simple accès, et il découvrait au
 * passage qu'il achetait la planification des fournées. Elle plafonnait aussi la cible jantes à
 * 79 € : le segment le plus différenciant du produit, et le moins rentable. Un siège se paie
 * désormais à l'unité, et la marche 79 → 129 € ne vend plus que ce qu'elle contient vraiment.
 */
export const SIEGES_INCLUS: Record<PlanCode, number> = {
  atelier: 2,
  equipe: 5,
  certifie: 10,
};

/** Siège supplémentaire, au-delà de ceux compris dans la formule. */
export const PRIX_SIEGE_MENSUEL = 5;
/** Deux mois offerts, comme sur les formules : la remise est portée par le prix, pas par un calcul. */
export const PRIX_SIEGE_ANNUEL = 50;

export function prixSiege(periode: Periode): number {
  return periode === "an" ? PRIX_SIEGE_ANNUEL : PRIX_SIEGE_MENSUEL;
}

/**
 * Les capacités ouvertes par formule.
 *
 * C'est la **traduction lisible** du barème appliqué en base par `capacite_du_plan()` : les deux
 * listes doivent rester identiques, et un test les compare. Un droit qui ne vivrait qu'ici serait
 * un verrou de navigateur, c'est-à-dire aucun verrou — ce projet en a déjà pris cinq en défaut.
 */
export const CAPACITES = [
  "tarifs_negocies",
  "facturation_mensuelle",
  "fournees",
  "rentabilite",
  "relances_auto",
  "commande_poudre",
  "qualite",
  "certificat",
  "fiche_cuisson",
  "registre_dechets",
  "fds",
] as const;

export type Capacite = (typeof CAPACITES)[number];

export const NIVEAU_PLAN: Record<PlanCode, number> = { atelier: 1, equipe: 2, certifie: 3 };

/** Niveau minimal exigé par chaque capacité. Doit être le miroir exact de `capacite_du_plan()`. */
export const NIVEAU_REQUIS: Record<Capacite, number> = {
  tarifs_negocies: 2,
  facturation_mensuelle: 2,
  fournees: 2,
  rentabilite: 2,
  relances_auto: 2,
  commande_poudre: 2,
  qualite: 3,
  certificat: 3,
  fiche_cuisson: 3,
  registre_dechets: 3,
  fds: 3,
};

/** Ce qu'on montre à l'atelier quand il ouvre un écran que sa formule ne couvre pas. */
export const LIBELLE_CAPACITE: Record<Capacite, { titre: string; pourquoi: string }> = {
  tarifs_negocies: {
    titre: "Tarifs négociés par client",
    pourquoi:
      "Fixer un prix par prestation et par client, pour que le devis d'un donneur d'ordre sous contrat sorte au bon prix sans que personne ait à s'en souvenir.",
  },
  facturation_mensuelle: {
    titre: "Facturation mensuelle récapitulative",
    pourquoi:
      "Regrouper les bons de livraison d'un mois en une seule facture, remise reportée bon par bon. C'est ce que réclament les donneurs d'ordre qui vous livrent trois fois par semaine.",
  },
  fournees: {
    titre: "Planification des fournées",
    pourquoi:
      "Grouper les pièces par teinte et par cycle, remplir le four et refuser une fournée incompatible. Vous cuisez toujours sans, vous ne planifiez plus à la tête du client.",
  },
  rentabilite: {
    titre: "Prix de revient et rentabilité par client",
    pourquoi:
      "Poudre au prix du lot, main d'œuvre pointée, énergie au prorata, frais généraux : la marge réelle par chantier et par client, y compris ceux que vous perdez.",
  },
  relances_auto: {
    titre: "Relances automatiques",
    pourquoi:
      "Les devis sans réponse et les factures échues sont relancés seuls, en votre nom. C'est le travail que personne ne fait le vendredi soir.",
  },
  commande_poudre: {
    titre: "Commande de poudre au catalogue",
    pourquoi:
      "Le panier de réapprovisionnement se prépare à partir de vos seuils, et part au fournisseur avec les références exactes.",
  },
  qualite: {
    titre: "Cahier de contrôles et qualité tracée",
    pourquoi:
      "Épaisseur, brillance, adhérence, Buchholz, polymérisation, aspect : les seuils de votre référentiel, le verdict rendu par la base et non par le poste de saisie, et un contrôle qui ne peut plus être effacé.",
  },
  certificat: {
    titre: "Certificat de conformité",
    pourquoi:
      "Le document opposable que votre client joint à son dossier — et qui refuse de s'imprimer tant qu'une mesure manque.",
  },
  fiche_cuisson: {
    titre: "Fiche de cuisson tracée",
    pourquoi:
      "Consigne, relevé, écart, opérateur, lot de poudre et visas : la pièce que l'auditeur demande quand il remonte d'une pièce livrée jusqu'au four.",
  },
  registre_dechets: {
    titre: "Registre des déchets ICPE",
    pourquoi:
      "Le registre de l'article R.541-43, avec la nomenclature pré-chargée et l'alerte sur un déchet dangereux sorti sans bordereau.",
  },
  fds: {
    titre: "Classeur FDS",
    pourquoi:
      "Les fiches de données de sécurité de vos poudres, consultables depuis l'atelier, avec l'alerte au-delà de trois ans.",
  },
};

/** Formule minimale qui ouvre une capacité. */
export function planRequis(capacite: Capacite): PlanCode {
  const niveau = NIVEAU_REQUIS[capacite];
  return (Object.keys(NIVEAU_PLAN) as PlanCode[]).find((p) => NIVEAU_PLAN[p] === niveau) ?? "certifie";
}

export function offre(plan: PlanCode | string | null | undefined): Offre | undefined {
  return OFFRES.find((o) => o.code === plan);
}

export function nomPlan(plan: PlanCode | string | null | undefined): string {
  return offre(plan)?.nom ?? String(plan ?? "—");
}

/** Clé de recherche du prix côté Stripe. Les identifiants `price_…` ne sont jamais écrits
 *  en dur dans le code : on les retrouve par lookup_key, ce qui permet de changer un tarif
 *  dans Stripe sans redéployer. Huit tarifs : trois formules et le siège, × deux périodicités. */
export function lookupKey(plan: PlanCode, periode: Periode) {
  return `thermogestion_${plan}_${periode === "an" ? "annuel" : "mensuel"}`;
}

/** Le siège supplémentaire, facturé à la quantité sur le même abonnement que la formule. */
export function lookupKeySiege(periode: Periode) {
  return `thermogestion_siege_${periode === "an" ? "annuel" : "mensuel"}`;
}

/** Reconnaît une clé de siège, pour ne jamais la confondre avec une formule. */
export function estCleSiege(cle: string | null | undefined): boolean {
  return !!cle && (cle === lookupKeySiege("mois") || cle === lookupKeySiege("an"));
}

export const LOOKUP_KEYS = [
  ...OFFRES.flatMap((o) =>
    (["mois", "an"] as Periode[]).map((p) => ({
      cle: lookupKey(o.code, p),
      plan: o.code as PlanCode | "siege",
      periode: p,
      montant: p === "an" ? o.prixAnnuel : o.prixMensuel,
    })),
  ),
  ...(["mois", "an"] as Periode[]).map((p) => ({
    cle: lookupKeySiege(p),
    plan: "siege" as PlanCode | "siege",
    periode: p,
    montant: prixSiege(p),
  })),
];

export type Abonnement = {
  plan: string;
  status: string;
  trial_end: string | null;
  /** Formule prévisualisée pendant l'essai. `null` = l'essai ouvre tout. */
  apercu_plan?: string | null;
  /** Sièges payants au-delà de ceux compris dans la formule. Écrit par le webhook Stripe seul. */
  sieges_supp?: number | null;
  /** Périodicité réellement souscrite (`mois` ou `an`), déduite de la lookup_key par le webhook. */
  periode?: string | null;
};

/** Un abonnement donne accès à l'application tant qu'il est en essai non expiré,
 *  actif, ou en retard de paiement (on laisse une chance de régulariser plutôt que
 *  de couper net un atelier dont la carte a expiré). */
export function accesOuvert(sub: Abonnement | null): boolean {
  if (!sub) return false;
  if (sub.status === "active" || sub.status === "past_due") return true;
  if (sub.status === "trialing") return !essaiExpire(sub);
  return false;
}

export function enEssai(sub: Abonnement | null): boolean {
  return !!sub && sub.status === "trialing" && !essaiExpire(sub);
}

function essaiExpire(sub: Abonnement): boolean {
  if (sub.status !== "trialing") return false;
  if (!sub.trial_end) return false;
  return new Date(sub.trial_end).getTime() <= Date.now();
}

/**
 * Formule qui fait foi pour les droits.
 *
 * Miroir exact de `plan_effectif()` en base. Pendant l'essai, tout est ouvert — l'atelier doit
 * voir ce qu'il achète — sauf s'il a explicitement demandé l'aperçu d'une formule pour comparer.
 */
export function planEffectif(sub: Abonnement | null): PlanCode {
  if (!sub) return "atelier";
  if (enEssai(sub)) return (sub.apercu_plan as PlanCode) ?? "certifie";
  return (["atelier", "equipe", "certifie"].includes(sub.plan) ? sub.plan : "atelier") as PlanCode;
}

/** Le droit tel que l'écran doit l'afficher. La base rejouera le même calcul à l'écriture. */
export function capaciteOuverte(sub: Abonnement | null, capacite: Capacite): boolean {
  if (!accesOuvert(sub)) return false;
  return NIVEAU_PLAN[planEffectif(sub)] >= NIVEAU_REQUIS[capacite];
}

/** Sièges compris dans la formule en vigueur, hors sièges achetés. */
export function siegesInclus(sub: Abonnement | null): number {
  return SIEGES_INCLUS[planEffectif(sub)];
}

/**
 * Utilisateurs autorisés : ceux de la formule, plus les sièges payés.
 * Miroir de `sieges_autorises()` en base, qui est la seule règle qui compte — celle-ci ne fait
 * qu'éviter d'afficher un bouton que la base refuserait.
 */
export function siegesAutorises(sub: Abonnement | null): number {
  return siegesInclus(sub) + Math.max(0, sub?.sieges_supp ?? 0);
}

/** Ce que coûtent en plus, chaque mois, les sièges achetés au-delà de la formule. */
export function coutSiegesMensuel(sub: Abonnement | null): number {
  return Math.max(0, sub?.sieges_supp ?? 0) * PRIX_SIEGE_MENSUEL;
}

export function joursRestantsEssai(sub: Abonnement | null): number | null {
  if (!sub || sub.status !== "trialing" || !sub.trial_end) return null;
  return Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000));
}

/** Prix d'entrée affiché partout où l'on annonce « à partir de ». Une seule source. */
export const PRIX_ENTREE = OFFRES[0].prixMensuel;
