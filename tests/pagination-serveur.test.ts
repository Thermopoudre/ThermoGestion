import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte } from "./helpers/contexte";
import { TAILLE_PAGE, estHorsPlage } from "@/components/Pagination";

/**
 * Pagination et filtre serveur (chantier C1).
 *
 * L'audit du 20/08 constatait un seul `.range()` dans tout le dépôt, et il servait à l'export.
 * Les listes étaient plafonnées à 200 lignes, puis filtrées en mémoire : à 12 000 devis, les
 * 11 800 plus anciens n'étaient plus atteignables, et le bouton « Tous » ne parcourait que les
 * 200 déjà chargées.
 *
 * Ce fichier rejoue exactement les requêtes que passent désormais les écrans, sur un jeu assez
 * grand pour dépasser la première page. Il vérifie trois choses qu'aucun test d'unité ne peut
 * voir : les pages ne se recouvrent pas, elles couvrent la totalité, et le filtre de statut est
 * bien appliqué par la base — pas après coup.
 */

const ctx = contexte();
let sb: SupabaseClient;

/** Deux pages et demie : assez pour que « la deuxième page » veuille dire quelque chose. */
const NB_DEVIS = TAILLE_PAGE * 2 + 7;
const PREFIXE = "PAG-";
let numeros: string[] = [];

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const lignes = Array.from({ length: NB_DEVIS }, (_, i) => ({
    atelier_id: ctx.seed.atelierId,
    client_id: ctx.seed.clientSimpleId,
    numero: `${PREFIXE}${String(i).padStart(4, "0")}`,
    // Un tiers de brouillons : c'est ce qui permet de vérifier que le filtre part bien en base.
    status: i % 3 === 0 ? "brouillon" : "envoye",
    items: [],
    total_ht: 100 + i,
    total_tva: 0,
    total_ttc: 100 + i,
    // Dates étalées : sans elles, le tri par date serait indéterminé et les pages instables.
    created_at: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
  }));
  const { error } = await sb.from("devis").insert(lignes);
  if (error) throw new Error(`semis de pagination : ${error.message}`);
  numeros = lignes.map((l) => l.numero);
});

afterAll(async () => {
  await sb.from("devis").delete().like("numero", `${PREFIXE}%`);
});

/** La requête de la liste des devis, telle que l'écran la construit. */
function page(de: number, a: number, statuts: string[] | null) {
  let requete = sb.from("devis").select("id, numero, status, total_ttc, created_at", { count: "exact" }).like("numero", `${PREFIXE}%`);
  if (statuts) requete = requete.in("status", statuts);
  return requete.order("created_at", { ascending: false }).range(de, a);
}

describe("découpage en pages", () => {
  it("rend le total exact, pas le nombre de lignes de la page", async () => {
    const { data, count, error } = await page(0, TAILLE_PAGE - 1, null);
    expect(error).toBeNull();
    expect(data).toHaveLength(TAILLE_PAGE);
    expect(count).toBe(NB_DEVIS);
  });

  it("les pages ne se recouvrent pas et couvrent la totalité", async () => {
    const vus: string[] = [];
    const nbPages = Math.ceil(NB_DEVIS / TAILLE_PAGE);
    for (let p = 0; p < nbPages; p++) {
      const { data, error } = await page(p * TAILLE_PAGE, p * TAILLE_PAGE + TAILLE_PAGE - 1, null);
      expect(error).toBeNull();
      vus.push(...((data ?? []) as { numero: string }[]).map((d) => d.numero));
    }
    expect(new Set(vus).size, "des lignes apparaissent sur deux pages").toBe(NB_DEVIS);
    expect(vus.sort()).toEqual([...numeros].sort());
  });

  it("la dernière page rend le reste, pas une page pleine", async () => {
    const nbPages = Math.ceil(NB_DEVIS / TAILLE_PAGE);
    const de = (nbPages - 1) * TAILLE_PAGE;
    const { data } = await page(de, de + TAILLE_PAGE - 1, null);
    expect(data).toHaveLength(NB_DEVIS - de);
  });

  /**
   * Découverte de ce chantier : au-delà de la dernière page, PostgREST ne rend pas une liste
   * vide mais une **erreur** PGRST103. Sans traitement, un opérateur qui reste en page 5 pendant
   * qu'un collègue supprime des lignes voit « Requested range not satisfiable » à la place de sa
   * liste. Le composant de pagination la reconnaît et ramène à la première page.
   */
  it("au-delà de la dernière page, PostgREST refuse la plage — et le composant sait le voir", async () => {
    const { error } = await page(NB_DEVIS + 100, NB_DEVIS + 124, null);
    expect(error).not.toBeNull();
    expect(estHorsPlage(error)).toBe(true);
    // Contre-épreuve : une vraie erreur de droits ne doit pas être confondue avec une fin de liste.
    expect(estHorsPlage({ code: "42501", message: "permission denied" })).toBe(false);
    expect(estHorsPlage(null)).toBe(false);
  });
});

describe("le filtre et le tri partent en base", () => {
  it("le filtre de statut porte sur la totalité, pas sur la page affichée", async () => {
    const attendus = numeros.filter((_, i) => i % 3 === 0).length;
    const { data, count } = await page(0, TAILLE_PAGE - 1, ["brouillon"]);
    expect(count, "le compte filtré ne correspond pas au filtre serveur").toBe(attendus);
    for (const d of (data ?? []) as { status: string }[]) expect(d.status).toBe("brouillon");
    // Le défaut d'origine : le brouillon le plus ancien n'était dans aucune des 200 lignes
    // chargées, donc invisible quel que soit le filtre. Il doit être atteignable ici.
    const derniere = Math.floor((attendus - 1) / TAILLE_PAGE) * TAILLE_PAGE;
    const { data: fin } = await page(derniere, derniere + TAILLE_PAGE - 1, ["brouillon"]);
    expect(((fin ?? []) as { numero: string }[]).map((d) => d.numero)).toContain(`${PREFIXE}0000`);
  });

  it("le tri est appliqué par la base, y compris entre deux pages", async () => {
    const p0 = await page(0, TAILLE_PAGE - 1, null);
    const p1 = await page(TAILLE_PAGE, TAILLE_PAGE * 2 - 1, null);
    const dates0 = ((p0.data ?? []) as { created_at: string }[]).map((d) => d.created_at);
    const dates1 = ((p1.data ?? []) as { created_at: string }[]).map((d) => d.created_at);
    const decroissant = (xs: string[]) => xs.every((x, i) => i === 0 || xs[i - 1] >= x);
    expect(decroissant(dates0)).toBe(true);
    expect(decroissant(dates1)).toBe(true);
    // La frontière entre deux pages est l'endroit exact où un tri fait en mémoire se voit.
    expect(dates0[dates0.length - 1] >= dates1[0]).toBe(true);
  });

  it("le tri par montant décroissant met bien le plus gros devis en tête de la première page", async () => {
    const { data } = await sb
      .from("devis").select("numero, total_ttc").like("numero", `${PREFIXE}%`)
      .order("total_ttc", { ascending: false }).range(0, 0);
    expect(((data ?? []) as { numero: string }[])[0]?.numero).toBe(numeros[numeros.length - 1]);
  });
});

/**
 * Ce que les écrans demandent réellement à la base.
 *
 * POURQUOI ON LIT LE CODE SOURCE. La version précédente de ce bloc écrivait elle-même le
 * `select("id, numero, status, total_ttc, created_at")` puis vérifiait que la réponse ne portait
 * que ces colonnes-là. Elle vérifiait donc PostgREST, pas l'écran : si `devis/page.tsx` repassait
 * à `select("*")`, le test serait resté vert pendant que la liste retéléchargerait les lignes,
 * les notes et les jetons publics de chaque devis. Le référentiel est désormais la constante
 * `COLONNES` de l'écran lui-même, lue dans son fichier.
 */
const RACINE = path.resolve(process.cwd(), "src/app/(app)");

/**
 * Le fichier réellement passé à `fs` pour un écran donné.
 *
 * Chantier suivant l'audit du 20/08 : les listes ont été scindées en un `page.tsx` serveur de
 * cinq lignes (juste le `<Metadata>` du titre d'onglet, cf. commentaire de `devis/page.tsx`) et un
 * `Contenu.tsx` qui garde toute la logique cliente — donc la constante `COLONNES` et le `.select()`
 * qu'elle nourrit. `page.tsx` ne les porte plus. On lit `Contenu.tsx` en priorité, et on ne retombe
 * sur `page.tsx` que pour un écran qui n'a pas (encore) été scindé — `projets/histo/page.tsx` au
 * moment d'écrire ceci — pour ne pas casser ce fichier au prochain écran migré dans un sens ou
 * dans l'autre.
 */
function fichierDeLEcran(fichier: string): string {
  const dossier = path.dirname(fichier);
  const contenu = path.join(RACINE, dossier, "Contenu.tsx");
  return existsSync(contenu) ? path.join(dossier, "Contenu.tsx") : fichier;
}

/**
 * Extrait d'un écran la constante `COLONNES` (y compris écrite sur plusieurs lignes) **et** la
 * table qu'il interroge avec. Lire la table dans le source aussi, plutôt que la recopier ici,
 * évite de refaire à moitié la faute qu'on corrige : un écran qui changerait de table sans que le
 * test le sache reviendrait à comparer le code à une constante du test.
 */
function requeteDeLEcran(fichier: string): { colonnes: string; table: string } {
  const reel = fichierDeLEcran(fichier);
  const source = readFileSync(path.join(RACINE, reel), "utf8");
  const bloc = /^const COLONNES(?:_\w+)? =\s*([\s\S]*?);\s*$/m.exec(source);
  if (!bloc) throw new Error(`${reel} : aucune constante COLONNES — l'écran a-t-il changé de forme ?`);
  const morceaux = [...bloc[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (morceaux.length === 0) throw new Error(`${reel} : COLONNES illisible`);
  const appel = /\.from\("(\w+)"\)\s*\.select\(COLONNES/.exec(source);
  if (!appel) throw new Error(`${reel} : COLONNES n'est passée à aucun .select() — constante morte ?`);
  return { colonnes: morceaux.join(""), table: appel[1] };
}

function colonnesDeLEcran(fichier: string): string {
  return requeteDeLEcran(fichier).colonnes;
}

/** Les colonnes de premier niveau demandées, hors relations embarquées `table(col, col)`. */
function champsSimples(colonnes: string): string[] {
  return colonnes
    .replace(/\w+\([^)]*\)/g, "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Colonnes qu'aucune liste ne doit rapatrier : elles pèsent lourd (les lignes d'un document, une
 * signature en base64) ou ne regardent pas une liste (le jeton d'accès public d'un document).
 */
const INTERDITES = ["items", "lignes", "notes", "public_token", "signature_data", "recherche", "reserves"];

/** [fichier de l'écran, colonnes interdites en plus du socle commun]. La table est lue du source. */
const ECRANS: Array<[string, string[]]> = [
  ["devis/page.tsx", []],
  ["clients/page.tsx", ["siret", "adresse_livraison", "grille_id"]],
  ["factures/page.tsx", []],
  ["receptions/page.tsx", []],
  ["projets/histo/page.tsx", []],
  ["jantes/page.tsx", []],
  ["lots/page.tsx", []],
  ["stock/page.tsx", []],
];

describe("les listes ne demandent que les colonnes qu'elles affichent", () => {
  it.each(ECRANS)("%s : aucune colonne lourde ni aucun jeton dans la liste", (fichier, enPlus) => {
    const colonnes = colonnesDeLEcran(fichier);
    expect(colonnes, `${fichier} demande tout : la pagination ne sert alors qu'à découper un gros téléchargement`)
      .not.toContain("*");
    for (const interdit of [...INTERDITES, ...enPlus]) {
      expect(champsSimples(colonnes), `${fichier} rapatrie ${interdit}`).not.toContain(interdit);
    }
  });

  it.each(ECRANS)("%s : la base accepte ce select et ne rend rien de plus", async (fichier) => {
    const { colonnes, table } = requeteDeLEcran(fichier);
    const { data, error } = await sb.from(table).select(colonnes).range(0, 0);
    // Une colonne renommée en base ferait échouer l'écran en production sans prévenir personne :
    // ici, la requête de l'écran est réellement jouée.
    expect(error, `${fichier} : ${error?.message}`).toBeNull();
    const ligne = ((data ?? []) as unknown as Record<string, unknown>[])[0];
    if (!ligne) return; // table vide dans l'atelier jetable : la validité du select est déjà prouvée.
    for (const interdit of INTERDITES) {
      expect(ligne, `${fichier} : ${interdit} est revenu de la base`).not.toHaveProperty(interdit);
    }
  });

  it("le bon de livraison est la seule liste à rapatrier ses lignes, et c'est assumé", () => {
    // Le BL ne stocke pas ses totaux : la liste les recalcule à partir des lignes et de la remise.
    // C'est la seule exception, et elle est nommée ici pour qu'une seconde ne passe pas inaperçue.
    const colonnes = colonnesDeLEcran("bl/page.tsx");
    expect(champsSimples(colonnes)).toContain("lignes");
    expect(champsSimples(colonnes)).toContain("remise");
    expect(champsSimples(colonnes)).not.toContain("public_token");
  });

  it("la liste des devis rend exactement les colonnes que l'écran demande, et pas une de plus", async () => {
    const colonnes = colonnesDeLEcran("devis/page.tsx");
    const { data, error } = await sb.from("devis").select(colonnes).like("numero", `${PREFIXE}%`).range(0, 0);
    expect(error).toBeNull();
    const ligne = ((data ?? []) as unknown as Record<string, unknown>[])[0];
    // `clients(nom)` revient sous la clé `clients` : on compare aux champs simples plus les
    // relations embarquées, telles que l'écran les a écrites.
    const attendues = [...champsSimples(colonnes), ...[...colonnes.matchAll(/(\w+)\([^)]*\)/g)].map((m) => m[1])];
    expect(Object.keys(ligne).sort()).toEqual([...attendues].sort());
  });
});
