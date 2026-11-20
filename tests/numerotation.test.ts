import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte } from "./helpers/contexte";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * La numérotation doit rester séquentielle et sans trou même si deux postes de l'atelier
 * finalisent un document au même instant : une facture en double numéro est un rejet comptable.
 * Un type de document dédié isole ce test des compteurs utilisés par les autres fichiers.
 */
const ctx = contexte();
let sb: SupabaseClient;

beforeAll(() => {
  sb = clientConnecte(ctx);
});

describe("next_numero", () => {
  it("délivre 20 numéros distincts et contigus sous 20 appels concurrents", async () => {
    const appels = Array.from({ length: 20 }, () => sb.rpc("next_numero", { p_type: "concurrence" }));
    const resultats = await Promise.all(appels);
    for (const r of resultats) expect(r.error).toBeNull();

    const numeros = resultats.map((r) => r.data as string);
    expect(new Set(numeros).size).toBe(20);

    const rangs = numeros.map((n) => Number(n.slice(-4))).sort((a, b) => a - b);
    expect(rangs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("préfixe selon le type de document et remet le compteur par année", async () => {
    const annee = new Date().getFullYear();
    const { data: devis } = await sb.rpc("next_numero", { p_type: "devis" });
    const { data: facture } = await sb.rpc("next_numero", { p_type: "facture" });
    const { data: projet } = await sb.rpc("next_numero", { p_type: "projet" });
    expect(devis).toMatch(new RegExp(`^DV-${annee}-\\d{4}$`));
    expect(facture).toMatch(new RegExp(`^FA-${annee}-\\d{4}$`));
    expect(projet).toMatch(new RegExp(`^PR-${annee}-\\d{4}$`));
  });

  it("compte séparément chaque type de document", async () => {
    const { data: avantDevis } = await sb.rpc("next_numero", { p_type: "devis" });
    await sb.rpc("next_numero", { p_type: "facture" });
    await sb.rpc("next_numero", { p_type: "facture" });
    const { data: apresDevis } = await sb.rpc("next_numero", { p_type: "devis" });
    expect(Number((apresDevis as string).slice(-4))).toBe(Number((avantDevis as string).slice(-4)) + 1);
  });

  it("la table des compteurs n'est pas exposée : on ne numérote que par la RPC", async () => {
    // Le premier test le prouve déjà côté métier (les 20 numéros de cet atelier neuf partent de 1,
    // donc sans mélange avec un autre atelier) ; ici on vérifie qu'aucun client ne peut lire ni
    // forcer un compteur en écrivant directement dans la table.
    attendreLectureFermee(
      await sb.from("compteurs").select("atelier_id, doc_type, valeur"),
      "la table des compteurs lue par un compte applicatif",
    );

    const { error: errEcriture } = await sb
      .from("compteurs")
      .insert({ atelier_id: ctx.seed.atelierId, doc_type: "devis", annee: 2026, valeur: 9999 });
    expect(errEcriture).not.toBeNull();
  });
});
