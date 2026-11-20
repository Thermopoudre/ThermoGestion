import type { TonBadge } from "@/lib/tons";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// PostgREST renvoie les `numeric` en chaîne : sans coercition, `"10000".toLocaleString()` rend
// « 10000 » au lieu de « 10 000,00 € » — c'est ce qui affichait un capital social brut sur les
// factures publiques.
export function eur(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return (Number.isNaN(v) ? 0 : v).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function dateFr(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

/**
 * D13 — quatre formats d'heure différents pour la même chose : un `dateHeureFr()` défini deux fois
 * (`ReglagesRelances.tsx` en `dateStyle: "short"`, `relances/page.tsx` en `dateStyle: "long"` —
 * même nom, deux résultats), plus deux combinaisons `toLocaleDateString` + `toLocaleTimeString`
 * écrites à la main ailleurs (`PortailReglage.tsx`, l'enregistrement automatique de
 * `DevisEditor.tsx`). Celle-ci est désormais la seule : compacte, adaptée à une ligne d'historique
 * répétée (« 03/09/2026 14h32 »).
 *
 * Recette navigateur (vague 2) — un cinquième format avait survécu à cette unification :
 * `horodatageFr` (lib/journal.ts) recomposait la même chose à la main pour le fil d'historique
 * d'une fiche, avec `toLocaleTimeString(...).replace(":", " h ")` (« 14 h 12 », espaces comprises,
 * mises en capitales par le CSS `uppercase` d'`Historique.tsx` — d'où le « À 12 H 25 » relevé par
 * la recette) pendant que `/relances` affichait « 09:00 » via celle-ci. Composée à partir de
 * `dateFr` et `heureFr`, qui ne dépendent plus de `toLocaleTimeString` (voir plus bas), pour ne
 * plus jamais diverger.
 */
export function dateHeureFr(d: string | null | undefined) {
  if (!d) return "—";
  return `${dateFr(d)} ${heureFr(d)}`;
}

/**
 * Heure seule à la française : « 12h25 », sans espace ni deux-points.
 *
 * POURQUOI PAS `toLocaleTimeString`. `date.toLocaleTimeString("fr-FR", { timeStyle: "short" })`
 * rend un résultat qui dépend de la version d'ICU embarquée par le runtime : « 14:32 » sur
 * certaines, « 14 h 32 » sur d'autres — deux environnements de production pourraient afficher deux
 * formats différents pour le même horodatage sans qu'aucune ligne de code ne change. Ce calcul est
 * manuel et ne dépend que de `getHours()`/`getMinutes()` : il rend toujours exactement « 12h25 »,
 * la forme sans espace qui est l'usage français (par opposition à « 12 h 25 », qui est celui de
 * l'écriture réglementaire des durées). Utilisée aussi par `dateHeureFr` ci-dessus et par
 * `horodatageFr` (lib/journal.ts) : c'est désormais la seule façon d'écrire une heure sur les
 * écrans internes.
 */
export function heureFr(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}

/**
 * Ligne de complément « Forfait minimum » : elle n'est pas une prestation vendue mais le
 * relèvement du total au plancher de la grille. Elle se reconnaît à son `meta`, jamais à son
 * libellé, qu'un atelier pourrait retoucher.
 */
export function estForfaitMinimum(ligne: { meta?: Record<string, unknown> | null }) {
  return ligne?.meta?.forfait_minimum === true;
}

/**
 * Ligne de déduction d'un acompte déjà facturé, sur une facture de solde.
 *
 * Elle se reconnaît à son `meta`, comme le forfait minimum, et pour la même raison : le libellé
 * est lisible par l'atelier, donc modifiable, donc inutilisable comme critère.
 */
export function estDeductionAcompte(ligne: { meta?: Record<string, unknown> | null }) {
  return ligne?.meta?.deduction_acompte === true;
}

/**
 * Lignes tenues hors de l'assiette de remise.
 *
 * Deux cas, opposés mais de même nature : le forfait minimum est un plancher (le remiser
 * annulerait le plancher), l'acompte déduit est un règlement déjà encaissé (le remiser une seconde
 * fois retirerait deux fois la remise du même euro — la remise a déjà porté sur l'acompte).
 */
function horsAssietteRemise(ligne: { meta?: Record<string, unknown> | null }) {
  return estForfaitMinimum(ligne) || estDeductionAcompte(ligne);
}

/**
 * Totaux d'un devis ou d'une facture.
 *
 * La ligne de forfait minimum est tenue hors de l'assiette de remise : c'est un plancher, et un
 * plancher qu'on remise ensuite n'en est plus un — le total repasserait sous le minimum annoncé.
 * Elle est donc ajoutée après coup, avec sa propre TVA. Même traitement pour la déduction d'un
 * acompte, qui vient en fin de calcul : la remise a déjà porté sur l'acompte le jour où il a été
 * facturé, la lui réappliquer la compterait deux fois.
 */
/** Une tranche de la ventilation de TVA : un taux, son assiette et sa taxe. */
export type TrancheTva = { taux: number; base: number; taxe: number };

/**
 * Ventilation de la TVA par taux, remise de pied de facture répartie au prorata.
 *
 * POURQUOI par taux, et pas en une seule multiplication. C'est la méthode qu'attend une facture :
 * un document à deux taux doit montrer l'assiette et la taxe de chacun. C'est aussi une règle dure
 * de la facture électronique — EN 16931, BR-S-09 : la TVA d'un taux est *exactement* sa base
 * multipliée par ce taux, et BR-CO-14 : le total de TVA est *exactement* la somme des tranches.
 * Additionner toutes les lignes puis arrondir une seule fois à la fin donnait un centime d'écart
 * (400 € à 20 % et 5,5 % : 70,33 € au lieu de 70,34 €), assez pour faire rejeter la facture.
 *
 * Les lignes de déduction d'acompte sont hors ventilation : elles ne taxent rien, elles
 * constatent un règlement déjà facturé, TVA comprise, sur une facture antérieure.
 */
export function ventilationParTaux(
  items: { total_ht: number | string; tva: number; meta?: Record<string, unknown> | null }[],
  remise?: { type: "pct" | "montant"; valeur: number } | null,
): TrancheTva[] {
  const lignes = (items ?? []).filter((i) => !estDeductionAcompte(i));
  const remiseTotale = montantRemise(items ?? [], remise ?? null);
  const baseRemisable = sousTotalRemisable(items ?? []);

  const parTaux = new Map<number, { brut: number; remisable: number }>();
  for (const l of lignes) {
    const t = Number(l.tva) || 0;
    const cumul = parTaux.get(t) ?? { brut: 0, remisable: 0 };
    cumul.brut += Number(l.total_ht) || 0;
    // Le forfait minimum reste hors assiette de remise : le remiser annulerait le plancher.
    if (!estForfaitMinimum(l)) cumul.remisable += Number(l.total_ht) || 0;
    parTaux.set(t, cumul);
  }

  // Taux décroissant : la remise de pied de facture, qui ne peut porter qu'une seule catégorie
  // dans le XML, sera déclarée sur le premier de la liste — celui sur lequel elle pèse le plus.
  return [...parTaux.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([taux, cumul]) => {
      const part = baseRemisable > 0 ? cumul.remisable / baseRemisable : 0;
      const base = round2(cumul.brut - remiseTotale * part);
      return { taux, base, taxe: round2((base * taux) / 100) };
    });
}

export function calcTotaux(
  items: { total_ht: number; tva: number; meta?: Record<string, unknown> | null }[],
  remise?: { type: "pct" | "montant"; valeur: number } | null,
) {
  const ventilation = ventilationParTaux(items, remise);
  const acomptes = (items ?? []).filter(estDeductionAcompte);

  // La facture, puis ce qui en a déjà été réglé. Les lignes d'acompte sont négatives.
  const baseHt = ventilation.reduce((s, v) => s + v.base, 0);
  const baseTva = ventilation.reduce((s, v) => s + v.taxe, 0);
  const acompteHt = acomptes.reduce((s, i) => s + (Number(i.total_ht) || 0), 0);
  const acompteTva = round2(acomptes.reduce((s, i) => s + ((Number(i.total_ht) || 0) * (Number(i.tva) || 0)) / 100, 0));

  // Le TTC est la somme des deux montants *arrondis*, pas l'arrondi de la somme.
  //
  // POURQUOI. Avec une remise de 12 % sur 114,05 €, la somme brute donnait HT 100,36 €,
  // TVA 20,07 € et TTC 120,44 € : trois nombres justes séparément, mais qui ne s'additionnent pas
  // sur le document. Un client qui recalcule sa facture trouve 120,43 €. Et la norme EN 16931 en
  // fait une règle dure (BR-CO-15 : BT-112 = BT-109 + BT-110) : une facture électronique dont le
  // TTC n'est pas exactement HT + TVA est rejetée à la réception.
  const total_ht = round2(baseHt + acompteHt);
  const total_tva = round2(baseTva + acompteTva);
  return { total_ht, total_tva, total_ttc: round2(total_ht + total_tva) };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Sous-total HT sur lequel porte réellement la remise (le plancher de facturation en est exclu). */
export function sousTotalRemisable(items: { total_ht: number | string; meta?: Record<string, unknown> | null }[]) {
  return round2((items ?? []).filter((i) => !horsAssietteRemise(i)).reduce((s, i) => s + (Number(i.total_ht) || 0), 0));
}

/** Total des acomptes déduits sur une facture de solde, en positif (les lignes sont négatives). */
export function montantAcomptesDeduits(items: { total_ht: number | string; meta?: Record<string, unknown> | null }[]) {
  return round2(-(items ?? []).filter(estDeductionAcompte).reduce((s, i) => s + (Number(i.total_ht) || 0), 0));
}

/**
 * Complément de forfait minimum présent dans les lignes.
 *
 * Il doit apparaître **après** la remise dans le bloc des totaux, sinon l'addition ne tombe pas :
 * un devis affichait « sous-total 13,50 € − remise 1,62 € » puis « total HT 25,00 € », le plancher
 * de 13,12 € étant compté dans le total mais absent du raisonnement. Le client ne peut pas
 * recalculer son propre devis — c'est exactement ce qu'on reproche à une facture illisible.
 */
export function montantForfaitMinimum(items: { total_ht: number | string; meta?: Record<string, unknown> | null }[]) {
  return round2((items ?? []).filter(estForfaitMinimum).reduce((s, i) => s + (Number(i.total_ht) || 0), 0));
}

/**
 * Montant de la remise, déduit de la remise elle-même et non de l'écart entre le brut et le total :
 * depuis le forfait minimum, cet écart n'est plus la remise (le complément vient s'y ajouter).
 */
export function montantRemise(
  items: { total_ht: number | string; meta?: Record<string, unknown> | null }[],
  remise?: { type: "pct" | "montant"; valeur: number } | null,
) {
  if (!remise || !remise.valeur) return 0;
  const st = sousTotalRemisable(items);
  const brut = remise.type === "pct" ? (st * Number(remise.valeur)) / 100 : Number(remise.valeur);
  return round2(Math.min(brut, st));
}

/**
 * Remise telle qu'elle doit être **imprimée** dans un bloc de totaux.
 *
 * POURQUOI elle diffère de `montantRemise`. Une remise de pied de facture est répartie au prorata
 * entre les taux de TVA, et chaque part est arrondie au centime. La somme des parts arrondies ne
 * fait pas toujours la remise arrondie : sur 25 € de remise répartis entre 20 %, 10 % et 5,5 %, les
 * parts valent 5,55 + 16,54 + 2,92 = 25,01 €. Le total HT de la facture, lui, est la somme des
 * bases — il tient compte des 25,01 €. Afficher « remise 25,00 € » à côté d'un sous-total de
 * 514,05 € et d'un total HT de 489,04 € donne un bloc de totaux qui ne s'additionne pas : le client
 * qui refait l'addition trouve 489,05 €, et le XML Factur-X, lui, déclare bien 25,01 € en BT-107.
 *
 * On imprime donc la remise **réellement appliquée**, déduite du total HT qui fait foi, exactement
 * comme `totauxFacturX` déduit BT-107 de BT-106 − BT-109. Le document lisible et sa version machine
 * portent alors le même chiffre, et l'addition tombe juste.
 *
 * `totalHt` est le total HT enregistré du document (ou recalculé par `calcTotaux` pour un bon de
 * livraison, qui ne stocke pas ses totaux).
 */
export function remiseAffichee(
  items: { total_ht: number | string; meta?: Record<string, unknown> | null }[],
  remise: { type: "pct" | "montant"; valeur: number } | null | undefined,
  totalHt: number | string | null | undefined,
) {
  if (!remise || !remise.valeur) return 0;
  const ht = Number(totalHt);
  // Sans total HT exploitable (document en cours de saisie, valeur absente), on retombe sur la
  // remise nominale plutôt que d'afficher un nombre inventé.
  if (!Number.isFinite(ht)) return montantRemise(items, remise);
  const applique = round2(
    sousTotalRemisable(items) + montantForfaitMinimum(items) - montantAcomptesDeduits(items) - ht,
  );
  // Garde-fou : une remise affichée négative ou nulle n'a pas de sens dans un bloc de totaux.
  return applique > 0 ? applique : 0;
}

/**
 * Un document appelle-t-il un règlement ?
 *
 * Trois cas où la réponse est non : un **avoir** (c'est l'atelier qui doit), une facture
 * **annulée**, et une facture à **zéro euro** (une régularisation, un geste commercial soldé).
 * De cette réponse dépendent l'échéance annoncée, les pénalités de retard, l'IBAN imprimé, le
 * bouton de paiement en ligne et, dans le XML Factur-X, les conditions de paiement (BT-20).
 *
 * POURQUOI C'EST UNE FONCTION. La règle était réécrite à quatre endroits — la page publique, le
 * PDF, le XML Factur-X et les métadonnées de partage — et **trois d'entre eux oubliaient le cas
 * du zéro euro**. Une facture à 0 € masquait donc son bouton de paiement à l'écran mais imprimait
 * l'IBAN et l'échéance sur le PDF, et son XML annonçait des conditions de règlement. Le document
 * lisible et sa version machine se contredisaient sur la même facture.
 */
export function factureARegler(facture: {
  status?: string | null;
  type?: string | null;
  total_ttc?: number | string | null;
}): boolean {
  return facture.status !== "annulee" && facture.type !== "avoir" && Number(facture.total_ttc ?? 0) > 0;
}

/**
 * Nombre à la française : virgule décimale, espace insécable pour les milliers.
 *
 * Par défaut, les zéros inutiles sont retirés (25 kg s'écrit « 25 », pas « 25,00 ») — c'est ce
 * qu'on veut pour un nombre isolé. `minDecimales` force au contraire un nombre de décimales fixe :
 * il sert aux paires affichées côte à côte autour d'une barre (« 6,8 / 25,0 kg », un seuil de
 * stock, la jauge du four). Sans lui, un « 6,8 / 25 kg » laisse croire à deux unités différentes
 * là où il n'y en a qu'une — l'œil compare des décimales, pas des grandeurs.
 */
export function nombreFr(n: unknown, maxDecimales = 2, minDecimales?: number) {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return v.toLocaleString("fr-FR", {
    maximumFractionDigits: maxDecimales,
    minimumFractionDigits: minDecimales ?? 0,
  });
}

const UNITES: Record<string, string> = {
  m2: "m²",
  ml: "ml",
  piece: "pièce",
  pieces: "pièces",
  jante: "jante",
  kg: "kg",
  heure: "h",
  forfait: "forfait",
};

/** Unités dont le pluriel change la lecture d'un document. « 4 jantes », pas « 4 jante ». */
const PLURIELS: Record<string, string> = { piece: "pièces", jante: "jantes" };

/** Libellé d'unité lisible : `m2` en base, « m² » à l'écran. */
export function uniteFr(unite: string | null | undefined, qte?: number) {
  if (!unite) return "";
  if (PLURIELS[unite] && (qte ?? 1) > 1) return PLURIELS[unite];
  return UNITES[unite] ?? unite;
}

/** Quantité + unité en français : « 4,2 m² » et non « 4.2 m2 ». Le forfait n'a pas de quantité. */
export function qteFr(qte: unknown, unite: string | null | undefined) {
  if (unite === "forfait") return "—";
  return `${nombreFr(qte, 3)} ${uniteFr(unite, Number(qte))}`.trim();
}

/**
 * Les statuts commerciaux, en libellé + ton sémantique.
 *
 * `ton` a remplacé `cls` : une table de statut n'a pas à savoir qu'un succès est vert, elle a
 * seulement à dire que « Signé » est un succès. Le rendu appartient au `Badge` (`lib/tons.ts`),
 * qui garantit du même geste les 4,5:1 de contraste — « Livré » portait
 * `bg-gray-200 text-gray-500`, mesuré à 3,90:1, et ce badge-là s'affiche sur le portail client.
 */
export const STATUS_DEVIS: Record<string, { label: string; ton: TonBadge }> = {
  brouillon: { label: "Brouillon", ton: "neutral" },
  envoye: { label: "Envoyé", ton: "info" },
  signe: { label: "Signé", ton: "success" },
  refuse: { label: "Refusé", ton: "danger" },
  expire: { label: "Expiré", ton: "warning" },
  // C3 — le devis dont une version plus récente a pris la suite. Le badge est volontairement
  // neutre : ce n'est ni un échec ni un succès, c'est un document qui n'est plus le bon.
  // (Il était violet, une sixième couleur pour dire « neutre » : le mot le dit déjà.)
  remplace: { label: "Remplacé", ton: "neutral" },
};

export const STATUS_PROJET: Record<string, { label: string; ton: TonBadge }> = {
  en_attente: { label: "En attente", ton: "neutral" },
  en_cours: { label: "En cours", ton: "info" },
  pret: { label: "Prêt", ton: "success" },
  livre: { label: "Livré", ton: "neutral" },
  annule: { label: "Annulé", ton: "danger" },
};

export const STATUS_FACTURE: Record<string, { label: string; ton: TonBadge }> = {
  brouillon: { label: "Brouillon", ton: "neutral" },
  emise: { label: "Émise", ton: "info" },
  payee: { label: "Payée", ton: "success" },
  annulee: { label: "Annulée", ton: "danger" },
};

/**
 * Quantité proposée au réapprovisionnement d'une poudre : de quoi repasser au double du seuil
 * d'alerte. Recommander exactement le manquant remettrait la teinte en alerte dès la première
 * fournée ; l'arrondi à 5 kg colle aux conditionnements de la poudre.
 */
export function qteConseillee(p: { seuil_alerte_kg: number | null }, stock: number) {
  const seuil = Number(p.seuil_alerte_kg ?? 0);
  return Math.max(5, Math.ceil(Math.max(seuil * 2 - stock, 5) / 5) * 5);
}

/**
 * D7 — libellés de la finition et du type de poudre.
 *
 * `poudres.finition` et `poudres.type` sont des colonnes texte libre (pas de contrainte en base :
 * une reprise de tableur peut y avoir déposé n'importe quoi), mais `PoudreForm` ne propose qu'une
 * liste fermée de codes techniques anglo-saxons ("satine", "texture", "metallise"…) — c'est ce
 * code-là, et lui seul, qui s'affichait brut dans le sélecteur et dans la liste de `/stock`. La
 * traduction ne couvre donc que les codes connus de la liste ; une valeur importée déjà en clair
 * (« RAL 9010 satiné brillant ») n'a aucune raison d'être retouchée et retombe telle quelle.
 */
export const FINITION_POUDRE_LABEL: Record<string, string> = {
  mat: "Mat",
  satine: "Satiné",
  brillant: "Brillant",
  texture: "Texturé",
  metallise: "Métallisé",
  candy: "Candy",
  fluo: "Fluo",
};

export const TYPE_POUDRE_LABEL: Record<string, string> = {
  polyester: "Polyester",
  epoxy: "Époxy",
  "epoxy-polyester": "Époxy-polyester",
  primaire: "Primaire",
  vernis: "Vernis",
};

export function libelleFinitionPoudre(code: string | null | undefined) {
  if (!code) return "";
  return FINITION_POUDRE_LABEL[code] ?? code;
}

export function libelleTypePoudre(code: string | null | undefined) {
  if (!code) return "";
  return TYPE_POUDRE_LABEL[code] ?? code;
}

/**
 * Libellé du bain de prétraitement.
 *
 * `controles_bains.bain` est une colonne texte libre : `BainForm` (le formulaire de saisie de
 * `/qualite/bains`) n'y écrit plus que les libellés déjà accentués de `BAINS_TYPES`
 * (`lib/qualite.ts`), mais une reprise d'historique antérieure à cette liste fermée y a laissé des
 * codes bruts sans accent (« degraissage », « rincage ») — ce sont eux qui s'affichaient tels
 * quels dans les cartes du haut et l'historique, alors que le sélecteur « Bain » du même écran
 * affichait déjà « Dégraissage ». Même principe que `libelleFinitionPoudre` : une valeur déjà
 * propre (n'importe quelle entrée de `BAINS_TYPES`) retombe inchangée.
 */
export const BAIN_LABEL: Record<string, string> = {
  degraissage: "Dégraissage",
  decapage: "Décapage",
  rincage: "Rinçage",
  "rincage 1": "Rinçage 1",
  "rincage1": "Rinçage 1",
  "rincage 2": "Rinçage 2",
  "rincage2": "Rinçage 2",
  deoxydation: "Déoxydation",
  conversion: "Conversion (phosphatation / Cr3)",
  passivation: "Passivation",
  "rincage final": "Rinçage final (eau déminéralisée)",
  autre: "Autre",
};

export function libelleBain(bain: string | null | undefined) {
  if (!bain) return "";
  return BAIN_LABEL[bain.toLowerCase().trim()] ?? bain;
}

/**
 * D11 — retard invisible : une échéance ou une date prévue dépassée restait affichée en gris
 * comme n'importe quelle autre date, sur `/factures`, la fiche facture et le portail client, alors
 * que le kanban de l'atelier, lui, passe au rouge dès que la date est franchie. Même règle
 * partout : ce qui est accompli (livré, réglé) l'emporte toujours — une pièce livrée après sa date
 * prévue n'est pas « en retard », elle est livrée, et une facture réglée n'est pas échue même si
 * son échéance est passée.
 *
 * Reprend exactement la comparaison déjà en service sur les factures du portail
 * (`new Date(due_date) < new Date()`), pour ne pas introduire une deuxième définition du retard.
 */
export function dateDepassee(dateRealisee: string | null | undefined, datePrevue: string | null | undefined): boolean {
  if (dateRealisee) return false;
  if (!datePrevue) return false;
  return new Date(datePrevue) < new Date();
}

/**
 * Une facture est en retard si elle est émise et que son échéance est passée. `status` suffit à
 * exclure ce qui est déjà réglé : une facture soldée passe à « payée » (voir `paiements`, migration
 * 53), elle ne reste jamais « émise » avec un reste dû à zéro — même définition que l'outil
 * `factures_echues` de l'assistant (lib/assistant/outils.ts).
 */
export function factureEchue(f: { status?: string | null; due_date?: string | null }): boolean {
  if (f.status !== "emise") return false;
  return dateDepassee(null, f.due_date);
}
