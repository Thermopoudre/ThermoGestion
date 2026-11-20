/**
 * Les plafonds et les tarifs de l'assistant — un seul endroit, parce qu'un plafond recopié est un
 * plafond qu'on oublie de baisser.
 *
 * Rien ici n'est un secret : la clé d'API vit dans l'environnement serveur et n'apparaît nulle
 * part dans ce fichier. Ce module est importable côté serveur uniquement (il n'a pas vocation à
 * partir dans le navigateur), mais il ne contiendrait rien de compromettant s'il partait.
 */

/**
 * La clé d'API, lue à chaud.
 *
 * POURQUOI une fonction et pas une constante : `src/lib/env.ts` donne à chaque variable une valeur
 * de repli, ce qui est le bon réflexe pour une URL publique et le pire pour une clé payante — un
 * repli inventé produirait un 401 chez Anthropic au lieu du message « assistant non configuré »
 * que l'exploitant doit lire. Il n'y a donc pas de repli, et l'absence se teste explicitement.
 */
export function cleApi(): string {
  return process.env.ANTHROPIC_API_KEY ?? "";
}

export function assistantConfigure(): boolean {
  return cleApi().length > 0;
}

/**
 * Les deux modèles.
 *
 * Le raisonnement du choix : 90 % des questions d'un atelier sont des questions de liste — « quels
 * devis n'ont pas de réponse », « qui me doit de l'argent ». Le travail y est fait par l'outil, pas
 * par le modèle : il faut choisir le bon outil, remplir deux paramètres et rendre une phrase. Un
 * petit modèle y suffit et coûte cinq fois moins cher. Les questions qui comparent, qui expliquent
 * un écart ou qui hiérarchisent (« qu'est-ce que je dois relancer aujourd'hui ? ») demandent en
 * revanche d'articuler plusieurs outils et de tenir un raisonnement de priorité — c'est là, et là
 * seulement, qu'un modèle plus grand se paie.
 *
 * Les identifiants sont à confirmer contre la liste des modèles de l'API avant mise en service :
 * un identifiant périmé rend un 404 au premier appel, pas un mauvais résultat silencieux.
 */
export const MODELE_SIMPLE = "claude-haiku-4-5";
export const MODELE_ANALYSE = "claude-sonnet-5";

/**
 * Tarifs publics, en dollars par million de jetons, saisis à la main.
 *
 * Ils servent à une seule chose : afficher et journaliser un coût par question, pour que le
 * plafond mensuel ne soit pas une croyance. Ils ne sont pas la facture d'Anthropic — celle-ci
 * fait foi — et ils doivent être revus quand la grille change.
 */
export const TARIFS: Record<string, { entree: number; sortie: number }> = {
  [MODELE_SIMPLE]: { entree: 1, sortie: 5 },
  [MODELE_ANALYSE]: { entree: 3, sortie: 15 },
};

/** Taux de conversion retenu pour l'affichage en euros. Approximation assumée, pas une compta. */
export const USD_EUR = 0.92;

export function coutEnEuros(modele: string, jetonsEntree: number, jetonsSortie: number): number {
  const t = TARIFS[modele] ?? TARIFS[MODELE_ANALYSE];
  const usd = (jetonsEntree * t.entree + jetonsSortie * t.sortie) / 1_000_000;
  return Math.round(usd * USD_EUR * 100_000) / 100_000;
}

/**
 * Nombre maximal d'allers-retours modèle ↔ outils pour une question.
 *
 * Quatre : un tour pour choisir un outil, un pour en croiser un second, un pour rédiger, et une
 * marge. Au-delà, ce n'est plus une question d'atelier, c'est une boucle — et une boucle facturée
 * au jeton n'a pas sa place dans un abonnement à 129 € par mois.
 */
export const TOURS_MAX = 4;

/** Jetons de sortie par appel. Une réponse d'assistant tient en quelques phrases. */
export const JETONS_SORTIE_MAX = 1200;

/** Longueurs acceptées pour la question. En dessous : une faute de frappe. Au-dessus : un roman. */
export const QUESTION_MIN = 3;
export const QUESTION_MAX = 500;

/**
 * Plafond de questions par atelier et par jour, SELON LA FORMULE.
 *
 * POURQUOI un plafond par formule et pas un chiffre unique : l'assistant n'est ni un nombre de
 * comptes ni un niveau de preuve — c'est un troisième axe. Le calquer sur `SIEGES_INCLUS`
 * (`src/lib/abonnement.ts`) serait une fausse bonne idée : un atelier à un seul siège qui pose
 * beaucoup de questions n'est pas un atelier qui abuse du produit, c'est un atelier qui s'en sert.
 * La bonne source est `plan_effectif()` (base), c'est-à-dire le MÊME nom de formule que celui qui
 * ouvre déjà `rentabilite`, `qualite`, etc. : dix par jour en Atelier, trente en Équipe, soixante
 * en Certifié — la montée en gamme se fait toute seule, exactement comme pour les vues de
 * rentabilité qui portent déjà leur verrou de formule.
 *
 * Le but n'est pas de rationner : c'est d'empêcher qu'une boucle côté navigateur, un onglet resté
 * ouvert ou un collaborateur curieux transforment une ligne de coût prévisible en facture
 * imprévue. Le dépassement se dit en clair et ne casse rien d'autre dans le produit.
 */
export const QUOTA_PAR_PLAN: Record<string, number> = {
  atelier: 10,
  equipe: 30,
  certifie: 60,
};

/** Plafond du jour pour la formule donnée. `atelier` (le plus bas) sert de repli. */
export function quotaDuJour(plan: string | null | undefined): number {
  if (!plan) return QUOTA_PAR_PLAN.atelier;
  return QUOTA_PAR_PLAN[plan] ?? QUOTA_PAR_PLAN.atelier;
}

/**
 * Plafond de lignes rapatriées par outil.
 *
 * Deux cents lignes suffisent à tout atelier de laquage pour une question de pipeline, et bornent
 * ce qui part chez le modèle. Au-delà, l'outil le DIT (`tronque: true`) : un total partiel présenté
 * comme un total est le pire défaut possible pour cet objet.
 */
export const LIGNES_MAX = 200;

/** Lignes détaillées transmises au modèle. Le reste ne sert qu'aux agrégats. */
export const LIGNES_DETAILLEES = 12;
