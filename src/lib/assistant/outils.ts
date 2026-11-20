import type { SupabaseClient } from "@supabase/supabase-js";
import { LIGNES_DETAILLEES, LIGNES_MAX } from "@/lib/assistant/config";
import {
  ajouterJours, debutDeJourParis, estJour, joursEntre, jourParis,
  periodePrecedente, type Jour,
} from "@/lib/assistant/dates";
import { REGLAGES_ALERTES_DEFAUT } from "@/lib/alertes";
import { devisPerime } from "@/lib/devis";
import type { PerimetreOutil, ResultatOutil, SourceAssistant } from "@/lib/assistant/types";

/**
 * Les outils de l'assistant : la seule porte entre le modèle et la base.
 *
 * ─── LA RÈGLE QUI GOUVERNE TOUT CE FICHIER ───────────────────────────────────────────────────
 *
 * Aucun outil ne prend d'`atelier_id`, aucun ne construit de SQL, aucun n'écrit. Chaque outil
 * reçoit le client Supabase **porteur de la session de l'utilisateur** et pose une requête
 * PostgREST fixe, écrite ici, en dur. Le cloisonnement n'est donc pas une consigne donnée au
 * modèle — il est en RLS, table par table, comme pour n'importe quel écran :
 *
 *   • `devis`, `factures`, `paiements` portent la policy `commercial_all`, qui exige
 *     `acces_commercial()` en plus de `atelier_id = current_atelier_id()`. Un opérateur d'atelier
 *     qui demanderait « quelle est ma marge » obtiendrait zéro ligne, comme sur l'écran ;
 *   • le `deleted_at is null` de la corbeille est dans la policy elle-même : l'outil n'a pas à y
 *     penser, et ne peut pas l'oublier.
 *
 * Le modèle ne voit jamais autre chose que le JSON rendu par `executer()`.
 *
 * ─── ET CE QUE ÇA N'EMPÊCHE PAS ──────────────────────────────────────────────────────────────
 *
 * Zéro ligne rendue à un opérateur, c'est vrai au sens de la base et trompeur au sens de la
 * phrase : « vous n'avez aucune facture échue » est faux, il n'a simplement pas le droit de le
 * savoir. C'est pourquoi chaque outil déclare un `perimetre`, et pourquoi la liste envoyée au
 * modèle est filtrée AVANT l'appel : un opérateur ne se voit pas proposer l'outil, et l'assistant
 * lui dit que la question relève du bureau. Les deux verrous se complètent, aucun ne remplace
 * l'autre.
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Socle
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Ce dont un outil a besoin. `maintenant` est injecté pour que les tests soient déterministes. */
export type ContexteOutil = {
  sb: SupabaseClient;
  maintenant: Date;
};

export type OutilAssistant = {
  nom: string;
  /** La description lue par le modèle : elle doit dire ce que l'outil compte, pas comment. */
  description: string;
  /** Schéma JSON des paramètres, au format attendu par l'API Messages. */
  parametres: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  perimetre: PerimetreOutil;
  executer: (ctx: ContexteOutil, args: Record<string, unknown>) => Promise<ResultatOutil>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Somme d'une colonne numérique rendue par PostgREST, qui la sérialise parfois en texte. */
function somme(lignes: { valeur: number | string | null | undefined }[]): number {
  return round2(lignes.reduce((s, l) => s + (Number(l.valeur) || 0), 0));
}

function echec(outil: string, refus: ResultatOutil["refus"], message: string): ResultatOutil {
  return {
    outil, parametres: {}, definition: "", donnees: {}, sources: [],
    tronque: false, refus, message,
  };
}

/**
 * Le seuil « devis sans réponse » de l'atelier.
 *
 * POURQUOI on va le chercher au lieu de coder sept jours : c'est le même nombre qui décide de ce
 * que le courriel du matin annonce (`reglages_alertes.devis_sans_reponse_jours`, cf.
 * `recap_quotidien_payload`). Si l'assistant en retenait un autre, l'exploitant lirait deux
 * chiffres différents le même matin pour la même question — et cesserait de croire les deux.
 */
async function seuilDevisAtelier(sb: SupabaseClient): Promise<number> {
  const { data } = await sb.rpc("mes_reglages_alertes");
  const n = Number((data as { devis_sans_reponse_jours?: number } | null)?.devis_sans_reponse_jours);
  return Number.isFinite(n) && n > 0 ? n : REGLAGES_ALERTES_DEFAUT.devis_sans_reponse_jours;
}

/** Un entier de paramètre, borné. Rend `null` si le modèle a écrit n'importe quoi. */
function entier(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= min && i <= max ? i : null;
}

/** Forme minimale des lignes rendues par PostgREST. Les embeds arrivent en objet ou en tableau. */
type LigneClient = { nom?: string | null } | { nom?: string | null }[] | null;
function nomClient(c: LigneClient): string {
  const o = Array.isArray(c) ? c[0] : c;
  return o?.nom ?? "Client inconnu";
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 1 — les devis envoyés restés sans réponse
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LigneDevis = {
  id: string;
  numero: string | null;
  total_ttc: number | string | null;
  envoye_at: string | null;
  created_at: string;
  validite_jours: number | null;
  relance_count: number | null;
  clients: LigneClient;
};

export const devisSansReponse: OutilAssistant = {
  nom: "devis_sans_reponse",
  description:
    "Liste les devis ENVOYÉS au client et restés sans réponse depuis au moins N jours. " +
    "Un devis signé, refusé, expiré ou encore en brouillon n'y figure pas. " +
    "Sans paramètre, le seuil est celui réglé par l'atelier pour son courriel du matin. " +
    "Répond aux questions du genre « quels devis n'ont pas de réponse depuis dix jours », " +
    "« qu'est-ce que je dois relancer », « combien j'ai de devis en attente ».",
  parametres: {
    type: "object",
    properties: {
      jours: {
        type: "integer",
        description:
          "Ancienneté minimale, en jours, depuis l'envoi du devis. Ne le renseigne que si " +
          "l'exploitant a donné un nombre de jours dans sa question.",
        minimum: 1,
        maximum: 730,
      },
    },
    additionalProperties: false,
  },
  perimetre: "commercial",

  async executer({ sb, maintenant }, args) {
    const demande = args.jours === undefined ? null : entier(args.jours, 1, 730);
    if (args.jours !== undefined && demande === null) {
      return echec("devis_sans_reponse", "parametres_invalides",
        "Le nombre de jours doit être un entier compris entre 1 et 730.");
    }
    const jours = demande ?? (await seuilDevisAtelier(sb));
    const borne = new Date(maintenant.getTime() - jours * 86_400_000).toISOString();

    // `clients!inner` : une jointure interne, pour aligner l'outil sur le courriel du matin, qui
    // écarte les devis dont le client est à la corbeille (`c.deleted_at is null`). Sans elle, on
    // annoncerait des devis rattachés à « Client inconnu », que l'exploitant ne peut pas relancer.
    const { data, error, count } = await sb
      .from("devis")
      .select("id, numero, total_ttc, envoye_at, created_at, validite_jours, relance_count, clients!inner(nom)", { count: "exact" })
      .eq("status", "envoye")
      .not("envoye_at", "is", null)
      .lte("envoye_at", borne)
      .order("envoye_at", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("devis_sans_reponse", "erreur_base",
        `La base n'a pas répondu : ${error.message}`);
    }

    const brut = (data ?? []) as LigneDevis[];
    // Un devis resté au statut « envoyé » alors que sa durée de validité est dépassée (le cron
    // `expirer_devis` n'est pas encore passé, ou l'a sauté pour un atelier en lecture seule, cf.
    // migration 45 §4) n'est plus un devis qu'on relance par un simple e-mail : il ne peut plus
    // être signé (`DEVIS_EXPIRE`). Cette définition existe déjà (`devisPerime`, src/lib/devis.ts,
    // miroir de `devis_perime()` en base) : on la réutilise, on n'en invente pas une seconde —
    // c'est exactement ce que promet déjà la `description` de cet outil (« non expirés »).
    const lignes = brut.filter((l) => !devisPerime(l));
    const exclusParExpiration = brut.length - lignes.length;
    // `count` porte le total exact de la requête brute (sans le filtre d'expiration, que PostgREST
    // ne sait pas appliquer côté serveur ici) ; `tronque` reste calculé sur ce total brut, comme
    // avant — le plafond `LIGNES_MAX` a pu couper le fetch avant même que le filtre d'expiration ne
    // s'applique. Au-delà du plafond, on ne connaît pas le statut d'expiration des lignes non
    // chargées : on ne corrige que ce qu'on a vu, plutôt que de deviner (200 devis sans réponse
    // simultanés dépasse de toute façon l'échelle d'une TPE de 1 à 10 personnes).
    const totalBrut = count ?? brut.length;
    const tronque = totalBrut > brut.length;
    const total = totalBrut - exclusParExpiration;
    const montant = somme(lignes.map((l) => ({ valeur: l.total_ttc })));
    const aujourdhui = jourParis(maintenant);

    const sources: SourceAssistant[] = lignes.slice(0, LIGNES_DETAILLEES).map((l) => {
      const attente = l.envoye_at ? joursEntre(jourParis(new Date(l.envoye_at)), aujourdhui) : null;
      return {
        type: "devis",
        id: l.id,
        libelle: `${l.numero ?? "Devis sans numéro"} · ${nomClient(l.clients)}`,
        montant: round2(Number(l.total_ttc) || 0),
        detail: attente === null
          ? null
          : `envoyé il y a ${attente} jour${attente > 1 ? "s" : ""}` +
            (l.relance_count ? `, ${l.relance_count} relance${l.relance_count > 1 ? "s" : ""} déjà partie${l.relance_count > 1 ? "s" : ""}` : ", jamais relancé"),
      };
    });

    return {
      outil: "devis_sans_reponse",
      parametres: { jours, seuil_venu_des_reglages: demande === null },
      definition:
        `Devis au statut « envoyé », envoyés il y a ${jours} jours ou plus, non signés, ` +
        "non refusés, non expirés, hors corbeille. Montants en euros TTC.",
      donnees: {
        nombre: total,
        montant_ttc_cumule: montant,
        // Explicite : sans ce drapeau, un modèle présenterait la somme de 200 lignes comme le
        // total de 400 devis. Le chiffre serait vrai et la phrase fausse.
        montant_porte_sur_toutes_les_lignes: !tronque,
        plus_ancien_jours: lignes[0]?.envoye_at
          ? joursEntre(jourParis(new Date(lignes[0].envoye_at)), aujourdhui)
          : null,
      },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 2 — les factures échues et non réglées
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LignePaiement = { montant: number | string | null };
type LigneFacture = {
  id: string;
  numero: string | null;
  total_ttc: number | string | null;
  due_date: string | null;
  relance_count: number | null;
  clients: LigneClient;
  paiements: LignePaiement[] | null;
};

export const facturesEchues: OutilAssistant = {
  nom: "factures_echues",
  description:
    "Liste les factures émises dont la date d'échéance est passée et qu'il reste à encaisser, " +
    "avec le RESTE DÛ (montant de la facture moins les règlements déjà reçus). " +
    "Répond à « qui me doit de l'argent », « quels impayés », « combien on me doit ».",
  parametres: {
    type: "object",
    properties: {
      jours_de_retard_min: {
        type: "integer",
        description:
          "Ne garder que les factures échues depuis au moins ce nombre de jours. Par défaut 1, " +
          "c'est-à-dire toute facture dont l'échéance est passée.",
        minimum: 1,
        maximum: 3650,
      },
    },
    additionalProperties: false,
  },
  perimetre: "commercial",

  async executer({ sb, maintenant }, args) {
    const demande = args.jours_de_retard_min === undefined
      ? 1
      : entier(args.jours_de_retard_min, 1, 3650);
    if (demande === null) {
      return echec("factures_echues", "parametres_invalides",
        "Le retard minimal doit être un entier compris entre 1 et 3650 jours.");
    }
    const aujourdhui = jourParis(maintenant);
    const borne = ajouterJours(aujourdhui, -demande + 1); // échéance strictement antérieure à cette date

    // `status = 'emise'` seulement : une facture soldée passe à « payée », un brouillon n'engage
    // rien, une facture annulée n'a rien produit. Les avoirs, eux, n'ont jamais de `due_date`
    // (cf. `avoir_depuis_facture()` en base) : le filtre sur la date les écarte de lui-même — ce
    // qui est heureux, un avoir n'est pas une créance mais une dette envers le client.
    const { data, error } = await sb
      .from("factures")
      .select("id, numero, total_ttc, due_date, relance_count, clients!inner(nom), paiements(montant)")
      .eq("status", "emise")
      .not("due_date", "is", null)
      .lt("due_date", borne)
      .order("due_date", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("factures_echues", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }

    const brutes = (data ?? []) as LigneFacture[];
    // Le reste dû se calcule ici parce que PostgREST ne sait pas filtrer sur une somme d'enfants.
    // Le seuil d'un centime reprend celui de `recap_quotidien_payload` : une facture réglée à
    // l'arrondi près n'est pas un impayé, et l'annoncer ferait relancer un client à tort.
    const impayees = brutes
      .map((f) => {
        const regle = somme((f.paiements ?? []).map((p) => ({ valeur: p.montant })));
        return { f, reste: round2((Number(f.total_ttc) || 0) - regle), regle };
      })
      .filter((x) => x.reste > 0.01);

    const tronque = brutes.length >= LIGNES_MAX;

    const sources: SourceAssistant[] = impayees.slice(0, LIGNES_DETAILLEES).map(({ f, reste, regle }) => {
      const retard = f.due_date ? joursEntre(f.due_date, aujourdhui) : null;
      return {
        type: "facture",
        id: f.id,
        libelle: `${f.numero ?? "Facture sans numéro"} · ${nomClient(f.clients)}`,
        montant: reste,
        detail:
          (retard === null ? "échéance inconnue" : `échue depuis ${retard} jour${retard > 1 ? "s" : ""}`) +
          (regle > 0 ? `, déjà réglée à hauteur de ${round2(regle)} €` : "") +
          (f.relance_count ? `, ${f.relance_count} relance${f.relance_count > 1 ? "s" : ""} partie${f.relance_count > 1 ? "s" : ""}` : ""),
      };
    });

    return {
      outil: "factures_echues",
      parametres: { jours_de_retard_min: demande },
      definition:
        "Factures au statut « émise » dont l'échéance est dépassée et dont il reste plus d'un " +
        "centime à encaisser. Le montant annoncé est le RESTE DÛ, pas le total de la facture : " +
        "une facture réglée à moitié ne compte que pour sa moitié. Avoirs exclus.",
      donnees: {
        nombre: impayees.length,
        reste_du_total: somme(impayees.map((x) => ({ valeur: x.reste }))),
        plus_ancienne_jours: impayees[0]?.f.due_date
          ? joursEntre(impayees[0].f.due_date, aujourdhui)
          : null,
        montant_porte_sur_toutes_les_lignes: !tronque,
      },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 3 — le chiffre d'affaires facturé sur une période
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LignePaiementCa = { montant: number | string | null };
type LigneCa = {
  type: string | null;
  status: string | null;
  total_ht: number | string | null;
  total_ttc: number | string | null;
  emise_at: string | null;
  paiements: LignePaiementCa[] | null;
};

/** Plafond propre au CA : une période longue porte plus de pièces qu'une liste de relance. */
const LIGNES_MAX_CA = 2000;

type TotauxCa = {
  ventes_ht: number; avoirs_ht: number; ca_ht: number;
  ca_ttc: number; nb_factures: number; nb_avoirs: number; tronque: boolean;
  /** F5 — reste dû sur les ventes de la période (pas les avoirs, qui ne sont pas des créances). */
  reste_du: number;
};

async function totauxPeriode(sb: SupabaseClient, debut: Jour, fin: Jour): Promise<TotauxCa | { erreur: string }> {
  const { data, error } = await sb
    .from("factures")
    .select("type, status, total_ht, total_ttc, emise_at, paiements(montant)")
    // Émises ET payées : le chiffre d'affaires est une créance, pas un encaissement. Une facture
    // émise le 31 août et réglée en octobre est du chiffre d'août — c'est la règle comptable, et
    // c'est celle que l'expert-comptable retrouvera dans le FEC.
    .in("status", ["emise", "payee"])
    .not("emise_at", "is", null)
    .gte("emise_at", debutDeJourParis(debut))
    .lt("emise_at", debutDeJourParis(ajouterJours(fin, 1)))
    .limit(LIGNES_MAX_CA);

  if (error) return { erreur: error.message };
  const lignes = (data ?? []) as LigneCa[];

  // LE PIÈGE DE CE FICHIER. `avoir_depuis_facture()` enregistre un avoir avec des totaux
  // POSITIFS ; c'est l'export comptable qui l'écrit en sens inverse (`src/lib/compta/export.ts`).
  // Un `sum(total_ht)` naïf AJOUTERAIT donc les avoirs au chiffre d'affaires : un atelier qui a
  // dû créditer 4 000 € verrait son mois grossir de 8 000 € par rapport à la réalité. On les
  // sépare et on les retranche.
  const ventes = lignes.filter((l) => l.type !== "avoir");
  const avoirs = lignes.filter((l) => l.type === "avoir");

  const ventes_ht = somme(ventes.map((l) => ({ valeur: l.total_ht })));
  const avoirs_ht = somme(avoirs.map((l) => ({ valeur: l.total_ht })));
  const ventes_ttc = somme(ventes.map((l) => ({ valeur: l.total_ttc })));
  const avoirs_ttc = somme(avoirs.map((l) => ({ valeur: l.total_ttc })));

  // F5 — le reste dû de la période : les ventes de la période dont le montant réglé (tous
  // paiements confondus) n'atteint pas le total TTC. Une facture « payée » vaut 0 ici par
  // construction ; ça n'a donc rien d'un doublon de `factures_echues`, qui lui ne regarde que les
  // échéances DÉPASSÉES, tous mois confondus — celui-ci regarde une période et ignore l'échéance.
  const reste_du = round2(
    ventes.reduce((s, l) => {
      const regle = somme((l.paiements ?? []).map((p) => ({ valeur: p.montant })));
      return s + Math.max(0, round2((Number(l.total_ttc) || 0) - regle));
    }, 0),
  );

  return {
    ventes_ht,
    avoirs_ht,
    ca_ht: round2(ventes_ht - avoirs_ht),
    ca_ttc: round2(ventes_ttc - avoirs_ttc),
    nb_factures: ventes.length,
    nb_avoirs: avoirs.length,
    tronque: lignes.length >= LIGNES_MAX_CA,
    reste_du,
  };
}

export const chiffreAffairesPeriode: OutilAssistant = {
  nom: "chiffre_affaires_periode",
  description:
    "Chiffre d'affaires FACTURÉ sur une période : total HT des factures émises ou payées, " +
    "avoirs déduits. Ce n'est pas de l'encaissé. " +
    "Peut comparer à la période précédente (mois civil précédent si la période est un mois entier). " +
    "Répond à « combien j'ai facturé en août », « août par rapport à juillet », « mon CA du trimestre ».",
  parametres: {
    type: "object",
    properties: {
      debut: { type: "string", description: "Premier jour de la période, au format AAAA-MM-JJ, inclus." },
      fin: { type: "string", description: "Dernier jour de la période, au format AAAA-MM-JJ, inclus." },
      comparer: {
        type: "boolean",
        description: "Vrai pour calculer aussi la période précédente et l'écart. Par défaut faux.",
      },
    },
    required: ["debut", "fin"],
    additionalProperties: false,
  },
  perimetre: "commercial",

  async executer({ sb, maintenant }, args) {
    const { debut, fin } = args as { debut?: unknown; fin?: unknown };
    if (!estJour(debut) || !estJour(fin)) {
      return echec("chiffre_affaires_periode", "parametres_invalides",
        "Les bornes doivent être deux dates au format AAAA-MM-JJ.");
    }
    if (joursEntre(debut, fin) < 0) {
      return echec("chiffre_affaires_periode", "parametres_invalides",
        "La date de début est postérieure à la date de fin.");
    }
    if (joursEntre(debut, fin) > 1100) {
      return echec("chiffre_affaires_periode", "parametres_invalides",
        "La période dépasse trois ans : demandez à l'exploitant de la resserrer.");
    }

    const p = await totauxPeriode(sb, debut, fin);
    if ("erreur" in p) {
      return echec("chiffre_affaires_periode", "erreur_base", `La base n'a pas répondu : ${p.erreur}`);
    }

    const donnees: Record<string, unknown> = {
      periode: { debut, fin },
      ca_ht: p.ca_ht,
      ca_ttc: p.ca_ttc,
      ventes_ht: p.ventes_ht,
      avoirs_ht_deduits: p.avoirs_ht,
      nombre_factures: p.nb_factures,
      nombre_avoirs: p.nb_avoirs,
      // F5 — le reste dû de la période : ce qui reste à encaisser sur les ventes ÉMISES pendant
      // cette période précise, indépendamment de leur échéance. Une facture de la période qui n'est
      // pas encore échue mais pas encore payée y figure ; `factures_echues` ne la verrait pas.
      reste_du_periode: p.reste_du,
      // Vrai tant que la date de fin n'est pas passée. Une période en cours ne se compare pas à un
      // mois complet sans que la phrase le dise : « septembre est en retrait sur août » est faux
      // le 3 septembre, et c'est le genre d'affirmation qui fait douter un patron de ses chiffres.
      periode_en_cours: joursEntre(jourParis(maintenant), fin) >= 0,
    };

    if (args.comparer === true) {
      const prec = periodePrecedente(debut, fin);
      const q = await totauxPeriode(sb, prec.debut, prec.fin);
      if ("erreur" in q) {
        return echec("chiffre_affaires_periode", "erreur_base", `La base n'a pas répondu : ${q.erreur}`);
      }
      donnees.comparaison = {
        periode: prec,
        ca_ht: q.ca_ht,
        nombre_factures: q.nb_factures,
        ecart_eur: round2(p.ca_ht - q.ca_ht),
        // Pas de pourcentage sur une base nulle : « +∞ % » n'a jamais aidé personne.
        ecart_pct: q.ca_ht === 0 ? null : Math.round(((p.ca_ht - q.ca_ht) / Math.abs(q.ca_ht)) * 1000) / 10,
      };
    }

    return {
      outil: "chiffre_affaires_periode",
      parametres: { debut, fin, comparer: args.comparer === true },
      definition:
        "Total HT des factures émises ou payées dont la date d'émission tombe dans la période " +
        "(bornes incluses, heure de Paris), diminué des avoirs de la même période. " +
        "C'est du FACTURÉ, pas de l'ENCAISSÉ : une facture émise et non réglée y figure. " +
        "« reste_du_periode » est ce qui, sur cette même période, n'a pas encore été réglé — " +
        "les avoirs n'y comptent pas, ils ne sont pas des créances.",
      donnees,
      // Pas de source unitaire : un total de période ne s'ouvre pas facture par facture. Le
      // renvoi vers l'écran des factures est proposé en action par l'orchestration.
      sources: [],
      tronque: p.tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Petites aides communes aux neuf outils qui suivent (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** L'embed PostgREST d'une relation « inverse » rend tantôt un objet, tantôt un tableau, tantôt
 * rien. Une seule fonction pour les trois cas, plutôt que de la répéter à chaque outil. */
function versTableau<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 4 — le point du jour (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type ProjetRecap = { id: string; numero: string | null; nom: string | null; client: string | null };
type ProjetRecapRetard = ProjetRecap & { jours: number | null };
type PoudreRecap = { id: string; libelle: string; stock_kg: number | null; seuil_kg: number | null };
type LotRecap = { id: string; libelle: string; jours: number | null; restant_kg: number | null };
type DevisRecap = { id: string; numero: string | null; client: string | null; total_ttc: number | null; jours: number | null };
type FactureRecap = { id: string; numero: string | null; client: string | null; reste: number | null; jours: number | null };

type RecapPayload = {
  vide: boolean;
  commercial: boolean;
  production: { a_sortir: ProjetRecap[]; a_sortir_total: number; en_retard: ProjetRecapRetard[]; en_retard_total: number };
  risques: { poudres: PoudreRecap[]; lots: LotRecap[] };
  argent: {
    devis: { nb: number; total: number; plus_ancien_jours: number; liste: DevisRecap[] };
    factures: { nb: number; total: number; liste: FactureRecap[] };
  };
  action: { titre: string; detail: string; url: string } | null;
};

export const journeeDuMatin: OutilAssistant = {
  nom: "journee_du_matin",
  description:
    "Le point du jour : chantiers à sortir aujourd'hui, retards sur date promise, poudres sous " +
    "leur seuil, lots proches de leur DLU, et — pour le bureau uniquement — devis sans réponse et " +
    "factures échues, avec leurs totaux. C'est EXACTEMENT le même calcul que le courriel du matin " +
    "de l'atelier. Répond à « qu'est-ce que je dois faire aujourd'hui », « quoi de neuf », " +
    "« fais-moi le point ».",
  parametres: { type: "object", properties: {}, additionalProperties: false },
  perimetre: "production",

  async executer({ sb }) {
    const { data, error } = await sb.rpc("mon_recap_quotidien");
    if (error) {
      return echec("journee_du_matin", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }
    if (!data) {
      return echec("journee_du_matin", "hors_perimetre", "Aucun atelier n'est associé à cette session.");
    }
    const p = data as RecapPayload;

    const sources: SourceAssistant[] = [
      ...p.production.en_retard.slice(0, 5).map((x): SourceAssistant => ({
        type: "projet", id: x.id,
        libelle: `${x.numero ?? x.nom ?? "Chantier"} · ${x.client ?? "Client inconnu"}`,
        detail: x.jours != null ? `date promise dépassée de ${x.jours} jour${x.jours > 1 ? "s" : ""}` : null,
      })),
      ...(p.commercial ? p.argent.factures.liste.slice(0, 5).map((x): SourceAssistant => ({
        type: "facture", id: x.id,
        libelle: `${x.numero ?? "Facture"} · ${x.client ?? "Client inconnu"}`,
        montant: x.reste != null ? round2(x.reste) : null,
        detail: x.jours != null ? `échue depuis ${x.jours} jour${x.jours > 1 ? "s" : ""}` : null,
      })) : []),
      ...(p.commercial ? p.argent.devis.liste.slice(0, 5).map((x): SourceAssistant => ({
        type: "devis", id: x.id,
        libelle: `${x.numero ?? "Devis"} · ${x.client ?? "Client inconnu"}`,
        montant: x.total_ttc != null ? round2(x.total_ttc) : null,
        detail: x.jours != null ? `envoyé il y a ${x.jours} jour${x.jours > 1 ? "s" : ""}` : null,
      })) : []),
      ...p.production.a_sortir.slice(0, 5).map((x): SourceAssistant => ({
        type: "projet", id: x.id,
        libelle: `${x.numero ?? x.nom ?? "Chantier"} · ${x.client ?? "Client inconnu"}`,
        detail: "à sortir aujourd'hui",
      })),
      ...p.risques.poudres.slice(0, 5).map((x): SourceAssistant => ({
        type: "poudre", id: x.id, libelle: x.libelle,
        detail: `${x.stock_kg ?? 0} kg restants, seuil ${x.seuil_kg ?? 0} kg`,
      })),
      ...p.risques.lots.slice(0, 5).map((x): SourceAssistant => ({
        type: "lot", id: x.id, libelle: x.libelle,
        detail: x.jours != null ? `DLU dans ${x.jours} jour${Math.abs(x.jours) > 1 ? "s" : ""}` : null,
      })),
    ];

    return {
      outil: "journee_du_matin",
      parametres: {},
      definition:
        "Même calcul que le courriel du matin de l'atelier : chantiers à sortir aujourd'hui, " +
        "retards sur date promise, poudres sous seuil, lots proches de leur DLU, et si le rôle est " +
        "commercial, devis sans réponse et factures échues avec leurs totaux exacts.",
      donnees: {
        vide: p.vide,
        chantiers_a_sortir: p.production.a_sortir_total,
        chantiers_en_retard: p.production.en_retard_total,
        poudres_sous_seuil: p.risques.poudres.length,
        lots_proches_dlu: p.risques.lots.length,
        action_prioritaire: p.action,
        ...(p.commercial ? {
          devis_sans_reponse: { nombre: p.argent.devis.nb, montant_ttc_cumule: round2(p.argent.devis.total) },
          factures_echues: { nombre: p.argent.factures.nb, reste_du_total: round2(p.argent.factures.total) },
        } : {}),
        // Les totaux (`nb`, `total`) sont calculés en base AVANT que les listes détaillées ne
        // soient plafonnées à dix lignes chacune : ils sont donc toujours exacts.
        montant_porte_sur_toutes_les_lignes: true,
      },
      sources,
      tronque: false,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 5 — les devis signés pas encore lancés en production (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LigneDevisSigne = {
  id: string; numero: string | null; total_ttc: number | string | null; signed_at: string | null;
  clients: LigneClient;
  projets: { status: string | null } | { status: string | null }[] | null;
};

export const devisSignesNonProduits: OutilAssistant = {
  nom: "devis_signes_non_produits",
  description:
    "Liste les devis SIGNÉS par le client dont le chantier n'existe pas encore, ou existe mais " +
    "est resté au statut « en attente » (pas encore lancé en production). Répond à « quels devis " +
    "signés ne sont pas encore lancés », « qu'est-ce qui doit démarrer en atelier ».",
  parametres: { type: "object", properties: {}, additionalProperties: false },
  perimetre: "commercial",

  async executer({ sb }) {
    const { data, error, count } = await sb
      .from("devis")
      .select("id, numero, total_ttc, signed_at, clients!inner(nom), projets(status)", { count: "exact" })
      .eq("status", "signe")
      .order("signed_at", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("devis_signes_non_produits", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }

    const lignes = (data ?? []) as LigneDevisSigne[];
    // Un devis signé sans chantier lié, ou dont le chantier est encore « en attente », n'est pas
    // lancé. Un chantier « en_cours », « pret », « livre » ou « annule » l'est déjà (ou ne compte
    // plus) : on ne le remonte pas, même si son devis d'origine est resté au statut « signé ».
    const nonLances = lignes.filter((l) => {
      const projets = versTableau(l.projets);
      return projets.length === 0 || projets.every((p) => p.status === "en_attente");
    });

    // La fenêtre de lecture porte sur les 200 devis signés les plus anciens en premier : si
    // l'atelier en a davantage, certains devis non lancés peuvent rester hors champ.
    const totalSigne = count ?? lignes.length;
    const tronque = totalSigne > lignes.length;
    const montant = somme(nonLances.map((l) => ({ valeur: l.total_ttc })));

    const sources: SourceAssistant[] = nonLances.slice(0, LIGNES_DETAILLEES).map((l) => ({
      type: "devis",
      id: l.id,
      libelle: `${l.numero ?? "Devis sans numéro"} · ${nomClient(l.clients)}`,
      montant: round2(Number(l.total_ttc) || 0),
      detail: versTableau(l.projets).length === 0 ? "aucun chantier créé" : "chantier en attente",
    }));

    return {
      outil: "devis_signes_non_produits",
      parametres: {},
      definition:
        "Devis au statut « signé » dont le chantier lié n'existe pas encore, ou est resté au " +
        "statut « en attente ». Montants en euros TTC.",
      donnees: {
        nombre: nonLances.length,
        montant_ttc_cumule: montant,
        montant_porte_sur_toutes_les_lignes: !tronque,
      },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 6 — les chantiers prêts, pas encore livrés (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LigneProjetPret = {
  id: string; numero: string | null; nom: string | null; date_promise: string | null;
  clients: LigneClient;
  bons_livraison: { status: string | null } | { status: string | null }[] | null;
};

export const piecesPretesNonLivrees: OutilAssistant = {
  nom: "pieces_pretes_non_livrees",
  description:
    "Liste les chantiers au statut « prêt » (cuits, contrôlés) pour lesquels aucun bon de " +
    "livraison n'a encore été signé ou facturé. Répond à « quels chantiers sont prêts mais pas " +
    "livrés », « qu'est-ce qui attend en sortie d'atelier ».",
  parametres: { type: "object", properties: {}, additionalProperties: false },
  perimetre: "production",

  async executer({ sb, maintenant }) {
    const { data, error, count } = await sb
      .from("projets")
      .select("id, numero, nom, date_promise, clients!inner(nom), bons_livraison(status)", { count: "exact" })
      .eq("status", "pret")
      .order("date_promise", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("pieces_pretes_non_livrees", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }

    const lignes = (data ?? []) as LigneProjetPret[];
    const nonLivres = lignes.filter((l) =>
      !versTableau(l.bons_livraison).some((b) => b.status === "livre" || b.status === "facture"));

    const total = count ?? lignes.length;
    const tronque = total > lignes.length;
    const aujourdhui = jourParis(maintenant);

    const sources: SourceAssistant[] = nonLivres.slice(0, LIGNES_DETAILLEES).map((l) => ({
      type: "projet",
      id: l.id,
      libelle: `${l.numero ?? l.nom ?? "Chantier"} · ${nomClient(l.clients)}`,
      detail: l.date_promise
        ? `date promise ${joursEntre(aujourdhui, jourParis(new Date(`${l.date_promise}T00:00:00Z`))) < 0 ? "dépassée" : "le " + l.date_promise}`
        : "pas de date promise",
    }));

    return {
      outil: "pieces_pretes_non_livrees",
      parametres: {},
      definition:
        "Chantiers au statut « prêt », hors corbeille, pour lesquels aucun bon de livraison " +
        "n'est encore au statut « livré » ni « facturé ».",
      donnees: { nombre: nonLivres.length, montant_porte_sur_toutes_les_lignes: !tronque },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 7 — l'agenda des dates promises (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LigneAgenda = {
  id: string; numero: string | null; nom: string | null; date_promise: string | null;
  clients: LigneClient;
};

export const agendaDatesPromises: OutilAssistant = {
  nom: "agenda_dates_promises",
  description:
    "Liste les chantiers en cours (non livrés, non annulés) qui ont une date promise dépassée ou " +
    "à venir dans les prochains jours. Répond à « quelles sont mes dates promises cette semaine », " +
    "« qu'est-ce qui est en retard », « mon agenda de livraison ».",
  parametres: {
    type: "object",
    properties: {
      horizon_jours: {
        type: "integer",
        description: "Nombre de jours à venir à inclure, en plus des retards. Par défaut 14.",
        minimum: 1,
        maximum: 90,
      },
    },
    additionalProperties: false,
  },
  perimetre: "production",

  async executer({ sb, maintenant }, args) {
    const demande = args.horizon_jours === undefined ? null : entier(args.horizon_jours, 1, 90);
    if (args.horizon_jours !== undefined && demande === null) {
      return echec("agenda_dates_promises", "parametres_invalides",
        "L'horizon doit être un entier compris entre 1 et 90 jours.");
    }
    const horizon = demande ?? 14;
    const aujourdhui = jourParis(maintenant);
    const borneHaute = ajouterJours(aujourdhui, horizon);

    const { data, error, count } = await sb
      .from("projets")
      .select("id, numero, nom, date_promise, clients!inner(nom)", { count: "exact" })
      .in("status", ["en_attente", "en_cours", "pret"])
      .not("date_promise", "is", null)
      .lte("date_promise", borneHaute)
      .order("date_promise", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("agenda_dates_promises", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }

    const lignes = (data ?? []) as LigneAgenda[];
    const total = count ?? lignes.length;
    const tronque = total > lignes.length;
    const enRetard = lignes.filter((l) => l.date_promise !== null && l.date_promise < aujourdhui).length;

    const sources: SourceAssistant[] = lignes.slice(0, LIGNES_DETAILLEES).map((l) => {
      const jours = l.date_promise ? joursEntre(aujourdhui, l.date_promise) : null;
      return {
        type: "projet",
        id: l.id,
        libelle: `${l.numero ?? l.nom ?? "Chantier"} · ${nomClient(l.clients)}`,
        detail: jours === null
          ? null
          : jours < 0 ? `en retard de ${-jours} jour${-jours > 1 ? "s" : ""}` : `dans ${jours} jour${jours > 1 ? "s" : ""}`,
      };
    });

    return {
      outil: "agenda_dates_promises",
      parametres: { horizon_jours: horizon },
      definition:
        `Chantiers non livrés et non annulés dont la date promise est passée, ou tombe dans les ` +
        `${horizon} prochains jours (bornes incluses, heure de Paris).`,
      donnees: {
        nombre: lignes.length,
        en_retard: enRetard,
        a_venir: lignes.length - enRetard,
        montant_porte_sur_toutes_les_lignes: !tronque,
      },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 8 — les clients sans nouvelle (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Un plafond propre : on ne lit que l'identifiant, la date et le nom, pas les pièces entières. */
const LIGNES_MAX_DORMANTS = 1000;

type LigneActivite = { client_id: string | null; created_at: string | null; clients: LigneClient };

export const clientsDormants: OutilAssistant = {
  nom: "clients_dormants",
  description:
    "Liste les clients qui ont déjà eu au moins un devis ou une facture par le passé, mais aucun " +
    "devis ni facture créé depuis au moins N jours. Ne compte pas les prospects jamais devisés. " +
    "Répond à « quels clients n'ont plus de nouvelle », « qui n'a rien commandé récemment ».",
  parametres: {
    type: "object",
    properties: {
      jours: {
        type: "integer",
        description: "Ancienneté minimale, en jours, depuis le dernier devis ou la dernière facture. Par défaut 60.",
        minimum: 30,
        maximum: 730,
      },
    },
    additionalProperties: false,
  },
  perimetre: "commercial",

  async executer({ sb, maintenant }, args) {
    const demande = args.jours === undefined ? null : entier(args.jours, 30, 730);
    if (args.jours !== undefined && demande === null) {
      return echec("clients_dormants", "parametres_invalides",
        "Le nombre de jours doit être un entier compris entre 30 et 730.");
    }
    const jours = demande ?? 60;
    const borne = new Date(maintenant.getTime() - jours * 86_400_000).toISOString();

    const [devisR, facturesR] = await Promise.all([
      sb.from("devis").select("client_id, created_at, clients!inner(nom)", { count: "exact" })
        .order("created_at", { ascending: false }).limit(LIGNES_MAX_DORMANTS),
      sb.from("factures").select("client_id, created_at, clients!inner(nom)", { count: "exact" })
        .order("created_at", { ascending: false }).limit(LIGNES_MAX_DORMANTS),
    ]);
    if (devisR.error) {
      return echec("clients_dormants", "erreur_base", `La base n'a pas répondu : ${devisR.error.message}`);
    }
    if (facturesR.error) {
      return echec("clients_dormants", "erreur_base", `La base n'a pas répondu : ${facturesR.error.message}`);
    }

    const lignes = [
      ...((devisR.data ?? []) as LigneActivite[]),
      ...((facturesR.data ?? []) as LigneActivite[]),
    ];

    const dernier = new Map<string, { nom: string; derniere: string }>();
    for (const l of lignes) {
      if (!l.client_id || !l.created_at) continue;
      const nom = nomClient(l.clients);
      const existant = dernier.get(l.client_id);
      if (!existant || l.created_at > existant.derniere) dernier.set(l.client_id, { nom, derniere: l.created_at });
    }

    const dormants = [...dernier.entries()]
      .filter(([, v]) => v.derniere < borne)
      .sort((a, b) => (a[1].derniere < b[1].derniere ? -1 : 1));

    // Si l'une des deux fenêtres de lecture est saturée, un client resté actif au-delà d'elle
    // peut manquer à l'appel (il resterait daté sur sa dernière ligne VUE, donc paraîtrait plus
    // dormant qu'il ne l'est).
    const tronque =
      (devisR.count ?? devisR.data?.length ?? 0) >= LIGNES_MAX_DORMANTS ||
      (facturesR.count ?? facturesR.data?.length ?? 0) >= LIGNES_MAX_DORMANTS;

    const sources: SourceAssistant[] = dormants.slice(0, LIGNES_DETAILLEES).map(([id, v]) => ({
      type: "client",
      id,
      libelle: v.nom,
      detail: `dernière activité il y a ${joursEntre(jourParis(new Date(v.derniere)), jourParis(maintenant))} jours`,
    }));

    return {
      outil: "clients_dormants",
      parametres: { jours },
      definition:
        `Clients ayant eu au moins un devis ou une facture par le passé, sans aucun devis ni ` +
        `facture créé depuis ${jours} jours ou plus. Un client jamais devisé n'y figure pas : ce ` +
        "n'est pas un client dormant, c'est un prospect.",
      donnees: { nombre: dormants.length, montant_porte_sur_toutes_les_lignes: !tronque },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 9 — les poudres sous leur seuil (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LignePoudreSeuil = {
  id: string; marque: string | null; reference: string | null; ral: string | null;
  stock_kg: number | string | null; seuil_alerte_kg: number | string | null;
};

export const stockSousSeuil: OutilAssistant = {
  nom: "stock_sous_seuil",
  description:
    "Liste les poudres actives dont le stock est descendu à ou sous leur seuil d'alerte. Une " +
    "poudre sans seuil réglé n'y figure jamais — ni en manque ni à l'abri, elle est simplement " +
    "hors surveillance. Répond à « quelles poudres sont sous leur seuil », « qu'est-ce qu'il faut " +
    "recommander ».",
  parametres: { type: "object", properties: {}, additionalProperties: false },
  perimetre: "production",

  async executer({ sb }) {
    // PostgREST ne compare pas deux colonnes entre elles dans un filtre : le tri « stock ≤ seuil »
    // se fait ici, sur les poudres actives dont un seuil est réglé.
    const { data, error, count } = await sb
      .from("poudres")
      .select("id, marque, reference, ral, stock_kg, seuil_alerte_kg", { count: "exact" })
      .eq("actif", true)
      .not("seuil_alerte_kg", "is", null)
      .gt("seuil_alerte_kg", 0)
      .order("stock_kg", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("stock_sous_seuil", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }

    const lignes = (data ?? []) as LignePoudreSeuil[];
    const sousSeuil = lignes.filter((l) => (Number(l.stock_kg) || 0) <= (Number(l.seuil_alerte_kg) || 0));
    const total = count ?? lignes.length;
    // La fenêtre de lecture porte sur TOUTES les poudres à seuil réglé (elle n'est pas filtrée en
    // base) : si l'atelier en a plus que le plafond, certaines peuvent rester hors champ.
    const tronque = total > lignes.length;

    const sources: SourceAssistant[] = sousSeuil.slice(0, LIGNES_DETAILLEES).map((l) => ({
      type: "poudre",
      id: l.id,
      libelle: `${[l.marque, l.reference].filter(Boolean).join(" ")}${l.ral ? ` (RAL ${l.ral})` : ""}` || "Poudre",
      detail: `${Number(l.stock_kg) || 0} kg restants, seuil ${Number(l.seuil_alerte_kg) || 0} kg`,
    }));

    return {
      outil: "stock_sous_seuil",
      parametres: {},
      definition:
        "Poudres actives, avec un seuil d'alerte réglé et supérieur à zéro, dont le stock est " +
        "descendu à ou sous ce seuil.",
      donnees: { nombre: sousSeuil.length, montant_porte_sur_toutes_les_lignes: !tronque },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outils 10 et 11 — la rentabilité, verrouillée à la formule (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Test EXPLICITE de la capacité, avant même d'interroger la vue.
 *
 * POURQUOI : `client_rentabilite` et `projet_revient` sont déjà filtrées par
 * `capacite_ouverte(atelier, 'rentabilite')` dans leur propre définition (RLS + `WHERE` de la vue).
 * Un atelier qui n'a pas la capacité obtiendrait donc zéro ligne — exactement la même réponse
 * qu'un atelier qui l'a mais n'a produit aucune marge. Sans ce test, l'assistant dirait « aucun
 * client » à un atelier en formule Atelier alors que la vraie réponse est « cet écran ne fait pas
 * partie de votre formule ».
 */
async function verifierCapaciteRentabilite(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.rpc("ma_capacite", { p_capacite: "rentabilite" });
  return data === true;
}

const REFUS_RENTABILITE =
  "La rentabilité par client ou par chantier n'est pas ouverte dans la formule de cet atelier. " +
  "Elle est disponible à partir de la formule Équipe — voir /reglages → Abonnement.";

type LigneClientRentabilite = {
  client_id: string; nom: string; facture_ht: number | string | null;
  revient_total: number | string | null; marge_eur: number | string | null;
  marge_pct: number | string | null; perte_reelle: boolean | null;
};

export const rentabiliteClient: OutilAssistant = {
  nom: "rentabilite_client",
  description:
    "Classe les clients par marge réelle : chiffre d'affaires facturé HT moins prix de revient " +
    "réel (poudre au prix du lot, main d'œuvre chronométrée, quote-part d'énergie, coût des " +
    "retouches). Réservé aux formules qui ouvrent la rentabilité. Répond à « quels sont mes " +
    "clients les moins rentables », « qui me coûte de l'argent ».",
  parametres: { type: "object", properties: {}, additionalProperties: false },
  perimetre: "commercial",

  async executer({ sb }) {
    if (!(await verifierCapaciteRentabilite(sb))) {
      return echec("rentabilite_client", "hors_perimetre", REFUS_RENTABILITE);
    }
    const { data, error } = await sb
      .from("client_rentabilite")
      .select("client_id, nom, facture_ht, revient_total, marge_eur, marge_pct, perte_reelle")
      .order("marge_eur", { ascending: true })
      .limit(LIGNES_MAX);

    if (error) {
      return echec("rentabilite_client", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }
    const lignes = (data ?? []) as LigneClientRentabilite[];
    const tronque = lignes.length >= LIGNES_MAX;
    const enPerte = lignes.filter((l) => l.perte_reelle).length;

    const sources: SourceAssistant[] = lignes.slice(0, LIGNES_DETAILLEES).map((l) => ({
      type: "client",
      id: l.client_id,
      libelle: l.nom,
      montant: round2(Number(l.marge_eur) || 0),
      detail: l.perte_reelle
        ? "en perte réelle"
        : l.marge_pct != null ? `marge de ${round2(Number(l.marge_pct))} %` : null,
    }));

    return {
      outil: "rentabilite_client",
      parametres: {},
      definition:
        "Marge réelle par client : facturé HT moins prix de revient (poudre, main d'œuvre, " +
        "énergie, non-qualité), sur toute la production disponible. Une marge négative peut " +
        "signifier du travail livré pas encore facturé, pas nécessairement une perte : seul « en " +
        "perte réelle » est une vraie perte (tout est facturé, et le facturé est sous le revient).",
      donnees: { nombre: lignes.length, clients_en_perte_reelle: enPerte, montant_porte_sur_toutes_les_lignes: !tronque },
      sources,
      tronque,
    };
  },
};

type LigneProjetPourRecherche = { id: string; numero: string | null; nom: string | null; client_id: string | null; clients: LigneClient };
type LigneProjetRevient = { projet_id: string; cout_poudre: number | string | null; cout_main_oeuvre: number | string | null; cout_energie: number | string | null; revient_total: number | string | null };
type LigneProjetTemps = { projet_id: string; minutes_totales: number | string | null };

export const rentabiliteProjet: OutilAssistant = {
  nom: "rentabilite_projet",
  description:
    "Le prix de revient réel d'UN chantier précis, cherché par numéro ou par nom : coût de " +
    "poudre, coût de main d'œuvre (au temps réellement pointé), quote-part d'énergie, et le total. " +
    "Réservé aux formules qui ouvrent la rentabilité. Répond à « combien m'a coûté le chantier " +
    "DV-2026-0031 », « le prix de revient de la Golf de Durand ».",
  parametres: {
    type: "object",
    properties: {
      projet: {
        type: "string",
        description: "Le numéro ou le nom du chantier, tel que l'exploitant l'a formulé.",
      },
    },
    required: ["projet"],
    additionalProperties: false,
  },
  perimetre: "commercial",

  async executer({ sb }, args) {
    const motif = typeof args.projet === "string" ? args.projet.trim() : "";
    if (motif.length < 2) {
      return echec("rentabilite_projet", "parametres_invalides",
        "Indiquez au moins deux caractères du numéro ou du nom du chantier.");
    }
    if (!(await verifierCapaciteRentabilite(sb))) {
      return echec("rentabilite_projet", "hors_perimetre", REFUS_RENTABILITE);
    }

    // Échappe le caractère qui casserait la syntaxe `or=` de PostgREST : une virgule dans le motif
    // couperait le filtre en deux. Les jokers `%`/`_` de l'utilisateur sont pris tels quels — ce
    // n'est pas une recherche exacte, c'est un « contient ».
    const motifSql = motif.replace(/,/g, " ");
    const { data, error } = await sb
      .from("projets")
      .select("id, numero, nom, client_id, clients!inner(nom)")
      .or(`numero.ilike.%${motifSql}%,nom.ilike.%${motifSql}%`)
      .limit(5);

    if (error) {
      return echec("rentabilite_projet", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }
    const projets = (data ?? []) as LigneProjetPourRecherche[];
    if (projets.length === 0) {
      return echec("rentabilite_projet", "parametres_invalides", `Aucun chantier ne correspond à « ${motif} ».`);
    }

    const ids = projets.map((p) => p.id);
    const [revientR, tempsR] = await Promise.all([
      sb.from("projet_revient").select("projet_id, cout_poudre, cout_main_oeuvre, cout_energie, revient_total").in("projet_id", ids),
      sb.from("projet_temps_cout").select("projet_id, minutes_totales").in("projet_id", ids),
    ]);
    if (revientR.error) {
      return echec("rentabilite_projet", "erreur_base", `La base n'a pas répondu : ${revientR.error.message}`);
    }
    const revientParId = new Map((revientR.data as LigneProjetRevient[] ?? []).map((r) => [r.projet_id, r]));
    const tempsParId = new Map((tempsR.data as LigneProjetTemps[] ?? []).map((r) => [r.projet_id, r]));

    const sources: SourceAssistant[] = projets.map((p) => {
      const r = revientParId.get(p.id);
      return {
        type: "projet",
        id: p.id,
        libelle: `${p.numero ?? p.nom ?? "Chantier"} · ${nomClient(p.clients)}`,
        montant: r ? round2(Number(r.revient_total) || 0) : null,
        detail: r ? "prix de revient" : "prix de revient non encore calculé",
      };
    });

    return {
      outil: "rentabilite_projet",
      parametres: { projet: motif },
      definition:
        "Prix de revient réel d'un chantier : coût de poudre au prix du lot consommé, coût de " +
        "main d'œuvre au temps réellement pointé, quote-part d'énergie du four. Absent si la " +
        "production n'est pas encore terminée ou pas encore pointée.",
      donnees: {
        resultats: projets.map((p) => {
          const r = revientParId.get(p.id);
          const t = tempsParId.get(p.id);
          return {
            id: p.id,
            numero: p.numero,
            client: nomClient(p.clients),
            cout_poudre: r ? round2(Number(r.cout_poudre) || 0) : null,
            cout_main_oeuvre: r ? round2(Number(r.cout_main_oeuvre) || 0) : null,
            cout_energie: r ? round2(Number(r.cout_energie) || 0) : null,
            revient_total: r ? round2(Number(r.revient_total) || 0) : null,
            minutes_pointees: t ? Number(t.minutes_totales) || 0 : null,
          };
        }),
        // La recherche est bornée à 5 chantiers correspondants : au-delà, on ne les a pas vus.
        montant_porte_sur_toutes_les_lignes: projets.length < 5,
      },
      sources,
      tronque: projets.length >= 5,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Outil 12 — la recherche dans les fiches (F1)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type LigneRecherche = {
  type: SourceAssistant["type"]; id: string; titre: string; sous_titre: string | null;
  date: string | null; montant: number | string | null;
};

export const rechercheFiche: OutilAssistant = {
  nom: "recherche_fiche",
  description:
    "Cherche une fiche précise par nom, numéro, plaque d'immatriculation, référence de poudre, " +
    "etc. — la MÊME recherche que la barre ⌘K de l'écran. À utiliser quand l'exploitant nomme une " +
    "pièce ou un client précis plutôt que de poser une question de liste : « ouvre-moi le devis " +
    "DV-2026-0031 », « la fiche de Métallerie du Sud », « la poudre RAL 9010 ».",
  parametres: {
    type: "object",
    properties: {
      q: {
        type: "string",
        description: "Le motif tapé par l'exploitant : nom, numéro, plaque, référence…",
      },
    },
    required: ["q"],
    additionalProperties: false,
  },
  perimetre: "production",

  async executer({ sb }, args) {
    const q = typeof args.q === "string" ? args.q.trim() : "";
    if (q.length < 2) {
      return echec("recherche_fiche", "parametres_invalides", "Tapez au moins deux caractères.");
    }
    const { data, error } = await sb.rpc("recherche_globale", { q, limite: 10 });
    if (error) {
      return echec("recherche_fiche", "erreur_base", `La base n'a pas répondu : ${error.message}`);
    }
    const lignes = (data ?? []) as LigneRecherche[];
    const tronque = lignes.length >= 10;

    const sources: SourceAssistant[] = lignes.map((l) => ({
      type: l.type,
      id: l.id,
      libelle: l.titre,
      montant: l.montant != null ? round2(Number(l.montant)) : null,
      detail: l.sous_titre,
    }));

    return {
      outil: "recherche_fiche",
      parametres: { q },
      definition:
        "Résultats de la recherche globale de l'atelier (clients, devis, factures, chantiers, " +
        "bons de livraison, réceptions, jeux de jantes, poudres, lots), triés par pertinence. " +
        "Ce n'est pas un décompte : une recherche ne rend jamais un total.",
      donnees: { nombre: sources.length, montant_porte_sur_toutes_les_lignes: !tronque },
      sources,
      tronque,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Le catalogue. C'est cette liste — et rien d'autre — que le modèle est autorisé à appeler. */
export const OUTILS: OutilAssistant[] = [
  devisSansReponse, facturesEchues, chiffreAffairesPeriode,
  journeeDuMatin, devisSignesNonProduits, piecesPretesNonLivrees, agendaDatesPromises,
  clientsDormants, stockSousSeuil, rentabiliteClient, rentabiliteProjet, rechercheFiche,
];

/**
 * Les outils ouverts à un rôle.
 *
 * Le filtrage est fait AVANT l'appel au modèle : un opérateur d'atelier ne reçoit tout simplement
 * pas la définition des outils commerciaux, donc il ne peut pas les nommer, donc il n'y a pas de
 * consigne à contourner. La RLS reste le verrou — celui-ci n'est là que pour que la réponse soit
 * honnête (« cette question relève du bureau ») plutôt que trompeuse (« vous n'avez rien »).
 */
export function outilsPourRole(role: string | null | undefined): OutilAssistant[] {
  const commercial = role === "owner" || role === "bureau";
  return OUTILS.filter((o) => o.perimetre === "production" || commercial);
}
