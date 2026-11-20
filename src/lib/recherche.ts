/**
 * Recherche globale — contrat partagé entre la base, l'écran et les tests.
 *
 * Le cœur est en base (`recherche_globale()`), pas ici : c'est la seule façon d'être soumis aux
 * politiques RLS et de ne pas rapatrier l'atelier entier dans le navigateur pour le filtrer. Ce
 * fichier ne porte que ce que les deux côtés doivent partager : la normalisation du texte, la
 * forme d'un résultat, et le chemin vers lequel chaque type mène.
 */

/**
 * Minuscules, sans accents ni ligatures.
 *
 * Doit rendre exactement la même chaîne que `public.txt_normalise()` en base, sinon un motif tapé
 * avec accent ne retrouve pas une fiche saisie sans — et le défaut est invisible tant qu'on ne
 * teste pas les deux implémentations sur la même chaîne (c'est fait dans `tests/recherche.test.ts`).
 *
 * `NFD` décompose « é » en « e » + accent, que la plage `̀-ͯ` retire. Il ne décompose en
 * revanche ni les ligatures (œ, æ, ß) ni les lettres barrées (ø, đ) : celles-là sont traitées à la
 * main, comme le fait la table de translittération SQL.
 */
export function normaliser(texte: string): string {
  return texte
    .replace(/Œ/g, "OE").replace(/œ/g, "oe")
    .replace(/Æ/g, "AE").replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[Øø]/g, "o")
    .replace(/[Đđ]/g, "d")
    .replace(/[Ðð]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Les chiffres seuls d'une saisie : « 06 12 34 » et « 0612 34 » désignent le même téléphone. */
export function chiffresSeuls(texte: string): string {
  return texte.replace(/[^0-9]/g, "");
}

/**
 * Motif `LIKE` prêt à envoyer à PostgREST, pour les listes qui filtrent sur la colonne
 * `recherche` sans passer par la RPC (Clients, Stock…).
 *
 * Deux précautions : la saisie est normalisée comme l'est la colonne — sans quoi « Gonçalves »
 * ne retrouverait pas sa propre fiche — et `%` comme `_` sont échappés. Un opérateur qui tape un
 * pourcentage dans le champ ne doit pas obtenir la liste entière.
 */
export function motifLike(texte: string): string {
  return `%${normaliser(texte).replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Même motif, mais écrit pour la grammaire `or=(…)` de PostgREST.
 *
 * `,` `.` `:` `(` `)` y sont des séparateurs : une valeur qui en contient doit être entre
 * guillemets, sans quoi une adresse e-mail tapée dans le champ ferait échouer toute la requête
 * avec un message incompréhensible. Les guillemets et antislashs de la saisie sont neutralisés.
 */
export function conditionOu(colonne: string, texte: string): string {
  return `${colonne}.like."${motifLike(texte).replace(/["\\]/g, "\\$&")}"`;
}

/**
 * Longueur minimale avant d'interroger la base.
 *
 * En dessous, le motif répond dans presque toutes les lignes : la requête coûte un balayage
 * complet et l'écran affiche du bruit. Deux caractères, c'est aussi ce qu'il faut pour retrouver
 * un client dont on ne connaît que les initiales.
 */
export const MIN_CARACTERES = 2;

/** Anti-rebond : la frappe d'un numéro de devis complet ne doit pas déclencher onze requêtes. */
export const REBOND_MS = 250;

/** Ligne rendue par la RPC `recherche_globale`. Les noms viennent du type composite SQL. */
export type ResultatRecherche = {
  type: TypeResultat;
  id: string;
  titre: string;
  sous_titre: string | null;
  date: string | null;
  montant: number | string | null;
  /** Pertinence, calculée en base par `public.score_recherche()`. Voir {@link SCORE}. */
  score?: number | null;
};

/**
 * L'échelle de pertinence, telle que la base la calcule. Elle tient en quatre barreaux, parce
 * qu'un cinquième ne changerait rien à ce que l'exploitant voit.
 *
 * `RICOCHET` est le seul qui compte vraiment : il marque les lignes qui n'ont répondu à AUCUN
 * texte et ne sont là que parce que leur client — ou leur véhicule — a répondu. C'est
 * exactement ce qu'étaient les sept lignes parasites d'une recherche par immatriculation.
 */
export const SCORE = { EXACT: 3, DEBUT: 2, DEDANS: 1, RICOCHET: 0 } as const;

function score(r: ResultatRecherche): number {
  return typeof r.score === "number" ? r.score : SCORE.RICOCHET;
}

export type TypeResultat =
  | "client" | "devis" | "facture" | "projet" | "bl"
  | "reception" | "jantes" | "poudre" | "lot";

/**
 * Familles affichées, dans l'ordre où l'atelier les cherche.
 *
 * Le client d'abord : au téléphone, on part presque toujours du nom de la personne. Les documents
 * ensuite, dans l'ordre du cycle commercial. Le stock en dernier, c'est une recherche de bureau.
 */
export const FAMILLES: { type: TypeResultat; libelle: string; chemin: (id: string) => string }[] = [
  { type: "client", libelle: "Clients", chemin: (id) => `/clients/${id}` },
  { type: "devis", libelle: "Devis", chemin: (id) => `/devis/${id}` },
  { type: "facture", libelle: "Factures", chemin: (id) => `/factures/${id}` },
  { type: "projet", libelle: "Projets", chemin: (id) => `/projets/${id}` },
  { type: "jantes", libelle: "Jeux de jantes", chemin: (id) => `/jantes/${id}` },
  { type: "reception", libelle: "Réceptions", chemin: (id) => `/receptions/${id}` },
  { type: "bl", libelle: "Bons de livraison", chemin: (id) => `/bl/fiche/${id}` },
  { type: "poudre", libelle: "Poudres", chemin: (id) => `/stock/${id}` },
  { type: "lot", libelle: "Lots de poudre", chemin: (id) => `/lots/${id}` },
];

/** Chemin d'ouverture d'un résultat. Rendu ici pour que l'écran n'ait aucune route en dur. */
export function chemin(r: Pick<ResultatRecherche, "type" | "id">): string {
  return FAMILLES.find((f) => f.type === r.type)?.chemin(r.id) ?? "/dashboard";
}

/**
 * Résultats regroupés par famille, familles vides écartées.
 *
 * L'ordre des familles n'est plus figé : il est donné par la **meilleure** ligne de chaque
 * famille, l'ordre métier de `FAMILLES` ne servant plus que d'arbitre entre familles de même
 * pertinence. Jusqu'ici il était figé, et une immatriculation tapée dans le champ affichait sept
 * lignes de ricochet avant le jeu de jantes cherché — le seul résultat que l'exploitant voulait,
 * en dernière position.
 *
 * L'arbitrage par `FAMILLES` garde donc tout son sens dans le cas ordinaire : quand on tape le
 * nom d'un client, sa fiche et ses pièces répondent, et c'est la fiche qui s'affiche d'abord.
 * Le tri ne se déclenche que lorsque quelque chose se détache vraiment.
 */
export function grouper(resultats: ResultatRecherche[]) {
  return FAMILLES.map((f, rang) => {
    // Les lignes arrivent déjà triées par la base (score décroissant, puis date ou nom) : les
    // retrier ici les ferait diverger de l'ordre que les tests de la RPC constatent.
    const lignes = resultats.filter((r) => r.type === f.type);
    return { ...f, rang, lignes, meilleur: Math.max(SCORE.RICOCHET, ...lignes.map(score)) };
  })
    .filter((g) => g.lignes.length > 0)
    .sort((a, b) => b.meilleur - a.meilleur || a.rang - b.rang);
}

/** Liste à plat dans l'ordre d'affichage : c'est elle que parcourent les flèches du clavier. */
export function aplatir(resultats: ResultatRecherche[]): ResultatRecherche[] {
  return grouper(resultats).flatMap((g) => g.lignes);
}
