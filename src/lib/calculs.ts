import { calcTotaux, estForfaitMinimum, round2, ventilationParTaux } from "@/lib/utils";
import type { ClientTarif, DevisItem, GrilleCoef, GrillePalier, PalierQuantite, PieceType, Prestation } from "@/lib/types";

/**
 * Surface développée d'un profilé chiffré au mètre linéaire.
 *
 * Un menuisier alu raisonne en mètres de barre posée, pas en m². C'est pourtant la surface qui
 * consomme de la poudre : un profilé « déplié » est un long rectangle dont la largeur est le
 * périmètre de sa section. Le périmètre se saisit en mm (plus lisible sur un plan de profilé
 * qu'en mètres), d'où la division par 1000. La quantité permet de cumuler plusieurs pièces
 * identiques (ex. 4 dormants de 2,10 m) sans ouvrir une ligne par pièce.
 */
export function surfaceDeveloppee(perimetreMm: number, longueurM: number, quantite: number = 1): number {
  if (!perimetreMm || !longueurM || !quantite) return 0;
  return round2((perimetreMm / 1000) * longueurM * quantite);
}

/** Métrage total à facturer (ml) : longueur d'une pièce × nombre de pièces identiques. */
export function metrageTotal(longueurM: number, quantite: number = 1): number {
  return round2((longueurM || 0) * (quantite || 1));
}

/**
 * Prix applicable à une prestation pour un client donné.
 *
 * Deux mécanismes de tarif négocié coexistent côté client (cf. `clients.grille_id` /
 * `remise_pct` et la table `client_tarifs`) et ne s'additionnent pas : un prix spécifique par
 * prestation prime toujours, car c'est l'accord le plus précis. À défaut, on repart du prix
 * catalogue — la remise contractuelle globale du client s'applique alors au niveau du total du
 * devis (cf. DevisEditor.choisirClient), pas ligne à ligne, pour ne pas la cumuler avec un tarif
 * déjà négocié sur d'autres lignes.
 */
export function prixNegocie(
  prestation: Prestation,
  clientId: string | null | undefined,
  tarifs: ClientTarif[],
  qte: number = 1,
): { pu: number; negocie: boolean } {
  const specifique = clientId ? tarifs.find((t) => t.client_id === clientId && t.prestation_id === prestation.id) : undefined;
  if (specifique) return { pu: Number(specifique.prix_ht), negocie: true };
  return { pu: prixPalierQuantite(prestation, qte), negocie: false };
}

/**
 * Prix unitaire d'une prestation à paliers de quantité (lot C, C5) : le palier retenu est celui
 * dont `a_partir_de` est le plus élevé sans dépasser la quantité saisie. Sans palier applicable
 * (aucun seuil ≤ qte, ou prestation sans palier déclaré), le prix catalogue fait foi — comportement
 * inchangé pour toute prestation qui ne déclare pas de dégressif.
 *
 * Le tarif négocié d'un client (`prixNegocie`) prime toujours sur les paliers : c'est l'accord le
 * plus précis, comme pour le prix catalogue qu'il remplaçait déjà.
 */
export function prixPalierQuantite(prestation: Prestation, qte: number): number {
  const paliers = (prestation.paliers_quantite ?? []) as PalierQuantite[];
  if (!paliers.length) return Number(prestation.prix_unitaire_ht);
  const applicables = paliers
    .filter((p) => Number(qte) >= Number(p.a_partir_de))
    .sort((a, b) => Number(b.a_partir_de) - Number(a.a_partir_de));
  return applicables.length ? Number(applicables[0].prix) : Number(prestation.prix_unitaire_ht);
}

/**
 * Coefficient d'une catégorie de grille. Un code absent vaut 1 : une grille incomplète ne doit
 * jamais faire tomber un prix à zéro.
 *
 * Exporté depuis l'arrivée du module jantes : les coefficients de dessin et de finition d'une
 * jante vivent dans la même table, et deux lectures parallèles auraient fini par diverger sur le
 * traitement du code absent — c'est-à-dire sur un prix.
 */
export function coefGrille(coefs: GrilleCoef[], grilleId: string | null | undefined, categorie: GrilleCoef["categorie"], code: string | null | undefined): number {
  if (!code) return 1;
  return Number(coefs.find((c) => c.grille_id === grilleId && c.categorie === categorie && c.code === code)?.coef ?? 1);
}
const coef = coefGrille;

/**
 * Prix au m² d'une ligne : palier de surface × finition × complexité × nombre de couches.
 *
 * Le palier se lit sur la borne basse incluse et la borne haute exclue (une pièce de 3 m² pile
 * tombe dans le palier 3–10, pas dans le 1–3), et la dernière tranche a un `surface_max` nul.
 * Les trois coefficients se multiplient entre eux : une seconde couche coûte un second passage
 * en cabine et une seconde cuisson, elle multiplie donc le prix déjà majoré de la finition et de
 * la complexité, elle ne s'y ajoute pas.
 */
export function prixM2(args: {
  surface: number;
  finition: string;
  complexite: string;
  /** Code du coefficient de couches (catégorie `couche`). Absent = grille sans couches déclarées. */
  couche?: string | null;
  grilleId: string | null | undefined;
  paliers: GrillePalier[];
  coefs: GrilleCoef[];
}): number {
  const { surface, finition, complexite, couche, grilleId, paliers, coefs } = args;
  const palier = paliers.find(
    (p) => p.grille_id === grilleId && surface >= Number(p.surface_min) && (p.surface_max == null || surface < Number(p.surface_max)),
  );
  const base = palier ? Number(palier.prix_m2) : 0;
  const cF = coef(coefs, grilleId, "finition", finition);
  const cC = coef(coefs, grilleId, "complexite", complexite);
  const cN = coef(coefs, grilleId, "couche", couche);
  return round2(base * cF * cC * cN);
}

/** Coefficients de couches d'une grille, du moins majorant au plus majorant. */
export function couchesDisponibles(coefs: GrilleCoef[], grilleId: string | null | undefined): GrilleCoef[] {
  return coefs
    .filter((c) => c.grille_id === grilleId && c.categorie === "couche")
    .sort((a, b) => Number(a.coef) - Number(b.coef));
}

/** Couche proposée par défaut sur une ligne neuve : la moins majorante, donc la simple couche. */
export function coucheParDefaut(coefs: GrilleCoef[], grilleId: string | null | undefined): string | null {
  return couchesDisponibles(coefs, grilleId)[0]?.code ?? null;
}

/**
 * Prix unitaire d'une pièce de la bibliothèque.
 *
 * `coef_complexite` majore le prix de la pièce type — une jante à voile creux se laque plus
 * lentement qu'une jante plate de même surface. Il s'applique aussi bien au prix catalogue qu'au
 * prix déduit de la grille au m², sinon le réglage n'aurait d'effet que dans un cas sur deux.
 */
export function prixPieceType(piece: PieceType, prixBase: number): number {
  const c = piece.coef_complexite != null ? Number(piece.coef_complexite) : 1;
  return round2(prixBase * (Number.isFinite(c) && c > 0 ? c : 1));
}

export const LIBELLE_FORFAIT_MINIMUM = "Forfait minimum";

/**
 * Plancher de facturation de la grille.
 *
 * Deux règles, toutes deux volontaires :
 *
 * 1. Le plancher porte sur le **total HT après remise**. L'appliquer avant la remise reviendrait à
 *    laisser la remise repasser sous le minimum : ce ne serait plus un plancher.
 * 2. Il ne se déclenche que si le devis contient au moins une ligne chiffrée au m². Le forfait
 *    minimum est un réglage de la grille au m² : une prestation forfaitaire de 20 € vendue seule
 *    n'a aucune raison d'être relevée à 50 €.
 *
 * Le complément est matérialisé en ligne pour que le client lise sur son devis pourquoi il paie
 * 50 € et non 13,50 €. `calcTotaux` le tient hors de l'assiette de remise.
 */
export function appliquerForfaitMinimum(args: {
  items: DevisItem[];
  remise?: { type: "pct" | "montant"; valeur: number } | null;
  forfaitMinimum?: number | null;
}): { items: DevisItem[]; complement: number; plancher: number } {
  // Une ligne de forfait déjà présente est toujours recalculée : elle dépend de tout le reste.
  const base = (args.items ?? []).filter((it) => !estForfaitMinimum(it));
  const plancher = Number(args.forfaitMinimum ?? 0);
  const lignesM2 = base.filter((it) => it.type === "m2");
  if (!(plancher > 0) || lignesM2.length === 0) return { items: base, complement: 0, plancher };

  const totalHt = calcTotaux(base, args.remise ?? null).total_ht;
  const complement = round2(plancher - totalHt);
  if (complement <= 0) return { items: base, complement: 0, plancher };

  // Le complément suit le taux de TVA du laquage lui-même : c'est la même opération, relevée.
  const tva = Number(lignesM2[0].tva ?? 20);
  const ligne: DevisItem = {
    type: "libre",
    libelle: LIBELLE_FORFAIT_MINIMUM,
    qte: 1,
    unite: "forfait",
    pu_ht: complement,
    tva,
    total_ht: complement,
    meta: { forfait_minimum: true, plancher },
  };
  return { items: [...base, ligne], complement, plancher };
}

/** Lignes réellement saisies par l'atelier : le complément de forfait n'en fait pas partie. */
export function lignesSaisies(items: DevisItem[] | null | undefined): DevisItem[] {
  return (items ?? []).filter((it) => !estForfaitMinimum(it));
}

/**
 * Délai de paiement applicable : celui négocié avec le client prime sur celui de l'atelier.
 * Sans cette règle, un client à 45 jours recevait une facture à 30 jours alors que son devis lui
 * annonçait 45 — deux documents contradictoires sur le même chantier.
 */
export function joursPaiement(delaiClient: number | null | undefined, delaiAtelier: number | null | undefined): number {
  return delaiClient ?? delaiAtelier ?? 30;
}

/** Échéance au format `YYYY-MM-DD`, à N jours de la date de référence (aujourd'hui par défaut). */
export function echeanceIso(jours: number, base: Date = new Date()): string {
  return new Date(base.getTime() + jours * 86400000).toISOString().slice(0, 10);
}

/**
 * Lignes reprises d'un devis vers une facture : le total de chaque ligne est recalculé depuis
 * quantité × prix unitaire, pour qu'une facture ne puisse pas hériter d'un total de ligne obsolète.
 * La remise, elle, se transporte à part (colonne `remise`) : l'appliquer ligne à ligne la
 * cumulerait avec les tarifs déjà négociés prestation par prestation.
 */
export function lignesDepuisDevis(items: DevisItem[] | null | undefined): DevisItem[] {
  return (items ?? []).map((it) => ({ ...it, total_ht: round2((Number(it.qte) || 0) * (Number(it.pu_ht) || 0)) }));
}

// ── Acomptes et solde ────────────────────────────────────────────────────────

export type AcompteDeductible = {
  id: string;
  numero: string | null;
  type: string;
  status: string;
  emise_at?: string | null;
  created_at?: string | null;
  items: DevisItem[] | null;
};

/** Un acompte se déduit dès qu'il est émis : c'est la créance qui compte, pas l'encaissement. */
export function acomptesDeductibles(factures: AcompteDeductible[] | null | undefined): AcompteDeductible[] {
  return (factures ?? [])
    .filter((f) => f.type === "acompte" && (f.status === "emise" || f.status === "payee"))
    .sort((a, b) => (a.emise_at ?? a.created_at ?? "").localeCompare(b.emise_at ?? b.created_at ?? ""));
}

/**
 * Lignes de déduction des acomptes déjà facturés, à poser sur la facture de solde.
 *
 * Une ligne négative par acompte **et par taux de TVA** : un acompte portant du 20 % et du 10 %
 * doit se déduire à l'identique, sinon la ventilation de TVA du solde ne retombe pas et le FEC
 * comme le Factur-X sortent faux. La mention du numéro et de la date de l'acompte est attendue sur
 * une facture de solde : le client doit pouvoir rapprocher la déduction du document d'origine.
 */
export function lignesDeductionAcomptes(acomptes: AcompteDeductible[] | null | undefined): DevisItem[] {
  const lignes: DevisItem[] = [];
  for (const a of acomptesDeductibles(acomptes)) {
    const parTaux = new Map<number, number>();
    for (const it of a.items ?? []) {
      const taux = Number(it.tva) || 0;
      parTaux.set(taux, round2((parTaux.get(taux) ?? 0) + (Number(it.total_ht) || 0)));
    }
    const date = (a.emise_at ?? a.created_at ?? "").slice(0, 10);
    for (const [taux, ht] of [...parTaux.entries()].sort((x, y) => y[0] - x[0])) {
      if (!ht) continue;
      const montant = round2(-ht);
      lignes.push({
        type: "libre",
        libelle: `Acompte ${a.numero ?? "en cours"}${date ? ` du ${date.split("-").reverse().join("/")}` : ""} — déjà facturé`,
        qte: 1,
        unite: "forfait",
        pu_ht: montant,
        tva: taux,
        total_ht: montant,
        meta: { deduction_acompte: true, facture_id: a.id, facture_numero: a.numero },
      });
    }
  }
  return lignes;
}

/** Lignes du solde : celles du devis, puis la déduction des acomptes déjà facturés. */
export function lignesSoldeDepuisDevis(
  items: DevisItem[] | null | undefined,
  acomptes: AcompteDeductible[] | null | undefined,
): DevisItem[] {
  return [...lignesDepuisDevis(items), ...lignesDeductionAcomptes(acomptes)];
}

// ── Acompte à la commande (lot C, C1) ────────────────────────────────────────

/** Montant de l'acompte à la commande, au pourcentage demandé du total TTC du devis. */
export function montantAcompte(totalTtc: number | null | undefined, acomptePct: number | null | undefined): number {
  const pct = Number(acomptePct) || 0;
  if (pct <= 0) return 0;
  return round2((Number(totalTtc) || 0) * pct / 100);
}

/**
 * Lignes de la facture d'acompte à la commande, une par taux de TVA du devis signé.
 *
 * Comme `lignesDeductionAcomptes` répartit la déduction du solde par taux, l'acompte est ici
 * construit par taux dès sa création : la facture de solde n'aura ensuite qu'à relire les lignes
 * de CETTE facture pour déduire exactement ce qui a été appelé, sans recalcul ni écart d'arrondi
 * entre les deux documents.
 *
 * `remise` doit être celle du devis (`devis.remise`). SANS ELLE, un devis remisé produirait un
 * acompte assis sur le total HT *brut* : sur un devis à 500 € HT remisé de 12 % (440 € HT), un
 * acompte de 30 % donnerait 150 € au lieu de 132 € — 30 % du total affiché à l'écran, pas 30 % de
 * ce qui a réellement été chiffré. `ventilationParTaux` porte déjà cette logique (et exclut le
 * forfait minimum de l'assiette remisable) : on la réutilise telle quelle plutôt que de la
 * dupliquer, exactement comme `calcTotaux` le fait pour le total du devis lui-même.
 */
export function lignesAcompteDepuisDevis(
  items: DevisItem[] | null | undefined,
  acomptePct: number | null | undefined,
  remise?: { type: "pct" | "montant"; valeur: number } | null,
): DevisItem[] {
  const pct = Number(acomptePct) || 0;
  if (pct <= 0) return [];
  const ventilation = ventilationParTaux(items ?? [], remise ?? null);
  const lignes: DevisItem[] = [];
  for (const { taux, base } of [...ventilation].sort((a, b) => b.taux - a.taux)) {
    const montant = round2((base * pct) / 100);
    if (!montant) continue;
    lignes.push({
      type: "libre",
      libelle: `Acompte à la commande (${pct} %)`,
      qte: 1,
      unite: "forfait",
      pu_ht: montant,
      tva: taux,
      total_ht: montant,
      meta: { acompte_ligne: true, acompte_pct: pct },
    });
  }
  return lignes;
}

// ── Devis à options (lot C, C5) ───────────────────────────────────────────────

/**
 * Lignes réellement comptées dans le total du devis.
 *
 * Une ligne optionnelle NON retenue en est exclue (c'est tout l'objet de l'option) ; une ligne
 * optionnelle retenue à la signature (`optionnel_accepte`, posé par `signer_devis`) y entre au
 * contraire normalement — elle reste marquée `optionnel` pour la traçabilité, mais elle est
 * vendue. Sans le second membre de ce test, un devis signé perdrait le prix de ses options
 * acceptées sur l'écran, le PDF et la page publique, alors que la base les a bien facturées.
 */
export function lignesFacturables(items: DevisItem[] | null | undefined): DevisItem[] {
  return (items ?? []).filter((it) => !it.optionnel || it.optionnel_accepte);
}

/** Lignes « en option » pas encore retenues : proposées, affichées, mais hors du total. */
export function lignesOptionnelles(items: DevisItem[] | null | undefined): DevisItem[] {
  return (items ?? []).filter((it) => it.optionnel === true && !it.optionnel_accepte);
}
