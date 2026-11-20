import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { dateHeureFr, heureFr } from "@/lib/utils";

/**
 * Lot D — D13 : quatre formats d'heure pour la même chose.
 *
 * `dateHeureFr()` était définie deux fois — `ReglagesRelances.tsx` (`dateStyle: "short"`) et
 * `/relances` (`dateStyle: "long"`) — sous le même nom, avec deux rendus différents pour le même
 * historique de relances. `PortailReglage.tsx` recomposait la date et l'heure à la main
 * (`toLocaleDateString` + `toLocaleTimeString`), et `DevisEditor` affichait l'heure seule sans
 * option, secondes comprises. Une seule paire de fonctions fait foi désormais : `dateHeureFr()`
 * (lib/utils.ts) et `heureFr()` pour l'heure seule.
 */
describe("D13 — dateHeureFr / heureFr", () => {
  it("dateHeureFr combine la date et l'heure en un format compact unique", () => {
    const iso = "2026-09-03T14:32:00.000Z";
    const rendu = dateHeureFr(iso);
    expect(rendu).not.toBe("—");
    // La forme exacte dépend du fuseau d'exécution ; on vérifie la structure, pas l'heure locale.
    expect(rendu).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });

  it("dateHeureFr rend un tiret sur une valeur absente, jamais « Invalid Date »", () => {
    expect(dateHeureFr(null)).toBe("—");
    expect(dateHeureFr(undefined)).toBe("—");
  });

  it("heureFr ne rend jamais les secondes, dans un format déterministe (« 14h32 »)", () => {
    const rendu = heureFr(new Date("2026-09-03T14:32:07.000Z"));
    expect(rendu).not.toBe("—");
    // Recette navigateur (vague 2) : un sixième format d'heure avait survécu à D13, dans
    // `horodatageFr` (lib/journal.ts), qui recomposait « 14 h 12 » à la main pendant que
    // `/relances` affichait « 09:00 » via `dateHeureFr`. `heureFr` ne dépend plus de
    // `toLocaleTimeString` — dont le séparateur rendu pour `fr-FR` dépend de la version d'ICU du
    // runtime (« 14:32 » ou « 14 h 32 » selon l'environnement) — mais calcule elle-même
    // `getHours()`/`getMinutes()` pour rendre toujours exactement « 14h32 », sans espace ni
    // deux-points : c'est l'usage français, et c'est déterministe.
    expect(rendu).toMatch(/^\d{2}h\d{2}$/);
  });
});

describe("D13 — plus aucune redéfinition locale de dateHeureFr", () => {
  it("le grep ne trouve qu'une seule déclaration de dateHeureFr dans tout le code source", () => {
    const racine = join(__dirname, "..", "src");
    const trouves: string[] = [];
    const parcourir = (dir: string) => {
      for (const entree of readdirSync(dir)) {
        const chemin = join(dir, entree);
        const info = statSync(chemin);
        if (info.isDirectory()) parcourir(chemin);
        else if (/\.(ts|tsx)$/.test(entree)) {
          const contenu = readFileSync(chemin, "utf8");
          if (/function dateHeureFr\(/.test(contenu) || /const dateHeureFr\s*=/.test(contenu)) {
            trouves.push(relative(racine, chemin).replace(/\\/g, "/"));
          }
        }
      }
    };
    parcourir(racine);
    expect(trouves, "dateHeureFr ne doit être déclarée qu'une fois, dans lib/utils.ts").toEqual(["lib/utils.ts"]);
  });
});
