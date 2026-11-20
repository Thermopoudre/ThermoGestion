import type { TonBadge } from "@/lib/tons";
import type { AtelierFour, AtelierLot2 } from "@/lib/types";

/**
 * Capacité du four et date de livraison réaliste.
 *
 * Un atelier de thermolaquage ne promet pas une date à la louche : sa contrainte physique est
 * le four, qui traite un nombre fini de m² par jour. La règle appliquée ici est celle que les
 * chefs d'atelier tiennent de tête, en trois nombres qu'ils connaissent :
 *
 *   capacité du four (m²) × nombre de cycles tenus dans la journée × taux de remplissage moyen
 *
 * Le taux de remplissage est indispensable : personne ne remplit un four à 100 %, les pièces ont
 * des formes. Sans cet abattement, la date proposée serait systématiquement trop optimiste — et
 * une date trop optimiste est pire que pas de date du tout, parce qu'elle sera annoncée au client.
 */

export type ParamsCapacite = Pick<AtelierFour, "four_capacite_m2"> & Pick<AtelierLot2, "four_cycles_jour" | "four_remplissage_moyen_pct">;

/** Une journée de plus après la dernière cuisson : contrôle, retouche éventuelle, emballage. */
export const MARGE_FINITION_JOURS = 1;

function nb(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** m² réellement laquables dans une journée ouvrée. `null` si le four n'est pas paramétré. */
export function capaciteJournaliereM2(p: ParamsCapacite): number | null {
  const capacite = nb(p.four_capacite_m2);
  const cycles = nb(p.four_cycles_jour);
  const remplissage = nb(p.four_remplissage_moyen_pct);
  if (capacite <= 0 || cycles <= 0 || remplissage <= 0) return null;
  return Math.round(capacite * cycles * (remplissage / 100) * 100) / 100;
}

/**
 * Ajoute des jours ouvrés à une date (samedi et dimanche exclus). Les jours fériés ne sont pas
 * gérés : la date proposée reste une proposition que l'atelier peut corriger, et un calendrier
 * de fériés mal tenu produirait une fausse précision.
 */
export function ajouterJoursOuvres(depart: Date, jours: number): Date {
  const d = new Date(depart.getTime());
  let restants = Math.max(0, Math.round(jours));
  while (restants > 0) {
    d.setDate(d.getDate() + 1);
    const jour = d.getDay();
    if (jour !== 0 && jour !== 6) restants--;
  }
  return d;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type ProjetEnCharge = {
  surface_m2: number | null;
  status?: string | null;
  date_promise?: string | null;
  etape_courante?: string | null;
  /** Posé au passage à la cuisson : c'est la preuve la plus fiable qu'un projet est déjà passé au four. */
  stock_decremente_at?: string | null;
};

export type Charge = {
  /** m² engagés et pas encore livrés — la file d'attente devant le four. */
  enCoursM2: number;
  projets: number;
  capaciteJourM2: number | null;
  /** Nombre de jours de four que représente la file d'attente. */
  joursDeCharge: number | null;
  /** File d'attente rapportée à une journée de production, en %. 100 % = un jour de retard pile. */
  tauxChargePct: number | null;
  /** Projets dont la date promise est déjà dépassée par la charge réelle. */
  enRetard: number;
};

/**
 * Étapes situées **après** le four dans le parcours par défaut. Un projet qui y est arrivé est
 * déjà cuit : le compter dans la file d'attente gonfle artificiellement la charge et repousse
 * toutes les dates promises. Le workflow étant personnalisable (Réglages > Parcours), la liste
 * est un repli : le signal qui fait autorité reste `stock_decremente_at`, posé à la cuisson.
 */
export const ETAPES_APRES_FOUR = ["controle", "pret", "livre"] as const;

/** Un projet livré, annulé, prêt ou déjà cuit ne pèse plus sur le four. Tout le reste est devant. */
export function estEnCharge(p: ProjetEnCharge): boolean {
  if (p.status === "livre" || p.status === "annule" || p.status === "pret") return false;
  if (p.stock_decremente_at) return false;
  const etape = p.etape_courante ?? null;
  return !(etape != null && (ETAPES_APRES_FOUR as readonly string[]).includes(etape));
}

/** Statuts qui pèsent encore sur une promesse de date faite au client. */
export const STATUTS_PROJET_OUVERT = ["en_attente", "en_cours", "pret"] as const;

/**
 * Un projet est en retard dès que sa date promise est dépassée et qu'il n'est ni livré ni annulé.
 *
 * POURQUOI CETTE FONCTION EXISTE (lot D — D12). « Retard » et « en charge » sont deux questions
 * différentes : un projet au statut `pret` ne pèse plus sur le four (`estEnCharge` l'exclut, à
 * raison — il ne consomme plus de cycle de cuisson), mais reste en retard pour le client tant
 * qu'il n'est pas livré. `/dashboard` comptait déjà `pret` dans son « en retard » (voir son
 * commentaire) ; `calculerCharge` s'appuyait, lui, sur `estEnCharge` pour le même chiffre — deux
 * écrans du même produit annonçaient donc deux nombres différents (3 contre 2 en recette). C'est
 * cette définition, et elle seule, qui fait foi partout : `/dashboard`, `/pilotage`, et le kanban
 * de `/projets`.
 */
export function estProjetEnRetard(p: { status?: string | null; date_promise?: string | null }, jourJ: string): boolean {
  if (p.status == null || !(STATUTS_PROJET_OUVERT as readonly string[]).includes(p.status)) return false;
  return p.date_promise != null && p.date_promise < jourJ;
}

export function calculerCharge(projets: ProjetEnCharge[], params: ParamsCapacite, aujourdHui = new Date()): Charge {
  const enCharge = projets.filter(estEnCharge);
  const enCoursM2 = Math.round(enCharge.reduce((s, p) => s + nb(p.surface_m2), 0) * 100) / 100;
  const capaciteJourM2 = capaciteJournaliereM2(params);
  const joursDeCharge = capaciteJourM2 ? Math.ceil(enCoursM2 / capaciteJourM2) : null;
  const jourJ = isoDate(aujourdHui);
  return {
    enCoursM2,
    projets: enCharge.length,
    capaciteJourM2,
    joursDeCharge,
    tauxChargePct: capaciteJourM2 ? Math.round((enCoursM2 / capaciteJourM2) * 100) : null,
    // Sur l'ensemble des projets, pas seulement `enCharge` : un projet « pret » compte, lui aussi.
    enRetard: projets.filter((p) => estProjetEnRetard(p, jourJ)).length,
  };
}

export type PropositionDate = {
  date: string;
  joursOuvres: number;
  explication: string;
};

/**
 * Date de livraison tenable pour un nouveau chantier : la file d'attente actuelle plus le
 * chantier lui-même, convertis en journées de four, plus la marge de finition.
 *
 * Rend `null` si le four n'est pas paramétré : une date inventée sur des réglages vides serait
 * exactement le genre de promesse que l'atelier ne tiendrait pas.
 */
export function dateLivraisonRealiste(
  charge: Charge,
  surfaceNouvelleM2: number,
  aujourdHui = new Date(),
): PropositionDate | null {
  if (!charge.capaciteJourM2) return null;
  const total = charge.enCoursM2 + Math.max(0, nb(surfaceNouvelleM2));
  const joursFour = Math.ceil(total / charge.capaciteJourM2);
  const joursOuvres = joursFour + MARGE_FINITION_JOURS;
  const date = isoDate(ajouterJoursOuvres(aujourdHui, joursOuvres));
  const explication =
    `${total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m² à cuire ` +
    `(${charge.enCoursM2.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m² déjà en file) ` +
    `à ${charge.capaciteJourM2.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m² par jour, ` +
    `plus ${MARGE_FINITION_JOURS} jour de contrôle et d'emballage.`;
  return { date, joursOuvres, explication };
}

export type NiveauCharge = "libre" | "normal" | "tendu" | "sature";

export function niveauCharge(tauxChargePct: number | null): NiveauCharge | null {
  if (tauxChargePct == null) return null;
  if (tauxChargePct < 100) return "libre";
  if (tauxChargePct < 300) return "normal";
  if (tauxChargePct < 600) return "tendu";
  return "sature";
}

export const NIVEAU_CHARGE_LABEL: Record<NiveauCharge, string> = {
  libre: "Moins d'une journée de four devant vous",
  normal: "Charge normale",
  tendu: "Carnet tendu",
  sature: "Four saturé",
};

export const NIVEAU_CHARGE_TON: Record<NiveauCharge, TonBadge> = {
  libre: "success",
  normal: "success",
  tendu: "warning",
  sature: "danger",
};
