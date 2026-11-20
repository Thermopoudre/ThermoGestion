/**
 * Le vocabulaire du cabinet : des périodes closes, pas des dates.
 *
 * Un expert-comptable ne demande jamais « du 3 au 27 » : il demande un mois, un trimestre, un
 * exercice. Le produit proposait jusqu'ici deux champs date libres, ce qui obligeait le cabinet à
 * calculer lui-même les bornes — et à se tromper d'un jour un mois sur deux, ce qui déséquilibre
 * la TVA du trimestre. Ces fonctions fabriquent les bornes ; l'écran ne fait que les afficher.
 *
 * Toutes les dates circulent en `AAAA-MM-JJ`, comme en base. Aucune conversion de fuseau : une
 * période comptable est une affaire de calendrier, pas d'horloge.
 */

export type Periode = { debut: string; fin: string; libelle: string };

export const CADENCES = ["aucune", "mensuelle", "trimestrielle"] as const;
export type Cadence = (typeof CADENCES)[number];

export const LIBELLE_CADENCE: Record<Cadence, string> = {
  aucune: "Aucun envoi automatique",
  mensuelle: "Chaque mois, pour le mois précédent",
  trimestrielle: "Chaque trimestre, pour le trimestre précédent",
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function iso(annee: number, moisIndex0: number, jour: number): string {
  return `${annee}-${String(moisIndex0 + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Dernier jour du mois : le 0 du mois suivant, seule formulation qui gère février sans table. */
function dernierJour(annee: number, moisIndex0: number): number {
  return new Date(annee, moisIndex0 + 1, 0).getDate();
}

export function mois(annee: number, moisIndex0: number): Periode {
  return {
    debut: iso(annee, moisIndex0, 1),
    fin: iso(annee, moisIndex0, dernierJour(annee, moisIndex0)),
    libelle: `${MOIS[moisIndex0]} ${annee}`,
  };
}

export function trimestre(annee: number, numero: 1 | 2 | 3 | 4): Periode {
  const premier = (numero - 1) * 3;
  const dernier = premier + 2;
  return {
    debut: iso(annee, premier, 1),
    fin: iso(annee, dernier, dernierJour(annee, dernier)),
    libelle: `T${numero} ${annee}`,
  };
}

export function annee(a: number): Periode {
  return { debut: iso(a, 0, 1), fin: iso(a, 11, 31), libelle: `Exercice ${a}` };
}

/**
 * Les périodes qu'un cabinet réclame réellement, dans l'ordre où il les réclame : le mois qui
 * vient de se clore d'abord, puisque c'est celui qu'on lui doit.
 *
 * Seules les périodes **closes** sont proposées. Le mois en cours n'est pas une période
 * comptable : le journal qu'on en tirerait serait faux dès le lendemain, et le cabinet aurait à
 * le redemander. C'est précisément la friction que ce chantier supprime.
 */
export function periodesProposees(aujourdhui = new Date()): Periode[] {
  const a = aujourdhui.getFullYear();
  const m = aujourdhui.getMonth();

  const liste: Periode[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(a, m - i, 1);
    liste.push(mois(d.getFullYear(), d.getMonth()));
  }

  // Trimestres clos. Le rang est compté en base 0 pour que le passage à l'année précédente se
  // fasse par un simple modulo : en base 1, « le trimestre d'avant » du T3 donnait le T3 lui-même,
  // c'est-à-dire le trimestre en cours — celui que ce sélecteur a précisément pour rôle d'exclure.
  const rangCourant = Math.floor(m / 3);
  for (let i = 1; i <= 4; i++) {
    const rang = rangCourant - i;
    const decalage = Math.floor(rang / 4);
    const numero = ((((rang % 4) + 4) % 4) + 1) as 1 | 2 | 3 | 4;
    liste.push(trimestre(a + decalage, numero));
  }

  liste.push(annee(a - 1));
  return liste;
}

/** La période proposée par défaut : le mois qui vient de se clore. */
export function periodeParDefaut(aujourdhui = new Date()): Periode {
  const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1);
  return mois(d.getFullYear(), d.getMonth());
}

/**
 * Une période libre saisie à la main mérite quand même un nom lisible : c'est ce nom qui sera
 * relu dans « remis le … », des mois plus tard, par quelqu'un qui n'a pas fait l'export.
 */
export function libellePeriode(debut: string, fin: string): string {
  const [ad, md, jd] = debut.split("-").map(Number);
  const [af, mf, jf] = fin.split("-").map(Number);
  const commenceUnMois = jd === 1;
  const finitUnMois = jf === dernierJour(af, mf - 1);

  if (commenceUnMois && finitUnMois && ad === af) {
    if (md === mf) return mois(ad, md - 1).libelle;
    if (md === 1 && mf === 12) return annee(ad).libelle;
    if (md % 3 === 1 && mf === md + 2) return trimestre(ad, (((md - 1) / 3) + 1) as 1 | 2 | 3 | 4).libelle;
  }
  return `du ${jourFr(debut)} au ${jourFr(fin)}`;
}

function jourFr(d: string): string {
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a}`;
}

/** Une facture est-elle soldée ? Le cabinet lit d'abord cette colonne-là. */
export function etatReglement(totalTtc: number, regle: number): "payee" | "partielle" | "attente" {
  if (regle >= totalTtc - 0.01) return "payee";
  return regle > 0 ? "partielle" : "attente";
}

export const LIBELLE_REGLEMENT: Record<ReturnType<typeof etatReglement>, string> = {
  payee: "Réglée",
  partielle: "Partiellement réglée",
  attente: "En attente de règlement",
};

/** Une ligne du journal des ventes, telle que la rend `journal_ventes()` en base. */
export type LigneJournal = {
  id: string;
  numero: string | null;
  type: "acompte" | "solde" | "libre" | "avoir";
  status: string;
  emise_at: string | null;
  due_date: string | null;
  total_ht: number | string;
  total_tva: number | string;
  total_ttc: number | string;
  nature_operation: "biens" | "services" | "mixte";
  items: { total_ht: number | string; tva: number | string }[];
  client: {
    id: string | null;
    nom: string | null;
    siren: string | null;
    siret: string | null;
    tva_intra: string | null;
    adresse: string | null;
    code_postal: string | null;
    ville: string | null;
    pays: string | null;
    email: string | null;
  } | null;
  paiements: { montant: number | string; moyen: string; paye_at: string }[];
  regle_ttc: number | string;
};

/** Une remise déjà faite au cabinet, telle que la garde `exports_comptables`. */
export type RemiseComptable = {
  id: string;
  periode_debut: string;
  periode_fin: string;
  format: "csv" | "fec";
  remis_at: string;
  role_demandeur: string | null;
  automatique: boolean;
  nb_factures: number;
  total_ht: number | string;
};
