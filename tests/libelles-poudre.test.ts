import { describe, expect, it } from "vitest";
import { libelleFinitionPoudre, libelleTypePoudre } from "@/lib/utils";

/**
 * Lot D — D7 : identifiants techniques affichés tels quels.
 *
 * `PoudreForm` proposait un `<Select>` dont la VALEUR **et** le TEXTE affiché étaient le même code
 * anglo-saxon ("satine", "texture", "metallise"…), et `/stock` recopiait `poudre.finition` brut
 * dans la liste. `poudres.finition` et `poudres.type` restent des colonnes texte libre en base
 * (aucune contrainte : une reprise de tableur peut y avoir déposé autre chose) — la traduction ne
 * porte donc que sur les codes que l'écran propose lui-même, avec un repli sur la valeur telle
 * quelle pour tout le reste, qui n'a jamais été un code technique à traduire.
 */
describe("D7 — libellés de finition et de type de poudre", () => {
  it("traduit chaque code proposé par PoudreForm", () => {
    expect(libelleFinitionPoudre("mat")).toBe("Mat");
    expect(libelleFinitionPoudre("satine")).toBe("Satiné");
    expect(libelleFinitionPoudre("brillant")).toBe("Brillant");
    expect(libelleFinitionPoudre("texture")).toBe("Texturé");
    expect(libelleFinitionPoudre("metallise")).toBe("Métallisé");
    expect(libelleFinitionPoudre("candy")).toBe("Candy");

    expect(libelleTypePoudre("polyester")).toBe("Polyester");
    expect(libelleTypePoudre("epoxy")).toBe("Époxy");
    expect(libelleTypePoudre("epoxy-polyester")).toBe("Époxy-polyester");
    expect(libelleTypePoudre("primaire")).toBe("Primaire");
    expect(libelleTypePoudre("vernis")).toBe("Vernis");
  });

  it("ne traduit plus jamais « satine » ou « texture » en clair", () => {
    // Reproduction exacte du D7 relevé en recette : le code technique ne doit plus jamais être le
    // texte affiché à l'écran.
    expect(libelleFinitionPoudre("satine")).not.toBe("satine");
    expect(libelleFinitionPoudre("texture")).not.toBe("texture");
  });

  it("une valeur absente rend une chaîne vide, pas « null »", () => {
    expect(libelleFinitionPoudre(null)).toBe("");
    expect(libelleFinitionPoudre(undefined)).toBe("");
    expect(libelleTypePoudre(null)).toBe("");
  });

  it("une valeur importée déjà en clair (hors liste) retombe telle quelle, sans être inventée", () => {
    expect(libelleFinitionPoudre("RAL 9010 satiné brillant")).toBe("RAL 9010 satiné brillant");
  });
});
