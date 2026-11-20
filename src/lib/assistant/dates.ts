/**
 * Les dates de l'assistant, en heure de Paris — et rien d'autre.
 *
 * POURQUOI ce fichier existe, et pourquoi il est testé avant le reste.
 *
 * Toutes les bornes de période de Thermogestion sont exprimées à Paris : `recap_quotidien_payload`
 * ouvre son jour sur `(now() at time zone 'Europe/Paris')::date`, et `src/lib/alertes.ts` a déjà
 * dû corriger un `toISOString()` qui faisait partir une borne **un jour trop tôt** pour tout le
 * fuseau français. Le même piège est mortel ici, et pire : une question comme « combien j'ai
 * facturé en août ? » se traduit par deux bornes `timestamptz`. Si le 1er août démarre à 22 h le
 * 31 juillet UTC, deux heures de facturation de juillet entrent dans le chiffre d'août et le
 * patron lit un total qu'il ne retrouvera nulle part.
 *
 * On n'ajoute pas de bibliothèque pour ça : `Intl` connaît déjà les règles d'été européennes, et
 * une dépendance de fuseau horaire est exactement le genre de chose qui se périme sans bruit.
 */

/** Un jour civil, « AAAA-MM-JJ ». Le type ne le prouve pas, {@link estJour} le vérifie. */
export type Jour = string;

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function estJour(v: unknown): v is Jour {
  if (typeof v !== "string" || !FORMAT_JOUR.test(v)) return false;
  // « 2026-02-31 » passe la regex : on vérifie que la date se relit à l'identique.
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Décalage d'Europe/Paris par rapport à UTC, en millisecondes, à l'instant `d`.
 *
 * Le format `sv-SE` est retenu parce qu'il rend « AAAA-MM-JJ HH:MM:SS », c'est-à-dire de l'ISO
 * sans le fuseau : il se relit avec `Date.parse` sans table de correspondance des mois.
 */
export function decalageParisMs(d: Date): number {
  const lu = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(d);
  return Date.parse(`${lu.replace(" ", "T")}Z`) - d.getTime();
}

/** Le jour civil, à Paris, de l'instant donné. C'est « aujourd'hui » pour tout l'assistant. */
export function jourParis(d: Date = new Date()): Jour {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/**
 * L'instant UTC qui, lu à Paris, vaut `jour` à minuit. C'est la borne basse d'une période.
 *
 * Deux passes : la première approxime le décalage avec l'heure UTC, la seconde le recalcule à
 * l'instant trouvé. Une seule suffirait presque toujours ; elle se tromperait d'une heure les
 * deux nuits de changement d'heure de l'année, et une erreur qui ne survient que deux fois par an
 * est celle qu'on ne diagnostique jamais.
 */
export function debutDeJourParis(jour: Jour): string {
  const naif = Date.parse(`${jour}T00:00:00Z`);
  let t = naif;
  for (let i = 0; i < 2; i++) t = naif - decalageParisMs(new Date(t));
  return new Date(t).toISOString();
}

/**
 * Borne HAUTE d'une période, **exclue** : le début du lendemain de `jour`.
 *
 * Volontairement exclusive plutôt que « 23:59:59.999 » : une facture émise à 23 h 59 min 59 s et
 * 700 ms le dernier jour du mois appartient à ce mois, et un `lte` sur une seconde ronde la perd.
 */
export function finDeJourParis(jour: Jour): string {
  return debutDeJourParis(ajouterJours(jour, 1));
}

/** `jour` décalé de `n` jours (négatif accepté). Arithmétique en UTC : pas de saut d'heure d'été. */
export function ajouterJours(jour: Jour, n: number): Jour {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours pleins de `depuis` à `jusqu_a`. Positif quand `jusqu_a` est postérieur. */
export function joursEntre(depuis: Jour, jusqu_a: Jour): number {
  return Math.round(
    (Date.parse(`${jusqu_a}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / 86_400_000,
  );
}

/** Le premier et le dernier jour du mois civil auquel `jour` appartient. */
export function moisDe(jour: Jour): { debut: Jour; fin: Jour } {
  const debut = `${jour.slice(0, 7)}-01`;
  const d = new Date(`${debut}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { debut, fin: ajouterJours(d.toISOString().slice(0, 10), -1) };
}

/** Vrai si la période couvre exactement un mois civil, du 1er au dernier jour. */
export function estMoisEntier(debut: Jour, fin: Jour): boolean {
  const m = moisDe(debut);
  return m.debut === debut && m.fin === fin;
}

/**
 * La période à laquelle comparer.
 *
 * POURQUOI ce n'est pas un simple décalage de N jours. « Combien j'ai facturé en août par rapport
 * à juillet ? » : août fait 31 jours, un décalage de 31 jours en arrière commence le 1er juillet
 * et finit le 31 — par chance. En février, le même calcul comparerait février à un « mois »
 * commençant le 1er février moins 28 jours, soit le 4 janvier, et le patron comparerait son mois
 * à un morceau de deux mois sans que rien ne le lui dise. Quand la période est un mois civil, on
 * compare au mois civil précédent ; sinon seulement, on décale de la durée exacte.
 */
export function periodePrecedente(debut: Jour, fin: Jour): { debut: Jour; fin: Jour } {
  if (estMoisEntier(debut, fin)) {
    return moisDe(ajouterJours(debut, -1));
  }
  const duree = joursEntre(debut, fin) + 1;
  return { debut: ajouterJours(debut, -duree), fin: ajouterJours(debut, -1) };
}
