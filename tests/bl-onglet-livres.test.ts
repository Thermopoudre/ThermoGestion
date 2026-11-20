import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte } from "./helpers/contexte";

/**
 * Amélioration n°5 (07/09/2026) — non-régression sur les onglets de `/bl`.
 *
 * Avant correction, l'onglet « Livrés » ne couvrait que `status = 'livre'` : un bon passé en
 * facturation (`status = 'facture'`) ne ressortait alors dans AUCUN onglet utile (« À livrer »
 * ne le voulait plus, « Livrés » ne le voulait pas encore), seulement dans « Tous ». C'est ce qui
 * a fait croire à la recette que la page était vide. Du point de vue de l'atelier, un BL facturé
 * a bien quitté les murs : « Livrés » doit désormais couvrir `['livre', 'facture']`.
 *
 * Un onglet distinct « À facturer » (`['livre']` seul, sans le facturé) reprend l'ancienne
 * définition de « Livrés » : c'est la même liste que réclament les liens de Pilotage → Rentabilité
 * (« Reste à facturer »), et la même logique que le CTE `bl` de la vue `client_rentabilite`
 * (migration 59) : `status = 'livre' and facture_id is null`.
 *
 * Ce fichier ne peut pas monter le composant React de `/bl` (pas d'environnement DOM dans ce
 * projet, cf. absence de tests de rendu ailleurs) : il reproduit donc, telle quelle, la requête
 * Supabase que la page exécute pour chaque onglet (`.in("status", [...])`), et vérifie
 * l'appartenance d'un jeu de BL couvrant les quatre statuts possibles.
 */
const ctx = contexte();
let sb: SupabaseClient;
const idsParStatut: Record<"brouillon" | "emis" | "livre" | "facture", string> = {
  brouillon: "", emis: "", livre: "", facture: "",
};

beforeAll(async () => {
  sb = clientConnecte(ctx);
  for (const status of ["brouillon", "emis", "livre", "facture"] as const) {
    const { data: numero } = await sb.rpc("next_numero", { p_type: "bl" });
    const { data: bl, error } = await sb
      .from("bons_livraison")
      .insert({
        atelier_id: ctx.seed.atelierId,
        client_id: ctx.seed.clientRemiseId,
        numero,
        status,
        lignes: [{ type: "prestation", libelle: "Onglet BL", qte: 1, unite: "piece", pu_ht: 10, total_ht: 10 }],
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    idsParStatut[status] = bl!.id as string;
  }
});

/** Reproduit exactement `charger()` de `src/app/(app)/bl/Contenu.tsx` pour un jeu de statuts donné. */
async function idsVisibles(statuts: string[] | null): Promise<string[]> {
  let requete = sb.from("bons_livraison").select("id").eq("atelier_id", ctx.seed.atelierId);
  if (statuts) requete = requete.in("status", statuts);
  const { data, error } = await requete;
  expect(error).toBeNull();
  return (data ?? []).map((r) => (r as { id: string }).id);
}

describe("onglets de /bl", () => {
  it("« À livrer » (['brouillon','emis']) ne montre ni le livré ni le facturé", async () => {
    const ids = await idsVisibles(["brouillon", "emis"]);
    expect(ids).toEqual(expect.arrayContaining([idsParStatut.brouillon, idsParStatut.emis]));
    expect(ids).not.toContain(idsParStatut.livre);
    expect(ids).not.toContain(idsParStatut.facture);
  });

  it("« Livrés » (['livre','facture']) montre le livré ET le facturé — c'est la correction n°5", async () => {
    const ids = await idsVisibles(["livre", "facture"]);
    expect(ids).toEqual(expect.arrayContaining([idsParStatut.livre, idsParStatut.facture]));
    expect(ids).not.toContain(idsParStatut.brouillon);
    expect(ids).not.toContain(idsParStatut.emis);
  });

  it("« À facturer » (['livre']) ne reprend PAS le déjà-facturé — c'est le sous-ensemble que Pilotage attend", async () => {
    const ids = await idsVisibles(["livre"]);
    expect(ids).toContain(idsParStatut.livre);
    expect(ids).not.toContain(idsParStatut.facture);
    expect(ids).not.toContain(idsParStatut.brouillon);
    expect(ids).not.toContain(idsParStatut.emis);
  });

  it("« Tous » (statuts = null) montre les quatre statuts, y compris le facturé", async () => {
    const ids = await idsVisibles(null);
    expect(ids).toEqual(expect.arrayContaining(Object.values(idsParStatut)));
  });

  it("aucun BL n'est absent des trois onglets à la fois (le piège qui a fait croire la page vide)", async () => {
    const aLivrer = new Set(await idsVisibles(["brouillon", "emis"]));
    const livres = new Set(await idsVisibles(["livre", "facture"]));
    const tous = await idsVisibles(null);
    for (const id of tous) {
      expect(aLivrer.has(id) || livres.has(id)).toBe(true);
    }
  });
});
