import { nombreFr, round2 } from "@/lib/utils";
import type { PoudreCycle, ProjetPretFournee } from "@/lib/types";

/**
 * Deux règles de métier gouvernent le remplissage d'une fournée (four de cuisson) :
 *
 * 1. La teinte (poudre_id) : enchaîner deux projets de la même poudre évite un nettoyage
 *    complet de cabine entre les deux (15 à 30 min perdues). C'est un critère de confort,
 *    pas une contrainte physique — on peut mélanger les teintes dans une même fournée.
 * 2. Le cycle de cuisson (temp_cuisson / duree_cuisson_min, propriétés de la poudre) : tout
 *    ce qui cuit ensemble dans le même four subit le même programme. Deux poudres à cycles
 *    différents ne peuvent physiquement pas cuire dans la même fournée — c'est une contrainte
 *    dure, contrairement à la teinte.
 */

/** Étapes de workflow à partir desquelles un projet est un candidat à une fournée. */
export const ETAPES_PRETES_FOURNEE = ["poudrage", "cuisson"] as const;

export function cycleLabel(p: PoudreCycle | null | undefined): string {
  if (!p || p.temp_cuisson == null || p.duree_cuisson_min == null) return "cycle inconnu";
  return `${p.temp_cuisson} °C / ${p.duree_cuisson_min} min`;
}

export function poudreLabel(p: Pick<PoudreCycle, "reference" | "ral"> | null | undefined): string {
  if (!p) return "—";
  return p.ral ? `${p.reference} (RAL ${p.ral})` : p.reference;
}

/** Deux poudres ne cuisent ensemble que si température ET durée sont strictement identiques. */
export function cycleCompatible(a: PoudreCycle | null | undefined, b: PoudreCycle | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.temp_cuisson == null || a.duree_cuisson_min == null || b.temp_cuisson == null || b.duree_cuisson_min == null) return false;
  return a.temp_cuisson === b.temp_cuisson && a.duree_cuisson_min === b.duree_cuisson_min;
}

export function memeTeinte(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a === b;
}

export function surfaceTotale(projets: { surface_m2: number | null }[]): number {
  return round2(projets.reduce((s, p) => s + (p.surface_m2 ?? 0), 0));
}

/** Retourne le taux de remplissage en % (peut dépasser 100 si la fournée déborde du four). */
export function tauxRemplissage(surfaceM2: number, capaciteM2: number | null | undefined): number | null {
  if (!capaciteM2) return null;
  return Math.round((surfaceM2 / capaciteM2) * 100);
}

export type GroupeTeinte = {
  poudre_id: string | null;
  poudre: PoudreCycle | null;
  projets: ProjetPretFournee[];
  surfaceTotale: number;
};

/** Groupe les projets prêts par teinte (poudre_id), du plus gros groupe au plus petit — c'est
 *  l'ordre naturel de suggestion : la teinte qui a le plus de projets en attente est celle qui
 *  fera gagner le plus de temps de nettoyage de cabine si on la traite en une seule fournée. */
export function grouperParTeinte(projets: ProjetPretFournee[]): GroupeTeinte[] {
  const map = new Map<string, GroupeTeinte>();
  for (const p of projets) {
    const key = p.poudre_id ?? "__sans_poudre__";
    if (!map.has(key)) map.set(key, { poudre_id: p.poudre_id, poudre: p.poudres ?? null, projets: [], surfaceTotale: 0 });
    const g = map.get(key)!;
    g.projets.push(p);
    g.surfaceTotale = round2(g.surfaceTotale + (p.surface_m2 ?? 0));
  }
  return [...map.values()].sort((a, b) => b.projets.length - a.projets.length || b.surfaceTotale - a.surfaceTotale);
}

export type Suggestion = {
  groupe: GroupeTeinte;
  projets: ProjetPretFournee[];
  surfaceTotale: number;
  tauxPct: number | null;
};

/**
 * Remplit un groupe de teinte au plus près de la capacité du four, en commençant par les pièces
 * les plus encombrantes : un four se paie au cycle, pas au nombre de pièces. Cuire 2,4 m² dans un
 * four de 9 m² coûte le même kWh que d'en cuire 8,58 — c'est le remplissage qu'il faut maximiser.
 */
function remplirAuMieux(projets: ProjetPretFournee[], capaciteM2: number | null | undefined): ProjetPretFournee[] {
  if (!capaciteM2) return projets;
  const tries = [...projets].sort((a, b) => (b.surface_m2 ?? 0) - (a.surface_m2 ?? 0));
  const retenus: ProjetPretFournee[] = [];
  let cumul = 0;
  for (const p of tries) {
    const s = p.surface_m2 ?? 0;
    if (cumul + s > capaciteM2 && retenus.length > 0) continue;
    retenus.push(p);
    cumul += s;
  }
  return retenus;
}

/**
 * Suggère la meilleure fournée à lancer maintenant : parmi les groupes de même teinte, celui qui
 * remplit le mieux le four sans le faire déborder. Sans capacité renseignée, on prend le plus gros
 * groupe (le critère devient alors le nombre de nettoyages de cabine évités).
 */
export function suggestionMeilleureFournee(groupes: GroupeTeinte[], capaciteM2: number | null | undefined): Suggestion | null {
  const candidats = groupes.filter((g) => g.poudre_id && g.projets.length > 0);
  if (candidats.length === 0) return null;
  let meilleure: Suggestion | null = null;
  for (const groupe of candidats) {
    const projets = remplirAuMieux(groupe.projets, capaciteM2);
    if (projets.length === 0) continue;
    const surface = surfaceTotale(projets);
    const candidate: Suggestion = { groupe, projets, surfaceTotale: surface, tauxPct: tauxRemplissage(surface, capaciteM2) };
    if (
      !meilleure ||
      candidate.surfaceTotale > meilleure.surfaceTotale ||
      (candidate.surfaceTotale === meilleure.surfaceTotale && candidate.projets.length > meilleure.projets.length)
    ) {
      meilleure = candidate;
    }
  }
  return meilleure;
}

export function suggestionLabel(s: Suggestion): string {
  const n = s.projets.length;
  const teinte = poudreLabel(s.groupe.poudre);
  const pct = s.tauxPct != null ? ` — four rempli à ${s.tauxPct} %` : "";
  return `${n} projet${n > 1 ? "s" : ""} ${teinte} (${nombreFr(s.surfaceTotale)} m²)${pct}. Lancer cette fournée ?`;
}

export type AvertissementAjout = { bloquant: boolean; message: string | null };

/** Avertissement (ou blocage) déclenché par l'ajout d'un projet candidat à une composition en
 *  cours. Le changement de teinte est un avertissement doux (nettoyage de cabine) ; le cycle de
 *  cuisson incompatible est bloquant (impossible physiquement). */
export function avertissementAjout(composition: ProjetPretFournee[], candidat: ProjetPretFournee): AvertissementAjout {
  if (composition.length === 0) return { bloquant: false, message: null };
  const ref = composition[0];
  // Même poudre = même cycle par définition. Sans ce raccourci, deux projets de la même teinte
  // dont la fiche poudre n'a pas de cycle renseigné se déclarent mutuellement incompatibles, avec
  // un message absurde — et l'atelier ne peut plus composer aucune fournée.
  if (memeTeinte(ref.poudre_id, candidat.poudre_id)) return { bloquant: false, message: null };
  if (!cycleCompatible(ref.poudres, candidat.poudres)) {
    return {
      bloquant: true,
      message: `Cycle de cuisson incompatible (${cycleLabel(ref.poudres)} ≠ ${cycleLabel(candidat.poudres)}) : ces poudres ne peuvent pas cuire dans la même fournée.`,
    };
  }
  if (!memeTeinte(ref.poudre_id, candidat.poudre_id)) {
    return { bloquant: false, message: `Changement de teinte (${poudreLabel(candidat.poudres)}) : un nettoyage de cabine sera nécessaire.` };
  }
  return { bloquant: false, message: null };
}

export type BlocageLancement = { bloquant: boolean; capaciteConnue: boolean; message: string | null };

/**
 * Amélioration n°2 (07/09/2026) — la même règle que la base (`trg_fournee_capacite`, migration
 * 71), rejouée ici pour l'écran : le bouton « Lancer la fournée » se désactive avec sa raison
 * affichée, sur le modèle du bouton « Générer » du certificat de conformité
 * (`src/lib/certificat.ts` / `CertificatProjet.tsx`). **C'est un affichage, pas une garde** — la
 * base refuse la même chose de toute façon, y compris si ce fichier divergeait ou si quelqu'un
 * appelait `.update()` depuis la console.
 *
 * Trois issues :
 *  - capacité inconnue → jamais de blocage, on ne compare pas à une valeur qu'on n'a pas ;
 *  - dans la capacité → jamais de blocage ;
 *  - au-delà → bloquant, sauf dérogation cochée par l'atelier (portée par l'appelant, pas ici :
 *    cette fonction ne connaît que la géométrie, pas l'état de la case à cocher).
 */
export function blocageLancement(surfaceM2: number, capaciteM2: number | null | undefined): BlocageLancement {
  if (!capaciteM2) {
    return {
      bloquant: false,
      capaciteConnue: false,
      message: "Capacité du four non renseignée : le dépassement ne peut pas être vérifié. Renseignez-la dans Réglages → Atelier pour activer ce contrôle.",
    };
  }
  if (surfaceM2 <= capaciteM2) return { bloquant: false, capaciteConnue: true, message: null };
  const pct = Math.round((surfaceM2 / capaciteM2) * 100);
  return {
    bloquant: true,
    capaciteConnue: true,
    message:
      `Cette fournée occupe ${nombreFr(surfaceM2, 1, 1)} m² pour ${nombreFr(capaciteM2, 1, 1)} m² de capacité déclarée ` +
      `(${pct} %). Cochez la dérogation pour lancer quand même si le four est réellement plus grand, ou corrigez sa ` +
      "capacité dans Réglages → Atelier si le dépassement est systématique.",
  };
}

/**
 * La numérotation des fournées est passée en base (`next_numero('fournee')`, migration 48).
 *
 * Elle était comptée ici, dans le navigateur : « F-AAAAMMJJ-N » où N était le nombre de fournées
 * du jour relues juste avant. Deux postes qui lançaient une fournée à la même minute lisaient le
 * même total et posaient deux fois le même numéro — et la table n'a aucune contrainte d'unicité
 * pour les arrêter. Le compteur est désormais sérialisé par la base, et il porte le préfixe que
 * l'atelier a posé dans Réglages → Numérotation. Les fournées d'avant gardent leur ancien numéro :
 * c'est une étiquette d'atelier, pas une pièce comptable.
 */
