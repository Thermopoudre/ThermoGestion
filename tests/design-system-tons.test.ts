import { describe, expect, it } from "vitest";
import { CLASSES_TON, HEX_TON, contraste, type TonBadge } from "@/lib/tons";
import { STATUS_DEVIS, STATUS_FACTURE, STATUS_PROJET } from "@/lib/utils";
import { STATUS_BL, STATUS_FOURNEE } from "@/lib/types";
import { STATUTS_JANTE, STATUTS_JEU } from "@/lib/jantes";
import { STATUT_BL_CLIENT, STATUT_JEU_CLIENT } from "@/lib/portail";
import { STATUT_ETALONNAGE_TON, verdictTon, verdictLabel } from "@/lib/qualite";
import { NIVEAU_CHARGE_TON } from "@/lib/capacite";
import { STATUT_CERTIFICATION_TON } from "@/lib/certificat";

/**
 * Le design system, dans ce qu'il a de vérifiable sans navigateur.
 *
 * Deux choses sont testées ici, et ce sont les deux qui coûtent cher quand elles cassent :
 *
 * 1. **Le contraste.** Un badge illisible ne se voit pas en relecture de code, et celui qui a
 *    déclenché ce lot — « Restitué », « Livré et facturé » à 3,90:1 — s'affichait sur le portail
 *    du client du client. Le calcul WCAG est déterministe : il se teste.
 *
 * 2. **La complétude et la stabilité des tables de statut.** La règle du lot était « le même mot
 *    dans la même couleur sémantique ». Les libellés sont donc figés ici mot pour mot, et chaque
 *    statut doit porter un ton valide. Un statut ajouté sans ton, ou un libellé retouché par
 *    inadvertance à l'occasion d'un autre chantier, fait échouer ce fichier.
 *
 * Ce qui reste à vérifier au navigateur (React Testing Library n'est pas installé) :
 * l'apparence réelle du badge, le repli de `AstuceEcran`, et le piège de focus des modales.
 */

const TONS: TonBadge[] = ["neutral", "info", "success", "warning", "danger"];

describe("jetons de couleur — contraste WCAG", () => {
  it("les cinq tons passent AA (4,5:1) sur du texte courant", () => {
    for (const ton of TONS) {
      const { fond, texte } = HEX_TON[ton];
      const rapport = contraste(fond, texte);
      expect(rapport, `ton ${ton} : ${rapport.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("mesure les rapports attendus, au centième", () => {
    const attendus: Record<TonBadge, number> = {
      neutral: 9.37,
      info: 6.8,
      success: 6.49,
      warning: 6.37,
      danger: 6.8,
    };
    for (const ton of TONS) {
      expect(Number(contraste(HEX_TON[ton].fond, HEX_TON[ton].texte).toFixed(2))).toBeCloseTo(attendus[ton], 2);
    }
  });

  /**
   * Le garde-fou de la régression d'origine. `bg-gray-200 text-gray-500` — la paire qu'aucune
   * relecture n'avait vue — est à 3,90:1, sous les 4,5 exigés. Si quelqu'un la remet un jour
   * dans `CLASSES_TON`, ce test le dit avant le client.
   */
  it("la paire gris-200 / gris-500 qui portait « Restitué » échouait bien à AA", () => {
    expect(Number(contraste("#E5E7EB", "#6B7280").toFixed(2))).toBe(3.9);
    expect(Object.values(CLASSES_TON).join(" ")).not.toContain("text-gray-500");
  });

  it("chaque ton a bien une classe de fond et une classe de texte", () => {
    for (const ton of TONS) {
      expect(CLASSES_TON[ton]).toMatch(/^bg-\S+ text-\S+$/);
    }
  });

  it("la fonction de contraste est symétrique et bornée entre 1 et 21", () => {
    expect(contraste("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contraste("#147085", "#147085")).toBeCloseTo(1, 5);
  });
});

/** Les onze tables de statut du produit, avec leur nom pour que l'échec dise laquelle a cassé. */
const TABLES: [string, Record<string, { label: string; ton: TonBadge }>][] = [
  ["STATUS_DEVIS", STATUS_DEVIS],
  ["STATUS_PROJET", STATUS_PROJET],
  ["STATUS_FACTURE", STATUS_FACTURE],
  ["STATUS_BL", STATUS_BL],
  ["STATUS_FOURNEE", STATUS_FOURNEE],
  ["STATUTS_JANTE", STATUTS_JANTE],
  ["STATUTS_JEU", STATUTS_JEU],
  ["STATUT_JEU_CLIENT", STATUT_JEU_CLIENT],
  ["STATUT_BL_CLIENT", STATUT_BL_CLIENT],
];

describe("tables de statut — tons sémantiques", () => {
  it("chaque statut porte un ton valide, et plus aucune classe en dur", () => {
    for (const [nom, table] of TABLES) {
      for (const [code, valeur] of Object.entries(table)) {
        expect(TONS, `${nom}.${code}`).toContain(valeur.ton);
        expect(valeur, `${nom}.${code} porte encore une classe`).not.toHaveProperty("cls");
        expect(valeur.label.length, `${nom}.${code} sans libellé`).toBeGreaterThan(0);
      }
    }
  });

  it("les tables de tons simples couvrent tous leurs cas", () => {
    for (const [nom, table] of [
      ["STATUT_ETALONNAGE_TON", STATUT_ETALONNAGE_TON],
      ["NIVEAU_CHARGE_TON", NIVEAU_CHARGE_TON],
      ["STATUT_CERTIFICATION_TON", STATUT_CERTIFICATION_TON],
    ] as [string, Record<string, TonBadge>][]) {
      for (const [code, ton] of Object.entries(table)) {
        expect(TONS, `${nom}.${code}`).toContain(ton);
      }
    }
  });

  /**
   * Les libellés, mot pour mot. Ils sont lus par le client sur son portail et imprimés sur les
   * documents : une majuscule ou un accent qui bouge est une régression métier, pas un détail.
   */
  it("les libellés n'ont pas bougé", () => {
    expect(Object.fromEntries(Object.entries(STATUS_DEVIS).map(([k, v]) => [k, v.label]))).toEqual({
      brouillon: "Brouillon", envoye: "Envoyé", signe: "Signé", refuse: "Refusé",
      expire: "Expiré", remplace: "Remplacé",
    });
    expect(Object.fromEntries(Object.entries(STATUS_PROJET).map(([k, v]) => [k, v.label]))).toEqual({
      en_attente: "En attente", en_cours: "En cours", pret: "Prêt", livre: "Livré", annule: "Annulé",
    });
    expect(Object.fromEntries(Object.entries(STATUT_JEU_CLIENT).map(([k, v]) => [k, v.label]))).toEqual({
      recu: "Réceptionné", en_cours: "En atelier", pret: "Prêt à récupérer",
      livre: "Restitué", annule: "Annulé",
    });
    expect(Object.fromEntries(Object.entries(STATUT_BL_CLIENT).map(([k, v]) => [k, v.label]))).toEqual({
      emis: "Prêt à partir", livre: "Livré", facture: "Livré et facturé",
    });
  });

  /**
   * La sémantique, statut par statut, sur les cas où se tromper coûte quelque chose : un devis
   * signé qui s'afficherait en rouge, un rebut en vert.
   */
  it("conserve le sens de chaque statut", () => {
    expect(STATUS_DEVIS.signe.ton).toBe("success");
    expect(STATUS_DEVIS.refuse.ton).toBe("danger");
    expect(STATUS_DEVIS.expire.ton).toBe("warning");
    expect(STATUS_FACTURE.payee.ton).toBe("success");
    expect(STATUS_FACTURE.annulee.ton).toBe("danger");
    expect(STATUS_PROJET.pret.ton).toBe("success");
    expect(STATUS_BL.livre.ton).toBe("success");
    // Le four allumé reste un avertissement, pas une information.
    expect(STATUS_FOURNEE.en_cours.ton).toBe("warning");
    expect(STATUTS_JANTE.rebut.ton).toBe("danger");
    expect(STATUTS_JANTE.prete.ton).toBe("success");
    // Les trois statuts qui portaient le contraste fautif sont neutres — et lisibles.
    expect(STATUT_JEU_CLIENT.livre.ton).toBe("neutral");
    expect(STATUT_BL_CLIENT.facture.ton).toBe("neutral");
    expect(STATUS_PROJET.livre.ton).toBe("neutral");
  });

  it("le verdict qualité garde ses trois états", () => {
    expect(verdictTon(true)).toBe("success");
    expect(verdictTon(false)).toBe("danger");
    expect(verdictTon(null)).toBe("neutral");
    expect(verdictLabel(true)).toBe("Conforme");
    expect(verdictLabel(false)).toBe("Non conforme");
    expect(verdictLabel(null)).toBe("En cours");
  });
});
