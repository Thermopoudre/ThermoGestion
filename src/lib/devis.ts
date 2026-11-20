/**
 * La durée de validité d'un devis, côté application.
 *
 * **La base fait foi.** `public.devis_echeance()` et `public.devis_perime()` sont les seules
 * règles qui comptent : elles refusent la signature d'un devis périmé même si la page publique
 * est contournée, et le cron `expirer-devis` s'appuie sur elles. Ce fichier n'existe que pour
 * afficher la même chose que la base — annoncer une date au client, griser un bouton — et il
 * doit rester son miroir exact.
 *
 * Fuseau : Europe/Paris, comme en base. Un devis finalisé à 00 h 30 à Bandol est enregistré la
 * veille en UTC ; compter en UTC lui ferait perdre une journée de validité. Les ateliers sont
 * français, la validité se compte en jours calendaires français.
 */

/** Valeur retenue quand l'atelier n'a rien paramétré. Miroir du `coalesce(..., 30)` en base. */
export const VALIDITE_DEVIS_DEFAUT = 30;

/** Bornes acceptées par `devis_validite_jours_check` et `ateliers_devis_validite_jours_check`. */
export const VALIDITE_DEVIS_MIN = 1;
export const VALIDITE_DEVIS_MAX = 365;

/** Ce dont on a besoin pour dater un devis — pas le devis entier, pour rester appelable partout. */
export type DevisDatable = {
  envoye_at?: string | null;
  created_at: string;
  validite_jours?: number | null;
};

/** Jour civil parisien d'un instant, au format `YYYY-MM-DD` — l'ordre lexicographique y est chronologique. */
function jourParis(instant: Date): string {
  // `fr-CA` rend précisément `YYYY-MM-DD`, ce que ne fait aucune locale française.
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(instant);
}

/**
 * Dernier jour où le devis peut être signé, au format `YYYY-MM-DD`.
 *
 * POURQUOI `envoye_at` avant `created_at` : `created_at` est la date de saisie du brouillon,
 * `envoye_at` la date à laquelle le devis est parti chez le client — c'est elle qui fait courir
 * la validité. La distinction devient décisive dès qu'un devis est rouvert : `rouvrir_devis`
 * remet `envoye_at` à NULL, la refinalisation en pose un nouveau, et la validité repart de zéro.
 */
export function echeanceDevis(devis: DevisDatable): string {
  const depart = jourParis(new Date(devis.envoye_at ?? devis.created_at));
  const jours = devis.validite_jours ?? VALIDITE_DEVIS_DEFAUT;
  // Arithmétique en UTC sur une date nue : pas d'heure, donc pas de saut d'heure d'été.
  const d = new Date(`${depart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/**
 * La même échéance, sous une forme que `dateFr` et `dateL` affichent sans décalage.
 *
 * POURQUOI midi : `new Date("2026-09-05")` est interprété à minuit **UTC**, puis affiché dans le
 * fuseau du navigateur. Un client qui ouvre son devis depuis un fuseau à l'ouest verrait la
 * veille. Midi met deux journées entières de marge de chaque côté.
 */
export function echeanceDevisAffichable(devis: DevisDatable): string {
  return `${echeanceDevis(devis)}T12:00:00`;
}

/**
 * Vrai si la durée de validité est dépassée.
 *
 * Le jour de l'échéance, le devis est **encore** signable : la comparaison est stricte, comme
 * en base. Un client qui ouvre son devis le trentième jour au matin ne doit pas trouver porte
 * close alors que le document lui annonce trente jours.
 */
export function devisPerime(devis: DevisDatable, maintenant: Date = new Date()): boolean {
  return echeanceDevis(devis) < jourParis(maintenant);
}

/**
 * Vrai si c'est **la validité** qui empêche de signer.
 *
 * On ne se contente ni du statut ni du calcul de date, parce que les deux disent une moitié de
 * la vérité : le cron `expirer-devis` ne passe qu'une fois par jour, donc un devis peut être
 * périmé en portant encore « envoyé » ; et un devis refusé ou remplacé n'est pas signable non
 * plus, mais pour une autre raison — lui annoncer « validité dépassée » serait un mensonge.
 */
export function bloqueParLaValidite(
  devis: DevisDatable & { status?: string | null },
  maintenant: Date = new Date(),
): boolean {
  if (devis.status === "expire") return true;
  return devis.status === "envoye" && devisPerime(devis, maintenant);
}

/** Jours restants avant l'échéance : 0 le dernier jour, négatif au-delà. */
export function joursRestantsDevis(devis: DevisDatable, maintenant: Date = new Date()): number {
  const fin = new Date(`${echeanceDevis(devis)}T00:00:00Z`).getTime();
  const jour = new Date(`${jourParis(maintenant)}T00:00:00Z`).getTime();
  return Math.round((fin - jour) / 86400000);
}
