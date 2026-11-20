import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux, montantForfaitMinimum, remiseAffichee, round2, sousTotalRemisable } from "@/lib/utils";
import { appliquerForfaitMinimum } from "@/lib/calculs";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { clientConnecte, contexte } from "./helpers/contexte";
import { chargerGrille, ligneM2 } from "./helpers/devis";

/**
 * Lot D — D1 : la remise doit rester bornée à l'écran ET en base, et le récapitulatif doit
 * toujours s'additionner : sous-total − remise + forfait minimum = total HT.
 *
 * La recette du 03/09 a trouvé le contraire sur une remise de 100 % : le complément de forfait
 * minimum n'entrait pas dans le calcul de la remise affichée (`DevisEditor` passait les lignes
 * SAISIES à `remiseAffichee`, pas les lignes CHIFFRÉES qui portent la ligne de forfait). Les
 * quatre cas ci-dessous couvrent le récapitulatif (calcul pur) et les trois bornes posées en base
 * par la migration 53 : remise négative, remise en pourcentage au-delà de 100 %, remise en euros
 * au-delà du sous-total.
 */
const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
let grilleId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  grilleId = ctx.seed.grilleStandardId;
  ({ paliers, coefs } = await chargerGrille(sb, grilleId));
});

describe("cas 1 — remise à 100 % avec forfait minimum : le récapitulatif s'additionne", () => {
  it("sous-total − remise affichée + forfait minimum = total HT, exactement", () => {
    // 0,3 m² × 45 € (palier 0–1) = 13,50 € : sans plancher, en dessous du forfait de 50 €.
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    expect(petite.total_ht).toBe(13.5);

    const remise = { type: "pct" as const, valeur: 100 };
    const { items: itemsChiffres, complement } = appliquerForfaitMinimum({ items: [petite], remise, forfaitMinimum: 50 });
    const totaux = calcTotaux(itemsChiffres, remise);

    // Une remise à 100 % efface la ligne facturée : le plancher comble tout le total.
    expect(complement).toBe(50);
    expect(totaux.total_ht).toBe(50);

    // C'est le correctif exact de D1 : `remiseAffichee` doit recevoir les lignes CHIFFRÉES
    // (forfait inclus), pas les seules lignes saisies — sinon `montantForfaitMinimum` vaut 0 et
    // l'addition ne tombe plus juste (c'est le bug reproduit juste après).
    const sousTotal = sousTotalRemisable([petite]);
    const remiseMontant = remiseAffichee(itemsChiffres, remise, totaux.total_ht);
    const forfait = montantForfaitMinimum(itemsChiffres);
    expect(sousTotal).toBe(13.5);
    expect(remiseMontant).toBe(13.5);
    expect(forfait).toBe(50);
    expect(round2(sousTotal - remiseMontant + forfait)).toBe(totaux.total_ht);
  });

  it("non-régression : les lignes SAISIES (sans le forfait) cassent l'addition — la raison du bug", () => {
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    const remise = { type: "pct" as const, valeur: 100 };
    const { items: itemsChiffres } = appliquerForfaitMinimum({ items: [petite], remise, forfaitMinimum: 50 });
    const totaux = calcTotaux(itemsChiffres, remise);

    // `items` = [petite] seul, comme le faisait `DevisEditor` avant correction : le forfait n'y
    // figure pas, `montantForfaitMinimum` retombe à 0, et `remiseAffichee` ne peut plus retomber
    // sur le total HT réel — la garde `applique > 0 ? applique : 0` masque même la remise (0 au
    // lieu de 13,50), ce qui est la version de la régression observée en recette.
    const remiseMontantBuggue = remiseAffichee([petite], remise, totaux.total_ht);
    const forfaitBuggue = montantForfaitMinimum([petite]);
    expect(forfaitBuggue).toBe(0);
    expect(round2(sousTotalRemisable([petite]) - remiseMontantBuggue + forfaitBuggue)).not.toBe(totaux.total_ht);
  });
});

describe("cas 2 — remise négative refusée en base", () => {
  it("un devis avec une remise négative est rejeté, rien n'est écrit", async () => {
    const petite = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { error } = await sb.from("devis").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      items: [petite], remise: { type: "pct", valeur: -30 }, ...calcTotaux([petite], null),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REMISE_NEGATIVE/i);

    const { count } = await sb.from("devis").select("id", { count: "exact", head: true })
      .eq("client_id", ctx.seed.clientSimpleId).eq("remise->>valeur", "-30");
    expect(count).toBe(0);
  });
});

describe("cas 3 — remise en pourcentage supérieure à 100 % refusée en base", () => {
  it("un devis à 150 % de remise est rejeté", async () => {
    const petite = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { error } = await sb.from("devis").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      items: [petite], remise: { type: "pct", valeur: 150 }, ...calcTotaux([petite], null),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REMISE_SUPERIEURE_100/i);
  });

  it("la même borne s'applique à une facture", async () => {
    const petite = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, type: "libre",
      items: [petite], remise: { type: "pct", valeur: 500 }, ...calcTotaux([petite], null),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REMISE_SUPERIEURE_100/i);
  });
});

describe("cas 4 — remise en euros supérieure au sous-total refusée en base", () => {
  it("un devis remisé de 200 € sur 64,00 € de sous-total est rejeté", async () => {
    // 2 m² × 32 € (palier 1–3) = 64,00 €.
    const ligne = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    expect(ligne.total_ht).toBe(64);
    const { error } = await sb.from("devis").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      items: [ligne], remise: { type: "montant", valeur: 200 }, ...calcTotaux([ligne], null),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REMISE_SUPERIEURE_SOUS_TOTAL/i);
  });

  it("la même borne s'applique à un bon de livraison", async () => {
    const ligne = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { error } = await sb.from("bons_livraison").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      lignes: [ligne], remise: { type: "montant", valeur: 90 },
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REMISE_SUPERIEURE_SOUS_TOTAL/i);
  });

  it("une remise qui colle exactement au sous-total (arrondi) est acceptée, elle", async () => {
    const ligne = ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { data, error } = await sb.from("devis").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      items: [ligne], remise: { type: "montant", valeur: 64 }, ...calcTotaux([ligne], { type: "montant", valeur: 64 }),
    }).select("id").single();
    expect(error).toBeNull();
    await sb.from("devis").delete().eq("id", data!.id);
  });
});

describe("bonus D5 — une quantité ou surface de ligne négative est refusée en base", () => {
  it("une ligne à surface négative sur un devis est rejetée", async () => {
    const ligneNegative: DevisItem = {
      type: "m2", libelle: "Thermolaquage", qte: -5, unite: "m2", pu_ht: 20, tva: 20, total_ht: -100,
    };
    const { error } = await sb.from("devis").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId,
      items: [ligneNegative], remise: null, ...calcTotaux([ligneNegative], null),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/LIGNE_QUANTITE_NEGATIVE/i);
  });

  it("une ligne de déduction d'acompte (qte positive, montant négatif) reste acceptée", async () => {
    const acompte: DevisItem = {
      type: "libre", libelle: "Acompte — déjà facturé", qte: 1, unite: "forfait",
      pu_ht: -50, tva: 20, total_ht: -50, meta: { deduction_acompte: true },
    };
    const ligne = ligneM2({ surface: 4, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const { data, error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, type: "solde",
      items: [ligne, acompte], remise: null, ...calcTotaux([ligne, acompte], null),
    }).select("id").single();
    expect(error).toBeNull();
    await sb.from("factures").delete().eq("id", data!.id);
  });
});
