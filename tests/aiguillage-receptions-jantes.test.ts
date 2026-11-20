import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASTUCES } from "@/lib/aide";

/**
 * Amélioration n°10 (07/09/2026) — deux circuits de réception (générique `/receptions` et jantes
 * `/jantes`), sans rien qui explique à l'écran pourquoi il y en a deux ni lequel prendre.
 *
 * Décision prise (la moins risquée) : un AIGUILLAGE explicite, pas une fusion — aucune donnée ni
 * aucun circuit existant n'est touché, seule l'explication à l'écran change. Ce fichier ne peut
 * pas monter `AstuceEcran` (son premier rendu reste bloqué à `deplie === null` tant que l'effet
 * `useEffect` n'a pas tranché « déjà lu » ou non — `localStorage` et une lecture Supabase, tous
 * deux absents d'un rendu statique ; `design-system-ui.test.ts` documente déjà cette limite) ni
 * `/receptions/new` ou `/jantes/new` (page bloquée sur `<Spinner />` tant que son `useEffect` de
 * chargement n'a pas rendu la main, qui ne s'exécute pas non plus en rendu statique). Ce fichier
 * vérifie donc : 1) les DONNÉES que consomme `AstuceEcran` (`ASTUCES`), et 2) que le code source
 * des deux écrans porte bien le lien réciproque — même méthode que `assistant-securite.test.ts`.
 */

describe("ASTUCES — aiguillage réciproque jantes ↔ réceptions", () => {
  it("l'astuce « jantes » pointe vers /receptions, avec le vocabulaire de l'atelier", () => {
    const lien = ASTUCES.jantes.lienCroise;
    expect(lien).toBeDefined();
    expect(lien!.href).toBe("/receptions");
    // Vocabulaire atelier : « dépôt », « jantes » — jamais un nom de table ou de colonne.
    expect(lien!.libelle).toMatch(/jantes/i);
    expect(lien!.libelle).not.toMatch(/jeux_jantes|projet_id|type_piece/i);
  });

  it("l'astuce « receptions » pointe vers /jantes, réciproque de la précédente", () => {
    const lien = ASTUCES.receptions.lienCroise;
    expect(lien).toBeDefined();
    expect(lien!.href).toBe("/jantes");
    expect(lien!.libelle).toMatch(/jantes/i);
  });

  it("aucune des deux ne se pointe elle-même (un aiguillage qui boucle ne sert à rien)", () => {
    expect(ASTUCES.jantes.lienCroise!.href).not.toBe("/jantes");
    expect(ASTUCES.receptions.lienCroise!.href).not.toBe("/receptions");
  });
});

describe("AstuceEcran — rendu du lien croisé", () => {
  it("consomme bien astuce.lienCroise (pas seulement astuce.tutoriel)", () => {
    const source = readFileSync(join(process.cwd(), "src/components/AstuceEcran.tsx"), "utf8");
    expect(source).toContain("astuce.lienCroise");
    expect(source).toContain("astuce.lienCroise.href");
  });
});

describe("Boutons de création — l'aiguillage est visible AVANT la saisie, pas seulement dans l'astuce repliable", () => {
  it("/receptions/new explique le cas jantes et lie vers /jantes/new", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/receptions/new/page.tsx"), "utf8");
    expect(source).toMatch(/jante/i);
    expect(source).toContain("/jantes/new");
  });

  it("/jantes/new explique le cas générique et lie vers /receptions/new", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/jantes/new/page.tsx"), "utf8");
    expect(source).toMatch(/réception/i);
    expect(source).toContain("/receptions/new");
  });
});

describe("Listes — l'astuce de chaque écran porte l'aiguillage", () => {
  it("/receptions utilise AstuceEcran cle=\"receptions\"", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/receptions/Contenu.tsx"), "utf8");
    expect(source).toContain('<AstuceEcran cle="receptions" />');
  });

  it("/jantes utilise AstuceEcran cle=\"jantes\"", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/jantes/Contenu.tsx"), "utf8");
    expect(source).toContain('<AstuceEcran cle="jantes" />');
  });
});
