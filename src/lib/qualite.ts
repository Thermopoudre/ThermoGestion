import { CLASSES_TON, type TonBadge } from "@/lib/tons";
import type { ControleType, ReferentielQualite } from "@/lib/types";

/**
 * Seuils, verdicts et typologies du module Qualité (Qualicoat / Qualisteelcoat / Qualimarine).
 *
 * Le référentiel exact (classes, tolérances) varie selon le label visé et la classe demandée par
 * le donneur d'ordre : les seuils sont donc réglables par atelier, dans la table
 * `referentiels_qualite`. Les valeurs ci-dessous sont celles de la classe 1 Qualicoat, la plus
 * répandue en sous-traitance générale ; elles servent de référentiel par défaut à la création d'un
 * atelier et de repli si aucun référentiel n'est renseigné.
 */

export type SeuilsQualite = {
  epaisseur_mini_um: number;
  /** `null` = pas de maximum : Qualicoat ne plafonne pas l'épaisseur, certains cahiers des charges si. */
  epaisseur_maxi_um: number | null;
  brillance_tolerance_ub: number;
  adherence_classe_max: number;
  buchholz_min: number;
};

export const SEUILS_QUALICOAT_CLASSE_1: SeuilsQualite = {
  epaisseur_mini_um: 60, // minimum en tout point
  epaisseur_maxi_um: null,
  brillance_tolerance_ub: 10, // unités de brillance, +/- autour du nominal de la teinte
  adherence_classe_max: 1, // ISO 2409 : conforme jusqu'à la classe 1 (0 = parfait)
  buchholz_min: 80,
};

/**
 * Les `numeric` de PostgREST reviennent en chaîne, et un contrôle d'avant la migration 23 peut
 * n'avoir aucun snapshot. Toute lecture de seuils passe par ici pour ne jamais comparer une mesure
 * à `undefined` — ce qui rendrait « non conforme » silencieusement.
 */
export function normaliserSeuils(brut: unknown): SeuilsQualite {
  const o = (brut ?? {}) as Record<string, unknown>;
  const n = (v: unknown, defaut: number): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : defaut;
  };
  const maxi = Number(o.epaisseur_maxi_um);
  return {
    epaisseur_mini_um: n(o.epaisseur_mini_um, SEUILS_QUALICOAT_CLASSE_1.epaisseur_mini_um),
    epaisseur_maxi_um: o.epaisseur_maxi_um == null || !Number.isFinite(maxi) ? null : maxi,
    brillance_tolerance_ub: n(o.brillance_tolerance_ub, SEUILS_QUALICOAT_CLASSE_1.brillance_tolerance_ub),
    adherence_classe_max: n(o.adherence_classe_max, SEUILS_QUALICOAT_CLASSE_1.adherence_classe_max),
    buchholz_min: n(o.buchholz_min, SEUILS_QUALICOAT_CLASSE_1.buchholz_min),
  };
}

export function seuilsDuReferentiel(r: ReferentielQualite | null | undefined): SeuilsQualite {
  return r ? normaliserSeuils(r) : SEUILS_QUALICOAT_CLASSE_1;
}

/** Ce que chaque seuil veut dire, affiché à côté du champ de saisie du référentiel. */
export const EXPLICATION_SEUILS: { cle: keyof SeuilsQualite; titre: string; texte: string }[] = [
  {
    cle: "epaisseur_mini_um",
    titre: "Épaisseur minimale",
    texte:
      "Épaisseur de film sec en dessous de laquelle la couche ne protège plus. Le verdict se joue sur le point le plus fin relevé, jamais sur la moyenne : c'est là que la corrosion démarre. Qualicoat classe 1 exige 60 µm ; un cahier des charges Qualisteelcoat en ambiance marine peut demander 80 µm ou plus.",
  },
  {
    cle: "epaisseur_maxi_um",
    titre: "Épaisseur maximale",
    texte:
      "Facultatif. Au-delà d'une certaine épaisseur, le film devient cassant et l'aspect se dégrade. Qualicoat ne plafonne pas ; certains donneurs d'ordre le font. Laissé vide, aucun contrôle de surépaisseur n'est appliqué. Le verdict porte alors sur l'épaisseur maxi relevée, quand elle est saisie.",
  },
  {
    cle: "brillance_tolerance_ub",
    titre: "Tolérance de brillance",
    texte:
      "Écart admis, en unités de brillance mesurées à 60°, entre la valeur relevée et la valeur nominale de la teinte. Une tolérance large accepte des lots visiblement différents côte à côte ; une tolérance serrée multiplie les rebuts.",
  },
  {
    cle: "adherence_classe_max",
    titre: "Classe d'adhérence maximale (ISO 2409)",
    texte:
      "Résultat du quadrillage : 0 = aucun écaillage, 5 = décollement massif. Le contrôle est conforme jusqu'à la classe indiquée incluse. Qualicoat accepte la classe 1 ; un marché public exige souvent la classe 0.",
  },
  {
    cle: "buchholz_min",
    titre: "Dureté Buchholz minimale",
    texte:
      "Indice de résistance à l'indentation : plus il est élevé, plus le film est dur. Une valeur basse trahit une cuisson insuffisante. Le repère usuel est 80.",
  },
];

export const TYPES_CONTROLE: ControleType[] = ["epaisseur", "brillance", "adherence", "buchholz", "polymerisation", "aspect"];

/**
 * Contrôles réellement pratiqués par l'atelier sous un référentiel donné.
 *
 * Beaucoup d'ateliers ne mesurent jamais l'épaisseur, d'autres ni la brillance ni le Buchholz.
 * Imposer les six types produisait deux effets contraires à la promesse du produit : une saisie
 * encombrée de mesures qu'on ne fait pas, et un certificat de conformité **inédictable** faute
 * d'épaisseur. Un référentiel sans liste (base antérieure à la migration) vaut « tout est
 * pratiqué » : jamais moins de contrôles qu'avant sans que l'atelier l'ait décidé.
 */
export function typesControleActifs(r: { types_controle?: ControleType[] | null } | null | undefined): ControleType[] {
  const liste = r?.types_controle;
  if (!Array.isArray(liste) || liste.length === 0) return [...TYPES_CONTROLE];
  // On repasse par TYPES_CONTROLE pour garder l'ordre d'affichage stable quel que soit l'ordre du tableau.
  return TYPES_CONTROLE.filter((t) => liste.includes(t));
}

/**
 * Labels dont le référentiel impose une mesure d'épaisseur de film.
 *
 * Qualicoat, Qualisteelcoat, Qualimarine et Qualidéco reposent tous sur un minimum d'épaisseur
 * contrôlé en production : un atelier qui revendique le label et coupe le contrôle d'épaisseur
 * n'est plus en règle avec son propre agrément. On l'avertit, on ne l'empêche pas — c'est son
 * agrément, pas le nôtre.
 */
export const LABELS_EXIGEANT_EPAISSEUR = ["Qualicoat", "Qualisteelcoat", "Qualimarine", "Qualidéco"];

export function labelExigeEpaisseur(label: string | null | undefined): boolean {
  return !!label && LABELS_EXIGEANT_EPAISSEUR.includes(label);
}

export const TYPE_CONTROLE_LABEL: Record<ControleType, string> = {
  epaisseur: "Épaisseur",
  brillance: "Brillance",
  adherence: "Adhérence",
  buchholz: "Dureté Buchholz",
  polymerisation: "Polymérisation",
  aspect: "Aspect",
};

export const TYPE_CONTROLE_UNITE: Record<ControleType, string> = {
  epaisseur: "µm",
  brillance: "UB",
  adherence: "",
  buchholz: "",
  polymerisation: "",
  aspect: "",
};

// Type d'instrument attendu pour chaque contrôle : sert à filtrer la liste d'instruments proposée
// à la saisie, pour ne pas faire chercher l'opérateur dans une liste qui mélange tout l'atelier.
export const INSTRUMENT_POUR_TYPE: Partial<Record<ControleType, string>> = {
  epaisseur: "sonde_epaisseur",
  brillance: "brillancemetre",
  adherence: "grille_quadrillage",
  buchholz: "duretometre_buchholz",
  polymerisation: "kit_mek",
};

export const INSTRUMENT_TYPE_LABEL: Record<string, string> = {
  sonde_epaisseur: "Sonde d'épaisseur",
  brillancemetre: "Brillancemètre",
  grille_quadrillage: "Grille de quadrillage (ISO 2409)",
  duretometre_buchholz: "Duromètre Buchholz",
  kit_mek: "Kit test MEK",
  autre: "Autre",
};

export type ValeursEpaisseur = { mini: number | null; maxi: number | null; moyenne: number | null };
export type ValeursBrillance = { valeur: number | null; nominale: number | null };
export type ValeursAdherence = { classe: number | null };
export type ValeursBuchholz = { valeur: number | null };
export type ValeursPolymerisation = { resultat: "conforme" | "limite" | "non_conforme" | null };
export type ValeursAspect = { conforme: boolean | null; defaut: string | null };

export const POLYMERISATION_LABEL: Record<string, string> = {
  conforme: "Conforme",
  limite: "Limite",
  non_conforme: "Non conforme",
};

export function valeursParDefaut(type: ControleType): Record<string, unknown> {
  switch (type) {
    case "epaisseur": return { mini: null, maxi: null, moyenne: null };
    case "brillance": return { valeur: null, nominale: null };
    case "adherence": return { classe: null };
    case "buchholz": return { valeur: null };
    case "polymerisation": return { resultat: null };
    case "aspect": return { conforme: null, defaut: null };
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcule le verdict conforme/non conforme à partir des valeurs saisies et des seuils du
 * référentiel retenu.
 *
 * Retourne `null` tant que les valeurs nécessaires ne sont pas toutes renseignées : pas de verdict
 * affiché sur un contrôle incomplet plutôt qu'un faux "conforme" par défaut qui endormirait l'opérateur.
 *
 * Cette fonction sert au verdict affiché **avant** enregistrement. Un contrôle déjà enregistré ne
 * repasse jamais par ici : les écrans et les PDF lisent le `conforme` stocké, et la base refuse
 * qu'il soit modifié (trigger `figer_controle`).
 */
export function calculerConformite(
  type: ControleType,
  valeurs: Record<string, unknown>,
  seuils: SeuilsQualite = SEUILS_QUALICOAT_CLASSE_1,
): boolean | null {
  switch (type) {
    case "epaisseur": {
      // Le verdict se joue sur le MINI, jamais sur la moyenne : Qualicoat sanctionne le point le plus
      // fin du revêtement, celui où la protection anticorrosion cède en premier. Une moyenne flatteuse
      // avec un point relevé à 40 µm reste non conforme.
      const mini = num(valeurs.mini);
      if (mini == null) return null;
      if (mini < seuils.epaisseur_mini_um) return false;
      // La surépaisseur ne se juge que sur le point le plus épais, et seulement si le référentiel
      // en fixe un plafond et que l'opérateur a relevé le maxi.
      const maxi = num(valeurs.maxi);
      if (seuils.epaisseur_maxi_um != null && maxi != null && maxi > seuils.epaisseur_maxi_um) return false;
      return true;
    }
    case "brillance": {
      const valeur = num(valeurs.valeur);
      const nominale = num(valeurs.nominale);
      if (valeur == null || nominale == null) return null;
      return Math.abs(valeur - nominale) <= seuils.brillance_tolerance_ub;
    }
    case "adherence": {
      const classe = num(valeurs.classe);
      if (classe == null) return null;
      return classe <= seuils.adherence_classe_max;
    }
    case "buchholz": {
      const valeur = num(valeurs.valeur);
      if (valeur == null) return null;
      return valeur >= seuils.buchholz_min;
    }
    case "polymerisation": {
      const resultat = valeurs.resultat;
      if (!resultat) return null;
      return resultat === "conforme";
    }
    case "aspect": {
      const conforme = valeurs.conforme;
      if (conforme === null || conforme === undefined) return null;
      return !!conforme;
    }
    default:
      return null;
  }
}

/** Résumé lisible des valeurs d'un contrôle, pour les listes d'historique et le PDF du registre. */
export function resumeValeurs(type: ControleType, valeurs: Record<string, unknown>): string {
  switch (type) {
    case "epaisseur": {
      const mini = num(valeurs.mini), maxi = num(valeurs.maxi), moyenne = num(valeurs.moyenne);
      const parts = [
        mini != null ? `mini ${mini} µm` : null,
        maxi != null ? `maxi ${maxi} µm` : null,
        moyenne != null ? `moy. ${moyenne} µm` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : "—";
    }
    case "brillance": {
      const valeur = num(valeurs.valeur), nominale = num(valeurs.nominale);
      if (valeur == null) return "—";
      return nominale != null ? `${valeur} UB (nominal ${nominale})` : `${valeur} UB`;
    }
    case "adherence": {
      const classe = num(valeurs.classe);
      return classe != null ? `Classe ${classe}` : "—";
    }
    case "buchholz": {
      const valeur = num(valeurs.valeur);
      return valeur != null ? `${valeur}` : "—";
    }
    case "polymerisation": {
      const resultat = valeurs.resultat as string | null;
      return resultat ? (POLYMERISATION_LABEL[resultat] ?? resultat) : "—";
    }
    case "aspect": {
      const conforme = valeurs.conforme as boolean | null;
      const defaut = valeurs.defaut as string | null;
      if (conforme == null) return "—";
      return conforme ? "Conforme" : defaut ? `Non conforme — ${defaut}` : "Non conforme";
    }
    default:
      return "—";
  }
}

/**
 * Défaut de la typologie à pré-sélectionner quand on propose de déclarer une non-conformité depuis
 * un contrôle qui vient d'échouer. Pour l'aspect, l'opérateur a déjà choisi le défaut exact : on le
 * reprend tel quel. Pour les autres types, seule une correspondance directe et sans ambiguïté est
 * proposée — mieux vaut laisser "Autre" que de deviner faux.
 */
export function suggestionDefautNC(type: ControleType, valeurs: Record<string, unknown>): string | null {
  switch (type) {
    case "aspect": return (valeurs.defaut as string | null) ?? null;
    case "epaisseur": return "Sous-épaisseur";
    case "brillance": return "Brillant non conforme";
    case "adherence": return "Manque d'accroche";
    default: return null;
  }
}

/**
 * Seuils appliqués, en une ligne. Imprimé sur le registre présenté à l'auditeur : un verdict sans
 * son barème ne se vérifie pas.
 */
export function resumeSeuils(seuils: SeuilsQualite): string {
  return [
    `épaisseur ≥ ${seuils.epaisseur_mini_um} µm`,
    seuils.epaisseur_maxi_um != null ? `et ≤ ${seuils.epaisseur_maxi_um} µm` : null,
    `· brillance ± ${seuils.brillance_tolerance_ub} UB`,
    `· adhérence ≤ classe ${seuils.adherence_classe_max}`,
    `· Buchholz ≥ ${seuils.buchholz_min}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function verdictLabel(conforme: boolean | null): string {
  if (conforme === null) return "En cours";
  return conforme ? "Conforme" : "Non conforme";
}

/** Le verdict d'un contrôle, en ton sémantique : c'est ce que consomment les `Badge`. */
export function verdictTon(conforme: boolean | null): TonBadge {
  if (conforme === null) return "neutral";
  return conforme ? "success" : "danger";
}

/**
 * Le même verdict en classes, pour le seul cas qui n'est pas un badge : le bandeau de synthèse
 * de `ControleForm`, qui occupe toute la largeur du formulaire. Il dérive de `verdictTon` pour
 * qu'il n'existe jamais deux définitions du vert « conforme ».
 */
export function verdictClass(conforme: boolean | null): string {
  return CLASSES_TON[verdictTon(conforme)];
}

// ── Typologie des défauts (non-conformités) ──────────────────────────────────
// Pré-chargée pour la saisie : l'opérateur pointe une cause connue plutôt que de la retaper à chaque
// fois. Les libellés doivent rester identiques d'une fiche à l'autre pour que le Pareto des défauts
// (non-conformités/page.tsx) puisse les agréger correctement.
export const TYPOLOGIE_DEFAUTS = [
  "Peau d'orange",
  "Cratères (silicone)",
  "Piqûres / dégazage (fonte, alu poreux)",
  "Coulure",
  "Manque d'accroche",
  "Faïençage",
  "Surépaisseur",
  "Sous-épaisseur",
  "Cage de Faraday (angles rentrants)",
  "Pollution / mélange époxy-polyester",
  "Marque de crochet",
  "Différence de teinte entre lots",
  "Brillant non conforme",
  "Autre",
] as const;

export const CAUSES_NC = [
  "Préparation de surface",
  "Application poudre",
  "Cuisson / polymérisation",
  "Poudre / lot",
  "Support / matériau",
  "Bain de prétraitement",
  "Manutention",
  "Autre",
] as const;

// ── Bains de prétraitement ────────────────────────────────────────────────────
// Liste indicative des bains d'une ligne de prétraitement classique avant thermolaquage. Le process
// réel (chimie, nombre de cuves) varie par atelier : ce n'est qu'une pré-saisie pratique, le champ
// `bain` reste un texte libre en base pour ne pas brider un atelier dont la ligne diffère.
export const BAINS_TYPES = [
  "Dégraissage",
  "Décapage",
  "Rinçage 1",
  "Rinçage 2",
  "Déoxydation",
  "Conversion (phosphatation / Cr3)",
  "Passivation",
  "Rinçage final (eau déminéralisée)",
  "Autre",
] as const;

// Le pH/conductivité/température "corrects" dépendent de la chimie retenue par le fournisseur de la
// ligne de prétraitement, pas d'un seuil universel Qualicoat : le champ `conforme` d'un bain reste
// donc une décision de l'opérateur, jamais calculée automatiquement — contrairement aux contrôles
// produit ci-dessus, qui obéissent aux seuils du référentiel choisi par l'atelier.

export type StatutEtalonnage = "ok" | "bientot" | "retard" | "jamais";

export const STATUT_ETALONNAGE_LABEL: Record<StatutEtalonnage, string> = {
  ok: "À jour",
  bientot: "À faire bientôt",
  retard: "En retard",
  jamais: "Jamais étalonné",
};

export const STATUT_ETALONNAGE_TON: Record<StatutEtalonnage, TonBadge> = {
  ok: "success",
  bientot: "warning",
  retard: "danger",
  // « Jamais étalonné » reste neutre, comme avant : c'est une absence de donnée, pas un
  // dépassement d'échéance. La page le signale déjà par son libellé.
  jamais: "neutral",
};

/** Un instrument non étalonné à temps invalide potentiellement toutes les mesures prises avec : c'est
 * exactement ce qu'un auditeur Qualicoat vérifie en premier. Seuil "bientôt" à 30 jours pour laisser
 * le temps de programmer l'étalonnage suivant avant l'échéance. */
export function etalonnageInfo(dernier: string | null, periodiciteMois: number): { statut: StatutEtalonnage; joursRestants: number | null; prochaine: string | null } {
  if (!dernier) return { statut: "jamais", joursRestants: null, prochaine: null };
  const prochaineDate = new Date(`${dernier}T00:00:00`);
  prochaineDate.setMonth(prochaineDate.getMonth() + periodiciteMois);
  const jours = Math.round((prochaineDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const statut: StatutEtalonnage = jours < 0 ? "retard" : jours <= 30 ? "bientot" : "ok";
  return { statut, joursRestants: jours, prochaine: prochaineDate.toISOString().slice(0, 10) };
}
