/**
 * Doublons — prévenir à la saisie, refuser en base.
 *
 * Le constat : aucune contrainte d'unicité n'existait sur `clients`, `poudres` ni `prestations`.
 * « SARL DURAND », « Sarl Durand » et « Durand SARL » coexistaient, chacun avec une part de
 * l'historique, et la rentabilité par client devenait fausse par construction.
 *
 * Deux dispositifs, et il faut les deux :
 *
 *  * **La contrainte**, en base, sur le nom normalisé par atelier. Elle est infranchissable, mais
 *    elle ne parle qu'au moment de l'enregistrement et seulement sur une identité exacte.
 *  * **L'alerte**, ici. Elle voit large — l'ordre des mots, la forme juridique, la casse — et
 *    elle n'empêche rien. C'est important : « Durand Père » et « Durand Fils » sont deux vrais
 *    clients, et un logiciel qui refuse le second a tort.
 *
 * La normalisation n'est pas réécrite : `normaliser()` de `recherche.ts` rend exactement la même
 * chaîne que `public.txt_normalise()` en base. Une troisième implémentation finirait par diverger.
 */
import { normaliser } from "@/lib/recherche";

/**
 * Mots qui ne distinguent personne.
 *
 * Formes juridiques, civilités et liants : ils sont présents dans un carnet d'adresses sur trois
 * et les garder ferait répondre l'alerte à chaque saisie. « SARL Durand » et « Durand SARL » ne
 * se ressemblent que par « durand » — c'est le seul mot qui porte l'information.
 */
const MOTS_VIDES = new Set([
  "sarl", "sarlu", "sas", "sasu", "sa", "sci", "scic", "scop", "snc", "eurl", "eirl", "ei",
  "ste", "societe", "sté", "cie", "compagnie", "groupe", "holding",
  "ets", "etablissement", "etablissements", "entreprise", "entreprises",
  "monsieur", "madame", "mr", "mme", "mlle",
  "de", "du", "des", "la", "le", "les", "et", "aux", "au", "chez",
]);

/**
 * Longueur minimale d'un mot retenu.
 *
 * Trois lettres : en dessous, un mot répond dans une fiche sur deux et l'alerte devient du bruit
 * qu'on apprend à ignorer — c'est-à-dire une alerte qui ne sert plus à rien.
 */
const LONGUEUR_MIN_MOT = 3;

/**
 * Les mots d'un nom qui portent réellement l'identité, normalisés.
 *
 * Si tout a été écarté (« SARL », « M. et Mme »), on rend le nom normalisé entier plutôt que rien :
 * mieux vaut une alerte trop large qu'aucune alerte sur une saisie qui n'est faite que de mots
 * communs.
 */
export function motsSignificatifs(nom: string): string[] {
  const mots = normaliser(nom)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= LONGUEUR_MIN_MOT && !MOTS_VIDES.has(m));
  if (mots.length > 0) return [...new Set(mots)];
  const entier = normaliser(nom).replace(/[^a-z0-9]+/g, "");
  return entier.length >= 2 ? [entier] : [];
}

/**
 * Les mots à envoyer à la base, au plus deux.
 *
 * Chaîner deux conditions `like` sur la colonne `recherche` produit un **et** : « Garage Martin »
 * ne répond que sur les fiches qui contiennent les deux mots, pas sur tous les garages de la
 * ville. Au-delà de deux, la requête se resserre au point de ne plus rien trouver dès qu'un mot
 * manque à la fiche existante — ce qui est justement le cas d'un doublon mal orthographié.
 *
 * Les plus longs d'abord : ce sont les plus discriminants.
 */
export function motsPourRecherche(nom: string): string[] {
  return motsSignificatifs(nom).sort((a, b) => b.length - a.length).slice(0, 2);
}

/** En dessous, on n'interroge pas : la saisie est encore en cours de frappe. */
export const MIN_CARACTERES_ALERTE = 3;

/** Anti-rebond de l'alerte. Plus long que celui de la recherche : personne n'attend ce résultat. */
export const REBOND_ALERTE_MS = 500;

/**
 * Deux noms désignent-ils la même fiche au sens de la contrainte d'unicité ?
 *
 * Exactement la règle de l'index `clients_nom_unique_par_atelier` : si c'est vrai, la base
 * refusera l'enregistrement. L'alerte le dit alors autrement — « existe déjà » plutôt que
 * « nom proche » — parce que l'exploitant n'a pas le choix dans ce cas-là.
 */
export function memeNom(a: string, b: string): boolean {
  return normaliser(a).trim() === normaliser(b).trim();
}

/** Les chiffres seuls d'un SIRET : « 123 456 789 00012 » et « 12345678900012 » sont le même. */
export function siretNormalise(siret: string): string {
  return siret.replace(/[^0-9]/g, "");
}
