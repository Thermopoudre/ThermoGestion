import { describe, expect, it } from "vitest";
import {
  COLONNES_FEC,
  codeAuxiliaire,
  lignesFec,
  montantFec,
  nomFichierFec,
  ventilationTva,
  versCsv,
  versFec,
  type FactureCompta,
} from "@/lib/compta/export";

/**
 * Le FEC est un fichier réglementaire : 18 colonnes nommées, dans cet ordre, séparées par des
 * tabulations. Ce qui se contrôle ici, ce n'est pas « est-ce que ça ressemble à de la compta »,
 * c'est la structure exigée par l'article A.47 A-1 du LPF et l'équilibre débit/crédit de chaque
 * écriture — un journal déséquilibré est refusé par n'importe quel logiciel comptable.
 */

const FACTURE: FactureCompta = {
  id: "11111111-2222-3333-4444-555555555555",
  numero: "FA-2026-0004",
  type: "solde",
  status: "payee",
  emise_at: "2026-08-18T09:12:00.000Z",
  created_at: "2026-08-17T10:00:00.000Z",
  due_date: "2026-10-02",
  total_ht: 114.05,
  total_tva: 22.81,
  total_ttc: 136.86,
  nature_operation: "services",
  items: [
    { total_ht: 108, tva: 20 },
    { total_ht: 21.6, tva: 20 },
  ],
  client: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", nom: "Menuiserie Aluval", siren: "812345678", siret: null },
  paiements: [{ montant: 136.86, moyen: "virement", paye_at: "2026-09-30T08:00:00.000Z" }],
};

function colonnes(l: string) {
  return l.split("\t");
}

/**
 * Découpage sans `trim()` : les dernières colonnes du FEC (lettrage, devise) sont vides sur toutes
 * les lignes, un `trim()` mangerait les tabulations de fin et ferait croire à des lignes tronquées.
 */
function lignesDe(fec: string) {
  return fec.split("\r\n").filter((l) => l !== "");
}

describe("FEC", () => {
  const fec = versFec(lignesFec([FACTURE]));
  const lignes = lignesDe(fec);

  it("porte les 18 colonnes réglementaires, dans l'ordre, séparées par des tabulations", () => {
    // Les noms sont recopiés de l'article A.47 A-1 du LPF, en dur. Les comparer à `COLONNES_FEC`
    // ne prouverait rien : `versFec` construit l'en-tête AVEC `COLONNES_FEC`, l'assertion serait
    // vraie même en écrivant « JornalCode ». Or c'est exactement le genre de faute qu'un contrôle
    // fiscal relève, et que l'atelier découvrirait le jour où il n'a plus le temps.
    expect(colonnes(lignes[0])).toEqual([
      "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
      "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
      "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
    ]);
    expect(COLONNES_FEC).toHaveLength(18);
    for (const l of lignes) expect(colonnes(l)).toHaveLength(18);
  });

  it("écrit la vente au journal VT : client au débit, produit et TVA au crédit", () => {
    const vt = lignes.slice(1).map(colonnes).filter((c) => c[0] === "VT");
    expect(vt).toHaveLength(3);
    expect(vt[0][4]).toBe("411000");
    expect(vt[0][11]).toBe("136,86"); // débit client TTC
    expect(vt[1][4]).toBe("706000");
    expect(vt[1][12]).toBe("114,05"); // crédit produit HT
    expect(vt[2][4]).toBe("445710");
    expect(vt[2][12]).toBe("22,81"); // crédit TVA collectée
    // Dates au format AAAAMMJJ, sans séparateur.
    expect(vt[0][3]).toBe("20260818");
  });

  it("écrit l'encaissement au journal BQ et solde le compte client", () => {
    const bq = lignes.slice(1).map(colonnes).filter((c) => c[0] === "BQ");
    expect(bq).toHaveLength(2);
    expect(bq[0][4]).toBe("512000");
    expect(bq[0][11]).toBe("136,86");
    expect(bq[1][4]).toBe("411000");
    expect(bq[1][12]).toBe("136,86");
    expect(bq[0][3]).toBe("20260930");
  });

  it("équilibre chaque écriture au centime", () => {
    const somme = (i: number) =>
      lignes.slice(1).map(colonnes).reduce((s, c) => s + Number(c[i].replace(",", ".")), 0);
    expect(Math.round(somme(11) * 100)).toBe(Math.round(somme(12) * 100));
  });

  it("passe un avoir en sens inverse, jamais en vente négative", () => {
    const avoir = versFec(lignesFec([{ ...FACTURE, numero: "AV-2026-0001", type: "avoir", paiements: [] }]));
    const l = lignesDe(avoir).slice(1).map(colonnes);
    expect(l[0][4]).toBe("411000");
    expect(l[0][12]).toBe("136,86"); // le client est crédité
    expect(l[0][11]).toBe("0,00");
    expect(l[1][11]).toBe("114,05"); // le produit est débité
  });

  it("écarte les brouillons : une facture non émise n'existe pas comptablement", () => {
    expect(lignesFec([{ ...FACTURE, status: "brouillon" }])).toHaveLength(0);
    expect(lignesFec([{ ...FACTURE, numero: null }])).toHaveLength(0);
  });

  it("utilise le compte de caisse pour un règlement en espèces", () => {
    const l = lignesFec([{ ...FACTURE, paiements: [{ montant: 50, moyen: "especes", paye_at: "2026-09-01" }] }]);
    expect(l.find((x) => x.JournalCode === "BQ")!.CompteNum).toBe("530000");
  });

  it("distingue les comptes de vente selon la nature de l'opération", () => {
    const biens = lignesFec([{ ...FACTURE, nature_operation: "biens", paiements: [] }]);
    expect(biens[1].CompteNum).toBe("707000");
  });

  it("donne un compte auxiliaire lisible mais unique par client", () => {
    const a = codeAuxiliaire({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", nom: "Menuiserie Aluval" });
    const b = codeAuxiliaire({ id: "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee", nom: "Menuiserie Aluval" });
    expect(a).toBe("MENUISERAAAA");
    // Deux homonymes ne doivent pas fusionner dans un seul compte de grand-livre.
    expect(a).not.toBe(b);
  });

  it("nomme le fichier selon la règle <SIREN>FEC<AAAAMMJJ>.txt", () => {
    expect(nomFichierFec("900123456", "2026-12-31")).toBe("900123456FEC20261231.txt");
    expect(nomFichierFec(null, "2026-12-31")).toBe("000000000FEC20261231.txt");
  });

  it("écrit les montants à la française, sans séparateur de milliers", () => {
    expect(montantFec(1234.5)).toBe("1234,50");
    expect(montantFec("0")).toBe("0,00");
  });
});

describe("ventilation de TVA", () => {
  it("répartit une remise globale sur les bases, sans perdre un centime", () => {
    // 108 + 21,60 = 129,60 brut, remisés à 114,05 : la base reventilée doit retomber pile.
    const v = ventilationTva([{ total_ht: 108, tva: 20 }, { total_ht: 21.6, tva: 20 }], 114.05, 22.81);
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({ taux: 20, base: 114.05, tva: 22.81 });
  });

  it("sépare les taux et fait retomber la somme sur les totaux enregistrés", () => {
    const v = ventilationTva([{ total_ht: 100, tva: 20 }, { total_ht: 100, tva: 5.5 }], 200, 25.5);
    expect(v.map((x) => x.taux)).toEqual([20, 5.5]);
    expect(v.reduce((s, x) => s + x.base, 0)).toBe(200);
    expect(v.reduce((s, x) => s + x.tva, 0)).toBe(25.5);
  });

  it("ne divise jamais par zéro sur une facture sans ligne", () => {
    expect(ventilationTva([], 0, 0)).toEqual([{ taux: 0, base: 0, tva: 0 }]);
  });
});

describe("CSV de l'expert-comptable", () => {
  const csv = versCsv([FACTURE]);

  it("s'ouvre correctement dans un tableur français : BOM, point-virgule, virgule décimale", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    const [entete, premiere] = csv.replace("﻿", "").trim().split("\r\n");
    expect(entete.split(";")[0]).toBe("Date");
    const c = premiere.split(";");
    expect(c[0]).toBe("18/08/2026");
    expect(c[1]).toBe("FA-2026-0004");
    expect(c[8]).toBe("114,05");
    expect(c[9]).toBe("22,81");
  });

  it("protège un nom de client contenant un point-virgule", () => {
    const avecPointVirgule = versCsv([{ ...FACTURE, client: { ...FACTURE.client!, nom: "Durand ; Fils" } }]);
    expect(avecPointVirgule).toContain('"Durand ; Fils"');
  });

  it("ignore les brouillons comme le FEC", () => {
    expect(versCsv([{ ...FACTURE, status: "brouillon" }]).replace("﻿", "").trim().split("\r\n")).toHaveLength(1);
  });
});
