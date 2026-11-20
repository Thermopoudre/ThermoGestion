import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";

/**
 * Deux régressions se croisent ici :
 *  — le stock global et les lots divergeaient dès qu'un opérateur oubliait de rattacher son lot ;
 *  — deux surcharges de `mouvement_stock` (5 et 7 arguments) rendaient l'appel ambigu pour
 *    PostgreSQL, ce qui cassait silencieusement la pesée et l'ajustement.
 */
const ctx = contexte();
let sb: SupabaseClient;
let lotAncienId: string;
let lotRecentId: string;

async function etatStock() {
  const [{ data: poudre }, { data: lots }] = await Promise.all([
    sb.from("poudres").select("stock_kg").eq("id", ctx.seed.poudreId).single(),
    sb.from("poudre_lots").select("id, numero, restant_kg, dlu").eq("poudre_id", ctx.seed.poudreId),
  ]);
  const somme = (lots ?? []).reduce((s, l) => s + nb(l.restant_kg), 0);
  return {
    stock: nb(poudre!.stock_kg),
    somme: Math.round(somme * 1000) / 1000,
    parLot: Object.fromEntries((lots ?? []).map((l) => [l.numero as string, nb(l.restant_kg)])),
  };
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  // DLU la plus lointaine reçue en premier : le décompte doit malgré tout attaquer la plus proche.
  const lointain = await sb.rpc("receptionner_lot", {
    p_poudre_id: ctx.seed.poudreId, p_numero: "LOT-2027", p_fournisseur: "TestPowder",
    p_quantite_kg: 5, p_prix_kg: 15.9, p_dlu: "2027-09-01",
  });
  if (lointain.error) throw new Error(`receptionner_lot : ${lointain.error.message}`);
  lotAncienId = lointain.data as string;

  const proche = await sb.rpc("receptionner_lot", {
    p_poudre_id: ctx.seed.poudreId, p_numero: "LOT-PROCHE", p_fournisseur: "TestPowder",
    p_quantite_kg: 3, p_prix_kg: 15.9, p_dlu: "2026-09-30",
  });
  if (proche.error) throw new Error(`receptionner_lot : ${proche.error.message}`);
  lotRecentId = proche.data as string;
});

describe("réception de lots", () => {
  it("aligne le stock global sur la somme des lots", async () => {
    const etat = await etatStock();
    expect(etat.stock).toBe(8);
    expect(etat.somme).toBe(8);
    expect(etat.parLot).toEqual({ "LOT-2027": 5, "LOT-PROCHE": 3 });
  });

  it("trace la réception dans les mouvements de stock", async () => {
    const { data: mvts } = await sb
      .from("stock_mouvements")
      .select("type, delta_kg, lot_id, lot_numero, dlu")
      .eq("poudre_id", ctx.seed.poudreId)
      .eq("type", "reception");
    expect(mvts).toHaveLength(2);
    expect(mvts!.map((m) => m.lot_numero).sort()).toEqual(["LOT-2027", "LOT-PROCHE"]);
    expect(mvts!.every((m) => m.lot_id !== null && m.dlu !== null)).toBe(true);
  });
});

describe("décompte automatique à la cuisson", () => {
  it("impute la consommation au lot dont la DLU est la plus proche", async () => {
    const { data: projet, error } = await sb
      .from("projets")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "Projet cuisson test",
        status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "reception",
        surface_m2: 8, couches: 1, poudre_id: ctx.seed.poudreId,
      })
      .select("*")
      .single();
    expect(error).toBeNull();

    // Réception → préparation → poudrage → cuisson : c'est la validation de l'étape « cuisson »
    // qui déclenche le décompte.
    for (const attendue of ["reception", "preparation", "poudrage", "cuisson"]) {
      const { data: res, error: errEtape } = await sb.rpc("avancer_etape", { p_projet_id: projet!.id });
      expect(errEtape).toBeNull();
      expect(res.etape_faite).toBe(attendue);
    }

    const etat = await etatStock();
    // 8 m² × 1 couche ÷ 8 m²/kg = 1,000 kg, pris sur le lot qui périme le premier.
    expect(etat.parLot["LOT-PROCHE"]).toBe(2);
    expect(etat.parLot["LOT-2027"]).toBe(5);
    expect(etat.stock).toBe(7);
    expect(etat.somme).toBe(7);

    const { data: relu } = await sb.from("projets").select("poudre_conso_kg, stock_decremente_at, lot_id").eq("id", projet!.id).single();
    expect(nb(relu!.poudre_conso_kg)).toBe(1);
    expect(relu!.stock_decremente_at).not.toBeNull();
    expect(relu!.lot_id).toBe(lotRecentId);

    const { data: mvt } = await sb
      .from("stock_mouvements")
      .select("*")
      .eq("projet_id", projet!.id)
      .eq("type", "conso_auto")
      .single();
    expect(nb(mvt!.delta_kg)).toBe(-1);
    expect(mvt!.lot_id).toBe(lotRecentId);
    expect(mvt!.lot_numero).toBe("LOT-PROCHE");
    expect(mvt!.dlu).toBe("2026-09-30");
  });

  it("ne décompte pas deux fois le même projet", async () => {
    const avant = await etatStock();
    const { data: projet } = await sb
      .from("projets")
      .select("id")
      .eq("nom", "Projet cuisson test")
      .single();
    await sb.rpc("avancer_etape", { p_projet_id: projet!.id });
    const apres = await etatStock();
    expect(apres.stock).toBe(avant.stock);
    expect(apres.somme).toBe(avant.somme);
  });
});

describe("pesée et ajustement (régression : surcharges ambiguës de mouvement_stock)", () => {
  it("accepte la forme courte de l'appel, sans ambiguïté de surcharge", async () => {
    const { data, error } = await sb.rpc("mouvement_stock", {
      p_poudre_id: ctx.seed.poudreId, p_type: "pesee", p_valeur_kg: 6,
    });
    expect(error).toBeNull();
    expect(nb(data)).toBe(6);

    const etat = await etatStock();
    expect(etat.stock).toBe(6);
    expect(etat.somme).toBe(6);
    // L'écart de pesée est pris sur le lot le plus proche de sa DLU.
    expect(etat.parLot["LOT-PROCHE"]).toBe(1);
  });

  it("accepte la forme complète et trace le lot imputé", async () => {
    const { error } = await sb.rpc("mouvement_stock", {
      p_poudre_id: ctx.seed.poudreId, p_type: "ajustement", p_valeur_kg: -0.5,
      p_projet_id: null, p_note: "Casse d'un sac", p_lot_numero: null, p_lot_fournisseur: null,
    });
    expect(error).toBeNull();

    const etat = await etatStock();
    expect(etat.stock).toBe(5.5);
    expect(etat.somme).toBe(5.5);

    const { data: mvt } = await sb
      .from("stock_mouvements")
      .select("*")
      .eq("poudre_id", ctx.seed.poudreId)
      .eq("type", "ajustement")
      .single();
    expect(mvt!.note).toBe("Casse d'un sac");
    expect(mvt!.lot_id).not.toBeNull();
  });

  it("maintient l'invariant stock = somme des lots après chaque mouvement", async () => {
    for (const [type, valeur] of [["ajustement", 2], ["pesee", 4.25], ["ajustement", -0.75]] as const) {
      const { error } = await sb.rpc("mouvement_stock", { p_poudre_id: ctx.seed.poudreId, p_type: type, p_valeur_kg: valeur });
      expect(error).toBeNull();
      const etat = await etatStock();
      expect(etat.stock).toBe(etat.somme);
    }
    const final = await etatStock();
    expect(final.stock).toBe(3.5);
    expect(lotAncienId).toBeTruthy();
  });
});
