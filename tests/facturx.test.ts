import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  codeExigibiliteTva,
  codeTypeDocument,
  codeUnite,
  dateCii,
  manquesFacturX,
  PROFIL_EN16931,
  PROFIL_MINIMUM,
  profilDeLXml,
  sirenDe,
  totauxFacturX,
  ventilationTva,
  xmlFacturX,
  type DonneesFacturX,
  type LigneFacturX,
} from "@/lib/facturx/xml";
import { emballerFacturX, xmpFacturX } from "@/lib/facturx/pdf";
import { calcTotaux, round2 } from "@/lib/utils";

/**
 * Facture électronique Factur-X, profil **EN 16931**.
 *
 * Le profil MINIMUM, produit jusqu'au 20/08/2026, n'est plus dans la liste des formats du socle
 * fixée par l'arrêté du 27 juillet 2026 (art. 1er, E, 1°, b : profils EN16931 et EXTENDED-CTC-FR,
 * en CII, en UBL et en Factur-X). Ces tests vérifient la *structure* du XML produit, pas seulement
 * qu'il est bien formé : un fichier bien formé mais amputé de sa ventilation de TVA est rejeté à
 * la réception exactement comme un fichier cassé.
 */

const LIGNES: LigneFacturX[] = [
  { libelle: "Thermolaquage garde-corps RAL 9005", qte: 3.5, unite: "m2", pu_ht: 28, total_ht: 98, tva: 20 },
  { libelle: "Sablage préparation surface", qte: 2, unite: "piece", pu_ht: 8.025, total_ht: 16.05, tva: 20 },
];

const DONNEES: DonneesFacturX = {
  facture: {
    numero: "FA-2026-0004",
    type: "solde",
    date: "2026-08-18T09:12:00.000Z",
    lignes: LIGNES,
    remise: null,
    total_ht: 114.05,
    total_tva: 22.81,
    total_ttc: 136.86,
    echeance: "2026-09-17",
    conditions_paiement: "Paiement à 30 jours à compter de la date d'émission.",
    reference_commande: "DV-2026-0007",
    nature_operation: "services",
  },
  vendeur: {
    nom: "ThermoTest",
    siren: "900123456",
    siret: "90012345600018",
    tva_intra: "FR12900123456",
    adresse: "12 rue des Fours",
    code_postal: "83500",
    ville: "La Seyne-sur-Mer",
    pays: "FR",
  },
  acheteur: {
    nom: "Menuiserie Aluval",
    siren: "812345678",
    adresse: "4 avenue des Platanes",
    code_postal: "83000",
    ville: "Toulon",
    pays: "FR",
  },
  livraison: null,
  assujetti_tva: true,
  tva_sur_debits: false,
  iban: "FR7630004000031234567890143",
};

/** Extrait le contenu textuel de toutes les occurrences d'une balise, dans l'ordre du document. */
function balises(xml: string, nom: string): string[] {
  return [...xml.matchAll(new RegExp(`<${nom}(?:\\s[^>]*)?>([^<]*)</${nom}>`, "g"))].map((m) => m[1]);
}

describe("XML CII — profil et identification", () => {
  it("déclare le profil EN 16931, et plus MINIMUM", () => {
    const xml = xmlFacturX(DONNEES);
    expect(profilDeLXml(xml)).toBe(PROFIL_EN16931);
    expect(profilDeLXml(xml)).toBe("urn:cen.eu:en16931:2017");
    expect(xml).not.toContain(PROFIL_MINIMUM);
  });

  it("reste un XML bien formé, sans balise ouverte ni caractère interdit", () => {
    const xml = xmlFacturX({ ...DONNEES, acheteur: { ...DONNEES.acheteur, nom: 'Ateliers "D&B" <SARL>' } });
    expect(xml).toContain("Ateliers &quot;D&amp;B&quot; &lt;SARL&gt;");
    // Aucun « & » ne doit subsister hors entité : c'est la première cause de XML illisible.
    expect(/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(xml)).toBe(false);
    // Balises `ram:` ouvertes (attributs compris, hors auto-fermantes) contre balises fermées.
    const ouvrantes = (xml.match(/<ram:[A-Za-z]+(?:\s[^>]*)?(?<!\/)>/g) ?? []).length;
    const fermantes = (xml.match(/<\/ram:[A-Za-z]+>/g) ?? []).length;
    expect(ouvrantes).toBeGreaterThan(0);
    expect(ouvrantes).toBe(fermantes);
  });

  it("respecte l'ordre du schéma : lignes, puis accord, puis livraison, puis règlement", () => {
    const xml = xmlFacturX(DONNEES);
    const ordre = [
      "<ram:IncludedSupplyChainTradeLineItem>",
      "<ram:ApplicableHeaderTradeAgreement>",
      "<ram:ApplicableHeaderTradeDelivery",
      "<ram:ApplicableHeaderTradeSettlement>",
    ].map((b) => xml.indexOf(b));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it("porte le SIREN du vendeur et celui de l'acheteur, mention obligatoire depuis le 01/09/2026", () => {
    const xml = xmlFacturX(DONNEES);
    const vendeur = xml.slice(xml.indexOf("<ram:SellerTradeParty>"), xml.indexOf("</ram:SellerTradeParty>"));
    const acheteur = xml.slice(xml.indexOf("<ram:BuyerTradeParty>"), xml.indexOf("</ram:BuyerTradeParty>"));
    expect(vendeur).toContain('<ram:ID schemeID="0002">900123456</ram:ID>');
    expect(acheteur).toContain('<ram:ID schemeID="0002">812345678</ram:ID>');
  });

  it("donne l'adresse complète des deux parties, exigée par BR-08 à BR-11", () => {
    const xml = xmlFacturX(DONNEES);
    expect(balises(xml, "ram:PostcodeCode")).toEqual(["83500", "83000"]);
    expect(balises(xml, "ram:CityName")).toEqual(["La Seyne-sur-Mer", "Toulon"]);
    expect(balises(xml, "ram:CountryID")).toEqual(["FR", "FR"]);
  });

  it("code le type de document selon UNTDID 1001 : un avoir n'est pas une facture négative", () => {
    expect(codeTypeDocument("solde")).toBe("380");
    expect(codeTypeDocument("libre")).toBe("380");
    expect(codeTypeDocument("acompte")).toBe("386");
    expect(codeTypeDocument("avoir")).toBe("381");
  });

  it("date l'émission sans aller-retour de fuseau", () => {
    // Une facture émise le 1er septembre ne doit jamais ressortir datée du 31 août.
    expect(dateCii("2026-09-01T00:30:00.000Z")).toBe("20260901");
    expect(dateCii("2026-09-01")).toBe("20260901");
  });

  it("déduit le SIREN d'un SIRET, et refuse un identifiant trop court", () => {
    expect(sirenDe({ siret: "90012345600018" })).toBe("900123456");
    expect(sirenDe({ siren: "900 123 456" })).toBe("900123456");
    expect(sirenDe({ siren: "9001" })).toBeNull();
  });
});

describe("XML CII — lignes de facture détaillées (BG-25)", () => {
  it("écrit une ligne par prestation, numérotée, avec quantité, unité, prix unitaire et TVA", () => {
    const xml = xmlFacturX(DONNEES);
    expect(balises(xml, "ram:LineID")).toEqual(["1", "2"]);
    expect(balises(xml, "ram:Name").slice(0, 2)).toEqual([
      "Thermolaquage garde-corps RAL 9005",
      "Sablage préparation surface",
    ]);
    expect(balises(xml, "ram:LineTotalAmount")).toEqual(["98.00", "16.05", "114.05"]);
    // BT-146 : prix unitaire, jusqu'à quatre décimales pour ne pas mentir sur le prix au m².
    expect(balises(xml, "ram:ChargeAmount")).toEqual(["28.00", "8.025"]);
    expect(xml).toContain('<ram:BilledQuantity unitCode="MTK">3.50</ram:BilledQuantity>');
    expect(xml).toContain('<ram:BilledQuantity unitCode="H87">2.00</ram:BilledQuantity>');
  });

  it("traduit nos unités en codes UN/ECE Rec 20, et retombe sur C62 quand l'unité est inconnue", () => {
    expect(codeUnite("m2")).toBe("MTK");
    expect(codeUnite("ml")).toBe("MTR");
    expect(codeUnite("piece")).toBe("H87");
    expect(codeUnite("jante")).toBe("H87");
    expect(codeUnite("kg")).toBe("KGM");
    expect(codeUnite("heure")).toBe("HUR");
    expect(codeUnite("forfait")).toBe("C62");
    expect(codeUnite(null)).toBe("C62");
  });

  it("code une ligne négative avec une quantité négative, jamais un prix négatif (BR-27)", () => {
    const xml = xmlFacturX({
      ...DONNEES,
      facture: {
        ...DONNEES.facture,
        lignes: [...LIGNES, { libelle: "Reprise", qte: 1, unite: "forfait", pu_ht: -10, total_ht: -10, tva: 20 }],
        total_ht: 104.05,
        total_tva: 20.81,
        total_ttc: 124.86,
      },
    });
    expect(xml).toContain("<ram:ChargeAmount>10.00</ram:ChargeAmount>");
    expect(xml).toContain('<ram:BilledQuantity unitCode="C62">-1.00</ram:BilledQuantity>');
    expect(xml).not.toContain("<ram:ChargeAmount>-");
  });

  it("refuse de produire une facture sans aucune ligne (BR-16)", () => {
    const manques = manquesFacturX({ ...DONNEES, facture: { ...DONNEES.facture, lignes: [] } });
    expect(manques.join(" ")).toContain("au moins une ligne");
  });
});

describe("XML CII — ventilation de TVA (BG-23) et totaux (BG-22)", () => {
  it("ventile par taux, avec base, montant et catégorie", () => {
    const xml = xmlFacturX(DONNEES);
    const bloc = xml.slice(xml.indexOf("<ram:ApplicableHeaderTradeSettlement>"));
    expect(balises(bloc, "ram:BasisAmount")).toEqual(["114.05"]);
    expect(balises(bloc, "ram:CalculatedAmount")).toEqual(["22.81"]);
    expect(balises(bloc, "ram:CategoryCode")).toEqual(["S"]);
    expect(balises(bloc, "ram:RateApplicablePercent")).toEqual(["20.00"]);
  });

  it("produit un groupe par taux sur une facture à deux taux, et rien de plus", () => {
    const lignes: LigneFacturX[] = [
      { libelle: "Laquage", qte: 1, unite: "forfait", pu_ht: 100, total_ht: 100, tva: 20 },
      { libelle: "Poudre revendue", qte: 1, unite: "kg", pu_ht: 50, total_ht: 50, tva: 5.5 },
    ];
    const d = { ...DONNEES, facture: { ...DONNEES.facture, lignes, nature_operation: "mixte" as const } };
    const v = ventilationTva(d);
    expect(v.map((x) => x.taux)).toEqual([20, 5.5]);
    expect(v.map((x) => x.base)).toEqual([100, 50]);
    expect(v.map((x) => x.taxe)).toEqual([20, 2.75]);
  });

  it("BR-S-09 : la TVA de chaque taux est celle qu'on calcule à la main", () => {
    // 33,33 € à 20 % font 6,666 € → 6,67 € ; 66,67 € à 5,5 % font 3,66685 € → 3,67 €. Les nombres
    // sont écrits ici, jamais recalculés par la formule du code : `expect(v.taxe).toBe(round2(
    // v.base * v.taux / 100))` face à un code qui écrit `taxe = round2(base * taux / 100)` est une
    // identité algébrique, vraie même si toute la ventilation était fausse.
    const lignes: LigneFacturX[] = [
      { libelle: "A", qte: 1, unite: "forfait", pu_ht: 33.33, total_ht: 33.33, tva: 20 },
      { libelle: "B", qte: 1, unite: "forfait", pu_ht: 66.67, total_ht: 66.67, tva: 5.5 },
    ];
    const v = ventilationTva({ ...DONNEES, facture: { ...DONNEES.facture, lignes } });
    expect(v.map((x) => [x.taux, x.base, x.taxe])).toEqual([
      [20, 33.33, 6.67],
      [5.5, 66.67, 3.67],
    ]);
  });

  it("BR-CO-10 et BR-CO-13 : le total des lignes, la remise et la base d'imposition s'accordent", () => {
    const d = { ...DONNEES, facture: { ...DONNEES.facture, remise: { type: "pct" as const, valeur: 10 } } };
    const t = totauxFacturX(d);
    // 10 % de 114,05 € font 11,405 € — un demi-centime pile. L'arrondi commercial le monte à
    // 11,41 €, et c'est ce chiffre-là qui doit se retrouver partout : base 102,64 €, TVA 20,53 €,
    // TTC 123,17 €. Le poser en dur fige aussi la règle d'arrondi du demi-centime, qui n'est écrite
    // nulle part ailleurs et qu'un changement de `round2` ferait basculer en silence.
    expect({
      totalLignes: t.totalLignes, remiseTotale: t.remiseTotale, baseImposable: t.baseImposable,
      totalTva: t.totalTva, totalTtc: t.totalTtc,
    }).toEqual({ totalLignes: 114.05, remiseTotale: 11.41, baseImposable: 102.64, totalTva: 20.53, totalTtc: 123.17 });
    // Et le XML dit la même chose que le calcul.
    const xml = xmlFacturX(d);
    expect(xml).toContain("<ram:AllowanceTotalAmount>11.41</ram:AllowanceTotalAmount>");
    expect(xml).toContain("<ram:TaxBasisTotalAmount>102.64</ram:TaxBasisTotalAmount>");
    expect(xml).toContain("<ram:GrandTotalAmount>123.17</ram:GrandTotalAmount>");
  });

  it("le montant dû du XML est celui du PDF, au centime, sur les deux cas qui divergeaient", () => {
    // Le PDF est la représentation lisible de la même facture : un centime d'écart entre les deux
    // est un litige de paiement, et un rejet à la réception.
    //
    // Les montants ci-dessous sont calculés à la main. Premier cas — remise de 5 % puis acompte de
    // 30 % sur des montants « sales » : lignes remisables 265,60 + 180 = 445,60 €, remise 22,28 €,
    // base 423,32 €, TVA 84,66 €, TTC de la facture entière 507,98 €. L'acompte de 133,68 € HT
    // porte 26,74 € de TVA, soit 160,42 € déjà réglés, et il reste 347,56 € — le chiffre du PDF.
    // C'est ce cas qui donnait 347,57 € d'un côté et 347,56 € de l'autre.
    //
    // Second cas — deux taux et une remise de 12 % : remisable 400,00 €, remise 48,00 € répartie
    // 39,9996 / 8,0004, bases 293,33 € et 58,67 €, taxes 58,67 € et 3,23 €. Assiette 352,00 €,
    // TVA 61,90 €, TTC 413,90 €, rien de déjà réglé.
    //
    // La matrice complète (douze factures × acompte × remise × nombre de taux) est épinglée dans
    // `facturx-regles-en16931.test.ts` ; on garde ici les deux cas historiques.
    const acompte = {
      libelle: "Acompte 30 %", qte: 1, unite: "forfait",
      pu_ht: -133.68, total_ht: -133.68, tva: 20, meta: { deduction_acompte: true },
    };
    const cas: Array<[string, LigneFacturX[], { type: "pct"; valeur: number }, Record<string, number>]> = [
      [
        "acompte de 30 % après remise de 5 %",
        [
          { libelle: "Portail", qte: 6.4, unite: "m2", pu_ht: 41.5, total_ht: 265.6, tva: 20 },
          { libelle: "Valve", qte: 4, unite: "piece", pu_ht: 45, total_ht: 180, tva: 20 },
          acompte,
        ],
        { type: "pct", valeur: 5 },
        { totalLignes: 445.6, remiseTotale: 22.28, baseImposable: 423.32, totalTva: 84.66, totalTtc: 507.98, dejaRegle: 160.42, resteAPayer: 347.56 },
      ],
      [
        "deux taux et une remise de 12 %",
        [
          { libelle: "Laquage", qte: 1, unite: "forfait", pu_ht: 333.33, total_ht: 333.33, tva: 20 },
          { libelle: "Poudre", qte: 1, unite: "kg", pu_ht: 66.67, total_ht: 66.67, tva: 5.5 },
        ],
        { type: "pct", valeur: 12 },
        { totalLignes: 400, remiseTotale: 48, baseImposable: 352, totalTva: 61.9, totalTtc: 413.9, dejaRegle: 0, resteAPayer: 413.9 },
      ],
    ];

    for (const [nom, lignes, remise, attendu] of cas) {
      const items = lignes.map((l) => ({ total_ht: l.total_ht, tva: l.tva, meta: l.meta ?? null }));
      const pdf = calcTotaux(items, remise);
      const t = totauxFacturX({ ...DONNEES, facture: { ...DONNEES.facture, lignes, remise, ...pdf } });
      expect(
        {
          totalLignes: t.totalLignes, remiseTotale: t.remiseTotale, baseImposable: t.baseImposable,
          totalTva: t.totalTva, totalTtc: t.totalTtc, dejaRegle: t.dejaRegle, resteAPayer: t.resteAPayer,
        },
        nom,
      ).toEqual(attendu);
      // Et le PDF, arrivé par une autre soustraction, annonce le même net à payer.
      expect(pdf.total_ttc, `${nom} : le PDF et le XML divergent`).toBe(attendu.resteAPayer);
    }
  });

  it("n'annonce pas de remise quand il n'y en a pas", () => {
    const xml = xmlFacturX(DONNEES);
    expect(xml).not.toContain("SpecifiedTradeAllowanceCharge");
    expect(xml).not.toContain("AllowanceTotalAmount");
  });

  it("franchise en base : catégorie E, taux zéro et motif d'exonération (BR-E-10)", () => {
    const xml = xmlFacturX({ ...DONNEES, assujetti_tva: false, vendeur: { ...DONNEES.vendeur, tva_intra: null } });
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(xml).toContain("<ram:ExemptionReason>TVA non applicable, article 293 B du CGI</ram:ExemptionReason>");
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
    expect(xml).not.toContain("<ram:CategoryCode>S</ram:CategoryCode>");
  });
});

describe("XML CII — acompte déjà facturé", () => {
  const lignes: LigneFacturX[] = [
    ...LIGNES,
    {
      libelle: "Acompte 30 % sur devis DV-2026-0007",
      qte: 1,
      unite: "forfait",
      pu_ht: -34.22,
      total_ht: -34.22,
      tva: 20,
      meta: { deduction_acompte: true, facture_numero: "FA-2026-0003" },
    },
  ];
  const totaux = calcTotaux(
    lignes.map((l) => ({ total_ht: l.total_ht, tva: l.tva, meta: l.meta ?? null })),
    null,
  );
  const avecAcompte: DonneesFacturX = {
    ...DONNEES,
    facture: { ...DONNEES.facture, lignes, ...totaux },
  };

  it("n'en fait pas une ligne de facture : c'est un montant déjà réglé (BT-113)", () => {
    const xml = xmlFacturX(avecAcompte);
    expect(balises(xml, "ram:LineID")).toEqual(["1", "2"]);
    expect(xml).not.toContain("Acompte 30 %");
    expect(xml).toContain("<ram:TotalPrepaidAmount>41.06</ram:TotalPrepaidAmount>");
  });

  it("déclare la facture entière puis le solde dû, et ce solde est celui du PDF", () => {
    const t = totauxFacturX(avecAcompte);
    // BT-109 porte toute l'assiette, pas l'assiette diminuée de l'acompte.
    expect(t.baseImposable).toBe(114.05);
    expect(t.totalTtc).toBe(136.86);
    expect(t.dejaRegle).toBe(41.06);
    // BR-CO-16 : BT-115 = BT-112 − BT-113. L'acompte de 34,22 € HT porte 6,84 € de TVA, soit
    // 41,06 € déjà réglés sur 136,86 €, et il reste 95,80 € à payer. Le nombre est écrit ici :
    // `expect(t.resteAPayer).toBe(round2(t.totalTtc - t.dejaRegle))` recopiait la ligne
    // d'implémentation et restait vraie quelles que soient les valeurs.
    expect(t.resteAPayer).toBe(95.8);
    // Et le PDF, qui arrive au même solde par une autre soustraction, annonce le même chiffre.
    expect(totaux.total_ttc, "le PDF et le XML annoncent deux soldes différents").toBe(95.8);
  });
});

describe("XML CII — mentions obligatoires du 01/09/2026", () => {
  it("porte la catégorie de l'opération en note de document", () => {
    for (const [nature, texte] of [
      ["services", "prestation de services"],
      ["biens", "livraison de biens"],
      ["mixte", "mixte"],
    ] as const) {
      const xml = xmlFacturX({ ...DONNEES, facture: { ...DONNEES.facture, nature_operation: nature } });
      expect(xml).toContain("<ram:SubjectCode>AAI</ram:SubjectCode>");
      expect(xml.toLowerCase()).toContain(texte);
    }
  });

  it("traduit l'option TVA sur les débits en date d'exigibilité (BT-8) et en note lisible", () => {
    // Sans option : services exigibles à l'encaissement (72), biens à la livraison (29).
    expect(codeExigibiliteTva("services", false)).toBe("72");
    expect(codeExigibiliteTva("biens", false)).toBe("29");
    expect(codeExigibiliteTva("mixte", false)).toBe("72");
    // Sur option : exigibilité à la facture (5), quelle que soit la nature.
    expect(codeExigibiliteTva("services", true)).toBe("5");
    expect(codeExigibiliteTva("biens", true)).toBe("5");

    const sans = xmlFacturX(DONNEES);
    expect(sans).toContain("<ram:DueDateTypeCode>72</ram:DueDateTypeCode>");
    expect(sans).not.toContain("d&apos;après les débits");
    expect(sans).not.toContain("d'après les débits");

    const avec = xmlFacturX({ ...DONNEES, tva_sur_debits: true });
    expect(avec).toContain("<ram:DueDateTypeCode>5</ram:DueDateTypeCode>");
    expect(avec).toContain("Option pour le paiement de la TVA d'après les débits.");
  });

  it("porte l'adresse de livraison quand elle diffère, et rien quand elle ne diffère pas", () => {
    const sans = xmlFacturX(DONNEES);
    expect(sans).toContain("<ram:ApplicableHeaderTradeDelivery />");
    expect(sans).not.toContain("ShipToTradeParty");

    const avec = xmlFacturX({
      ...DONNEES,
      livraison: { adresse: "ZA des Playes, lot 7", code_postal: "83500", ville: "La Seyne-sur-Mer", pays: "FR" },
    });
    const bloc = avec.slice(avec.indexOf("<ram:ShipToTradeParty>"), avec.indexOf("</ram:ShipToTradeParty>"));
    expect(bloc).toContain("<ram:LineOne>ZA des Playes, lot 7</ram:LineOne>");
    expect(bloc).toContain("<ram:CityName>La Seyne-sur-Mer</ram:CityName>");
    // Le nom du destinataire par défaut est celui de l'acheteur.
    expect(bloc).toContain("<ram:Name>Menuiserie Aluval</ram:Name>");
  });
});

describe("XML CII — paiement", () => {
  it("annonce l'échéance et les conditions de paiement (BT-9, BT-20)", () => {
    const xml = xmlFacturX(DONNEES);
    const bloc = xml.slice(xml.indexOf("<ram:SpecifiedTradePaymentTerms>"));
    expect(bloc).toContain("Paiement à 30 jours");
    expect(bloc).toContain('<udt:DateTimeString format="102">20260917</udt:DateTimeString>');
  });

  it("n'annonce un virement que s'il y a un IBAN à créditer (BR-50)", () => {
    expect(xmlFacturX(DONNEES)).toContain("<ram:IBANID>FR7630004000031234567890143</ram:IBANID>");
    const sans = xmlFacturX({ ...DONNEES, iban: null });
    expect(sans).not.toContain("SpecifiedTradeSettlementPaymentMeans");
  });

  it("omet proprement la référence de commande quand la facture n'a pas de devis", () => {
    const xml = xmlFacturX({ ...DONNEES, facture: { ...DONNEES.facture, reference_commande: null } });
    expect(xml).not.toContain("BuyerOrderReferencedDocument");
    expect(xml).toContain("</ram:SellerTradeParty>");
  });
});

describe("XML CII — contrôles préalables", () => {
  it("ne réclame rien quand la facture est complète", () => {
    expect(manquesFacturX(DONNEES)).toEqual([]);
  });

  it("réclame ce qu'EN16931 exige et que MINIMUM tolérait", () => {
    const sansAdresseClient = manquesFacturX({
      ...DONNEES,
      acheteur: { nom: "Menuiserie Aluval", siren: "812345678" },
    });
    expect(sansAdresseClient.join(" ")).toContain("adresse postale du client");

    const sansSirenClient = manquesFacturX({
      ...DONNEES,
      acheteur: { ...DONNEES.acheteur, siren: null, siret: null },
    });
    expect(sansSirenClient.join(" ")).toContain("SIREN ou le SIRET du client");
  });

  it("ne réclame pas de SIREN à un particulier : la réforme ne vise que le B2B", () => {
    const particulier = manquesFacturX({
      ...DONNEES,
      acheteur: { ...DONNEES.acheteur, siren: null, siret: null, professionnel: false },
    });
    expect(particulier).toEqual([]);
  });

  it("réclame l'identité de l'atelier quand elle est incomplète", () => {
    const sansAtelier = manquesFacturX({ ...DONNEES, vendeur: { nom: "ThermoTest" } });
    expect(sansAtelier.join(" ")).toContain("SIREN de l'atelier");
    expect(sansAtelier.join(" ")).toContain("adresse postale de l'atelier");
  });

  it("ne réclame pas de numéro de TVA à un atelier en franchise en base", () => {
    const franchise = manquesFacturX({
      ...DONNEES,
      assujetti_tva: false,
      vendeur: { ...DONNEES.vendeur, tva_intra: null },
    });
    expect(franchise).toEqual([]);
  });
});

describe("emballage PDF/A-3", () => {
  const XML = xmlFacturX(DONNEES);

  async function pdfDeTest() {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]).drawText("Facture FA-2026-0004");
    return doc.save();
  }

  it("embarque le XML sous le nom normalisé, en relation /Alternative", async () => {
    const emballe = await emballerFacturX(await pdfDeTest(), {
      xml: XML,
      titre: "Facture FA-2026-0004",
      auteur: "ThermoTest",
    });
    const texte = Buffer.from(emballe).toString("latin1");

    // Le nom de fichier est imposé par la spécification : un lecteur Factur-X ne cherche que celui-là.
    expect(texte).toContain("factur-x.xml");
    // /Alternative : le XML est une autre expression de la même facture, pas une annexe.
    expect(texte).toContain("/Alternative");
    expect(texte).toContain("/EmbeddedFiles");
    expect(texte).toContain("/AF");
    // Intention de sortie couleur, exigée par PDF/A.
    expect(texte).toContain("/OutputIntent");
    expect(texte).toContain("GTS_PDFA1");
    expect(texte.startsWith("%PDF-1.7")).toBe(true);
  });

  it("laisse le document ouvrable et retrouvable par un lecteur PDF ordinaire", async () => {
    const emballe = await emballerFacturX(await pdfDeTest(), {
      xml: XML,
      titre: "Facture FA-2026-0004",
      auteur: "ThermoTest",
    });
    // `updateMetadata: false` : à la lecture, pdf-lib réécrit sinon le producteur en mémoire et
    // on contrôlerait sa signature au lieu de la nôtre.
    const relu = await PDFDocument.load(emballe, { updateMetadata: false });
    expect(relu.getPageCount()).toBe(1);
    expect(relu.getTitle()).toBe("Facture FA-2026-0004");
    expect(relu.getProducer()).toBe("Thermogestion");
  });

  it("déclare PDF/A-3B et le profil EN 16931 — le même que le XML", () => {
    const xmp = xmpFacturX({
      titre: "Facture FA-2026-0004",
      auteur: "ThermoTest",
      profil: "EN 16931",
      date: new Date("2026-08-18T09:12:00Z"),
    });
    expect(xmp).toContain("<pdfaid:part>3</pdfaid:part>");
    expect(xmp).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
    expect(xmp).toContain("urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#");
    expect(xmp).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>");
    // Un validateur compare le profil annoncé dans le XMP à celui déclaré dans le XML : ils ne
    // doivent jamais diverger. C'est exactement ce qui aurait cassé si on avait monté le XML sans
    // toucher au XMP.
    expect(xmp).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>");
    expect(xmp).not.toContain("MINIMUM");
    expect(xmp).toContain("pdfaExtension:schemas");
  });
});
