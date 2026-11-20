"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  SIEGES_INCLUS,
  capaciteOuverte,
  enEssai,
  planEffectif,
  siegesAutorises,
  siegesInclus,
  type Abonnement,
  type Capacite,
  type PlanCode,
} from "@/lib/abonnement";
import { accesCommercial, estProprietaire as calculerProprietaire, type Role } from "@/lib/roles";

type Contexte = {
  sub: Abonnement | null;
  plan: PlanCode;
  essai: boolean;
  /** Rôle applicatif du membre connecté. `null` hors de l'application (vitrine, connexion). */
  role: Role | null;
  estProprietaire: boolean;
  /** Le membre voit-il l'argent : marges, prix d'achat, devis, factures, grilles modifiables ? */
  commercial: boolean;
  ouvert: (c: Capacite) => boolean;
  /** Sièges compris dans la formule en vigueur. */
  siegesInclus: number;
  /** Sièges compris + sièges achetés. Ce n'est jamais `null` : il n'y a plus de formule « illimitée ». */
  siegesAutorises: number;
};

const PlanContexte = createContext<Contexte | null>(null);

/**
 * L'abonnement est chargé une seule fois, par le layout serveur, et distribué aux écrans.
 *
 * Sans lui, chaque écran verrouillé referait sa propre requête `subscriptions` — trois requêtes
 * pour afficher un cadenas, et surtout trois occasions de diverger. Ce contexte ne **protège**
 * rien : le verrou réel est le trigger `exiger_capacite` en base et les conditions portées par
 * les vues. Ici on ne fait qu'éviter à l'atelier de buter sur un refus sans explication.
 */
export function PlanProvider({
  sub,
  role,
  children,
}: {
  sub: Abonnement | null;
  role: Role | null;
  children: ReactNode;
}) {
  const valeur: Contexte = {
    sub,
    plan: planEffectif(sub),
    essai: enEssai(sub),
    role,
    estProprietaire: calculerProprietaire(role),
    commercial: accesCommercial(role),
    ouvert: (c) => capaciteOuverte(sub, c),
    siegesInclus: siegesInclus(sub),
    siegesAutorises: siegesAutorises(sub),
  };
  return <PlanContexte.Provider value={valeur}>{children}</PlanContexte.Provider>;
}

/**
 * Hors du layout de l'application (pages publiques, écrans de connexion), le contexte n'existe
 * pas : on répond « tout ouvert » plutôt que de faire tomber le rendu. Aucun risque — ces écrans
 * ne montrent aucune donnée d'atelier, et la base tranche de toute façon à l'écriture.
 */
export function usePlan(): Contexte {
  return (
    useContext(PlanContexte) ?? {
      sub: null,
      plan: "certifie",
      essai: false,
      role: null,
      estProprietaire: false,
      commercial: false,
      ouvert: () => true,
      siegesInclus: SIEGES_INCLUS.certifie,
      siegesAutorises: SIEGES_INCLUS.certifie,
    }
  );
}
