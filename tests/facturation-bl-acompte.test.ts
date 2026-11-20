import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { calcTotaux, estDeductionAcompte, montantAcomptesDeduits, montantRemise, round2 } from "@/lib/utils";
import { acomptesDeductibles, lignesDeductionAcomptes, lignesSoldeDepuisDevis } from "@/lib/calculs";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, creerFactureDepuisDevis, finaliserDevis, ligneM2 } from "./helpers/devis";

/**
 * Deux fuites d'argent de l'audit, dans la même chaîne :
 *
 *  - R4 : un bon de livraison déjà facturé restait refacturable. `bons_livraison.facture_id`
 *    n'était posé que par la RPC récapitulative ; une facture créée depuis un devis ne rattachait
 *    rien. Cas réel : BL-2026-0011 à 420,30 €, livré et déjà réglé par FA-2026-0031, comptait
 *    encore dans les bons éligibles à la récap du mois.
 *  - R6 : une facture d'acompte fermait définitivement la porte au solde — l'écran retirait de la
 *    liste tout devis portant *au moins une* facture.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
/** Client dédié : la récapitulative ramasse tous les bons livrés d'un client sur la période. */
let clientId: string;

async function devisSigne(remise: { type: "pct" | "montant"; valeur: number } | null = null, surface = 6) {
  const items = [ligneM2({ surface, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items, remise });
  const envoye = await finaliserDevis(sb, devis.id);
  await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Signataire lot 6", p_signature: {}, p_ip: null });
  const { data: relu } = await sb.from("devis").select("*").eq("id", devis.id).single();
  const { data: projet } = await sb.from("projets").select("id").eq("devis_id", devis.id).single();
  return { devis: relu!, projetId: projet!.id as string, items };
}

async function creerBLLivre(projetId: string | null, lignes: DevisItem[]) {
  const { data: numero } = await sb.rpc("next_numero", { p_type: "bl" });
  const { data, error } = await sb
    .from("bons_livraison")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, projet_id: projetId,
      numero, status: "livre", lignes, livre_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  expect(error, `création BL : ${error?.message}`).toBeNull();
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Serrurerie Lot 6", delai_paiement_jours: 45 })
    .select("id")
    .single();
  if (error) throw new Error(`client de test : ${error.message}`);
  clientId = data!.id as string;
});

describe("R4 — un bon de livraison ne se facture qu'une fois", () => {
  it("la facture du chantier consomme le bon de livraison du chantier", async () => {
    const { devis, projetId, items } = await devisSigne();
    const bl = await creerBLLivre(projetId, items);
    expect(bl.facture_id).toBeNull();

    const facture = await creerFactureDepuisDevis(sb, devis);

    const { data: blRelu } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(blRelu!.facture_id, "le bon est resté détaché de la facture qui le règle").toBe(facture.id);
    expect(blRelu!.status).toBe("facture");
  });

  it("et la récapitulative du mois ne le ramasse plus", async () => {
    const jour = new Date().toISOString().slice(0, 10);
    const { error } = await sb.rpc("facture_recapitulative", { p_client: clientId, p_debut: jour, p_fin: jour });
    expect(error, "un bon déjà facturé est reparti dans la récapitulative").not.toBeNull();
    expect(error!.message).toMatch(/[Aa]ucun bon de livraison/);
  });

  it("rebrancher un bon sur une autre facture est refusé depuis un client PostgREST", async () => {
    const { devis: d1, projetId: p1, items } = await devisSigne();
    const bl = await creerBLLivre(p1, items);
    await creerFactureDepuisDevis(sb, d1);

    const { devis: d2 } = await devisSigne();
    const autre = await creerFactureDepuisDevis(sb, d2);

    const { error } = await sb.from("bons_livraison").update({ facture_id: autre.id }).eq("id", bl.id);
    expect(error, "le bon a été rebranché sur une seconde facture").not.toBeNull();
    expect(error!.message).toMatch(/BL_DEJA_FACTURE/);
  });

  it("statut et rattachement ne peuvent pas diverger", async () => {
    const { devis, projetId, items } = await devisSigne();
    const bl = await creerBLLivre(projetId, items);
    await creerFactureDepuisDevis(sb, devis);

    // Repasser le bon en « livré » sans le détacher le remettrait dans le pool de la récap.
    await sb.from("bons_livraison").update({ status: "livre" }).eq("id", bl.id);
    const { data } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(data!.status).toBe("facture");
    expect(data!.facture_id).not.toBeNull();
  });

  it("supprimer une facture brouillon rend le bon disponible", async () => {
    const { devis, projetId, items } = await devisSigne();
    const bl = await creerBLLivre(projetId, items);
    const facture = await creerFactureDepuisDevis(sb, devis);

    const { error } = await sb.from("factures").delete().eq("id", facture.id);
    expect(error).toBeNull();

    const { data } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(data!.facture_id, "le bon est resté marqué facturé alors que la facture n'existe plus").toBeNull();
    expect(data!.status).toBe("livre");
  });

  it("annuler une facture rend le bon disponible", async () => {
    const { devis, projetId, items } = await devisSigne();
    const bl = await creerBLLivre(projetId, items);
    const facture = await creerFactureDepuisDevis(sb, devis);

    await sb.from("factures").update({ status: "annulee" }).eq("id", facture.id);
    const { data } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(data!.facture_id).toBeNull();
    expect(data!.status).toBe("livre");
  });

  it("un acompte ne consomme aucun bon : il n'est pas le règlement de la livraison", async () => {
    const { devis, projetId, items } = await devisSigne();
    const bl = await creerBLLivre(projetId, items);
    // Totaux cohérents avec la ligne : un autre test vérifie cet invariant sur *tous* les
    // documents de l'atelier, un montant posé à la main le ferait tomber.
    const { error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id, projet_id: projetId,
      type: "acompte", items: [items[0]], ...calcTotaux([items[0]], null),
    });
    expect(error).toBeNull();
    const { data } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(data!.facture_id).toBeNull();
    expect(data!.status).toBe("livre");
  });
});

describe("R6 — l'acompte n'interdit plus le solde", () => {
  it("un devis portant un acompte reste proposable ; un devis soldé ne l'est plus", async () => {
    const { devis } = await devisSigne();
    // Reproduit exactement la requête d'exclusion de l'éditeur de facture.
    const dejaSolde = async () => {
      const { data } = await sb
        .from("factures")
        .select("devis_id")
        .not("devis_id", "is", null)
        .in("type", ["solde", "libre"])
        .neq("status", "annulee");
      return new Set(((data as { devis_id: string }[]) ?? []).map((f) => f.devis_id)).has(devis.id);
    };

    await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id,
      type: "acompte", items: [], total_ht: 0, total_tva: 0, total_ttc: 0,
    });
    expect(await dejaSolde(), "un acompte a fermé la porte au solde").toBe(false);

    await creerFactureDepuisDevis(sb, devis);
    expect(await dejaSolde()).toBe(true);
  });

  it("le solde déduit l'acompte et le total tombe juste au centime", async () => {
    const { devis, items } = await devisSigne({ type: "pct", valeur: 12 });
    const totalDevis = calcTotaux(devis.items as DevisItem[], devis.remise);

    // Acompte de 30 % du TTC, facturé et émis.
    const acompteHt = round2(totalDevis.total_ht * 0.3);
    const ligneAcompte: DevisItem = {
      type: "libre", libelle: "Acompte 30 %", qte: 1, unite: "forfait",
      pu_ht: acompteHt, tva: 20, total_ht: acompteHt,
    };
    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    const { data: acompte, error: errA } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id, numero,
        type: "acompte", status: "emise", items: [ligneAcompte], ...calcTotaux([ligneAcompte], null),
      })
      .select("*")
      .single();
    expect(errA).toBeNull();

    // Le solde reprend le chantier et déduit ce qui a déjà été facturé.
    const lignesSolde = lignesSoldeDepuisDevis(devis.items as DevisItem[], [acompte!]);
    const totauxSolde = calcTotaux(lignesSolde, devis.remise);
    const { data: solde, error: errS } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientId, devis_id: devis.id,
        type: "solde", items: lignesSolde, remise: devis.remise, facture_liee_id: acompte!.id,
        ...totauxSolde,
      })
      .select("*")
      .single();
    expect(errS).toBeNull();

    // Devis − acompte = solde, au centime, TVA comprise.
    expect(nb(solde!.total_ht)).toBeCloseTo(totalDevis.total_ht - nb(acompte!.total_ht), 2);
    expect(nb(solde!.total_ttc)).toBeCloseTo(totalDevis.total_ttc - nb(acompte!.total_ttc), 2);

    // La déduction est explicite sur le document : c'est une mention attendue sur une facture de solde.
    const deduction = (solde!.items as DevisItem[]).find(estDeductionAcompte);
    expect(deduction, "le solde ne dit nulle part que l'acompte a été déduit").toBeDefined();
    expect(deduction!.libelle).toContain(acompte!.numero);
    expect(montantAcomptesDeduits(solde!.items as DevisItem[])).toBe(nb(acompte!.total_ht));
    expect(solde!.facture_liee_id).toBe(acompte!.id);
  });

  it("la remise ne s'applique pas une seconde fois à l'acompte déduit", async () => {
    const lignesChantier: DevisItem[] = [
      { type: "m2", libelle: "Laquage", qte: 10, unite: "m2", pu_ht: 50, tva: 20, total_ht: 500 },
    ];
    const acompte = {
      id: "a", numero: "FA-2026-0100", type: "acompte", status: "emise", emise_at: "2026-08-01T00:00:00Z",
      items: [{ type: "libre", libelle: "Acompte", qte: 1, unite: "forfait", pu_ht: 132, tva: 20, total_ht: 132 } as DevisItem],
    };
    const remise = { type: "pct" as const, valeur: 12 };
    const lignes = lignesSoldeDepuisDevis(lignesChantier, [acompte]);

    // L'assiette de remise reste le chantier seul : 500 € et non 368 €.
    expect(montantRemise(lignes, remise)).toBe(60);
    const totaux = calcTotaux(lignes, remise);
    expect(totaux.total_ht).toBe(round2(500 - 60 - 132));
    expect(totaux.total_tva).toBe(round2((500 - 60 - 132) * 0.2));
  });

  it("un acompte multi-TVA se déduit taux par taux, sinon la ventilation du solde sort fausse", () => {
    const acompte = {
      id: "a", numero: "FA-2026-0101", type: "acompte", status: "payee", emise_at: "2026-08-05T00:00:00Z",
      items: [
        { type: "libre", libelle: "Laquage", qte: 1, unite: "forfait", pu_ht: 200, tva: 20, total_ht: 200 },
        { type: "libre", libelle: "Fourniture", qte: 1, unite: "forfait", pu_ht: 100, tva: 10, total_ht: 100 },
      ] as DevisItem[],
    };
    const lignes = lignesDeductionAcomptes([acompte]);
    expect(lignes).toHaveLength(2);
    expect(lignes.map((l) => [l.tva, l.total_ht])).toEqual([[20, -200], [10, -100]]);
    expect(lignes.every((l) => l.meta?.deduction_acompte === true)).toBe(true);
    expect(lignes[0].libelle).toContain("05/08/2026");
  });

  it("seuls les acomptes réellement facturés se déduisent", () => {
    const base = { id: "x", numero: "FA-x", items: [] as DevisItem[] };
    expect(acomptesDeductibles([{ ...base, type: "acompte", status: "brouillon" }])).toHaveLength(0);
    expect(acomptesDeductibles([{ ...base, type: "acompte", status: "annulee" }])).toHaveLength(0);
    expect(acomptesDeductibles([{ ...base, type: "solde", status: "emise" }])).toHaveLength(0);
    expect(acomptesDeductibles([{ ...base, type: "acompte", status: "emise" }])).toHaveLength(1);
    expect(acomptesDeductibles([{ ...base, type: "acompte", status: "payee" }])).toHaveLength(1);
  });

  it("un devis ne se solde pas deux fois — le garde-fou est en base, pas dans l'écran", async () => {
    const { devis } = await devisSigne();
    await creerFactureDepuisDevis(sb, devis);
    let erreur: string | null = null;
    try {
      await creerFactureDepuisDevis(sb, devis);
    } catch (e) {
      erreur = (e as Error).message;
    }
    expect(erreur, "le même devis a été soldé deux fois").not.toBeNull();
    expect(erreur!).toMatch(/factures_un_solde_par_devis|duplicate|unique/i);
  });
});
