import { round2 } from "@/lib/utils";

/**
 * Coût énergétique d'une fournée, en euros.
 *
 * Jusqu'ici l'application relevait des kWh et n'en disait jamais le prix : le réglage
 * `ateliers.prix_kwh` n'était multiplié qu'au niveau du projet, dans la vue `projet_revient`,
 * au prorata de surface. L'exploitant voyait « 10,5 kWh » sur sa fiche de cuisson et devait
 * sortir sa calculette pour savoir ce que le cycle lui avait coûté.
 *
 * La vraie décision d'un exploitant n'est d'ailleurs pas « combien a coûté ce cycle » mais
 * « ai-je eu raison de lancer ce four à moitié plein ». Un four de cuisson consomme presque
 * autant à vide qu'à plein : la montée en température et les pertes de paroi dominent, la masse
 * des pièces ne pèse que marginalement. Le kWh dépensé est donc quasiment le même quel que soit
 * le remplissage — ce qui change, c'est le nombre de m² sur lesquels on l'étale. D'où le seul
 * chiffre qui pilote : **le coût au m² embarqué**.
 *
 * Règle absolue : aucun euro n'est affiché si `prix_kwh` n'est pas renseigné. Ce projet a déjà
 * été mordu six fois par des réglages affichés sans effet et des chiffres inventés ; un coût
 * calculé sur un prix du kWh à zéro serait un mensonge de plus.
 */

/** En dessous de ce taux de remplissage, la fournée doit sauter aux yeux : on a chauffé du vide. */
export const SEUIL_REMPLISSAGE_ALERTE_PCT = 50;

/** Ce qui manque, et où le renseigner — repris tel quel à l'écran comme dans le PDF. */
export const MESSAGE_PRIX_KWH_MANQUANT =
  "Prix du kWh non renseigné : le coût de cette fournée ne peut pas être chiffré. " +
  "Renseignez-le dans Réglages → Atelier, champ « Prix du kWh (€) » — il figure sur votre " +
  "facture d'électricité.";

export const MESSAGE_CONSO_MANQUANTE =
  "Consommation non relevée sur cette fournée : sans kWh, aucun coût ne peut être calculé.";

/** Ce qui manque pour chiffrer, `null` quand rien ne manque. */
export type ManqueCout = "prix_kwh" | "conso_kwh" | null;

export type CoutFournee = {
  /** conso_kwh × prix_kwh. `null` dès qu'un des deux manque. */
  coutEur: number | null;
  /** Coût rapporté aux m² réellement embarqués — le chiffre de décision. */
  coutM2Eur: number | null;
  /** Ce que le même cycle aurait coûté au m² si le four avait été rempli à sa capacité. */
  coutM2PleinEur: number | null;
  /**
   * Part du coût imputable au vide du four, à consommation égale : `coût × (1 − remplissage)`.
   * C'est une comparaison, pas une mesure — elle repose sur l'hypothèse (vraie sur un four de
   * cuisson à charge) que la consommation ne dépend quasiment pas du remplissage.
   */
  surcoutVideEur: number | null;
  /** m² embarqués dans la fournée (somme des surfaces des projets composés). */
  surfaceM2: number;
  /** Remplissage du four en %, `null` si la capacité n'est pas paramétrée. */
  tauxRemplissagePct: number | null;
  /** `true` quand le four a tourné à moins de la moitié de sa capacité. */
  fourneeCreuse: boolean;
  manque: ManqueCout;
};

function nb(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type EntreesCoutFournee = {
  consoKwh: number | string | null | undefined;
  prixKwh: number | string | null | undefined;
  surfaceM2: number | string | null | undefined;
  capaciteM2?: number | string | null | undefined;
};

/**
 * Chiffre une fournée. Un prix du kWh nul ou négatif est traité comme non renseigné : personne
 * n'achète l'électricité 0 €, et un zéro laissé dans le formulaire produirait un coût de 0 €
 * parfaitement crédible et parfaitement faux.
 */
export function coutFournee({ consoKwh, prixKwh, surfaceM2, capaciteM2 }: EntreesCoutFournee): CoutFournee {
  const conso = nb(consoKwh);
  const prix = nb(prixKwh);
  const surface = round2(Math.max(0, nb(surfaceM2)));
  const capacite = nb(capaciteM2);

  const tauxRemplissagePct = capacite > 0 ? Math.round((surface / capacite) * 100) : null;
  const fourneeCreuse = tauxRemplissagePct != null && tauxRemplissagePct < SEUIL_REMPLISSAGE_ALERTE_PCT;

  const vide: CoutFournee = {
    coutEur: null, coutM2Eur: null, coutM2PleinEur: null, surcoutVideEur: null,
    surfaceM2: surface, tauxRemplissagePct, fourneeCreuse, manque: null,
  };

  // L'ordre compte : le prix du kWh est un réglage que l'atelier peut corriger en dix secondes,
  // la consommation d'une fournée déjà close ne se rattrape pas. On annonce d'abord le réparable.
  if (prix <= 0) return { ...vide, manque: "prix_kwh" };
  if (conso <= 0) return { ...vide, manque: "conso_kwh" };

  const coutEur = round2(conso * prix);
  return {
    ...vide,
    coutEur,
    coutM2Eur: surface > 0 ? coutEur / surface : null,
    coutM2PleinEur: capacite > 0 ? coutEur / capacite : null,
    // Au-delà de 100 % de remplissage il n'y a plus de vide : la valeur est bornée à zéro
    // plutôt que de devenir négative et de se lire comme un gain.
    surcoutVideEur: capacite > 0 ? round2(coutEur * Math.max(0, 1 - surface / capacite)) : null,
    manque: null,
  };
}

/** Somme des m² embarqués dans une fournée, à partir de sa composition. */
export function surfaceEmbarquee(lignes: { surface_m2: number | string | null }[]): number {
  return round2((lignes ?? []).reduce((s, l) => s + nb(l.surface_m2), 0));
}
