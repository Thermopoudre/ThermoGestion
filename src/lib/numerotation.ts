/**
 * Reprise de la numérotation d'un atelier qui migre.
 *
 * Un atelier qui s'installe n'en est jamais à sa première facture : celui du pilote en est à
 * FA-2026-0347. Si le logiciel repart à FA-2026-0001, l'exercice porte deux séries pour la même
 * année — le fichier des écritures comptables est refusé par le cabinet, et la numérotation
 * « chronologique et continue » de l'article 242 nonies A de l'annexe II au CGI n'est plus tenue.
 *
 * Tout ce qui décide vit en base (`poser_numerotation`, `ma_numerotation`) : ce fichier ne sert
 * qu'à éviter un aller-retour pour un refus que l'écran pouvait prévoir, et à afficher l'aperçu
 * pendant la frappe. Les deux règles ci-dessous sont donc des COPIES de règles de base, pas des
 * règles à part — si l'une change, l'autre doit suivre.
 */

/** Types de document dont la numérotation se règle à l'écran, dans l'ordre d'affichage. */
export type TypeNumerotation =
  | "devis" | "facture" | "avoir" | "bl" | "projet" | "jantes" | "fournee";

/** Une ligne de `ma_numerotation()`, telle que la base la rend. */
export type LigneNumerotation = {
  type: TypeNumerotation;
  libelle: string;
  prefixe: string;
  prefixe_defaut: string;
  prochain: number;
  annee: number;
  /** Un document de ce type est déjà parti cette année : la série ne se déplace plus. */
  verrouille: boolean;
  apercu: string;
};

/**
 * Forme exacte d'un numéro, telle que `_next_numero()` la construit :
 * `format('%s-%s-%s', prefixe, annee, lpad(valeur, 4, '0'))`.
 *
 * Le zéro de tête est sur quatre positions et ne tronque jamais : au-delà de 9 999, le numéro
 * s'allonge au lieu de repartir à zéro — c'est ce qu'il faut, un compteur qui reboucle produit
 * deux fois le même numéro.
 */
export function apercuNumero(prefixe: string, annee: number, rang: number): string {
  return `${prefixe}-${annee}-${String(Math.max(1, Math.trunc(rang))).padStart(4, "0")}`;
}

/** Copie de la contrainte de `poser_numerotation` : le tiret sépare, il ne s'écrit pas dans le préfixe. */
export const PREFIXE_VALIDE = /^[A-Z0-9]{1,6}$/;

/** Normalisation de la frappe : l'atelier tape « fa », la base attend « FA ». */
export function normaliserPrefixe(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

/** Ce que l'écran refuse avant d'appeler la base — mêmes bornes, mêmes mots. */
export function motifRefusNumerotation(prefixe: string, prochain: number): string | null {
  if (!PREFIXE_VALIDE.test(prefixe)) {
    return "Le préfixe fait de 1 à 6 caractères, lettres non accentuées et chiffres uniquement (FA, DV, FACT…).";
  }
  if (!Number.isFinite(prochain) || !Number.isInteger(prochain) || prochain < 1 || prochain > 999_999) {
    return "Le prochain numéro est un entier compris entre 1 et 999 999.";
  }
  return null;
}
