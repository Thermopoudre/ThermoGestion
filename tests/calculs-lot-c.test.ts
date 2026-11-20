import { describe, expect, it } from "vitest";
import {
  lignesAcompteDepuisDevis,
  lignesFacturables,
  lignesOptionnelles,
  montantAcompte,
  prixPalierQuantite,
} from "@/lib/calculs";
import { calcTotaux } from "@/lib/utils";
import type { DevisItem, PalierQuantite, Prestation } from "@/lib/types";

/**
 * Lot C — unités pures des fonctions ajoutées à `lib/calculs.ts` (C1 acompte, C5 paliers/options).
 * Rien ici ne touche la base : c'est `tests/facturation-acompte-c1.test.ts`,
 * `tests/quantite-options-c5.test.ts`, etc. qui prouvent le câblage bout en bout.
 */

function prestation(paliers: PalierQuantite[], prixCatalogue = 10): Prestation {
  return {
    id: "presta-1", atelier_id: "at-1", code: "TST", nom: "Test", unite: "piece",
    prix_unitaire_ht: prixCatalogue, tva_rate: 20, categorie: null, nature: "services",
    ordre: 1, actif: true, paliers_quantite: paliers,
  } as unknown as Prestation;
}

describe("C5 — prixPalierQuantite : prix dégressif par quantité", () => {
  it("sans palier déclaré, le prix catalogue s'applique quelle que soit la quantité", () => {
    expect(prixPalierQuantite(prestation([]), 1)).toBe(10);
    expect(prixPalierQuantite(prestation([]), 500)).toBe(10);
  });

  it("retient le palier dont le seuil est le plus élevé sans dépasser la quantité", () => {
    const paliers: PalierQuantite[] = [
      { a_partir_de: 10, prix: 8.5 },
      { a_partir_de: 50, prix: 7 },
      { a_partir_de: 100, prix: 6 },
    ];
    expect(prixPalierQuantite(prestation(paliers), 1)).toBe(10); // sous le premier seuil : catalogue
    expect(prixPalierQuantite(prestation(paliers), 9)).toBe(10);
    expect(prixPalierQuantite(prestation(paliers), 10)).toBe(8.5); // pile le seuil
    expect(prixPalierQuantite(prestation(paliers), 49)).toBe(8.5);
    expect(prixPalierQuantite(prestation(paliers), 50)).toBe(7);
    expect(prixPalierQuantite(prestation(paliers), 250)).toBe(6);
  });

  it("des paliers déclarés dans le désordre donnent le même résultat", () => {
    const paliers: PalierQuantite[] = [
      { a_partir_de: 100, prix: 6 },
      { a_partir_de: 10, prix: 8.5 },
      { a_partir_de: 50, prix: 7 },
    ];
    expect(prixPalierQuantite(prestation(paliers), 60)).toBe(7);
  });
});

describe("C1 — montantAcompte", () => {
  it("calcule le pourcentage du TTC, arrondi au centime", () => {
    expect(montantAcompte(1000, 30)).toBe(300);
    expect(montantAcompte(133.33, 30)).toBe(40); // 133,33 × 30 % = 39,999 → arrondi à 40
  });

  it("ne demande aucun acompte à 0 % ou sans pourcentage", () => {
    expect(montantAcompte(1000, 0)).toBe(0);
    expect(montantAcompte(1000, null)).toBe(0);
    expect(montantAcompte(1000, undefined)).toBe(0);
  });

  it("un TTC absent ne casse rien", () => {
    expect(montantAcompte(null, 30)).toBe(0);
  });
});

describe("C1 — lignesAcompteDepuisDevis", () => {
  it("une ligne par taux de TVA, au pourcentage demandé", () => {
    const items: DevisItem[] = [
      { type: "libre", libelle: "Laquage", qte: 1, unite: "forfait", pu_ht: 200, tva: 20, total_ht: 200 },
      { type: "libre", libelle: "Fourniture", qte: 1, unite: "forfait", pu_ht: 100, tva: 10, total_ht: 100 },
    ];
    const lignes = lignesAcompteDepuisDevis(items, 30, null);
    expect(lignes).toHaveLength(2);
    // Ordre décroissant de taux, comme lignesDeductionAcomptes.
    expect(lignes.map((l) => [l.tva, l.total_ht])).toEqual([[20, 60], [10, 30]]);
    expect(lignes.every((l) => l.meta?.acompte_ligne === true)).toBe(true);
    expect(lignes[0].libelle).toContain("30 %");
  });

  it("rien à 0 % ou sans pourcentage", () => {
    const items: DevisItem[] = [{ type: "libre", libelle: "X", qte: 1, unite: "forfait", pu_ht: 100, tva: 20, total_ht: 100 }];
    expect(lignesAcompteDepuisDevis(items, 0, null)).toEqual([]);
    expect(lignesAcompteDepuisDevis(items, null, null)).toEqual([]);
  });

  it("tient compte de la remise du devis — 30 % d'un devis remisé, pas 30 % du brut", () => {
    // 500 € HT à 20 %, remisé de 12 % → base réelle 440 € HT.
    const items: DevisItem[] = [{ type: "m2", libelle: "Laquage", qte: 10, unite: "m2", pu_ht: 50, tva: 20, total_ht: 500 }];
    const remise = { type: "pct" as const, valeur: 12 };
    const lignes = lignesAcompteDepuisDevis(items, 30, remise);
    // 30 % de 440 € HT = 132 €, pas 30 % de 500 € (150 €).
    expect(lignes).toHaveLength(1);
    expect(lignes[0].total_ht).toBe(132);
  });

  it("le total TTC de l'acompte ainsi construit tombe exactement sur montantAcompte(devis.total_ttc, pct)", () => {
    const items: DevisItem[] = [
      { type: "m2", libelle: "Laquage", qte: 10, unite: "m2", pu_ht: 50, tva: 20, total_ht: 500 },
      { type: "libre", libelle: "Fourniture", qte: 1, unite: "forfait", pu_ht: 100, tva: 10, total_ht: 100 },
    ];
    const remise = { type: "pct" as const, valeur: 12 };
    const totalDevis = calcTotaux(items, remise);

    const lignesAcompte = lignesAcompteDepuisDevis(items, 30, remise);
    const totalAcompte = calcTotaux(lignesAcompte, null);

    expect(totalAcompte.total_ttc).toBeCloseTo(montantAcompte(totalDevis.total_ttc, 30), 2);
  });

  it("exclut le forfait minimum de l'assiette, comme la remise elle-même", () => {
    const items: DevisItem[] = [
      { type: "m2", libelle: "Laquage", qte: 1, unite: "m2", pu_ht: 30, tva: 20, total_ht: 30, meta: { forfait_minimum: true } },
      { type: "libre", libelle: "Prestation", qte: 1, unite: "forfait", pu_ht: 100, tva: 20, total_ht: 100 },
    ];
    // Un acompte de 100 % doit reprendre les DEUX lignes (rien à négliger) : ce test vérifie
    // seulement que le plancher entre bien dans l'assiette de l'acompte, contrairement à la remise.
    const lignes = lignesAcompteDepuisDevis(items, 100, null);
    const total = lignes.reduce((s, l) => s + Number(l.total_ht), 0);
    expect(total).toBe(130);
  });
});

describe("C5 — lignesFacturables / lignesOptionnelles", () => {
  const base: DevisItem[] = [
    { type: "libre", libelle: "Ligne ferme", qte: 1, unite: "forfait", pu_ht: 100, tva: 20, total_ht: 100 },
    { type: "libre", libelle: "Option non retenue", qte: 1, unite: "forfait", pu_ht: 50, tva: 20, total_ht: 50, optionnel: true, option_id: "o1" },
    { type: "libre", libelle: "Option retenue à la signature", qte: 1, unite: "forfait", pu_ht: 80, tva: 20, total_ht: 80, optionnel: true, option_id: "o2", optionnel_accepte: true },
  ];

  it("lignesFacturables garde les lignes fermes ET les options acceptées, exclut les options en attente", () => {
    const facturables = lignesFacturables(base);
    expect(facturables.map((l) => l.libelle)).toEqual(["Ligne ferme", "Option retenue à la signature"]);
  });

  it("lignesOptionnelles ne garde que les options pas encore tranchées", () => {
    const optionnelles = lignesOptionnelles(base);
    expect(optionnelles.map((l) => l.libelle)).toEqual(["Option non retenue"]);
  });

  it("un devis sans aucune option renvoie tout en facturable et rien en optionnel", () => {
    const items: DevisItem[] = [{ type: "libre", libelle: "Seule ligne", qte: 1, unite: "forfait", pu_ht: 10, tva: 20, total_ht: 10 }];
    expect(lignesFacturables(items)).toHaveLength(1);
    expect(lignesOptionnelles(items)).toHaveLength(0);
  });

  it("tolère une liste vide ou absente", () => {
    expect(lignesFacturables(null)).toEqual([]);
    expect(lignesFacturables(undefined)).toEqual([]);
    expect(lignesOptionnelles([])).toEqual([]);
  });
});
