import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, creerFactureDepuisDevis, finaliserDevis, ligneM2 } from "./helpers/devis";

/**
 * Les écrans désactivent les champs d'un devis signé et d'une facture émise, mais l'API accepte
 * toujours l'écriture : rien n'empêchait de modifier les prix d'un document déjà signé ou émis
 * sans que le client le voie. Ces tests verrouillent la garde côté base, la seule qui tienne.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

async function devisSigne() {
  const items = [ligneM2({ surface: 5.4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items, remise: { type: "pct", valeur: 12 } });
  const envoye = await finaliserDevis(sb, devis.id);
  await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Signataire", p_signature: {}, p_ip: null });
  const { data } = await sb.from("devis").select("*").eq("id", devis.id).single();
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
});

describe("un devis signé est figé", () => {
  it("refuse toute modification des lignes, de la remise ou des totaux", async () => {
    const devis = await devisSigne();
    const avant = nb(devis.total_ttc);

    for (const patch of [
      { items: [{ ...(devis.items as DevisItem[])[0], pu_ht: 999, total_ht: 999 }] },
      { remise: null },
      { total_ttc: 1 },
      { numero: "DV-2000-0001" },
      { client_id: ctx.seed.clientSimpleId },
    ]) {
      const { error } = await sb.from("devis").update(patch).eq("id", devis.id);
      expect(error, `modification acceptée : ${JSON.stringify(patch)}`).not.toBeNull();
    }

    const { data: relu } = await sb.from("devis").select("*").eq("id", devis.id).single();
    expect(nb(relu!.total_ttc)).toBe(avant);
    expect(relu!.items).toEqual(devis.items);
  });

  it("laisse passer ce qui doit rester modifiable après signature", async () => {
    const devis = await devisSigne();
    const { error } = await sb.from("devis").update({ relances_actives: false, notes: "Note interne" }).eq("id", devis.id);
    expect(error).toBeNull();
  });

  it("n'entrave pas la signature elle-même ni l'édition d'un brouillon", async () => {
    const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const brouillon = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const { error: errBrouillon } = await sb.from("devis").update({ total_ttc: 12 }).eq("id", brouillon.id);
    expect(errBrouillon).toBeNull();
    // On remet les vrais totaux : l'invariant « totaux = calcTotaux(lignes, remise) » est
    // contrôlé sur l'ensemble des documents de l'atelier par un autre fichier de la suite.
    await sb.from("devis").update({ total_ttc: brouillon.total_ttc }).eq("id", brouillon.id);

    const envoye = await finaliserDevis(sb, brouillon.id);
    const { data: signe } = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "OK", p_signature: {}, p_ip: null });
    expect(signe).toBe(true);
  });
});

describe("une facture émise est figée", () => {
  it("refuse la modification des montants après émission", async () => {
    const devis = await devisSigne();
    const facture = await creerFactureDepuisDevis(sb, devis);
    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    const { error: errEmission } = await sb
      .from("factures")
      .update({ status: "emise", numero, emise_at: new Date().toISOString() })
      .eq("id", facture.id);
    expect(errEmission).toBeNull();

    for (const patch of [
      { items: [] },
      { total_ttc: 1 },
      { remise: null },
      { due_date: "2030-01-01" },
      { nature_operation: "biens" },
    ]) {
      const { error } = await sb.from("factures").update(patch).eq("id", facture.id);
      expect(error, `modification acceptée : ${JSON.stringify(patch)}`).not.toBeNull();
    }

    const { data: relue } = await sb.from("factures").select("*").eq("id", facture.id).single();
    expect(nb(relue!.total_ttc)).toBe(nb(devis.total_ttc));
    expect(relue!.numero).toBe(numero);
  });

  it("laisse enregistrer un paiement et un lien Stripe sur une facture émise", async () => {
    const devis = await devisSigne();
    const facture = await creerFactureDepuisDevis(sb, devis);
    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    await sb.from("factures").update({ status: "emise", numero, emise_at: new Date().toISOString() }).eq("id", facture.id);

    const { error: errLien } = await sb.from("factures").update({ stripe_payment_link: "https://exemple.test/pay" }).eq("id", facture.id);
    expect(errLien).toBeNull();

    const { error: errPaiement } = await sb.from("paiements").insert({
      atelier_id: ctx.seed.atelierId, facture_id: facture.id, montant: nb(facture.total_ttc), moyen: "virement",
    });
    expect(errPaiement).toBeNull();

    const { error: errStatut } = await sb.from("factures").update({ status: "payee" }).eq("id", facture.id);
    expect(errStatut).toBeNull();

    // Une fois payée, elle reste tout aussi intouchable.
    const { error: errApres } = await sb.from("factures").update({ total_ttc: 0 }).eq("id", facture.id);
    expect(errApres).not.toBeNull();
  });

  it("laisse librement modifier une facture encore en brouillon", async () => {
    const devis = await devisSigne();
    const facture = await creerFactureDepuisDevis(sb, devis);
    const { error } = await sb.from("factures").update({ items: [], total_ht: 0, total_tva: 0, total_ttc: 0, remise: null }).eq("id", facture.id);
    expect(error).toBeNull();
  });
});
