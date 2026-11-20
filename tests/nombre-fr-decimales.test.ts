import { describe, expect, it } from "vitest";
import { nombreFr } from "@/lib/utils";

/**
 * Recette navigateur, vague 1, défaut n°3 — `/lots` affichait « 6,8 / 25 kg » : le premier nombre
 * porte une décimale, le second n'en porte jamais (`nombreFr()` retire les zéros inutiles par
 * défaut). Deux grandeurs affichées de part et d'autre d'une barre doivent porter le MÊME nombre
 * de décimales, sinon l'œil lit deux unités différentes là où il n'y en a qu'une.
 *
 * Le troisième paramètre de `nombreFr()`, `minDecimales`, sert exactement ça : forcer un nombre de
 * décimales fixe. Sans lui (comportement historique, inchangé), les zéros inutiles restent retirés
 * — c'est ce que veulent les ~60 autres appels de `nombreFr()` dans le produit, pour un nombre isolé.
 */
describe("nombreFr — comportement par défaut inchangé (rétrocompatibilité)", () => {
  it("retire les zéros inutiles sans minDecimales, comme avant", () => {
    expect(nombreFr(25, 1)).toBe("25");
    expect(nombreFr(6.8, 1)).toBe("6,8");
  });

  it("rend « — » pour une valeur absente ou non numérique, comme avant", () => {
    expect(nombreFr(null)).toBe("—");
    expect(nombreFr(undefined)).toBe("—");
    expect(nombreFr("")).toBe("—");
    expect(nombreFr("pas un nombre")).toBe("—");
  });
});

describe("nombreFr — minDecimales force des décimales identiques des deux côtés d'une paire", () => {
  it("complète les zéros manquants jusqu'à minDecimales", () => {
    expect(nombreFr(25, 1, 1)).toBe("25,0");
    expect(nombreFr(6.8, 1, 1)).toBe("6,8");
  });

  it("reproduit exactement le défaut relevé en recette, corrigé : 6,8 / 25,0 kg", () => {
    const restant = nombreFr(6.8, 1, 1);
    const total = nombreFr(25, 1, 1);
    expect(`${restant} / ${total} kg`).toBe("6,8 / 25,0 kg");
  });

  it("s'applique à n'importe quelle précision (paire à trois décimales, comme /stock/[id])", () => {
    expect(nombreFr(6.8, 3, 3)).toBe("6,800");
    expect(nombreFr(25, 3, 3)).toBe("25,000");
  });

  it("ne tronque jamais en dessous de minDecimales même si le nombre est déjà « rond »", () => {
    expect(nombreFr(0, 1, 1)).toBe("0,0");
  });
});
