import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, ligneM2 } from "./helpers/devis";

/**
 * `facture_public` est la seule source de la facture vue par le client et du PDF : toute mention
 * légale absente ici est absente du document remis. On contrôle donc son contenu, pas la mise en page.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

async function factureEmise(clientId: string) {
  const items = [ligneM2({ surface: 5.4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items, remise: { type: "pct", valeur: 12 } });
  const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
  const { data, error } = await sb
    .from("factures")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id, type: "solde",
      numero, status: "emise", emise_at: new Date().toISOString(), nature_operation: "services",
      items: devis.items, remise: devis.remise,
      total_ht: devis.total_ht, total_tva: devis.total_tva, total_ttc: devis.total_ttc,
      due_date: "2026-10-02",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
});

describe("mentions obligatoires portées par facture_public", () => {
  it("expose l'identité légale de l'atelier et les mentions de paiement", async () => {
    const facture = await factureEmise(ctx.seed.clientRemiseId);
    const { data: pub, error } = await anon.rpc("facture_public", { p_token: facture.public_token });
    expect(error).toBeNull();

    expect(pub.numero).toMatch(/^FA-\d{4}-\d{4}$/);
    expect(pub.atelier.siren).toBe("900123456");
    expect(pub.atelier.siret).toBe("90012345600018");
    expect(pub.atelier.forme_juridique).toBe("SARL");
    expect(nb(pub.atelier.capital_social)).toBe(10000);
    expect(pub.atelier.rcs_ville).toBe("Toulon");
    expect(pub.atelier.tva_intra).toBe("FR12900123456");
    expect(pub.atelier.assujetti_tva).toBe(true);
    expect(pub.atelier.iban).toBe("FR7630001007941234567890185");
    expect(pub.atelier.bic).toBe("BDFEFRPPXXX");
    expect(nb(pub.atelier.penalites_taux)).toBe(10);
    expect(pub.atelier.escompte_texte).toBeTruthy();
    expect(pub.atelier.adresse).toContain("quai du Port");
    expect(pub.atelier.code_postal).toBe("83150");
  });

  it("expose le SIREN du client, la nature de l'opération et la remise", async () => {
    const facture = await factureEmise(ctx.seed.clientRemiseId);
    const { data: pub } = await anon.rpc("facture_public", { p_token: facture.public_token });

    expect(pub.client.nom).toBe("Menuiserie Testale");
    expect(pub.client.siren).toBe("812345678");
    expect(pub.nature_operation).toBe("services");
    expect(pub.remise).toEqual({ type: "pct", valeur: 12 });
    expect(nb(pub.total_ttc)).toBe(nb(facture.total_ttc));
    expect(pub.due_date).toBe("2026-10-02");
    expect(pub.status).toBe("emise");
  });

  it("porte l'adresse de livraison quand elle diffère de l'adresse de facturation", async () => {
    const facture = await factureEmise(ctx.seed.clientRemiseId);
    const { data: pub } = await anon.rpc("facture_public", { p_token: facture.public_token });
    expect(pub.client.adresse_livraison).toContain("ZA des Playes");
    expect(pub.client.adresse_livraison).toContain("83500");
    expect(pub.client.adresse_livraison).toContain("La Seyne-sur-Mer");
    // Le délai affiché sur la facture doit être celui du client, pas celui de l'atelier.
    expect(pub.client.delai_paiement_jours).toBe(45);
  });

  it("n'affiche pas d'adresse de livraison quand elle est identique ou absente", async () => {
    const facture = await factureEmise(ctx.seed.clientSimpleId);
    const { data: pub } = await anon.rpc("facture_public", { p_token: facture.public_token });
    expect(pub.client.adresse_livraison).toBeNull();
    expect(pub.client.delai_paiement_jours).toBeNull();
  });

  it("ne renvoie rien pour un jeton inconnu", async () => {
    const { data, error } = await anon.rpc("facture_public", { p_token: "jeton-qui-nexiste-pas" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
