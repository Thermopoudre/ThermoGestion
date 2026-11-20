import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculerCharge, estProjetEnRetard, isoDate } from "@/lib/capacite";
import { clientConnecte, contexte } from "./helpers/contexte";

/**
 * Lot D — D12 : compteurs incohérents.
 *
 * La recette a trouvé « 3 projets en retard » sur le tableau de bord contre « 2 » sur
 * `/pilotage` : le tableau de bord comptait les projets au statut `pret` dans son « en retard »,
 * `/pilotage` s'appuyait sur `estEnCharge` (qui exclut `pret`, à raison — un projet prêt ne pèse
 * plus sur le four) pour le même chiffre. `estProjetEnRetard` (lib/capacite.ts) est désormais la
 * seule définition : ce test la fait tourner sur de vrais projets en base et vérifie qu'elle rend
 * exactement le même compte que la requête SQL posée sur `/dashboard`.
 */
const ctx = contexte();
let sb: SupabaseClient;
let clientJetableId: string;
const projetIds: string[] = [];
const aujourdhui = isoDate(new Date());
const hier = isoDate(new Date(Date.now() - 86400000));
const demain = isoDate(new Date(Date.now() + 86400000));

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "TEST-AUTO-compteurs-en-retard" })
    .select("id")
    .single();
  if (error) throw new Error(`création du client jetable : ${error.message}`);
  clientJetableId = (data as { id: string }).id;

  // Un projet par cas : en retard « en_cours », en retard « pret » (le cas qui divergeait),
  // « livre » en retard (ne doit plus compter, il est fait), et un en_cours pas encore en retard.
  const lignes = [
    { nom: "TEST-AUTO-retard-en-cours", status: "en_cours", date_promise: hier, surface_m2: 1 },
    { nom: "TEST-AUTO-retard-pret", status: "pret", date_promise: hier, surface_m2: 1 },
    { nom: "TEST-AUTO-retard-livre", status: "livre", date_promise: hier, date_livraison: aujourdhui, surface_m2: 1 },
    { nom: "TEST-AUTO-pas-en-retard", status: "en_cours", date_promise: demain, surface_m2: 1 },
  ];
  for (const l of lignes) {
    const { data: p, error: errP } = await sb
      .from("projets")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: clientJetableId, ...l })
      .select("id")
      .single();
    if (errP) throw new Error(`création du projet ${l.nom} : ${errP.message}`);
    projetIds.push((p as { id: string }).id);
  }
});

afterAll(async () => {
  for (const id of projetIds) await sb.from("projets").delete().eq("id", id);
  if (clientJetableId) await sb.from("clients").delete().eq("id", clientJetableId);
});

describe("D12 — une seule définition du retard, deux écrans qui l'appliquent pareil", () => {
  it("le compte de /dashboard (requête SQL brute) et celui de /pilotage (estProjetEnRetard) tombent sur le même chiffre", async () => {
    // Requête SQL de /dashboard : statuts ouverts, date_promise dans le passé.
    const { count, error } = await sb
      .from("projets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientJetableId)
      .in("status", ["en_attente", "en_cours", "pret"])
      .lt("date_promise", aujourdhui);
    expect(error, error?.message).toBeNull();

    // Calcul de /pilotage : calculerCharge().enRetard, sur les mêmes projets relus depuis la base.
    const { data: projets } = await sb
      .from("projets")
      .select("status, date_promise, surface_m2, etape_courante, stock_decremente_at")
      .eq("client_id", clientJetableId);
    const charge = calculerCharge((projets ?? []) as never, { four_capacite_m2: 10, four_cycles_jour: 1, four_remplissage_moyen_pct: 80 });

    expect(charge.enRetard).toBe(count);
    // Exactement 2 : « en_cours » en retard et « pret » en retard — ni le livré, ni celui pas encore en retard.
    expect(charge.enRetard).toBe(2);
  });

  it("estProjetEnRetard tranche chaque cas comme attendu", () => {
    expect(estProjetEnRetard({ status: "en_cours", date_promise: hier }, aujourdhui)).toBe(true);
    // C'est le cas qui divergeait en recette : « pret » compte dans le retard, même s'il ne pèse
    // plus sur le four (estEnCharge l'exclut, à raison, mais c'est une autre question).
    expect(estProjetEnRetard({ status: "pret", date_promise: hier }, aujourdhui)).toBe(true);
    expect(estProjetEnRetard({ status: "livre", date_promise: hier }, aujourdhui)).toBe(false);
    expect(estProjetEnRetard({ status: "annule", date_promise: hier }, aujourdhui)).toBe(false);
    expect(estProjetEnRetard({ status: "en_cours", date_promise: demain }, aujourdhui)).toBe(false);
    expect(estProjetEnRetard({ status: "en_cours", date_promise: null }, aujourdhui)).toBe(false);
  });
});
