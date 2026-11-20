/**
 * Facture électronique Factur-X — génération du XML CII (Cross Industry Invoice, UN/CEFACT).
 *
 * Profil **EN 16931** (`urn:cen.eu:en16931:2017`).
 *
 * POURQUOI ce profil et pas MINIMUM. L'arrêté du 27 juillet 2026 (NOR CPPE2610309A, JORF n°0174
 * du 28/07/2026) réécrit le 1° du I de l'article 41 septies C de l'annexe IV au CGI et fige la
 * liste des formats et profils du socle : profil EN16931 et profil EXTENDED-CTC-FR, en CII, en
 * UBL, et en format mixte « XML CII + PDF/A-3 » — c'est-à-dire Factur-X — « conforme au profil
 * EN16931 ou au profil EXTENDED-CTC-FR au travers de son profil EXTENDED ». Le profil MINIMUM,
 * que nous produisions jusqu'ici, n'y figure plus. Et il ne peut pas y être rattrapé par
 * conversion : MINIMUM ne transporte ni lignes ni ventilation de TVA, aucune plateforme ne peut
 * en reconstituer une facture EN16931. Il fallait donc monter le générateur, pas le convertir.
 *
 * Ce que le profil EN16931 exige en plus de MINIMUM, et que ce fichier produit :
 *   — les lignes de facture détaillées (BG-25) : quantité, unité, prix unitaire, TVA par ligne ;
 *   — la ventilation de TVA par taux (BG-23) avec base, montant et catégorie ;
 *   — l'adresse postale complète des deux parties (BR-08 à BR-11) ;
 *   — les conditions et l'échéance de paiement (BT-9, BT-20), le moyen de paiement (BG-16) ;
 *   — la cohérence arithmétique des totaux (BR-CO-10 à BR-CO-16).
 *
 * L'ordre des éléments n'est pas décoratif : le schéma CII est une séquence stricte, un élément
 * déplacé rend le fichier invalide. Toute modification doit être revalidée contre le XSD et le
 * schematron officiels Factur-X 1.0.9 profil EN16931.
 */

import { estDeductionAcompte, round2, ventilationParTaux } from "@/lib/utils";

/** URN du profil EN 16931, déclarée dans le XML *et* dans le XMP du PDF (fx:ConformanceLevel). */
export const PROFIL_EN16931 = "urn:cen.eu:en16931:2017";
/** Nom du profil tel qu'il doit apparaître dans les métadonnées XMP du PDF/A-3. */
export const NOM_PROFIL = "EN 16931";
/** Nom de fichier imposé par la spécification Factur-X pour la pièce jointe du PDF. */
export const NOM_FICHIER_XML = "factur-x.xml";

/**
 * Ancienne URN, conservée pour une seule raison : reconnaître un XML déjà émis au profil MINIMUM.
 * Une facture émise est figée, on ne la réécrit jamais — voir `profilDeLXml()` plus bas.
 */
export const PROFIL_MINIMUM = "urn:factur-x.eu:1p0:minimum";

export type PartieFacturX = {
  nom: string;
  siren?: string | null;
  siret?: string | null;
  tva_intra?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  pays?: string | null;
  /**
   * Faux pour un particulier. La réforme ne porte que sur les factures entre assujettis : un
   * particulier n'a pas de SIREN, et le lui réclamer bloquerait une facture parfaitement
   * régulière. Absent = professionnel, c'est le cas du vendeur et du gros des clients.
   */
  professionnel?: boolean;
};

/** Adresse de livraison, quand elle diffère de l'adresse de facturation (BG-13). */
export type LivraisonFacturX = {
  nom?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  pays?: string | null;
};

/** Une ligne de facture telle qu'elle est stockée dans `factures.items`. */
export type LigneFacturX = {
  libelle: string;
  qte: number;
  unite: string;
  pu_ht: number;
  total_ht: number;
  /** Taux de TVA en pourcentage (20 pour 20 %). */
  tva: number;
  meta?: Record<string, unknown> | null;
};

export type FactureFacturX = {
  numero: string;
  type: "acompte" | "solde" | "libre" | "avoir";
  date: string;
  /** Lignes brutes de la facture, déductions d'acompte comprises : elles sont triées ici. */
  lignes: LigneFacturX[];
  remise?: { type: "pct" | "montant"; valeur: number } | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  /** Échéance de paiement (BT-9). */
  echeance?: string | null;
  /** Conditions de paiement en clair (BT-20) : pénalités, escompte. */
  conditions_paiement?: string | null;
  /** Référence de commande de l'acheteur (BT-13) : ici le devis signé, quand la facture en vient. */
  reference_commande?: string | null;
  /**
   * Mention obligatoire depuis le 01/09/2026 : catégorie de l'opération. EN16931 n'a pas de champ
   * dédié (c'est une spécificité française portée par EXTENDED-CTC-FR), on la transporte donc en
   * note libre (BT-22) — lisible par un humain comme par une plateforme.
   */
  nature_operation: "biens" | "services" | "mixte";
};

export type DonneesFacturX = {
  facture: FactureFacturX;
  vendeur: PartieFacturX;
  acheteur: PartieFacturX;
  livraison?: LivraisonFacturX | null;
  /** Faux = franchise en base (art. 293 B du CGI) : catégorie de TVA « E » et motif obligatoire. */
  assujetti_tva: boolean;
  /** Option pour le paiement de la TVA d'après les débits : change l'exigibilité (BT-8). */
  tva_sur_debits: boolean;
  /** IBAN de l'atelier : sans lui, on n'émet pas de bloc « moyen de paiement » (BR-50). */
  iban?: string | null;
};

/**
 * BT-3, code de type de document (UNTDID 1001). L'avoir a son propre code : une facture négative
 * n'est pas un avoir aux yeux de l'administration, et un acompte doit être identifié comme tel
 * pour que le solde ne fasse pas double emploi.
 */
export function codeTypeDocument(type: FactureFacturX["type"]): string {
  if (type === "avoir") return "381";
  if (type === "acompte") return "386";
  return "380";
}

/**
 * BT-8, code de date d'exigibilité de la TVA (UNTDID 2005). C'est ici que se loge la mention
 * « option pour le paiement de la TVA d'après les débits » : sur option, la TVA est exigible à la
 * facture (5) ; à défaut, elle l'est à l'encaissement pour les services (72) et à la livraison
 * pour les biens (29). Une facture mixte sans option suit le régime des services, et la note en
 * clair du document porte la nuance.
 */
export function codeExigibiliteTva(nature: FactureFacturX["nature_operation"], surDebits: boolean): string {
  if (surDebits) return "5";
  if (nature === "biens") return "29";
  return "72";
}

const NATURE_TEXTE: Record<FactureFacturX["nature_operation"], string> = {
  biens: "Catégorie de l'opération : livraison de biens.",
  services: "Catégorie de l'opération : prestation de services.",
  mixte: "Catégorie de l'opération : mixte (livraison de biens et prestation de services).",
};

/**
 * BT-130, code d'unité (UN/ECE Rec 20). Nos unités applicatives sont en français et abrégées ;
 * la norme veut un code international. Toute unité inconnue retombe sur C62 (« unité »), qui est
 * toujours acceptable et ne fait jamais échouer la facture.
 */
export function codeUnite(unite: string | null | undefined): string {
  switch ((unite ?? "").trim().toLowerCase()) {
    case "m2":
    case "m²":
      return "MTK";
    case "ml":
    case "m":
      return "MTR";
    case "piece":
    case "pieces":
    case "pièce":
    case "pièces":
    case "jante":
    case "jantes":
      return "H87";
    case "kg":
      return "KGM";
    case "heure":
    case "h":
      return "HUR";
    case "l":
    case "litre":
      return "LTR";
    default:
      return "C62";
  }
}

function esc(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format 102 du CII : AAAAMMJJ, sans séparateur ni fuseau. La date d'émission est prise telle
 * qu'elle est écrite : la reconvertir via un fuseau ferait sortir une facture du 1er septembre
 * datée du 31 août — un décalage d'exercice comptable pour un simple aller-retour UTC.
 */
export function dateCii(iso: string): string {
  const direct = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (direct) return `${direct[1]}${direct[2]}${direct[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Date de facture illisible");
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Deux décimales exactement : le schematron refuse davantage (BR-DEC-12 à BR-DEC-18). */
function montant(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return (Number.isFinite(v) ? v : 0).toFixed(2);
}

/**
 * Quantité (BT-129) et prix unitaire (BT-146) : jusqu'à quatre décimales, deux au minimum.
 * Les règles BR-DEC ne bornent que les montants ; arrondir une surface de 1,4375 m² à 1,44 ferait
 * mentir la ligne au regard du prix au m² imprimé juste à côté.
 */
function decimal4(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0.00";
  const arrondi = Math.round(v * 10_000) / 10_000;
  // Deux décimales au minimum, quatre au maximum : « 8.0250 » se réduit à « 8.025 », « 28.0000 »
  // à « 28.00 », jamais à « 28 » — un montant sans décimale se lit mal dans un fichier comptable.
  return arrondi.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, "$1");
}

/** Taux de TVA (BT-119) : deux décimales, comme l'attend le schematron (BR-DEC-19). */
function taux(n: number): string {
  return (Number(n) || 0).toFixed(2);
}

/** Code pays ISO 3166-1 alpha-2 ; « France » et les libellés en toutes lettres sont ramenés à FR. */
function codePays(pays: string | null | undefined): string {
  const p = (pays ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
  return "FR";
}

/** SIREN : 9 chiffres. On accepte un SIRET et on en retient le SIREN, qui est son préfixe. */
export function sirenDe(partie: { siren?: string | null; siret?: string | null }): string | null {
  const brut = (partie.siren ?? partie.siret ?? "").replace(/\D/g, "");
  return brut.length >= 9 ? brut.slice(0, 9) : null;
}

// ── Ventilation de TVA ────────────────────────────────────────────────────────

export type LigneVentilation = {
  /** Catégorie EN16931 (BT-118) : S = taux normal, E = exonéré, Z = taux zéro. */
  categorie: "S" | "E" | "Z";
  /** BT-119, taux en pourcentage. */
  taux: number;
  /** BT-116, base d'imposition du taux. */
  base: number;
  /** BT-117, TVA du taux. */
  taxe: number;
  /** BT-120, motif d'exonération — obligatoire pour la catégorie E (BR-E-10). */
  motif?: string;
  /**
   * Part de la remise de pied de facture imputée à ce taux (BT-92 du groupe BG-20 correspondant).
   *
   * BR-S-08 exige que la base de chaque taux soit égale à la somme des lignes de ce taux **moins
   * les remises de niveau document déclarées à ce même taux**. Une remise globale déclarée en un
   * seul bloc au taux le plus élevé satisfait le total mais casse cette égalité dès qu'il y a deux
   * taux — vérifié au schematron officiel Factur-X 1.09 : deux erreurs BR-S-08 sur une facture
   * 20 % + 5,5 % remisée, zéro sur la même facture sans remise. Le cas est courant chez un laqueur
   * qui revend de la poudre, ou qui applique 10 % sur des travaux en logement ancien.
   */
  remise: number;
};

const MOTIF_FRANCHISE = "TVA non applicable, article 293 B du CGI";

/** Les lignes réellement facturées : la déduction d'un acompte n'en est pas une (voir plus bas). */
function lignesFacturees(lignes: LigneFacturX[]): LigneFacturX[] {
  return (lignes ?? []).filter((l) => !estDeductionAcompte(l));
}

/**
 * Ventilation de la TVA par taux (BG-23).
 *
 * La remise de pied de facture est répartie au prorata de la base remisable de chaque taux —
 * exactement ce que fait `calcTotaux` pour arriver au total affiché sur le PDF. Sans cette
 * répartition, une facture à deux taux verrait sa remise imputée arbitrairement et la TVA du
 * document ne tomberait plus sur celle du XML : deux chiffres différents pour la même facture,
 * c'est un rejet certain à la réception.
 */
export function ventilationTva(d: DonneesFacturX): LigneVentilation[] {
  // La ventilation est celle de `calcTotaux` — littéralement la même fonction. C'est ce qui
  // garantit que le XML et le PDF portent les mêmes chiffres : ils ne sont plus calculés deux
  // fois, ils le sont une fois et lus deux fois.
  // La ventilation porte sur les lignes **réellement facturées**, acompte déduit exclu. La norme
  // veut une facture entière — toute la base, toute la TVA — puis un montant déjà réglé en BT-113.
  // En laissant la ligne d'acompte négative dans la ventilation, son montant se retrouvait dans
  // BT-107 : le XML annonçait « remise commerciale 100 € » là où le client avait versé un acompte.
  // Passable au schematron sur un seul taux, faux pour le lecteur, et rejeté (BR-CO-11 et BR-S-08)
  // dès qu'il y a deux taux.
  const tranches = ventilationParTaux(lignesFacturees(d.facture.lignes), d.facture.remise ?? null);

  // Brut par taux, avant remise de pied : c'est la seule façon de savoir combien de remise a été
  // imputée à chaque taux, puisque la répartition au prorata se fait à l'intérieur de
  // `ventilationParTaux`. On le recalcule sur les mêmes lignes, avec la même exclusion de la
  // déduction d'acompte, pour que la soustraction tombe juste.
  const brutParTaux = new Map<number, number>();
  for (const l of lignesFacturees(d.facture.lignes)) {
    const t = Number(l.tva) || 0;
    brutParTaux.set(t, round2((brutParTaux.get(t) ?? 0) + (Number(l.total_ht) || 0)));
  }
  const remiseDe = (taux: number, base: number) =>
    Math.max(0, round2((brutParTaux.get(taux) ?? base) - base));

  // Franchise en base : plus qu'une seule tranche, exonérée, motif obligatoire (BR-E-10).
  if (!d.assujetti_tva) {
    const base = round2(tranches.reduce((s, t) => s + t.base, 0));
    const brut = round2([...brutParTaux.values()].reduce((s, v) => s + v, 0));
    return [{ categorie: "E", taux: 0, base, taxe: 0, motif: MOTIF_FRANCHISE, remise: Math.max(0, round2(brut - base)) }];
  }

  return tranches.map((t) => ({
    categorie: t.taux > 0 ? ("S" as const) : ("Z" as const),
    taux: t.taux,
    base: t.base,
    taxe: t.taxe,
    remise: remiseDe(t.taux, t.base),
  }));
}

/**
 * Totaux du document (BG-22), reconstruits depuis les lignes et la ventilation.
 *
 * Le point délicat est l'acompte déjà facturé. Dans l'application, il est porté par une ligne
 * négative et vient donc en déduction du total HT. La norme, elle, veut une facture complète
 * (BT-109 = toute la base, BT-110 = toute la TVA) puis un montant déjà réglé (BT-113) et un solde
 * dû (BT-115). On rétablit cette lecture ici : le montant *dû* reste identique à celui du PDF,
 * seule la présentation de l'assiette change — et elle change dans le sens de la norme.
 */
export function totauxFacturX(d: DonneesFacturX) {
  const lignes = lignesFacturees(d.facture.lignes);
  const ventilation = ventilationTva(d);

  const totalLignes = round2(lignes.reduce((s, l) => s + (Number(l.total_ht) || 0), 0));
  const baseImposable = round2(ventilation.reduce((s, v) => s + v.base, 0));
  // BR-CO-13 : BT-109 = BT-106 − BT-107. La remise absorbe l'écart d'arrondi de la répartition,
  // ce qui garantit l'égalité exacte plutôt qu'« à un centime près ».
  const remiseTotale = round2(totalLignes - baseImposable);
  const totalTva = round2(ventilation.reduce((s, v) => s + v.taxe, 0));
  const totalTtc = round2(baseImposable + totalTva);

  // Acompte déjà facturé : lignes négatives, exprimées ici en positif et en TTC (BT-113).
  //
  // POURQUOI on le déduit du solde plutôt que de le recalculer. L'application arrive au solde par
  // une soustraction (total de la facture moins l'acompte), la norme par une autre (base, TVA,
  // puis montant déjà réglé). Chacune arrondit à son tour, et sur un acompte de 30 % les deux
  // chemins tombaient à un centime l'un de l'autre : le PDF annonçait 347,57 € dus, le XML
  // 347,56 €. Un écart d'un centime entre le document lisible et sa version machine, c'est un
  // litige de paiement et un rejet de plateforme. On ancre donc BT-113 sur ce qui reste réellement
  // dû — sa définition même, « montant déjà payé » —, et l'arithmétique de la norme se referme.
  const acomptes = (d.facture.lignes ?? []).filter(estDeductionAcompte);
  const dejaRegle = acomptes.length > 0 ? Math.max(0, round2(totalTtc - Number(d.facture.total_ttc || 0))) : 0;

  return {
    ventilation,
    /** BT-106 */ totalLignes,
    /** BT-107 */ remiseTotale,
    /** BT-109 */ baseImposable,
    /** BT-110 */ totalTva,
    /** BT-112 */ totalTtc,
    /** BT-113 */ dejaRegle,
    /** BT-115 */ resteAPayer: round2(totalTtc - dejaRegle),
  };
}

// ── Fabrication du XML ────────────────────────────────────────────────────────

function adresseXml(
  p: { adresse?: string | null; code_postal?: string | null; ville?: string | null; pays?: string | null },
  indent: string,
): string {
  // Ordre imposé par le schéma : code postal, lignes d'adresse, ville, pays.
  const lignes = [`${indent}<ram:PostalTradeAddress>`];
  if (p.code_postal) lignes.push(`${indent}  <ram:PostcodeCode>${esc(p.code_postal)}</ram:PostcodeCode>`);
  if (p.adresse) {
    // Une adresse saisie sur plusieurs lignes se répartit sur LineOne/LineTwo (BT-35, BT-36).
    const [une, ...reste] = String(p.adresse)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (une) lignes.push(`${indent}  <ram:LineOne>${esc(une)}</ram:LineOne>`);
    if (reste.length) lignes.push(`${indent}  <ram:LineTwo>${esc(reste.join(", "))}</ram:LineTwo>`);
  }
  if (p.ville) lignes.push(`${indent}  <ram:CityName>${esc(p.ville)}</ram:CityName>`);
  lignes.push(`${indent}  <ram:CountryID>${codePays(p.pays)}</ram:CountryID>`);
  lignes.push(`${indent}</ram:PostalTradeAddress>`);
  return lignes.join("\n");
}

function partieXml(balise: string, p: PartieFacturX, indent: string): string {
  const siren = sirenDe(p);
  const lignes = [`${indent}<ram:${balise}>`, `${indent}  <ram:Name>${esc(p.nom)}</ram:Name>`];
  // BT-30 / BT-47 : identifiant légal, schéma 0002 = répertoire SIRENE (France). Côté acheteur,
  // c'est le SIREN du client, mention obligatoire depuis le 01/09/2026.
  if (siren) {
    lignes.push(
      `${indent}  <ram:SpecifiedLegalOrganization>`,
      `${indent}    <ram:ID schemeID="0002">${esc(siren)}</ram:ID>`,
      `${indent}  </ram:SpecifiedLegalOrganization>`,
    );
  }
  // BR-08 à BR-11 : l'adresse et le code pays des deux parties sont obligatoires en EN16931.
  lignes.push(adresseXml(p, `${indent}  `));
  if (p.tva_intra) {
    lignes.push(
      `${indent}  <ram:SpecifiedTaxRegistration>`,
      `${indent}    <ram:ID schemeID="VA">${esc(p.tva_intra.replace(/\s/g, ""))}</ram:ID>`,
      `${indent}  </ram:SpecifiedTaxRegistration>`,
    );
  }
  lignes.push(`${indent}</ram:${balise}>`);
  return lignes.join("\n");
}

function ligneXml(l: LigneFacturX, numero: number, d: DonneesFacturX): string {
  const total = Number(l.total_ht) || 0;
  const qteBrute = Number(l.qte) || 0;
  // BR-27 : le prix unitaire ne peut pas être négatif. Une ligne en négatif (une reprise, un
  // rabais chiffré en ligne) se code donc avec une quantité négative et un prix positif.
  const negative = total < 0;
  const pu = Math.abs(Number(l.pu_ht) || 0);
  const qte = negative && qteBrute > 0 ? -qteBrute : qteBrute;
  const t = d.assujetti_tva ? Number(l.tva) || 0 : 0;
  const categorie = !d.assujetti_tva ? "E" : t > 0 ? "S" : "Z";

  return [
    "    <ram:IncludedSupplyChainTradeLineItem>",
    "      <ram:AssociatedDocumentLineDocument>",
    `        <ram:LineID>${numero}</ram:LineID>`,
    "      </ram:AssociatedDocumentLineDocument>",
    "      <ram:SpecifiedTradeProduct>",
    `        <ram:Name>${esc(l.libelle || "Prestation")}</ram:Name>`,
    "      </ram:SpecifiedTradeProduct>",
    "      <ram:SpecifiedLineTradeAgreement>",
    "        <ram:NetPriceProductTradePrice>",
    `          <ram:ChargeAmount>${decimal4(pu)}</ram:ChargeAmount>`,
    "        </ram:NetPriceProductTradePrice>",
    "      </ram:SpecifiedLineTradeAgreement>",
    "      <ram:SpecifiedLineTradeDelivery>",
    `        <ram:BilledQuantity unitCode="${codeUnite(l.unite)}">${decimal4(qte)}</ram:BilledQuantity>`,
    "      </ram:SpecifiedLineTradeDelivery>",
    "      <ram:SpecifiedLineTradeSettlement>",
    "        <ram:ApplicableTradeTax>",
    "          <ram:TypeCode>VAT</ram:TypeCode>",
    `          <ram:CategoryCode>${categorie}</ram:CategoryCode>`,
    `          <ram:RateApplicablePercent>${taux(t)}</ram:RateApplicablePercent>`,
    "        </ram:ApplicableTradeTax>",
    "        <ram:SpecifiedTradeSettlementLineMonetarySummation>",
    `          <ram:LineTotalAmount>${montant(total)}</ram:LineTotalAmount>`,
    "        </ram:SpecifiedTradeSettlementLineMonetarySummation>",
    "      </ram:SpecifiedLineTradeSettlement>",
    "    </ram:IncludedSupplyChainTradeLineItem>",
  ].join("\n");
}

/** Notes de document (BT-22) : ce que la norme n'a pas de champ pour porter, mais que la loi exige. */
function notesXml(d: DonneesFacturX): string[] {
  const notes: string[] = [NATURE_TEXTE[d.facture.nature_operation] ?? NATURE_TEXTE.services];
  if (d.tva_sur_debits) notes.push("Option pour le paiement de la TVA d'après les débits.");
  if (!d.assujetti_tva) notes.push(`${MOTIF_FRANCHISE}.`);
  return notes.map((n) =>
    [
      "    <ram:IncludedNote>",
      `      <ram:Content>${esc(n)}</ram:Content>`,
      "      <ram:SubjectCode>AAI</ram:SubjectCode>",
      "    </ram:IncludedNote>",
    ].join("\n"),
  );
}

export function xmlFacturX(d: DonneesFacturX): string {
  const f = d.facture;
  const t = totauxFacturX(d);
  const lignes = lignesFacturees(f.lignes);

  const blocs: string[] = [];
  blocs.push('<?xml version="1.0" encoding="UTF-8"?>');
  blocs.push(
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  );
  blocs.push("  <rsm:ExchangedDocumentContext>");
  blocs.push("    <ram:BusinessProcessSpecifiedDocumentContextParameter>");
  blocs.push("      <ram:ID>A1</ram:ID>");
  blocs.push("    </ram:BusinessProcessSpecifiedDocumentContextParameter>");
  blocs.push("    <ram:GuidelineSpecifiedDocumentContextParameter>");
  blocs.push(`      <ram:ID>${PROFIL_EN16931}</ram:ID>`);
  blocs.push("    </ram:GuidelineSpecifiedDocumentContextParameter>");
  blocs.push("  </rsm:ExchangedDocumentContext>");

  blocs.push("  <rsm:ExchangedDocument>");
  blocs.push(`    <ram:ID>${esc(f.numero)}</ram:ID>`);
  blocs.push(`    <ram:TypeCode>${codeTypeDocument(f.type)}</ram:TypeCode>`);
  blocs.push("    <ram:IssueDateTime>");
  blocs.push(`      <udt:DateTimeString format="102">${dateCii(f.date)}</udt:DateTimeString>`);
  blocs.push("    </ram:IssueDateTime>");
  blocs.push(...notesXml(d));
  blocs.push("  </rsm:ExchangedDocument>");

  blocs.push("  <rsm:SupplyChainTradeTransaction>");
  // Les lignes viennent avant les blocs d'en-tête : c'est l'ordre du schéma, pas un choix.
  lignes.forEach((l, i) => blocs.push(ligneXml(l, i + 1, d)));

  blocs.push("    <ram:ApplicableHeaderTradeAgreement>");
  blocs.push(partieXml("SellerTradeParty", d.vendeur, "      "));
  blocs.push(partieXml("BuyerTradeParty", d.acheteur, "      "));
  if (f.reference_commande) {
    blocs.push("      <ram:BuyerOrderReferencedDocument>");
    blocs.push(`        <ram:IssuerAssignedID>${esc(f.reference_commande)}</ram:IssuerAssignedID>`);
    blocs.push("      </ram:BuyerOrderReferencedDocument>");
  }
  blocs.push("    </ram:ApplicableHeaderTradeAgreement>");

  // Adresse de livraison différente de l'adresse de facturation : mention obligatoire depuis le
  // 01/09/2026, portée par BG-13 (ShipToTradeParty).
  const liv = d.livraison;
  if (liv && (liv.adresse || liv.ville || liv.code_postal)) {
    blocs.push("    <ram:ApplicableHeaderTradeDelivery>");
    blocs.push("      <ram:ShipToTradeParty>");
    blocs.push(`        <ram:Name>${esc(liv.nom || d.acheteur.nom)}</ram:Name>`);
    blocs.push(adresseXml(liv, "        "));
    blocs.push("      </ram:ShipToTradeParty>");
    blocs.push("    </ram:ApplicableHeaderTradeDelivery>");
  } else {
    blocs.push("    <ram:ApplicableHeaderTradeDelivery />");
  }

  blocs.push("    <ram:ApplicableHeaderTradeSettlement>");
  blocs.push("      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>");
  // BR-50 : pas de virement annoncé sans compte à créditer. Sans IBAN, on n'annonce rien.
  if (d.iban) {
    blocs.push("      <ram:SpecifiedTradeSettlementPaymentMeans>");
    blocs.push("        <ram:TypeCode>30</ram:TypeCode>");
    blocs.push("        <ram:PayeePartyCreditorFinancialAccount>");
    blocs.push(`          <ram:IBANID>${esc(d.iban.replace(/\s/g, ""))}</ram:IBANID>`);
    blocs.push("        </ram:PayeePartyCreditorFinancialAccount>");
    blocs.push("      </ram:SpecifiedTradeSettlementPaymentMeans>");
  }
  const exigibilite = codeExigibiliteTva(f.nature_operation, d.tva_sur_debits);
  for (const v of t.ventilation) {
    blocs.push("      <ram:ApplicableTradeTax>");
    blocs.push(`        <ram:CalculatedAmount>${montant(v.taxe)}</ram:CalculatedAmount>`);
    blocs.push("        <ram:TypeCode>VAT</ram:TypeCode>");
    if (v.motif) blocs.push(`        <ram:ExemptionReason>${esc(v.motif)}</ram:ExemptionReason>`);
    blocs.push(`        <ram:BasisAmount>${montant(v.base)}</ram:BasisAmount>`);
    blocs.push(`        <ram:CategoryCode>${v.categorie}</ram:CategoryCode>`);
    blocs.push(`        <ram:DueDateTypeCode>${exigibilite}</ram:DueDateTypeCode>`);
    blocs.push(`        <ram:RateApplicablePercent>${taux(v.taux)}</ram:RateApplicablePercent>`);
    blocs.push("      </ram:ApplicableTradeTax>");
  }
  // Une remise de pied de facture porte une catégorie et un taux de TVA (groupe BG-20), et
  // BR-S-08 vérifie taux par taux que la base déclarée vaut bien « lignes du taux − remises du
  // taux ». Un bloc unique au taux le plus élevé passait le total et échouait cette vérification
  // sur toute facture à deux taux : constaté au schematron officiel, deux erreurs BR-S-08. On émet
  // donc un bloc par taux effectivement remisé.
  for (const v of t.ventilation) {
    if (v.remise <= 0) continue;
    blocs.push("      <ram:SpecifiedTradeAllowanceCharge>");
    blocs.push("        <ram:ChargeIndicator>");
    blocs.push("          <udt:Indicator>false</udt:Indicator>");
    blocs.push("        </ram:ChargeIndicator>");
    blocs.push(`        <ram:ActualAmount>${montant(v.remise)}</ram:ActualAmount>`);
    blocs.push("        <ram:Reason>Remise commerciale</ram:Reason>");
    blocs.push("        <ram:CategoryTradeTax>");
    blocs.push("          <ram:TypeCode>VAT</ram:TypeCode>");
    blocs.push(`          <ram:CategoryCode>${v.categorie}</ram:CategoryCode>`);
    blocs.push(`          <ram:RateApplicablePercent>${taux(v.taux)}</ram:RateApplicablePercent>`);
    blocs.push("        </ram:CategoryTradeTax>");
    blocs.push("      </ram:SpecifiedTradeAllowanceCharge>");
  }
  // BR-CO-25 : dès qu'il reste quelque chose à payer, il faut une échéance ou des conditions.
  if (f.echeance || f.conditions_paiement) {
    blocs.push("      <ram:SpecifiedTradePaymentTerms>");
    if (f.conditions_paiement) blocs.push(`        <ram:Description>${esc(f.conditions_paiement)}</ram:Description>`);
    if (f.echeance) {
      blocs.push("        <ram:DueDateDateTime>");
      blocs.push(`          <udt:DateTimeString format="102">${dateCii(f.echeance)}</udt:DateTimeString>`);
      blocs.push("        </ram:DueDateDateTime>");
    }
    blocs.push("      </ram:SpecifiedTradePaymentTerms>");
  }
  blocs.push("      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
  blocs.push(`        <ram:LineTotalAmount>${montant(t.totalLignes)}</ram:LineTotalAmount>`);
  if (t.remiseTotale > 0) blocs.push(`        <ram:AllowanceTotalAmount>${montant(t.remiseTotale)}</ram:AllowanceTotalAmount>`);
  blocs.push(`        <ram:TaxBasisTotalAmount>${montant(t.baseImposable)}</ram:TaxBasisTotalAmount>`);
  blocs.push(`        <ram:TaxTotalAmount currencyID="EUR">${montant(t.totalTva)}</ram:TaxTotalAmount>`);
  blocs.push(`        <ram:GrandTotalAmount>${montant(t.totalTtc)}</ram:GrandTotalAmount>`);
  if (t.dejaRegle > 0) blocs.push(`        <ram:TotalPrepaidAmount>${montant(t.dejaRegle)}</ram:TotalPrepaidAmount>`);
  blocs.push(`        <ram:DuePayableAmount>${montant(t.resteAPayer)}</ram:DuePayableAmount>`);
  blocs.push("      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
  blocs.push("    </ram:ApplicableHeaderTradeSettlement>");
  blocs.push("  </rsm:SupplyChainTradeTransaction>");
  blocs.push("</rsm:CrossIndustryInvoice>");
  return `${blocs.join("\n")}\n`;
}

/**
 * Profil déclaré par un XML Factur-X déjà produit. Sert à distinguer, dans l'existant, une facture
 * émise au profil MINIMUM d'une facture au profil EN16931 — sans jamais réécrire la première.
 */
export function profilDeLXml(xml: string): string | null {
  const m = /<ram:GuidelineSpecifiedDocumentContextParameter>\s*<ram:ID>([^<]+)<\/ram:ID>/.exec(xml ?? "");
  return m ? m[1].trim() : null;
}

/**
 * Contrôles préalables : ce qui manque en base fait un XML invalide chez le destinataire, pas une
 * erreur ici. Autant le dire à l'atelier avant qu'il n'envoie la facture.
 *
 * La liste a grossi avec le passage à EN16931 : le profil MINIMUM se contentait des noms et des
 * totaux, EN16931 veut les adresses complètes et au moins une ligne détaillée.
 */
export function manquesFacturX(d: DonneesFacturX): string[] {
  const m: string[] = [];
  if (!d.facture.numero) m.push("le numéro de facture");

  if (!d.vendeur.nom) m.push("le nom de l'atelier");
  if (!sirenDe(d.vendeur)) m.push("le SIREN de l'atelier (Réglages → Atelier)");
  // BR-08 / BR-09 : sans adresse ni ville, la partie vendeuse n'est pas identifiable.
  if (!d.vendeur.adresse || !d.vendeur.ville) m.push("l'adresse postale de l'atelier (Réglages → Atelier)");
  if (d.assujetti_tva && !d.vendeur.tva_intra) {
    m.push("le numéro de TVA intracommunautaire de l'atelier (Réglages → Atelier)");
  }

  if (!d.acheteur.nom) m.push("le nom du client");
  // BR-10 / BR-11 : l'adresse de l'acheteur est obligatoire en EN16931, elle ne l'était pas en MINIMUM.
  if (!d.acheteur.adresse || !d.acheteur.ville) m.push("l'adresse postale du client (fiche client)");
  // Mention obligatoire depuis le 01/09/2026 : le SIREN du client. Elle ne vaut qu'entre
  // assujettis — un particulier n'a pas de SIREN et sa facture reste régulière sans.
  if (d.acheteur.professionnel !== false && !sirenDe(d.acheteur)) {
    m.push("le SIREN ou le SIRET du client (fiche client)");
  }

  // BR-16 : une facture EN16931 comporte au moins une ligne.
  if (lignesFacturees(d.facture.lignes).length === 0) m.push("au moins une ligne de facturation");

  return m;
}
