import { describe, expect, it } from "vitest";
import { lireParamUrl, urlAvecParam } from "@/lib/urlState";

/**
 * Lot D — D10 : liens qui ne tiennent pas leur promesse, état perdu à l'appui sur Précédent.
 *
 * `lireParamUrl` et `urlAvecParam` sont la logique pure derrière `useEtatUrl` (`lib/urlState.ts`),
 * le hook posé sur les onglets de `/reglages` et `/pilotage`, et les filtres de `/devis`,
 * `/factures`, `/bl`, `/jantes` et `/clients`.
 */
describe("D10 — lireParamUrl", () => {
  const VALEURS = ["actifs", "livre", "tous"] as const;

  it("reprend la valeur de la query string si elle fait partie des valeurs attendues", () => {
    expect(lireParamUrl("?filtre=livre", "filtre", VALEURS, "actifs")).toBe("livre");
  });

  it("retombe sur le défaut si le paramètre est absent", () => {
    expect(lireParamUrl("", "filtre", VALEURS, "actifs")).toBe("actifs");
  });

  it("retombe sur le défaut si la valeur ne fait pas partie des valeurs attendues — un lien ne doit pas planter l'écran", () => {
    expect(lireParamUrl("?filtre=nimportequoi", "filtre", VALEURS, "actifs")).toBe("actifs");
  });

  it("lit le bon paramètre parmi plusieurs sur la même URL", () => {
    expect(lireParamUrl("?client=abc-123&filtre=tous", "filtre", VALEURS, "actifs")).toBe("tous");
  });
});

describe("D10 — urlAvecParam", () => {
  it("pose le paramètre quand la valeur n'est pas celle par défaut", () => {
    expect(urlAvecParam("/bl", "", "filtre", "livre", "actifs")).toBe("/bl?filtre=livre");
  });

  it("retire le paramètre quand on revient au défaut — l'URL sans filtre reste le même lien qu'avant ce correctif", () => {
    expect(urlAvecParam("/bl", "?filtre=livre", "filtre", "actifs", "actifs")).toBe("/bl");
  });

  it("ne touche pas aux autres paramètres de la query string (ex. ?client=)", () => {
    expect(urlAvecParam("/bl", "?client=abc-123", "filtre", "livre", "actifs")).toBe("/bl?client=abc-123&filtre=livre");
  });

  it("« Voir les BL à facturer » : le lien pose le filtre attendu, pas le filtre par défaut", () => {
    // Reproduction du bug D10 : le lien promettait « Livrés » et /bl s'ouvrait sur « Tous ».
    const url = urlAvecParam("/bl", "", "filtre", "livre", "actifs");
    expect(url).not.toBe("/bl");
    expect(url).toBe("/bl?filtre=livre");
    expect(lireParamUrl(url.split("?")[1] ? `?${url.split("?")[1]}` : "", "filtre", ["actifs", "livre", "tous"] as const, "actifs")).toBe("livre");
  });
});
