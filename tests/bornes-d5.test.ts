import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux } from "@/lib/utils";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { ligneLibre } from "./helpers/devis";

/**
 * Lot D — D5 : bornes affichées à l'écran (`min`/`max`) mais jamais vérifiées, parce qu'un
 * `Input type="number"` rend `ChampDecimal`, un `<input type="text">` — les attributs HTML n'y ont
 * jamais eu d'effet. Chaque cas ci-dessous passe par PostgREST, comme le ferait l'écran, et
 * vérifie l'état après coup : rien n'est resté écrit derrière un refus.
 */
const ctx = contexte();
let sb: SupabaseClient;
// Client jetable dédié : les clients semés (`clientSimpleId`, `clientRemiseId`) sont partagés par
// toute la suite, leur `remise_pct` et leur `delai_paiement_jours` ne doivent pas bouger.
let clientJetableId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "TEST-AUTO-bornes-d5" })
    .select("id")
    .single();
  if (error) throw new Error(`création du client jetable : ${error.message}`);
  clientJetableId = (data as { id: string }).id;
});

afterAll(async () => {
  if (clientJetableId) await sb.from("clients").delete().eq("id", clientJetableId);
});

describe("clients.remise_pct — 0 à 100", () => {
  it("refuse 500 %, le client garde sa valeur précédente", async () => {
    const { error } = await sb.from("clients").update({ remise_pct: 500 }).eq("id", clientJetableId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/clients_remise_pct_check/i);
    const { data } = await sb.from("clients").select("remise_pct").eq("id", clientJetableId).single();
    expect(data!.remise_pct).toBeNull();
  });

  it("refuse une remise négative", async () => {
    const { error } = await sb.from("clients").update({ remise_pct: -1 }).eq("id", clientJetableId);
    expect(error).not.toBeNull();
  });

  it("accepte 100 %, la borne haute incluse", async () => {
    const { error } = await sb.from("clients").update({ remise_pct: 100 }).eq("id", clientJetableId);
    expect(error).toBeNull();
    await sb.from("clients").update({ remise_pct: null }).eq("id", clientJetableId);
  });
});

describe("clients.delai_paiement_jours — 0 à 60 (L441-10)", () => {
  it("refuse 999 jours, la mention légale affichée dit 60", async () => {
    const { error } = await sb.from("clients").update({ delai_paiement_jours: 999 }).eq("id", clientJetableId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/clients_delai_paiement_check/i);
    const { data } = await sb.from("clients").select("delai_paiement_jours").eq("id", clientJetableId).single();
    expect(data!.delai_paiement_jours).toBeNull();
  });

  it("accepte 60 jours, la borne haute incluse", async () => {
    const { error } = await sb.from("clients").update({ delai_paiement_jours: 60 }).eq("id", clientJetableId);
    expect(error).toBeNull();
  });
});

describe("receptions.nb_pieces — au moins 1", () => {
  it("refuse une réception de 0 pièce", async () => {
    const { error } = await sb.from("receptions").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, nb_pieces: 0, designation: "TEST-AUTO",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/receptions_nb_pieces_check/i);
    const { count } = await sb.from("receptions").select("id", { count: "exact", head: true })
      .eq("client_id", clientJetableId);
    expect(count).toBe(0);
  });

  it("accepte 1 pièce", async () => {
    const { data, error } = await sb.from("receptions").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, nb_pieces: 1, designation: "TEST-AUTO",
    }).select("id").single();
    expect(error).toBeNull();
    await sb.from("receptions").delete().eq("id", data!.id);
  });
});

describe("jeux_jantes — diamètre 12-26 pouces, largeur ≥ 4J", () => {
  it("refuse une jante de 0 pouce", async () => {
    const { error } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, diametre_pouces: 0,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/jeux_jantes_diametre_pouces_check/i);
  });

  it("refuse une largeur de 2J", async () => {
    const { error } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, diametre_pouces: 18, largeur_pouces: 2,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/jeux_jantes_largeur_pouces_check/i);
  });

  it("accepte 12 pouces (borne basse) et 8J", async () => {
    const { data, error } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, diametre_pouces: 12, largeur_pouces: 8,
    }).select("id").single();
    expect(error).toBeNull();
    await sb.from("jeux_jantes").delete().eq("id", data!.id);
  });

  it("aucune ligne ne reste après les deux refus", async () => {
    const { count } = await sb.from("jeux_jantes").select("id", { count: "exact", head: true })
      .eq("client_id", clientJetableId);
    expect(count).toBe(0);
  });
});

describe("paiements.montant — strictement positif, jamais au-delà du reste dû", () => {
  let factureId: string;

  beforeAll(async () => {
    const ligne = ligneLibre({ libelle: "TEST-AUTO", qte: 1, pu: 100 });
    const totaux = calcTotaux([ligne], null);
    const { data, error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientJetableId, type: "libre", status: "emise",
      items: [ligne], remise: null, ...totaux,
    }).select("id, total_ttc").single();
    if (error) throw new Error(`création facture de test : ${error.message}`);
    factureId = (data as { id: string }).id;
    expect(nb((data as { total_ttc: number }).total_ttc)).toBe(120); // 100 HT + 20 % TVA
  });

  afterAll(async () => {
    await sb.from("paiements").delete().eq("facture_id", factureId);
    await sb.from("factures").delete().eq("id", factureId);
  });

  it("refuse un montant nul ou négatif", async () => {
    const { error: errZero } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 0, moyen: "virement" });
    expect(errZero).not.toBeNull();
    expect(errZero!.message).toMatch(/PAIEMENT_MONTANT_INVALIDE/i);

    const { error: errNeg } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: -50, moyen: "virement" });
    expect(errNeg).not.toBeNull();

    const { count } = await sb.from("paiements").select("id", { count: "exact", head: true }).eq("facture_id", factureId);
    expect(count).toBe(0);
  });

  it("refuse un montant supérieur au reste dû (120 €)", async () => {
    const { error } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 150, moyen: "virement" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/PAIEMENT_SUPERIEUR_RESTE_DU/i);
  });

  it("accepte un règlement partiel, puis refuse un second qui dépasserait ce qui reste", async () => {
    const { error: err1 } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 80, moyen: "virement" });
    expect(err1).toBeNull();

    // Reste dû = 120 − 80 = 40 € : un second paiement de 41 € doit être refusé.
    const { error: err2 } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 41, moyen: "especes" });
    expect(err2).not.toBeNull();
    expect(err2!.message).toMatch(/PAIEMENT_SUPERIEUR_RESTE_DU/i);

    // Mais le solde exact passe.
    const { error: err3 } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 40, moyen: "especes" });
    expect(err3).toBeNull();

    const { data: reglements } = await sb.from("paiements").select("montant").eq("facture_id", factureId);
    const total = (reglements ?? []).reduce((s, p) => s + nb(p.montant), 0);
    expect(total).toBe(120);

    // Et un centime de plus, maintenant que le reste dû est à zéro, est refusé.
    const { error: err4 } = await sb.from("paiements")
      .insert({ atelier_id: ctx.seed.atelierId, facture_id: factureId, montant: 0.5, moyen: "especes" });
    expect(err4).not.toBeNull();
  });
});
