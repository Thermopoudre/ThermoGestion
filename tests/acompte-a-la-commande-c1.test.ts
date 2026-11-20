import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { calcTotaux, estDeductionAcompte, montantAcomptesDeduits } from "@/lib/utils";
import { lignesAcompteDepuisDevis, lignesSoldeDepuisDevis, montantAcompte } from "@/lib/calculs";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2 } from "./helpers/devis";

/**
 * Lot C, C1 — acompte à la commande.
 *
 * Reproduit le parcours réel : un devis remisé de 12 % demande 30 % d'acompte à la signature.
 * `creerFactureAcompte` (fiche devis) construit la facture d'acompte avec `lignesAcompteDepuisDevis`
 * — c'est cette fonction, corrigée dans ce chantier pour tenir compte de la remise (voir le
 * commentaire dans `lib/calculs.ts`), qui est rejouée ici. Le test qui compte vraiment est le
 * dernier : acompte + solde = total du devis, exactement, au centime.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
let clientId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Chaudronnerie Lot C1", delai_paiement_jours: 30 })
    .select("id")
    .single();
  if (error) throw new Error(`client C1 : ${error.message}`);
  clientId = data!.id as string;
});

describe("un devis demande 30 % d'acompte à la commande", () => {
  it("le montant s'affiche correctement avant même la signature, y compris sur la page publique", async () => {
    const items = [ligneM2({ surface: 6, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const remise = { type: "pct" as const, valeur: 12 };
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items, remise });

    const { error: errMaj } = await sb.from("devis").update({ acompte_pct: 30 }).eq("id", devis.id);
    expect(errMaj).toBeNull();

    const envoye = await finaliserDevis(sb, devis.id);
    expect(nb(envoye.acompte_pct)).toBe(30);

    const attendu = montantAcompte(nb(envoye.total_ttc), 30);
    expect(attendu).toBeGreaterThan(0);

    // La page publique (client anonyme, jeton du devis) doit annoncer le même montant.
    const { data: pub, error: errPub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect(errPub).toBeNull();
    expect(nb((pub as { montant_acompte: number }).montant_acompte)).toBeCloseTo(attendu, 2);
    expect(nb((pub as { acompte_pct: number }).acompte_pct)).toBe(30);
  });

  it("la facture d'acompte vaut exactement 30 % du TTC du devis signé, remise comprise", async () => {
    const items = [ligneM2({ surface: 6, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const remise = { type: "pct" as const, valeur: 12 };
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items, remise });
    await sb.from("devis").update({ acompte_pct: 30 }).eq("id", devis.id);
    const envoye = await finaliserDevis(sb, devis.id);

    const { error: errSign } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Signataire C1", p_signature: {}, p_ip: null,
    });
    expect(errSign).toBeNull();

    const { data: signe } = await sb.from("devis").select("*").eq("id", devis.id).single();
    expect(signe!.status).toBe("signe");

    // Reproduction fidèle de `creerFactureAcompte` (fiche devis) : lignes par taux de TVA puis
    // totaux, aucune remise recalculée par-dessus (elle est déjà dans les lignes).
    const lignes = lignesAcompteDepuisDevis(signe!.items as DevisItem[], signe!.acompte_pct, signe!.remise);
    const totaux = calcTotaux(lignes, null);
    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    const { data: acompte, error: errAcompte } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id, numero,
        type: "acompte", status: "emise", items: lignes, remise: null, ...totaux,
      })
      .select("*")
      .single();
    expect(errAcompte).toBeNull();

    // 30 % du TTC réellement signé (remisé), pas 30 % d'un total brut.
    expect(nb(acompte!.total_ttc)).toBeCloseTo(montantAcompte(nb(signe!.total_ttc), 30), 2);

    // ── Le solde déduit exactement ce montant ──────────────────────────────────
    const lignesSolde = lignesSoldeDepuisDevis(signe!.items as DevisItem[], [acompte!]);
    const totauxSolde = calcTotaux(lignesSolde, signe!.remise);
    const { data: solde, error: errSolde } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id,
        type: "solde", items: lignesSolde, remise: signe!.remise, facture_liee_id: acompte!.id,
        ...totauxSolde,
      })
      .select("*")
      .single();
    expect(errSolde).toBeNull();

    // La preuve qui compte : acompte + solde reconstitue EXACTEMENT le total du devis signé.
    expect(nb(acompte!.total_ttc) + nb(solde!.total_ttc)).toBeCloseTo(nb(signe!.total_ttc), 2);
    expect(nb(acompte!.total_ht) + nb(solde!.total_ht)).toBeCloseTo(nb(signe!.total_ht), 2);

    const deduction = (solde!.items as DevisItem[]).find(estDeductionAcompte);
    expect(deduction, "le solde ne mentionne pas la déduction de l'acompte").toBeDefined();
    expect(montantAcomptesDeduits(solde!.items as DevisItem[])).toBeCloseTo(nb(acompte!.total_ht), 2);
  });

  it("sans acompte demandé (acompte_pct NULL), aucune ligne d'acompte n'est produite", () => {
    const items: DevisItem[] = [{ type: "libre", libelle: "Sans acompte", qte: 1, unite: "forfait", pu_ht: 500, tva: 20, total_ht: 500 }];
    expect(lignesAcompteDepuisDevis(items, null, null)).toEqual([]);
  });

  it("un acompte_pct hors bornes est refusé par la contrainte en base", async () => {
    const items = [ligneM2({ surface: 4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items });
    const { error: trop } = await sb.from("devis").update({ acompte_pct: 130 }).eq("id", devis.id);
    expect(trop, "un acompte de 130 % a été accepté").not.toBeNull();
    const { error: negatif } = await sb.from("devis").update({ acompte_pct: -5 }).eq("id", devis.id);
    expect(negatif, "un acompte négatif a été accepté").not.toBeNull();
  });
});
