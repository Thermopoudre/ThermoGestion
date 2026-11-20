import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, forfaitMinimumClient, ligneM2 } from "./helpers/devis";
import { prixM2 } from "@/lib/calculs";
import type { GrilleCoef, GrillePalier } from "@/lib/types";

/**
 * Lot A5 — la grille dédiée d'un client sort au bon prix.
 *
 * Le bandeau « Grille dédiée appliquée » de l'éditeur de devis annonce depuis le lot 5 quelque
 * chose que rien ne permettait de créer : `createGrille()` forçait `is_default`, et l'écran de
 * réglages ne chargeait que la grille par défaut. La coquille C-4 est du code d'affichage sans
 * chemin de données derrière.
 *
 * Ce fichier vérifie l'autre bout de la chaîne, celui qui décide de l'argent : un client sous
 * contrat paie SON prix, pas le tarif public. Il travaille dans l'atelier du semis, où le client
 * « Menuiserie Testale » porte déjà une grille contrat — c'est le cas de figure réel.
 */

const ctx = contexte();
let sb: SupabaseClient;
let standard: { paliers: GrillePalier[]; coefs: GrilleCoef[] };
let contrat: { paliers: GrillePalier[]; coefs: GrilleCoef[] };

/** Une surface qui tombe dans une tranche intermédiaire de la grille standard, pas dans la première. */
const SURFACE = 5.4;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  standard = await chargerGrille(sb, ctx.seed.grilleStandardId);
  contrat = await chargerGrille(sb, ctx.seed.grilleContratId);
});

describe("la grille dédiée d'un client", () => {
  it("est bien celle qui figure sur sa fiche : c'est ce que lit l'éditeur de devis", async () => {
    const { data } = await sb
      .from("clients")
      .select("id, nom, grille_id")
      .eq("id", ctx.seed.clientRemiseId)
      .single();
    expect((data as { grille_id: string }).grille_id).toBe(ctx.seed.grilleContratId);

    const { data: temoin } = await sb
      .from("clients")
      .select("id, grille_id")
      .eq("id", ctx.seed.clientSimpleId)
      .single();
    expect((temoin as { grille_id: string | null }).grille_id).toBeNull();
  });

  it("donne un prix au m² différent du tarif public, sur la même surface", () => {
    const arguments_ = { surface: SURFACE, finition: "mat", complexite: "simple", couche: null };
    const publicM2 = prixM2({ ...arguments_, grilleId: ctx.seed.grilleStandardId, ...standard });
    const negocieM2 = prixM2({ ...arguments_, grilleId: ctx.seed.grilleContratId, ...contrat });

    // Grille standard du semis : tranche 3 → 10 m² à 24 €. Grille contrat : tranche unique à 20 €.
    expect(publicM2).toBe(24);
    expect(negocieM2).toBe(20);
  });

  it("emporte aussi le forfait minimum : c'est le même barème, pas seulement le prix au m²", async () => {
    expect(await forfaitMinimumClient(sb, ctx.seed.clientRemiseId)).toBe(0);
    expect(await forfaitMinimumClient(sb, ctx.seed.clientSimpleId)).toBe(50);
  });

  it("un devis établi pour ce client sort au prix négocié, en base", async () => {
    const items = [ligneM2({
      surface: SURFACE, finition: "mat", complexite: "simple",
      grilleId: ctx.seed.grilleContratId, paliers: contrat.paliers, coefs: contrat.coefs,
    })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items });

    // 5,4 m² × 20 € = 108 €. Au tarif public, la même pièce serait à 129,60 €.
    expect(nb(devis.total_ht)).toBe(108);

    // La ligne enregistrée porte la grille qui l'a chiffrée : sans cette trace, un devis relu six
    // mois plus tard ne dirait plus pourquoi il était à ce prix-là.
    const { data } = await sb.from("devis").select("items").eq("id", devis.id).single();
    const ligne = ((data as { items: { meta?: { grille_id?: string } }[] }).items ?? [])[0];
    expect(ligne.meta?.grille_id).toBe(ctx.seed.grilleContratId);

    await sb.from("devis").delete().eq("id", devis.id);
  });

  it("le même chantier, au tarif public, coûte plus cher — sinon la grille dédiée ne sert à rien", async () => {
    const items = [ligneM2({
      surface: SURFACE, finition: "mat", complexite: "simple",
      grilleId: ctx.seed.grilleStandardId, paliers: standard.paliers, coefs: standard.coefs,
    })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    expect(nb(devis.total_ht)).toBe(129.6);
    await sb.from("devis").delete().eq("id", devis.id);
  });
});
