/**
 * Facture électronique Factur-X / UBL / CII — LECTURE (amélioration n°1, 07/09/2026).
 *
 * `xml.ts` et `pdf.ts` (à côté) savent ÉCRIRE un Factur-X profil EN16931 — c'est ce que
 * Thermogestion émet. Ce fichier fait le chemin inverse : lire une facture reçue d'un fournisseur,
 * qui peut être n'importe quel logiciel du marché, dans n'importe quel profil.
 *
 * POURQUOI de simples expressions régulières et pas un analyseur XML complet. `package.json` ne
 * porte aucune bibliothèque XML (vérifié avant d'écrire ce fichier), et `xml.ts` lui-même construit
 * son XML par concaténation de chaînes plutôt qu'avec un DOM — la lecture reste cohérente avec ce
 * choix plutôt que d'introduire une dépendance et une façon de faire différentes pour l'opération
 * inverse. La différence de risque justifie la différence de rigueur : `xml.ts` engage la
 * conformité EN16931 d'un document qu'on ÉMET (vérifié XSD/schematron) ; ce fichier ne fait que
 * PRÉ-REMPLIR une fiche que l'atelier peut toujours corriger à la main (statut `a_traiter`). Une
 * extraction imparfaite n'est jamais qu'un champ vide à compléter, jamais une facture fausse
 * envoyée à un client ou à l'administration.
 *
 * Trois formats reconnus, dans cet ordre de fiabilité :
 *  - **Factur-X** : un PDF/A-3 avec un XML CII embarqué (le nôtre, et celui de la plupart des
 *    éditeurs français) — `extraireXmlDuPdf` va chercher ce XML dans la structure bas niveau du
 *    PDF, `lireCii` en tire les champs.
 *  - **CII ou UBL nus** : un fichier `.xml` déposé seul, sans PDF — le cas d'une Plateforme Agréée
 *    qui enverrait le structuré sans représentation imprimable, ou d'un fournisseur qui exporte
 *    son XML directement.
 *  - **Aucun des deux** : le PDF ne contient rien de structuré → `format_source = 'pdf_simple'`,
 *    et la fiche reste à saisir à la main. Ce sera le cas le plus fréquent au démarrage : la
 *    plupart des fournisseurs de l'atelier n'émettent pas encore de facture électronique malgré
 *    l'obligation, l'échéance PME/micro n'étant qu'au 01/09/2027.
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFStream,
  PDFRawStream,
  PDFString,
  PDFHexString,
  decodePDFRawStream,
} from "pdf-lib";
import { NOM_FICHIER_XML } from "@/lib/facturx/xml";

export type FormatXmlFacture = "cii" | "ubl";

export type DonneesLuesFacture = {
  numero: string | null;
  /** ISO `AAAA-MM-JJ`, ou `null` si absente ou illisible. */
  dateEmission: string | null;
  dateEcheance: string | null;
  devise: string | null;
  fournisseurNom: string | null;
  fournisseurSiren: string | null;
  fournisseurTva: string | null;
  totalHt: number | null;
  totalTva: number | null;
  totalTtc: number | null;
};

const VIDE: DonneesLuesFacture = {
  numero: null,
  dateEmission: null,
  dateEcheance: null,
  devise: null,
  fournisseurNom: null,
  fournisseurSiren: null,
  fournisseurTva: null,
  totalHt: null,
  totalTva: null,
  totalTtc: null,
};

// ── Aides regex, communes à CII et UBL ────────────────────────────────────────

/**
 * Contenu de la première balise `nomLocal` trouvée dans `source`, préfixe d'espace de noms ignoré
 * (un fournisseur peut écrire `<ram:ID>`, `<a:ID>`, ou `<ID>` sans préfixe — le nom EN16931/UBL
 * fait foi, pas la lettre choisie par l'éditeur pour son préfixe). `null` si absente ou vide.
 *
 * Le même appel sert à isoler un BLOC (pour y chercher ensuite une sous-balise) et à lire une
 * VALEUR terminale : c'est la portée du `source` passé qui fait la différence, jamais la fonction.
 */
function extraire(source: string | null, nomLocal: string): string | null {
  if (!source) return null;
  const re = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${nomLocal}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?${nomLocal}>`,
    "i",
  );
  const m = re.exec(source);
  if (!m) return null;
  const v = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return v || null;
}

function nombre(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** `AAAAMMJJ` (format CII 102) → `AAAA-MM-JJ`. */
function dateDepuisCii(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** UBL écrit déjà de l'ISO, parfois avec un fuseau accolé (`2026-09-01+02:00`) : on ne garde que la date. */
function dateDepuisUbl(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  return m ? m[1] : null;
}

// ── Détection du format ───────────────────────────────────────────────────────

/** Le premier élément réellement ouvert du document, déclaration XML et commentaires ignorés. */
function racineXml(xml: string): string | null {
  const m = /^[\s﻿]*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:[A-Za-z0-9_.-]+:)?([A-Za-z0-9_.-]+)/.exec(
    xml ?? "",
  );
  return m ? m[1] : null;
}

/**
 * `null` quand le document n'est ni un CII ni un UBL reconnu — un XML propriétaire, un fragment
 * incomplet, ou tout simplement pas du XML. C'est le signal qui fait retomber l'appelant sur
 * `pdf_simple` plutôt que de prétendre avoir compris ce qu'il n'a pas compris.
 */
export function formatXmlFacture(xml: string): FormatXmlFacture | null {
  const racine = racineXml(xml);
  if (racine === "CrossIndustryInvoice") return "cii";
  // Une facture d'avoir UBL porte la racine `CreditNote` — même famille de champs, on la lit pareil.
  if (racine === "Invoice" || racine === "CreditNote") return "ubl";
  return null;
}

// ── CII (Cross Industry Invoice — le format transporté par Factur-X) ─────────

/**
 * Lit un XML CII. Vocabulaire et structure repris de `xml.ts` (même norme, sens inverse) :
 * `ExchangedDocument` porte le numéro et la date, `SellerTradeParty` le fournisseur (nous sommes
 * l'acheteur d'une facture REÇUE — c'est le vendeur du document qui nous intéresse),
 * `SpecifiedTradeSettlementHeaderMonetarySummation` les totaux (BT-109/110/112, cf. `xml.ts`).
 */
export function lireCii(xml: string): DonneesLuesFacture {
  const entete = extraire(xml, "ExchangedDocument");
  const accord = extraire(xml, "ApplicableHeaderTradeAgreement");
  const vendeur = extraire(accord, "SellerTradeParty");
  const orgLegale = extraire(vendeur, "SpecifiedLegalOrganization");
  const enregistrementTva = extraire(vendeur, "SpecifiedTaxRegistration");
  const reglement = extraire(xml, "ApplicableHeaderTradeSettlement");
  const totaux = extraire(reglement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const conditions = extraire(reglement, "SpecifiedTradePaymentTerms");

  return {
    numero: extraire(entete, "ID"),
    dateEmission: dateDepuisCii(extraire(extraire(entete, "IssueDateTime"), "DateTimeString")),
    dateEcheance: dateDepuisCii(extraire(extraire(conditions, "DueDateDateTime"), "DateTimeString")),
    devise: extraire(reglement, "InvoiceCurrencyCode"),
    fournisseurNom: extraire(vendeur, "Name"),
    fournisseurSiren: extraire(orgLegale, "ID"),
    fournisseurTva: extraire(enregistrementTva, "ID"),
    totalHt: nombre(extraire(totaux, "TaxBasisTotalAmount")),
    totalTva: nombre(extraire(totaux, "TaxTotalAmount")),
    totalTtc: nombre(extraire(totaux, "GrandTotalAmount")),
  };
}

// ── UBL (Universal Business Language — l'autre format du socle depuis le 01/09/2026) ─────────

/**
 * Lit un XML UBL (`Invoice` ou `CreditNote`).
 *
 * `cbc:ID` seul est ambigu : il identifie aussi bien le document que chaque partie, chaque ligne
 * et chaque moyen de paiement. L'ordre du schéma UBL place l'en-tête (ID, IssueDate, DueDate,
 * DocumentCurrencyCode) avant le premier bloc `cac:` — couper le document à cette frontière isole
 * le numéro de facture sans ambiguïté. Si aucun `<cac:` n'est trouvé (document non conforme), on
 * retombe sur le document entier : dégradé, mais jamais une exception.
 */
export function lireUbl(xml: string): DonneesLuesFacture {
  const idxCac = xml.indexOf("<cac:");
  const entete = idxCac > 0 ? xml.slice(0, idxCac) : xml;

  const fournisseurBloc = extraire(xml, "AccountingSupplierParty");
  const partie = extraire(fournisseurBloc, "Party");
  const legale = extraire(partie, "PartyLegalEntity");
  const nomPartie = extraire(partie, "PartyName");
  const regimeTva = extraire(partie, "PartyTaxScheme");
  const total = extraire(xml, "LegalMonetaryTotal");
  // Le premier `TaxTotal` d'un document UBL valide est celui du document entier : les `TaxTotal`
  // par ligne (rares, et propres à certains profils) viennent après, à l'intérieur de chaque
  // `InvoiceLine` — qui n'apparaît qu'après `LegalMonetaryTotal` dans l'ordre du schéma.
  const taxeGlobale = extraire(xml, "TaxTotal");

  return {
    numero: extraire(entete, "ID"),
    dateEmission: dateDepuisUbl(extraire(entete, "IssueDate")),
    dateEcheance: dateDepuisUbl(extraire(entete, "DueDate")),
    devise: extraire(entete, "DocumentCurrencyCode"),
    fournisseurNom: extraire(legale, "RegistrationName") ?? extraire(nomPartie, "Name"),
    fournisseurSiren: extraire(legale, "CompanyID"),
    fournisseurTva: extraire(regimeTva, "CompanyID"),
    totalHt: nombre(extraire(total, "TaxExclusiveAmount")),
    totalTva: nombre(extraire(taxeGlobale, "TaxAmount")),
    totalTtc: nombre(extraire(total, "TaxInclusiveAmount")),
  };
}

/** Point d'entrée unique : détecte puis lit, sans jamais lever d'exception sur un champ manquant. */
export function lireFactureXml(xml: string, format: FormatXmlFacture): DonneesLuesFacture {
  try {
    return format === "cii" ? lireCii(xml) : lireUbl(xml);
  } catch {
    // Un XML malformé au point de faire échouer une regex ne doit pas faire échouer tout le dépôt :
    // la fiche reste créée, vide, à compléter à la main.
    return { ...VIDE };
  }
}

// ── Extraction du XML embarqué dans un PDF/A-3 (Factur-X, ZUGFeRD…) ──────────

export type PieceXmlPdf = { nom: string; xml: string };

/**
 * Cherche un XML embarqué dans un PDF et le retourne décodé en texte, ou `null` si le PDF n'en
 * contient pas (cas `pdf_simple`) ou s'il est illisible (chiffré, corrompu, exotique).
 *
 * pdf-lib n'expose pas de méthode « lire les pièces jointes » (seulement `attach()`, pour écrire) :
 * on descend donc jusqu'à la structure bas niveau du PDF — `/Root/Names/EmbeddedFiles/Names`, le
 * tableau alterné `[nom, spécification de fichier, nom, spécification de fichier, …]` du standard
 * PDF — exactement le chemin que `emballerFacturX()` (`pdf.ts`) construit à l'écriture, parcouru
 * en sens inverse. `decodePDFRawStream`, exportée par pdf-lib, décode le flux quel que soit son
 * filtre de compression (FlateDecode dans nos propres fichiers, via `context.flateStream`).
 *
 * Toute erreur — PDF chiffré, arborescence absente, flux corrompu — est avalée et rend `null` :
 * mieux vaut « pas de XML trouvé » (repli sur `pdf_simple`, toujours vrai) qu'une exception qui
 * ferait échouer tout le dépôt sur un fichier qui reste, lui, un PDF parfaitement valide à archiver.
 */
export async function extraireXmlDuPdf(pdf: Uint8Array): Promise<PieceXmlPdf | null> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    return null;
  }

  let noms: PDFArray | undefined;
  try {
    noms = doc.catalog
      .lookupMaybe(PDFName.of("Names"), PDFDict)
      ?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict)
      ?.lookupMaybe(PDFName.of("Names"), PDFArray);
  } catch {
    return null;
  }
  if (!noms) return null;

  const candidats: PieceXmlPdf[] = [];
  for (let i = 0; i + 1 < noms.size(); i += 2) {
    try {
      const nomFichier = noms.lookup(i, PDFString, PDFHexString).decodeText();
      if (!/\.xml$/i.test(nomFichier)) continue;
      const filespec = noms.lookup(i + 1, PDFDict);
      const ef = filespec.lookupMaybe(PDFName.of("EF"), PDFDict);
      const flux = ef?.lookupMaybe(PDFName.of("F"), PDFStream) ?? ef?.lookupMaybe(PDFName.of("UF"), PDFStream);
      if (!flux || !(flux instanceof PDFRawStream)) continue;
      const octets = decodePDFRawStream(flux).decode();
      candidats.push({ nom: nomFichier, xml: new TextDecoder("utf-8").decode(octets) });
    } catch {
      // Une pièce jointe illisible ne doit pas faire échouer la lecture des autres.
      continue;
    }
  }
  if (candidats.length === 0) return null;

  // Le nom imposé par la spécification Factur-X (voir `NOM_FICHIER_XML`) est prioritaire : c'est
  // celui que nos propres factures émises portent, et celui que la plupart des émetteurs
  // respectent. À défaut, la première pièce `.xml` trouvée (ZUGFeRD et d'autres conventions de
  // nommage existent).
  return candidats.find((c) => c.nom.toLowerCase() === NOM_FICHIER_XML.toLowerCase()) ?? candidats[0];
}
