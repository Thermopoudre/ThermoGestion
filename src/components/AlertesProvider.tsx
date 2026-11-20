"use client";
import { createContext, useContext, type ReactNode } from "react";
import { REGLAGES_ALERTES_DEFAUT, type ReglagesAlertes } from "@/lib/alertes";

type Contexte = Omit<ReglagesAlertes, "atelier_id"> & { atelier_id: string | null };

const AlertesContexte = createContext<Contexte | null>(null);

/**
 * Les réglages d'alerte de l'atelier, chargés une fois par le layout serveur et distribués aux
 * écrans.
 *
 * POURQUOI un contexte et non un `useEffect` par écran : le seuil de DLU est lu par six écrans
 * (Stock, fiche poudre, Lots, fiche lot, Tableau de bord, bouton de pointage). Six requêtes pour
 * un entier, et surtout six occasions d'afficher un badge orange avant que la valeur soit
 * revenue — donc six clignotements sur une tablette d'atelier en 4G.
 *
 * Ce contexte ne protège rien et ne décide rien : le seuil qui fait foi est celui que lit
 * `recap_quotidien_payload()` en base, dans la même colonne. Ici, il ne fait que colorer.
 */
export function AlertesProvider({
  reglages,
  children,
}: {
  reglages: ReglagesAlertes | null;
  children: ReactNode;
}) {
  const valeur: Contexte = { atelier_id: null, ...REGLAGES_ALERTES_DEFAUT, ...(reglages ?? {}) };
  return <AlertesContexte.Provider value={valeur}>{children}</AlertesContexte.Provider>;
}

/**
 * Hors du layout de l'application (pages publiques, écran de connexion), le contexte n'existe pas :
 * on rend les valeurs par défaut plutôt que de faire tomber le rendu. Aucun risque — ces écrans
 * n'affichent aucun lot de poudre.
 */
export function useAlertes(): Contexte {
  return useContext(AlertesContexte) ?? { atelier_id: null, ...REGLAGES_ALERTES_DEFAUT };
}

/** Raccourci : le seul réglage dont la moitié des écrans ait besoin. */
export function useSeuilDlu(): number {
  return useAlertes().seuil_dlu_jours;
}
