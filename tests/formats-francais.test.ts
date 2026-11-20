import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Lot D — D6 : formats anglo-saxons.
 *
 * `toFixed()` rend toujours un point décimal (`"6.80"`), jamais la virgule française. Chaque
 * occurrence trouvée en dehors d'un format machine (PDF, XML Factur-X, FEC, import de tableur) est
 * un nombre qui finira à l'écran tel quel — c'est exactement le défaut relevé en recette sur
 * `/lots`, `/fournees`, `/qualite/bains`, `/factures/<id>`, `/reglages` et les mentions légales
 * publiques. Ce test grep le code source une fois pour toutes : la seule façon de le faire
 * repasser au vert après l'avoir cassé est d'utiliser `nombreFr()`, pas de rajouter un chemin
 * autorisé de complaisance.
 */

const RACINE = join(__dirname, "..", "src");

/**
 * Fichiers et dossiers où `toFixed()` est légitime : ce sont des formats MACHINE (le XML Factur-X,
 * le FEC, un CSV d'import) où la virgule française est reconstruite explicitement
 * (`.toFixed(2).replace(".", ",")`) ou où le point est la norme du format. Rien ici n'est un texte
 * lu par un humain sans passer par un formatage dédié.
 */
const AUTORISES = [
  "lib/facturx/", // XML Factur-X — EN 16931, format machine
  "lib/pdf/", // PDF — mis en page séparément, hors mandat Lot D
  "lib/compta/export.ts", // FEC — `montantFec()` reconstruit déjà la virgule française
  "lib/import/modeles.ts", // reprise d'un tableur — `euros()` reconstruit déjà la virgule française
];

function estAutorise(chemin: string): boolean {
  return AUTORISES.some((prefixe) => chemin.startsWith(prefixe));
}

function fichiersSource(dir: string): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree);
    const info = statSync(chemin);
    if (info.isDirectory()) {
      resultats.push(...fichiersSource(chemin));
    } else if (/\.(ts|tsx)$/.test(entree)) {
      resultats.push(chemin);
    }
  }
  return resultats;
}

describe("aucun toFixed() en dehors des formats machine (PDF, XML, FEC, import)", () => {
  it("le grep ne trouve rien de nouveau", () => {
    const trouves: string[] = [];
    for (const fichier of fichiersSource(RACINE)) {
      const relatif = relative(RACINE, fichier).replace(/\\/g, "/");
      if (estAutorise(relatif)) continue;
      const contenu = readFileSync(fichier, "utf8");
      const lignes = contenu.split("\n");
      lignes.forEach((ligne, i) => {
        if (ligne.includes(".toFixed(")) trouves.push(`${relatif}:${i + 1}`);
      });
    }
    expect(
      trouves,
      "toFixed() rend un point anglo-saxon : utilisez nombreFr() (ou ajoutez le fichier à la " +
        "liste AUTORISES de ce test s'il s'agit réellement d'un format machine).",
    ).toEqual([]);
  });
});
