import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux } from "@/lib/utils";
import { prixM2, surfaceDeveloppee, metrageTotal, prixNegocie } from "@/lib/calculs";
import type { ClientTarif, GrilleCoef, GrillePalier, Prestation } from "@/lib/types";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, ligneM2, ligneMl, lignePrestation, lignePieceType } from "./helpers/devis";

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

describe("grille au m² : paliers et coefficients lus en base", () => {
  it("choisit le palier sur la borne basse incluse et la borne haute exclue", () => {
    const p = (surface: number) => prixM2({ surface, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    expect(p(0.5)).toBe(45);
    expect(p(1)).toBe(32);
    expect(p(2.99)).toBe(32);
    expect(p(3)).toBe(24);
    expect(p(9.99)).toBe(24);
    expect(p(10)).toBe(18);
    expect(p(150)).toBe(18);
  });

  it("multiplie le palier par les coefficients de finition et de complexité", () => {
    expect(prixM2({ surface: 4.2, finition: "structure", complexite: "moyenne", grilleId, paliers, coefs })).toBe(33.12);
    expect(prixM2({ surface: 4.2, finition: "mat", complexite: "complexe", grilleId, paliers, coefs })).toBe(34.8);
  });

  it("retombe sur un coefficient neutre si le code est inconnu, jamais sur zéro", () => {
    expect(prixM2({ surface: 4.2, finition: "inexistante", complexite: "inexistante", grilleId, paliers, coefs })).toBe(24);
  });

  it("chiffre une ligne m² au centime près", async () => {
    const ligne = ligneM2({ surface: 4.2, finition: "structure", complexite: "moyenne", grilleId, paliers, coefs });
    expect(ligne.pu_ht).toBe(33.12);
    expect(ligne.total_ht).toBe(139.1);
  });
});

describe("lignes au mètre linéaire", () => {
  it("facture le métrage et déduit la surface développée du périmètre", async () => {
    const { data: tarif } = await sb.from("tarifs_ml").select("*").eq("id", ctx.seed.tarifMlId).single();
    const ligne = ligneMl({
      famille: tarif!.famille, tarifMlId: tarif!.id, metrage: 12.5,
      prixMl: nb(tarif!.prix_ml), perimetreDeveloppeM: nb(tarif!.perimetre_developpe_m),
    });
    expect(ligne.total_ht).toBe(350);
    expect(ligne.meta!.surface_equivalente_m2).toBe(4.38);
  });

  it("convertit un profilé en surface développée depuis son périmètre en mm", () => {
    expect(surfaceDeveloppee(350, 2.1, 4)).toBe(2.94);
    expect(metrageTotal(2.1, 4)).toBe(8.4);
    expect(surfaceDeveloppee(0, 2.1, 4)).toBe(0);
  });
});

describe("prestations et tarif négocié", () => {
  it("préfère le prix négocié du client au prix catalogue", async () => {
    const { data: prestation } = await sb.from("prestations").select("*").eq("id", ctx.seed.prestationSablageId).single();
    const { data: tarifs } = await sb.from("client_tarifs").select("*");
    const catalogue = prixNegocie(prestation as Prestation, ctx.seed.clientSimpleId, (tarifs ?? []) as ClientTarif[]);
    const negocie = prixNegocie(prestation as Prestation, ctx.seed.clientRemiseId, (tarifs ?? []) as ClientTarif[]);
    expect(catalogue).toEqual({ pu: 9, negocie: false });
    expect(negocie).toEqual({ pu: 7.2, negocie: true });
  });
});

describe("totaux, remise, TVA et arrondis", () => {
  const lignes = [
    { total_ht: 108, tva: 20 },
    { total_ht: 21.6, tva: 20 },
  ];

  it("sans remise : TVA 20 % et TTC cohérents", () => {
    expect(calcTotaux(lignes, null)).toEqual({ total_ht: 129.6, total_tva: 25.92, total_ttc: 155.52 });
  });

  it("remise en pourcentage : la TVA suit le HT remisé", () => {
    expect(calcTotaux(lignes, { type: "pct", valeur: 12 })).toEqual({ total_ht: 114.05, total_tva: 22.81, total_ttc: 136.86 });
  });

  it("remise en montant", () => {
    expect(calcTotaux(lignes, { type: "montant", valeur: 29.6 })).toEqual({ total_ht: 100, total_tva: 20, total_ttc: 120 });
  });

  it("une remise supérieure au total ne rend jamais un montant négatif", () => {
    expect(calcTotaux(lignes, { type: "montant", valeur: 500 })).toEqual({ total_ht: 0, total_tva: 0, total_ttc: 0 });
  });

  it("mélange de taux de TVA : chaque ligne garde le sien", () => {
    const mixte = [
      { total_ht: 100, tva: 20 },
      { total_ht: 100, tva: 5.5 },
    ];
    expect(calcTotaux(mixte, null)).toEqual({ total_ht: 200, total_tva: 25.5, total_ttc: 225.5 });
  });

  it("arrondit au centime, sans dérive sur un tiers de centime", () => {
    expect(calcTotaux([{ total_ht: 0.005, tva: 20 }], null).total_ht).toBe(0.01);
    expect(calcTotaux([{ total_ht: 33.333, tva: 20 }], null)).toEqual({ total_ht: 33.33, total_tva: 6.67, total_ttc: 40 });
  });
});

describe("devis complet enregistré en base", () => {
  it("relit exactement les totaux qu'il a écrits", async () => {
    const items = [
      ligneM2({ surface: 4.2, finition: "structure", complexite: "moyenne", grilleId, paliers, coefs }),
      ligneMl({ famille: "Garde-corps", tarifMlId: ctx.seed.tarifMlId, metrage: 12.5, prixMl: 28, perimetreDeveloppeM: 0.35 }),
      lignePrestation({ prestationId: ctx.seed.prestationSablageId, nom: "Sablage", unite: "piece", qte: 1, pu: 7.2, negocie: true }),
      lignePieceType({ pieceTypeId: ctx.seed.pieceTypeId, nom: 'Jante alu 17"', prix: 55, surfaceM2: 0.9 }),
    ];
    const attendu = calcTotaux(items, { type: "pct", valeur: 12 });
    const devis = await creerDevis(sb, {
      atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items, remise: { type: "pct", valeur: 12 },
    });

    const { data: relu } = await sb.from("devis").select("*").eq("id", devis.id).single();
    expect(nb(relu!.total_ht)).toBe(attendu.total_ht);
    expect(nb(relu!.total_tva)).toBe(attendu.total_tva);
    expect(nb(relu!.total_ttc)).toBe(attendu.total_ttc);
    // 139,10 + 350,00 + 7,20 + 55,00 = 551,30 HT brut, remisé de 12 %.
    expect(attendu.total_ht).toBe(485.14);

    await sb.from("devis").delete().eq("id", devis.id);
  });
});
