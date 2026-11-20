import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexColonne, lireFichier, parserCsv, separateur } from "@/lib/import/tableur";
import { MODELES, deviner, nombreDepuisTexte, preparer } from "@/lib/import/modeles";

/**
 * Reprise de données.
 *
 * Un import qui avale silencieusement une ligne fausse coûte plus cher qu'un import qui refuse :
 * l'atelier découvre l'erreur sur un devis, trois semaines plus tard. Les tests portent donc
 * autant sur ce qui est **rejeté** et sur le **motif** que sur ce qui passe.
 */

const CLIENTS = MODELES.find((m) => m.cle === "clients")!;
const POUDRES = MODELES.find((m) => m.cle === "poudres")!;
const PRESTATIONS = MODELES.find((m) => m.cle === "prestations")!;

describe("lecture d'un CSV", () => {
  it("devine le séparateur, parce qu'Excel français exporte en point-virgule", () => {
    expect(separateur("Nom;Email;Ville")).toBe(";");
    expect(separateur("Nom,Email,Ville")).toBe(",");
    expect(separateur("Nom\tEmail\tVille")).toBe("\t");
  });

  it("retire le BOM, sans quoi la première colonne s'appelle « \\ufeffNom » et n'est jamais reconnue", () => {
    const f = parserCsv("﻿Nom;Ville\nMartin;Aubagne\n");
    expect(f.entetes).toEqual(["Nom", "Ville"]);
  });

  it("respecte les guillemets, y compris un séparateur et un guillemet à l'intérieur", () => {
    const f = parserCsv('Nom;Notes\n"Martin; et fils";"Dit ""le grand"""\n');
    expect(f.lignes[0]).toEqual(["Martin; et fils", 'Dit "le grand"']);
  });

  it("accepte les fins de ligne Windows et ignore les lignes vides", () => {
    const f = parserCsv("Nom;Ville\r\nMartin;Aubagne\r\n\r\nDupont;Istres\r\n");
    expect(f.lignes).toHaveLength(2);
  });

  it("situe une cellule par sa référence de colonne, pour ne pas décaler les valeurs", () => {
    expect(indexColonne("A1")).toBe(0);
    expect(indexColonne("Z9")).toBe(25);
    expect(indexColonne("AA1")).toBe(26);
    expect(indexColonne("BC12")).toBe(54);
  });
});

describe("reconnaissance des colonnes", () => {
  it("reconnaît les intitulés courants d'un tableur d'atelier", () => {
    const c = deviner(["Raison sociale", "Courriel", "Tél.", "Code Postal", "Commune"], CLIENTS);
    expect(c.nom).toBe(0);
    expect(c.email).toBe(1);
    expect(c.telephone).toBe(2);
    expect(c.code_postal).toBe(3);
    expect(c.ville).toBe(4);
  });

  it("laisse vide ce qu'elle ne reconnaît pas plutôt que de rattacher au hasard", () => {
    const c = deviner(["Client", "Machin bidule"], CLIENTS);
    expect(c.nom).toBe(0);
    expect(c.siren).toBeNull();
  });

  it("n'attribue jamais deux fois la même colonne", () => {
    const c = deviner(["Nom", "Nom"], CLIENTS);
    const utilisees = Object.values(c).filter((v) => v !== null);
    expect(new Set(utilisees).size).toBe(utilisees.length);
  });
});

describe("conversion des nombres", () => {
  it("lit la virgule décimale, les espaces de milliers et le symbole €", () => {
    expect(nombreDepuisTexte("12,50 €")).toBe(12.5);
    expect(nombreDepuisTexte("1 234,5")).toBe(1234.5);
    expect(nombreDepuisTexte("18")).toBe(18);
  });

  it("refuse ce qui n'est pas un nombre au lieu de rendre zéro", () => {
    expect(nombreDepuisTexte("à définir")).toBeNull();
    expect(nombreDepuisTexte("")).toBeNull();
  });
});

describe("préparation des lignes", () => {
  const corr = deviner(["Nom", "Email", "SIREN"], CLIENTS);

  it("importe une ligne complète et déduit « pro » d'un SIREN renseigné", () => {
    const r = preparer(CLIENTS, [["Menuiserie Aluval", "contact@aluval.fr", "812345678"]], corr, new Set());
    expect(r.rejets).toEqual([]);
    expect(r.valides[0]).toMatchObject({ nom: "Menuiserie Aluval", email: "contact@aluval.fr", type: "pro" });
  });

  it("rejette une ligne sans le champ obligatoire, en nommant le champ", () => {
    const r = preparer(CLIENTS, [["", "contact@aluval.fr", ""]], corr, new Set());
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toContain("Nom / raison sociale");
  });

  it("numérote les lignes comme le tableur de l'atelier, en-tête comprise", () => {
    const r = preparer(CLIENTS, [["Bon", "", ""], ["", "", ""]], corr, new Set());
    // La deuxième ligne de données est la ligne 3 du fichier : ligne 1 = en-têtes.
    expect(r.rejets[0].numero).toBe(3);
  });

  it("rejette une adresse e-mail invalide plutôt que de l'enregistrer telle quelle", () => {
    const r = preparer(CLIENTS, [["Aluval", "contact(at)aluval.fr", ""]], corr, new Set());
    expect(r.rejets[0].motif).toContain("adresse valide");
  });

  it("ne recrée pas un client déjà présent dans l'atelier", () => {
    const r = preparer(CLIENTS, [["Aluval", "", ""]], corr, new Set(["aluval"]));
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toBe("déjà présent dans votre atelier");
  });

  it("repère un doublon interne au fichier", () => {
    const r = preparer(CLIENTS, [["Aluval", "", ""], ["aluval", "", ""]], corr, new Set());
    expect(r.valides).toHaveLength(1);
    expect(r.rejets[0].motif).toBe("en double dans le fichier");
  });

  it("normalise une valeur de liste écrite autrement (« Satiné » → satine)", () => {
    const c = deviner(["Référence", "Finition"], POUDRES);
    const r = preparer(POUDRES, [["RAL 7016", "Satiné"]], c, new Set());
    expect(r.valides[0]).toMatchObject({ reference: "RAL 7016", finition: "satine" });
  });

  it("rejette une valeur de liste inconnue en rappelant les valeurs acceptées", () => {
    const c = deviner(["Référence", "Finition"], POUDRES);
    const r = preparer(POUDRES, [["RAL 7016", "nacré"]], c, new Set());
    expect(r.rejets[0].motif).toContain("mat");
  });

  it("refuse un prix négatif : c'est une saisie, pas un avoir", () => {
    const c = deviner(["Nom", "Prix HT"], PRESTATIONS);
    const r = preparer(PRESTATIONS, [["Sablage", "-18"]], c, new Set());
    expect(r.rejets[0].motif).toContain("négative");
  });

  it("applique les valeurs par défaut d'une prestation sans écraser ce qui est fourni", () => {
    const c = deviner(["Nom", "Prix HT", "Unité"], PRESTATIONS);
    const r = preparer(PRESTATIONS, [["Sablage", "18", ""], ["Masquage", "9", "m2"]], c, new Set());
    expect(r.valides[0]).toMatchObject({ unite: "piece", tva_rate: 20 });
    expect(r.valides[1]).toMatchObject({ unite: "m2" });
  });
});

describe("lecture d'un classeur Excel", () => {
  /** Vrai .xlsx produit par un tableur, pas une chaîne fabriquée pour l'occasion. */
  function classeur() {
    const octets = readFileSync(join(__dirname, "fixtures", "clients.xlsx"));
    return new File([octets], "clients.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  it("lit les en-têtes et les lignes d'un classeur réel", async () => {
    const f = await lireFichier(classeur());
    expect(f.entetes[0]).toBe("Raison sociale");
    expect(f.entetes).toContain("Code Postal");
    expect(f.lignes).toHaveLength(3);
    expect(f.lignes[0][0]).toBe("Menuiserie Aluval");
  });

  it("ne décale pas les colonnes quand une cellule du milieu est vide", async () => {
    const f = await lireFichier(classeur());
    const iAdresse = f.entetes.indexOf("Adresse");
    const iVille = f.entetes.indexOf("Commune");
    // Ligne 2 : « Métalu Provence » n'a pas d'adresse. Sans repositionnement par référence de
    // cellule, la commune remonterait dans la colonne adresse.
    expect(f.lignes[1][iAdresse] ?? "").toBe("");
    expect(f.lignes[1][iVille]).toBe("Marseille");
  });

  it("importe le classeur de bout en bout sans rejet", async () => {
    const f = await lireFichier(classeur());
    const r = preparer(CLIENTS, f.lignes, deviner(f.entetes, CLIENTS), new Set());
    expect(r.rejets).toEqual([]);
    expect(r.valides).toHaveLength(3);
    expect(r.valides[0]).toMatchObject({ nom: "Menuiserie Aluval", ville: "Aubagne", type: "pro" });
    // Pas de SIREN et pas de SIRET : l'atelier a saisi un particulier, on ne le passe pas en pro.
    expect(r.valides[1]).toMatchObject({ nom: "Métalu Provence", type: "particulier" });
  });

  it("refuse un format qu'il ne sait pas lire, avec la marche à suivre", async () => {
    await expect(lireFichier(new File(["x"], "clients.xls"))).rejects.toThrow(/CSV UTF-8/);
  });
});
