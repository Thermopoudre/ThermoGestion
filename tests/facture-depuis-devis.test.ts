import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { echeanceIso, joursPaiement } from "@/lib/calculs";
import type { GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, creerFactureDepuisDevis, finaliserDevis, ligneM2, lignePrestation } from "./helpers/devis";

const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

/** Devis signé de bout en bout, prêt à être facturé. */
async function devisSigne(clientId: string, remise: { type: "pct" | "montant"; valeur: number } | null) {
  const items = [
    ligneM2({ surface: 5.4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs }),
    lignePrestation({ prestationId: ctx.seed.prestationSablageId, nom: "Sablage", unite: "piece", qte: 3, pu: 7.2, negocie: true }),
  ];
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items, remise });
  const envoye = await finaliserDevis(sb, devis.id);
  const anon = clientAnonyme(ctx);
  await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Signataire test", p_signature: {}, p_ip: "127.0.0.1" });
  const { data } = await sb.from("devis").select("*").eq("id", devis.id).single();
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
});

describe("facture générée depuis un devis signé", () => {
  it("reprend les lignes, la remise et les totaux à l'identique", async () => {
    const devis = await devisSigne(ctx.seed.clientRemiseId, { type: "pct", valeur: 12 });
    const facture = await creerFactureDepuisDevis(sb, devis);

    expect(facture.items).toEqual(devis.items);
    expect(facture.remise).toEqual(devis.remise);
    expect(nb(facture.total_ht)).toBe(nb(devis.total_ht));
    expect(nb(facture.total_tva)).toBe(nb(devis.total_tva));
    expect(nb(facture.total_ttc)).toBe(nb(devis.total_ttc));
    expect(facture.devis_id).toBe(devis.id);
    expect(facture.status).toBe("brouillon");
    expect(facture.nature_operation).toBe("services");
  });

  it("calcule l'échéance sur le délai négocié du client, pas sur celui de l'atelier", async () => {
    const { data: atelier } = await sb.from("ateliers").select("delai_paiement_jours").single();
    expect(atelier!.delai_paiement_jours).toBe(30);

    const devis = await devisSigne(ctx.seed.clientRemiseId, null);
    const facture = await creerFactureDepuisDevis(sb, devis);
    expect(facture.due_date).toBe(echeanceIso(45));
    expect(facture.due_date).not.toBe(echeanceIso(30));
  });

  it("retombe sur le délai de l'atelier quand le client n'en a pas négocié", async () => {
    const devis = await devisSigne(ctx.seed.clientSimpleId, null);
    const facture = await creerFactureDepuisDevis(sb, devis);
    expect(facture.due_date).toBe(echeanceIso(30));
  });

  it("rattache la facture au projet issu du devis (sans quoi la marge du projet reste vide)", async () => {
    const devis = await devisSigne(ctx.seed.clientRemiseId, null);
    const { data: projet } = await sb.from("projets").select("id").eq("devis_id", devis.id).single();
    const facture = await creerFactureDepuisDevis(sb, devis);
    expect(facture.projet_id).toBe(projet!.id);
  });

  it("joursPaiement : le client prime, l'atelier sert de repli, 30 jours en dernier recours", () => {
    expect(joursPaiement(45, 30)).toBe(45);
    expect(joursPaiement(null, 30)).toBe(30);
    expect(joursPaiement(undefined, null)).toBe(30);
    // Un délai à 0 jour (paiement comptant) est une valeur, pas une absence de valeur.
    expect(joursPaiement(0, 30)).toBe(0);
  });
});
