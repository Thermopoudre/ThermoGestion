import { describe, expect, it } from "vitest";
import { xmlFacturX, totauxFacturX, type DonneesFacturX, type LigneFacturX } from "@/lib/facturx/xml";
import { calcTotaux, remiseAffichee } from "@/lib/utils";

/**
 * Règles de gestion EN 16931, épinglées sur douze factures représentatives.
 *
 * POURQUOI CE FICHIER EXISTE. Le XML produit a été passé le 20/08/2026 dans le **XSD et le
 * schematron officiels Factur-X 1.09 EN16931** (paquet `factur-x` d'Akretion, transformation
 * Saxon car le schematron est en XSLT 2.0). Cette validation a trouvé ce qu'aucun test de
 * structure n'avait vu : sur une facture à deux taux de TVA avec remise de pied, la remise était
 * déclarée en un seul bloc au taux le plus élevé — **deux erreurs BR-S-08**, c'est-à-dire une
 * facture rejetée par la plateforme du client. Le cas n'a rien d'exotique : un laqueur qui revend
 * de la poudre, ou qui applique 10 % sur des travaux en logement ancien, y tombe au premier devis.
 *
 * POURQUOI IL A ÉTÉ RÉÉCRIT LE 21/08/2026. La première version « rejouait les règles » : elle
 * écrivait `expect(v.taxe).toBe(round2(v.base * v.taux / 100))` face à un code qui calcule
 * `taxe = round2(base * taux / 100)`, et `expect(t.totalTtc).toBe(round2(t.baseImposable +
 * t.totalTva))` face à `totalTtc = round2(baseImposable + totalTva)`. Ce sont des identités
 * algébriques : elles sont vraies quelles que soient les valeurs, y compris fausses. Soixante-douze
 * assertions vertes qui n'auraient pas bougé si toute la ventilation avait été inversée. Pire :
 * elles donnaient l'apparence d'une couverture de la norme sur ce qui est de la **conformité
 * réglementaire**, alors même que le profil du XML venait d'être corrigé en urgence.
 *
 * MÉTHODE MAINTENANT. Chaque facture porte ses montants attendus, **calculés à la main** ligne à
 * ligne selon la norme, jamais par la formule du code. Un arrondi qui change, une répartition de
 * remise qui bascule, une ventilation qui perd un taux : le nombre écrit ici ne bouge pas, donc le
 * test tombe. Toute nouvelle forme de facture s'ajoute avec ses montants recalculés à la main.
 *
 * Ce n'est pas un substitut à la validation officielle — elle demande Java et un schematron
 * externe. C'est le filet qui empêche la régression entre deux passages chez le validateur.
 */

const V = {
  nom: "ThermoTest", siren: "900123456", siret: "90012345600018", tva_intra: "FR12900123456",
  adresse: "12 rue des Fours", code_postal: "83500", ville: "La Seyne-sur-Mer", pays: "FR",
};
const A = {
  nom: "Menuiserie Aluval", siren: "812345678", adresse: "4 avenue des Platanes",
  code_postal: "83000", ville: "Toulon", pays: "FR",
};

const L20: LigneFacturX = { libelle: "Thermolaquage garde-corps", qte: 3.5, unite: "m2", pu_ht: 28, total_ht: 98, tva: 20 };
const L20b: LigneFacturX = { libelle: "Sablage", qte: 2, unite: "piece", pu_ht: 8.025, total_ht: 16.05, tva: 20 };
const L55: LigneFacturX = { libelle: "Poudre revendue au client", qte: 5, unite: "kg", pu_ht: 12, total_ht: 60, tva: 5.5 };
const L10: LigneFacturX = { libelle: "Travaux en logement ancien", qte: 1, unite: "piece", pu_ht: 340, total_ht: 340, tva: 10 };
/** Déduction d'acompte : reconnue par son `meta`, jamais par son libellé, que l'atelier peut changer. */
const ACPT = { ...L20, libelle: "Acompte déjà facturé", pu_ht: -100, total_ht: -100, meta: { deduction_acompte: true } } as LigneFacturX;
const NEG: LigneFacturX = { libelle: "Geste commercial", qte: 1, unite: "piece", pu_ht: -30, total_ht: -30, tva: 20 };

type Remise = { type: "pct" | "montant"; valeur: number } | null;
const P12: Remise = { type: "pct", valeur: 12 };
const M25: Remise = { type: "montant", valeur: 25 };

function facture(lignes: LigneFacturX[], remise: Remise, opts: Partial<DonneesFacturX> = {}): DonneesFacturX {
  const items = lignes.map((l) => ({ ...l, quantite: l.qte, prix_unitaire: l.pu_ht, tva_pct: l.tva }));
  const t = calcTotaux(items as never, remise as never);
  return {
    facture: {
      numero: "FA-2026-0004", type: "solde", date: "2026-08-18T09:12:00.000Z", lignes, remise,
      total_ht: t.total_ht, total_tva: t.total_tva, total_ttc: t.total_ttc,
      echeance: "2026-09-17", conditions_paiement: "Paiement à 30 jours.",
      reference_commande: "DV-2026-0007", nature_operation: "mixte",
    },
    vendeur: V, acheteur: A, livraison: null, assujetti_tva: true, tva_sur_debits: false,
    iban: "FR7630004000031234567890143",
    ...opts,
  } as unknown as DonneesFacturX;
}

/**
 * Les montants attendus d'une facture, tous posés à la main.
 *
 * `ventilation` liste les tranches **dans l'ordre où le XML doit les écrire** (taux décroissant),
 * chacune sous la forme `[catégorie, taux, base BT-116, taxe BT-117, remise du taux BT-92]`.
 */
type Attendu = {
  /** BT-106, somme des lignes hors déduction d'acompte. */
  totalLignes: number;
  /** BT-107, remise de pied de facture réellement imputée. */
  remiseTotale: number;
  /** BT-109, assiette. */
  baseImposable: number;
  /** BT-110, TVA totale. */
  totalTva: number;
  /** BT-112, total TTC de la facture entière. */
  totalTtc: number;
  /** BT-113, déjà réglé (acomptes). */
  dejaRegle: number;
  /** BT-115, net à payer — et il doit être identique au TTC imprimé sur le PDF. */
  resteAPayer: number;
  ventilation: Array<["S" | "E" | "Z", number, number, number, number]>;
};

/**
 * Les douze factures passées au validateur officiel, avec leurs montants recalculés à la main.
 *
 * DÉTAIL D'UN CALCUL, pour que les suivants soient vérifiables (cas « deux taux, remise en
 * pourcentage ») : les lignes remisables font 98 + 16,05 + 60 = 174,05 €, la remise de 12 % vaut
 * donc 20,886 → 20,89 €. Elle se répartit au prorata : la tranche à 20 % en supporte
 * 20,89 × 114,05 / 174,05 = 13,6886 €, celle à 5,5 % 20,89 × 60 / 174,05 = 7,2014 €. Les bases
 * arrondies valent 114,05 − 13,6886 = 100,36 € et 60 − 7,2014 = 52,80 €, les taxes 20,07 € et
 * 2,90 €. Assiette 153,16 €, TVA 22,97 €, TTC 176,13 €.
 */
const CAS: Array<[string, DonneesFacturX, Attendu]> = [
  [
    "un seul taux, sans remise",
    facture([L20, L20b], null),
    {
      totalLignes: 114.05, remiseTotale: 0, baseImposable: 114.05, totalTva: 22.81,
      totalTtc: 136.86, dejaRegle: 0, resteAPayer: 136.86,
      ventilation: [["S", 20, 114.05, 22.81, 0]],
    },
  ],
  [
    "un seul taux, remise en pourcentage",
    facture([L20, L20b], P12),
    {
      totalLignes: 114.05, remiseTotale: 13.69, baseImposable: 100.36, totalTva: 20.07,
      totalTtc: 120.43, dejaRegle: 0, resteAPayer: 120.43,
      ventilation: [["S", 20, 100.36, 20.07, 13.69]],
    },
  ],
  [
    "deux taux, remise en pourcentage",
    facture([L20, L20b, L55], P12),
    {
      totalLignes: 174.05, remiseTotale: 20.89, baseImposable: 153.16, totalTva: 22.97,
      totalTtc: 176.13, dejaRegle: 0, resteAPayer: 176.13,
      ventilation: [["S", 20, 100.36, 20.07, 13.69], ["S", 5.5, 52.8, 2.9, 7.2]],
    },
  ],
  [
    "trois taux, remise en pourcentage",
    facture([L20, L20b, L55, L10], P12),
    {
      // Remisable 514,05 € → remise 61,686 → 61,69 €, répartie 13,6869 / 40,8026 / 7,2005.
      totalLignes: 514.05, remiseTotale: 61.69, baseImposable: 452.36, totalTva: 52.89,
      totalTtc: 505.25, dejaRegle: 0, resteAPayer: 505.25,
      ventilation: [
        ["S", 20, 100.36, 20.07, 13.69],
        ["S", 10, 299.2, 29.92, 40.8],
        ["S", 5.5, 52.8, 2.9, 7.2],
      ],
    },
  ],
  [
    "trois taux, remise en montant",
    facture([L20, L20b, L55, L10], M25),
    {
      // Le cas qui fait diverger la remise nominale (25,00 €) de la remise réellement imputée :
      // les parts arrondies valent 5,55 + 16,54 + 2,92 = 25,01 €, et c'est ce chiffre-là que la
      // norme veut en BT-107 puisque BT-109 = BT-106 − BT-107 doit se refermer exactement.
      totalLignes: 514.05, remiseTotale: 25.01, baseImposable: 489.04, totalTva: 57.19,
      totalTtc: 546.23, dejaRegle: 0, resteAPayer: 546.23,
      ventilation: [
        ["S", 20, 108.5, 21.7, 5.55],
        ["S", 10, 323.46, 32.35, 16.54],
        ["S", 5.5, 57.08, 3.14, 2.92],
      ],
    },
  ],
  [
    "acompte déduit, sans remise",
    facture([L20, L20b, ACPT], null),
    {
      // La facture reste entière (114,05 € d'assiette), l'acompte de 100 € HT + 20 € de TVA
      // devient un « déjà réglé » de 120,00 €, et le net à payer retombe sur les 16,86 € du PDF.
      totalLignes: 114.05, remiseTotale: 0, baseImposable: 114.05, totalTva: 22.81,
      totalTtc: 136.86, dejaRegle: 120, resteAPayer: 16.86,
      ventilation: [["S", 20, 114.05, 22.81, 0]],
    },
  ],
  [
    "acompte déduit, avec remise",
    facture([L20, L20b, ACPT], P12),
    {
      totalLignes: 114.05, remiseTotale: 13.69, baseImposable: 100.36, totalTva: 20.07,
      totalTtc: 120.43, dejaRegle: 120, resteAPayer: 0.43,
      ventilation: [["S", 20, 100.36, 20.07, 13.69]],
    },
  ],
  [
    "acompte déduit, deux taux, remise",
    facture([L20, L55, ACPT], P12),
    {
      // Remisable 158,00 € (l'acompte est hors assiette de remise) → 18,96 €, réparti
      // 11,76 sur les 98 € à 20 % et 7,20 sur les 60 € à 5,5 %.
      totalLignes: 158, remiseTotale: 18.96, baseImposable: 139.04, totalTva: 20.15,
      totalTtc: 159.19, dejaRegle: 120, resteAPayer: 39.19,
      ventilation: [["S", 20, 86.24, 17.25, 11.76], ["S", 5.5, 52.8, 2.9, 7.2]],
    },
  ],
  // En franchise en base, l'atelier ne facture pas de TVA : ses lignes sont à 0 %. Les poser à
  // 20 % ferait diverger le document lisible et le XML, ce qui est justement l'anomalie qu'on
  // traque ailleurs dans ce fichier.
  [
    "franchise en base, avec remise",
    facture([{ ...L20, tva: 0 }, { ...L20b, tva: 0 }], P12, { assujetti_tva: false } as never),
    {
      totalLignes: 114.05, remiseTotale: 13.69, baseImposable: 100.36, totalTva: 0,
      totalTtc: 100.36, dejaRegle: 0, resteAPayer: 100.36,
      ventilation: [["E", 0, 100.36, 0, 13.69]],
    },
  ],
  [
    "TVA sur les débits",
    facture([L20, L55], P12, { tva_sur_debits: true } as never),
    {
      totalLignes: 158, remiseTotale: 18.96, baseImposable: 139.04, totalTva: 20.15,
      totalTtc: 159.19, dejaRegle: 0, resteAPayer: 159.19,
      ventilation: [["S", 20, 86.24, 17.25, 11.76], ["S", 5.5, 52.8, 2.9, 7.2]],
    },
  ],
  [
    "ligne négative ordinaire, avec remise",
    facture([L20, L55, NEG], P12),
    {
      // Le geste commercial de −30 € entre dans l'assiette de remise (contrairement à l'acompte) :
      // remisable 128,00 € → 15,36 €, réparti 8,16 sur les 68 € à 20 % et 7,20 sur les 60 € à 5,5 %.
      totalLignes: 128, remiseTotale: 15.36, baseImposable: 112.64, totalTva: 14.87,
      totalTtc: 127.51, dejaRegle: 0, resteAPayer: 127.51,
      ventilation: [["S", 20, 59.84, 11.97, 8.16], ["S", 5.5, 52.8, 2.9, 7.2]],
    },
  ],
  [
    "ligne négative ordinaire, sans remise",
    facture([L20, L55, NEG], null),
    {
      totalLignes: 128, remiseTotale: 0, baseImposable: 128, totalTva: 16.9,
      totalTtc: 144.9, dejaRegle: 0, resteAPayer: 144.9,
      ventilation: [["S", 20, 68, 13.6, 0], ["S", 5.5, 60, 3.3, 0]],
    },
  ],
];

/** Contenu textuel de toutes les occurrences d'une balise, dans l'ordre du document. */
function balises(xml: string, nom: string): string[] {
  return [...xml.matchAll(new RegExp(`<${nom}(?:\\s[^>]*)?>([^<]*)</${nom}>`, "g"))].map((m) => m[1]);
}

/** Les blocs de remise de niveau document (BG-20), lus tels qu'ils partent chez le client. */
function remisesDocument(xml: string): Array<{ montant: string; categorie: string; taux: string }> {
  const blocs = [...xml.matchAll(/<ram:SpecifiedTradeAllowanceCharge>([\s\S]*?)<\/ram:SpecifiedTradeAllowanceCharge>/g)];
  return blocs.map((b) => ({
    montant: /<ram:ActualAmount>([^<]+)<\/ram:ActualAmount>/.exec(b[1])?.[1] ?? "",
    categorie: /<ram:CategoryCode>([^<]+)<\/ram:CategoryCode>/.exec(b[1])?.[1] ?? "",
    taux: /<ram:RateApplicablePercent>([^<]+)<\/ram:RateApplicablePercent>/.exec(b[1])?.[1] ?? "",
  }));
}

/** Le bloc de synthèse BG-22, isolé de la ventilation qui le précède. */
function synthese(xml: string): Record<string, string> {
  const bloc = xml.slice(xml.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>"));
  const out: Record<string, string> = {};
  for (const [, nom, valeur] of bloc.matchAll(/<ram:(\w+)(?:\s[^>]*)?>([\d.-]+)<\/ram:\1>/g)) out[nom] = valeur;
  return out;
}

describe.each(CAS)("règles EN 16931 — %s", (_nom, d, attendu) => {
  const t = totauxFacturX(d);
  const xml = xmlFacturX(d);
  const deuxDec = (n: number) => n.toFixed(2);

  it("BG-23 — la ventilation par taux porte les bases et les taxes attendues", () => {
    // Le tableau attendu est écrit en dur : une inversion de la répartition de remise, un taux
    // perdu, un arrondi qui bascule ne peuvent pas passer.
    expect(t.ventilation.map((v) => [v.categorie, v.taux, v.base, v.taxe, v.remise])).toEqual(attendu.ventilation);
  });

  it("BG-22 — les totaux du document sont ceux calculés à la main", () => {
    const { ventilation: _v, ...montants } = attendu;
    expect({
      totalLignes: t.totalLignes, remiseTotale: t.remiseTotale, baseImposable: t.baseImposable,
      totalTva: t.totalTva, totalTtc: t.totalTtc, dejaRegle: t.dejaRegle, resteAPayer: t.resteAPayer,
    }).toEqual(montants);
  });

  it("le XML transporte réellement ces montants — c'est lui qui part chez le client", () => {
    const s = synthese(xml);
    expect(s.LineTotalAmount).toBe(deuxDec(attendu.totalLignes));
    expect(s.TaxBasisTotalAmount).toBe(deuxDec(attendu.baseImposable));
    expect(s.TaxTotalAmount).toBe(deuxDec(attendu.totalTva));
    expect(s.GrandTotalAmount).toBe(deuxDec(attendu.totalTtc));
    expect(s.DuePayableAmount).toBe(deuxDec(attendu.resteAPayer));
    // BT-107 et BT-113 ne sont émis que s'ils valent quelque chose : les réclamer à zéro
    // produirait des balises que le schematron refuse.
    if (attendu.remiseTotale > 0) expect(s.AllowanceTotalAmount).toBe(deuxDec(attendu.remiseTotale));
    else expect(xml).not.toContain("AllowanceTotalAmount");
    if (attendu.dejaRegle > 0) expect(s.TotalPrepaidAmount).toBe(deuxDec(attendu.dejaRegle));
    else expect(xml).not.toContain("TotalPrepaidAmount");
  });

  it("BG-23 — le XML déclare une tranche de TVA par taux attendu, dans l'ordre attendu", () => {
    const bloc = xml.slice(
      xml.indexOf("<ram:ApplicableHeaderTradeSettlement>"),
      xml.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>"),
    );
    // On ne lit que les tranches de TVA, pas les blocs de remise qui les suivent.
    const tranches = [...bloc.matchAll(/<ram:ApplicableTradeTax>([\s\S]*?)<\/ram:ApplicableTradeTax>/g)].map((m) => ({
      taxe: /<ram:CalculatedAmount>([^<]+)</.exec(m[1])?.[1],
      base: /<ram:BasisAmount>([^<]+)</.exec(m[1])?.[1],
      categorie: /<ram:CategoryCode>([^<]+)</.exec(m[1])?.[1],
      taux: /<ram:RateApplicablePercent>([^<]+)</.exec(m[1])?.[1],
    }));
    expect(tranches).toEqual(
      attendu.ventilation.map(([categorie, taux, base, taxe]) => ({
        taxe: deuxDec(taxe), base: deuxDec(base), categorie, taux: deuxDec(taux),
      })),
    );
  });

  it("BR-S-08 et BR-CO-11 — un bloc de remise par taux remisé, au montant attendu", () => {
    // La régression qui a fait échouer le schematron officiel : une remise globale déclarée en un
    // seul bloc au taux le plus élevé. Elle passait BR-CO-11 (le total est bon) et échouait
    // BR-S-08 taux par taux. On épingle donc les blocs un par un, montant ET taux.
    const attendus = attendu.ventilation
      .filter(([, , , , remise]) => remise > 0)
      .map(([categorie, taux, , , remise]) => ({
        montant: deuxDec(remise), categorie, taux: deuxDec(taux),
      }));
    expect(remisesDocument(xml)).toEqual(attendus);
  });

  it("BR-16 — le XML écrit une ligne par prestation, l'acompte déduit n'en étant pas une", () => {
    const facturees = d.facture.lignes.filter((l) => !l.meta?.deduction_acompte);
    expect(balises(xml, "ram:LineID")).toEqual(facturees.map((_, i) => String(i + 1)));
    expect(xml).not.toContain("Acompte déjà facturé");
  });

  it("le montant réellement dû est celui du document lisible", () => {
    // Le PDF affiche `facture.total_ttc`, le XML `DuePayableAmount`. Un centime d'écart entre les
    // deux, c'est un litige de paiement et un rejet à la réception.
    expect(Number(d.facture.total_ttc)).toBe(attendu.resteAPayer);
    expect(t.resteAPayer).toBe(attendu.resteAPayer);
  });

  it("la remise imprimée sur le PDF est celle que le XML déclare en BT-107", () => {
    // Le bloc de totaux du document lisible doit s'additionner tout seul : sous-total − remise
    // (+ forfait − acomptes) = total HT. Afficher la remise nominale au lieu de la remise
    // réellement imputée donnait un bloc faux d'un centime sur le cas « trois taux, remise en
    // montant », et un XML qui annonçait un autre chiffre que le papier.
    expect(remiseAffichee(d.facture.lignes as never, d.facture.remise ?? null, d.facture.total_ht)).toBe(
      attendu.remiseTotale,
    );
  });
});
