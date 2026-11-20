import { describe, expect, it } from "vitest";
import {
  MODELES, cleDoublon, dateDepuisTexte, deviner, preparer,
  type Modele, type Referentiels,
} from "@/lib/import/modeles";

/**
 * Les quatre modèles d'import du lot A, éprouvés sans la base.
 *
 * Ce que ces tests visent : le moment où l'atelier dépose son fichier et regarde l'aperçu. C'est
 * là que se joue la reprise. Une ligne avalée en silence coûte plus cher qu'une ligne refusée —
 * l'atelier découvre l'erreur sur une facture, trois semaines plus tard, quand elle est figée.
 * Les assertions portent donc autant sur le MOTIF du rejet que sur ce qui passe.
 */

function modele(cle: string): Modele {
  const m = MODELES.find((x) => x.cle === cle);
  if (!m) throw new Error(`modèle ${cle} absent de MODELES`);
  return m;
}

const FACTURES = modele("factures_ouvertes");
const LOTS = modele("lots_poudre");
const TARIFS = modele("tarifs_negocies");
const GRILLE = modele("grille_m2");

const CLIENTS: Referentiels = {
  clients: new Map([
    ["menuiserie martin", "cli-martin"],
    ["serrurerie du sud", "cli-sud"],
    // Deux fiches au même nom normalisé : la valeur `null` dit « ambigu », et la ligne est refusée.
    ["ambigu sarl", null],
  ]),
};

describe("lecture d'une date de tableur", () => {
  it("accepte les trois écritures qu'un atelier emploie", () => {
    expect(dateDepuisTexte("03/09/2026")).toBe("2026-09-03");
    expect(dateDepuisTexte("3.9.2026")).toBe("2026-09-03");
    expect(dateDepuisTexte("2026-09-03")).toBe("2026-09-03");
    expect(dateDepuisTexte("03/09/26")).toBe("2026-09-03");
  });

  it("accepte le numéro de série d'Excel, sans quoi tout .xlsx daté serait rejeté", () => {
    // Excel compte les jours depuis le 30/12/1899 (l'année 1900 y est faussement bissextile).
    expect(dateDepuisTexte("45900")).toBe("2025-08-31");
    expect(dateDepuisTexte("46268")).toBe("2026-09-03");
    expect(dateDepuisTexte("46063")).toBe("2026-02-10");
  });

  it("refuse ce qui n'est pas une date, plutôt que de rendre le 1er janvier 1970", () => {
    expect(dateDepuisTexte("")).toBeNull();
    expect(dateDepuisTexte("à réception")).toBeNull();
    expect(dateDepuisTexte("32/01/2026")).toBeNull();
    expect(dateDepuisTexte("00/09/2026")).toBeNull();
    // Un montant n'est pas une date : les bornes du numéro de série l'écartent.
    expect(dateDepuisTexte("1200")).toBeNull();
  });
});

describe("modèle « Factures en cours »", () => {
  const entetes = ["N° facture", "Client", "Date", "HT", "TVA", "TTC", "Échéance", "Déjà réglé"];
  const corr = deviner(entetes, FACTURES);

  it("reconnaît les intitulés d'un export de balance client", () => {
    expect(corr.numero).toBe(0);
    expect(corr.client).toBe(1);
    expect(corr.emise_le).toBe(2);
    expect(corr.total_ht).toBe(3);
    expect(corr.total_tva).toBe(4);
    expect(corr.total_ttc).toBe(5);
    expect(corr.due_date).toBe(6);
    expect(corr.regle).toBe(7);
  });

  it("rapproche le client par son nom et rend l'identifiant que la RPC attend", () => {
    const r = preparer(FACTURES, [["FA-2026-0325", "MENUISERIE  MARTIN", "12/06/2026", "1000", "200", "1200", "12/07/2026", "200"]], corr, new Set(), CLIENTS);
    expect(r.rejets).toEqual([]);
    expect(r.valides[0]).toMatchObject({
      numero: "FA-2026-0325", client_id: "cli-martin", emise_le: "2026-06-12",
      total_ht: 1000, total_tva: 200, total_ttc: 1200, due_date: "2026-07-12", regle: 200,
    });
    expect(FACTURES.rpc!.parametres(r.valides[0])).toMatchObject({
      p_client_id: "cli-martin", p_numero: "FA-2026-0325", p_emise_le: "2026-06-12", p_regle: 200,
    });
  });

  it("refuse un client inconnu en disant quoi faire, et n'en crée pas un second", () => {
    const r = preparer(FACTURES, [["FA-1", "Chaudronnerie Inconnue", "12/06/2026", "100", "20", "120", "", ""]], corr, new Set(), CLIENTS);
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toMatch(/introuvable/);
    expect(r.rejets[0].motif).toMatch(/importez d'abord vos clients/i);
    expect(r.rejets[0].valeur).toBe("FA-1");
  });

  it("refuse un nom qui désigne deux fiches plutôt que de choisir au hasard", () => {
    const r = preparer(FACTURES, [["FA-2", "Ambigu SARL", "12/06/2026", "100", "20", "120", "", ""]], corr, new Set(), CLIENTS);
    expect(r.rejets[0].motif).toMatch(/plusieurs fiches/);
  });

  it("déduit la TVA quand la colonne manque — un atelier en franchise n'en a pas", () => {
    const sansTva = deviner(["N° facture", "Client", "Date", "HT", "TTC"], FACTURES);
    const r = preparer(FACTURES, [["FA-3", "Serrurerie du Sud", "12/06/2026", "1000", "1200"]], sansTva, new Set(), CLIENTS);
    expect(r.rejets).toEqual([]);
    expect(r.valides[0].total_tva).toBe(200);
  });

  it("refuse HT + TVA ≠ TTC en chiffrant l'écart : c'est une colonne mal rapprochée", () => {
    const r = preparer(FACTURES, [["FA-4", "Serrurerie du Sud", "12/06/2026", "1000", "200", "1500", "", ""]], corr, new Set(), CLIENTS);
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toMatch(/1[\s ]200,00 €/);
    expect(r.rejets[0].motif).toMatch(/1[\s ]500,00 €/);
  });

  it("refuse un règlement supérieur au dû, et une échéance antérieure à l'émission", () => {
    const r = preparer(FACTURES, [
      ["FA-5", "Serrurerie du Sud", "12/06/2026", "100", "20", "120", "", "500"],
      ["FA-6", "Serrurerie du Sud", "12/06/2026", "100", "20", "120", "01/01/2026", ""],
    ], corr, new Set(), CLIENTS);
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toMatch(/déjà réglé/);
    expect(r.rejets[1].motif).toMatch(/échéance précède/);
  });

  it("repère le numéro déjà repris, dans le fichier comme dans l'atelier", () => {
    const deja = new Set([cleDoublon(FACTURES, { numero: "FA-2026-0325" })]);
    const r = preparer(FACTURES, [
      ["FA-2026-0325", "Serrurerie du Sud", "12/06/2026", "100", "20", "120", "", ""],
      ["FA-2026-0400", "Serrurerie du Sud", "12/06/2026", "100", "20", "120", "", ""],
      ["FA-2026-0400", "Serrurerie du Sud", "12/06/2026", "100", "20", "120", "", ""],
    ], corr, new Set(deja), CLIENTS);
    expect(r.valides).toHaveLength(1);
    expect(r.rejets.map((x) => x.motif)).toEqual(["déjà présent dans votre atelier", "en double dans le fichier"]);
    // Le numéro de ligne est celui du tableur de l'atelier, en-tête comprise.
    expect(r.rejets[0].numero).toBe(2);
    expect(r.sources).toEqual([3]);
  });

  it("est réservé au responsable et le déclare, parce que ce qu'il crée est comptable", () => {
    expect(FACTURES.proprietaire).toBe(true);
    expect(FACTURES.avertissement).toMatch(/ÉMISES/);
  });
});

describe("modèle « Lots de poudre »", () => {
  const entetes = ["Référence", "N° de lot", "Fournisseur", "Quantité", "Reste", "DLU", "Date de réception", "Prix au kg"];
  const corr = deviner(entetes, LOTS);
  const POUDRES: Referentiels = { poudres: new Map([["testpowder ral 7016", "pou-7016"], ["ral 7016", "pou-7016"]]) };

  it("rapproche la poudre et garde le reste, la DLU et la date d'origine", () => {
    const r = preparer(LOTS, [["RAL 7016", "L-2026-001", "Valresa", "200", "120", "31/03/2027", "10/02/2026", "15,90"]], corr, new Set(), POUDRES);
    expect(r.rejets).toEqual([]);
    expect(r.valides[0]).toMatchObject({
      poudre_id: "pou-7016", numero: "L-2026-001", quantite_kg: 200, restant_kg: 120,
      dlu: "2027-03-31", recu_le: "2026-02-10", prix_kg: 15.9,
    });
  });

  it("suppose le lot plein quand la colonne « reste » manque", () => {
    const sansReste = deviner(["Référence", "N° de lot", "Quantité"], LOTS);
    const r = preparer(LOTS, [["RAL 7016", "L-2", "50"]], sansReste, new Set(), POUDRES);
    expect(r.valides[0].restant_kg).toBe(50);
  });

  it("refuse un reste supérieur à la quantité reçue", () => {
    const r = preparer(LOTS, [["RAL 7016", "L-3", "", "10", "40", "", "", ""]], corr, new Set(), POUDRES);
    expect(r.rejets[0].motif).toMatch(/dépasse la quantité reçue/);
  });

  it("refuse une poudre inconnue plutôt que d'en créer une sans cycle de cuisson", () => {
    const r = preparer(LOTS, [["RAL 9999", "L-4", "", "10", "", "", "", ""]], corr, new Set(), POUDRES);
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toMatch(/importez d'abord vos poudres/i);
    expect(LOTS.avertissement).toMatch(/AVANT vos lots/);
  });
});

describe("modèle « Tarifs négociés »", () => {
  const corr = deviner(["Client", "Code prestation", "Prix négocié"], TARIFS);
  const REFS: Referentiels = {
    ...CLIENTS,
    prestations: new Map([["sab", "pres-sab"], ["sablage", "pres-sab"], ["mask", "pres-mask"]]),
  };

  it("rapproche le client par son nom et la prestation par son code", () => {
    const r = preparer(TARIFS, [["Menuiserie Martin", "SAB", "7,20"]], corr, new Set(), REFS);
    expect(r.rejets).toEqual([]);
    expect(r.valides[0]).toMatchObject({ client_id: "cli-martin", prestation_id: "pres-sab", prix_ht: 7.2 });
  });

  it("le doublon porte sur le COUPLE client + prestation, pas sur le client seul", () => {
    const r = preparer(TARIFS, [
      ["Menuiserie Martin", "SAB", "7,20"],
      ["Menuiserie Martin", "MASK", "4,00"],
      ["Menuiserie Martin", "Sablage", "6,00"],
    ], corr, new Set(), REFS);
    expect(r.valides).toHaveLength(2);
    expect(r.rejets[0].motif).toBe("en double dans le fichier");
    expect(r.rejets[0].numero).toBe(4);
  });

  it("reconnaît un couple déjà présent dans l'atelier, tel que PostgREST le rend", () => {
    const deja = new Set([cleDoublon(TARIFS, { client_id: "cli-martin", prestation_id: "pres-sab" })]);
    const r = preparer(TARIFS, [["Menuiserie Martin", "SAB", "7,20"]], corr, deja, REFS);
    expect(r.rejets[0].motif).toBe("déjà présent dans votre atelier");
  });

  it("nomme la ligne rejetée par son client : c'est ce que l'atelier cherche dans son fichier", () => {
    const r = preparer(TARIFS, [["Chaudronnerie Inconnue", "SAB", "7,20"]], corr, new Set(), REFS);
    expect(r.rejets[0].valeur).toBe("Chaudronnerie Inconnue");
  });
});

describe("modèle « Grille m² »", () => {
  const corr = deviner(["De (m²)", "À (m²)", "Prix au m²"], GRILLE);

  it("lit un barème complet, dernière tranche sans plafond comprise", () => {
    const r = preparer(GRILLE, [["0", "1", "90"], ["1", "5", "60"], ["5", "", "35"]], corr, new Set());
    expect(r.rejets).toEqual([]);
    expect(r.valides).toHaveLength(3);
    expect(r.valides[2]).toMatchObject({ surface_min: 5, prix_m2: 35 });
    expect(r.valides[2].surface_max).toBeUndefined();
  });

  it("refuse une borne haute sous la borne basse — le palier n'attraperait aucune surface", () => {
    const r = preparer(GRILLE, [["10", "5", "30"]], corr, new Set());
    expect(r.valides).toHaveLength(0);
    expect(r.rejets[0].motif).toMatch(/borne haute/);
  });

  it("reconnaît un palier déjà en base malgré le « 0.00 » que rend PostgREST", () => {
    const deja = new Set([cleDoublon(GRILLE, { surface_min: "0.00" })]);
    const r = preparer(GRILLE, [["0", "1", "90"]], corr, deja);
    expect(r.rejets[0].motif).toBe("déjà présent dans votre atelier");
  });

  it("se range dans la grille par défaut de l'atelier, et le déclare", () => {
    expect(GRILLE.grilleDefaut).toBe(true);
    expect(GRILLE.table).toBe("grille_paliers");
  });
});

describe("les sept modèles restent cohérents entre eux", () => {
  it("chaque champ de rapprochement existe, et sa cible n'est pas un champ du fichier", () => {
    for (const m of MODELES) {
      for (const r of m.rapprochements ?? []) {
        expect(m.champs.some((c) => c.cle === r.champ), `${m.cle} : champ ${r.champ} absent`).toBe(true);
        expect(m.champs.some((c) => c.cle === r.cible), `${m.cle} : la cible ${r.cible} ne doit pas être une colonne du fichier`).toBe(false);
      }
    }
  });

  it("le champ témoin du rapport de rejet est toujours une colonne du fichier", () => {
    for (const m of MODELES) {
      expect(m.champs.some((c) => c.cle === m.temoin), `${m.cle} : témoin ${m.temoin} inconnu`).toBe(true);
    }
  });

  it("la clé de doublon ne porte que sur des colonnes du fichier ou des cibles de rapprochement", () => {
    for (const m of MODELES) {
      const connus = new Set([
        ...m.champs.map((c) => c.cle),
        ...(m.rapprochements ?? []).map((r) => r.cible),
      ]);
      for (const c of m.cleUnicite) {
        expect(connus.has(c), `${m.cle} : la clé d'unicité ${c} ne sera jamais renseignée`).toBe(true);
      }
    }
  });

  it("l'onglet de réglages annoncé par un modèle existe réellement sur /reglages", () => {
    // Recette navigateur, vague 1, défaut n°2 : le bandeau « Réglages → » de /import pointait sur
    // /reglages nu quel que soit le modèle choisi, et atterrissait toujours sur l'onglet Atelier.
    // `ONGLETS` de reglages/page.tsx, recopiée à la main : si elle divergeait, ce test tomberait
    // plutôt que de laisser un lien mener sur un onglet qui n'existe pas.
    const ONGLETS_CONNUS = new Set([
      "atelier", "numerotation", "alertes", "grille", "ml", "jantes", "pieces", "prestations", "equipe", "workflow", "compte",
    ]);
    for (const m of MODELES) {
      if (m.ongletReglages) {
        expect(ONGLETS_CONNUS.has(m.ongletReglages), `${m.cle} : onglet ${m.ongletReglages} inconnu de /reglages`).toBe(true);
      }
    }
    // Les trois modèles explicitement visés par le correctif suivent leur onglet naturel.
    expect(GRILLE.ongletReglages).toBe("grille");
    expect(modele("prestations").ongletReglages).toBe("prestations");
    expect(FACTURES.ongletReglages).toBe("numerotation");
  });

  it("chaque paramètre de RPC part d'une valeur que le modèle sait produire", () => {
    for (const m of MODELES) {
      if (!m.rpc) continue;
      const connus = new Set([
        ...m.champs.map((c) => c.cle),
        ...(m.rapprochements ?? []).map((r) => r.cible),
      ]);
      // Une ligne fictive où chaque clé connue porte son propre nom : ce qui ressort de
      // `parametres()` doit venir de là, et non d'un champ inventé.
      const fictive = Object.fromEntries([...connus].map((k) => [k, k]));
      const params = m.rpc.parametres(fictive);
      for (const [nom, valeur] of Object.entries(params)) {
        if (valeur === null || valeur === 0) continue;
        expect(connus.has(String(valeur)), `${m.cle} : ${nom} lit « ${valeur} », qui n'existe pas`).toBe(true);
      }
    }
  });
});
