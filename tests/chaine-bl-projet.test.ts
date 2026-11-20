import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Etape, GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2 } from "./helpers/devis";

/**
 * Non-régression de la rupture de chaîne n°2 de la recette : un bon de livraison signé laissait
 * le projet à l'étape « Prêt », si bien que le tableau de production ne se vidait jamais.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
});

describe("signature du bon de livraison", () => {
  it("clôt le projet rattaché et horodate la livraison", async () => {
    const items = [ligneM2({ surface: 5.4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items });
    const envoye = await finaliserDevis(sb, devis.id);
    await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Signataire BL", p_signature: {}, p_ip: null });

    const { data: projet } = await sb.from("projets").select("*").eq("devis_id", devis.id).single();
    expect(projet!.status).toBe("en_attente");

    const { data: numero } = await sb.rpc("next_numero", { p_type: "bl" });
    const { data: bl, error } = await sb
      .from("bons_livraison")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, projet_id: projet!.id,
        numero, status: "emis", lignes: items, nb_colis: 2, poids_kg: 46.5,
      })
      .select("*")
      .single();
    expect(error).toBeNull();

    const { data: res, error: errSign } = await anon.rpc("signer_bl", {
      p_token: bl!.public_token, p_nom: "Sophie Testonne", p_signature: { trace: "…" }, p_ip: "90.119.33.69",
    });
    expect(errSign).toBeNull();
    expect(res.ok).toBe(true);

    const { data: blRelu } = await sb.from("bons_livraison").select("*").eq("id", bl!.id).single();
    expect(blRelu!.status).toBe("livre");
    expect(blRelu!.recu_par).toBe("Sophie Testonne");
    expect(blRelu!.signature_ip).toBe("90.119.33.69");
    expect(blRelu!.signed_at).not.toBeNull();

    const { data: projetRelu } = await sb.from("projets").select("*").eq("id", projet!.id).single();
    expect(projetRelu!.status).toBe("livre");
    expect(projetRelu!.date_livraison).toBe(new Date().toISOString().slice(0, 10));
    expect((projetRelu!.etapes as Etape[]).every((e) => e.done_at != null)).toBe(true);

    // Une seconde signature ne doit ni passer ni écraser le signataire.
    const seconde = await anon.rpc("signer_bl", { p_token: bl!.public_token, p_nom: "Imposteur", p_signature: {}, p_ip: null });
    expect(seconde.data.ok).toBe(false);
    const { data: blFinal } = await sb.from("bons_livraison").select("recu_par").eq("id", bl!.id).single();
    expect(blFinal!.recu_par).toBe("Sophie Testonne");
  });
});
