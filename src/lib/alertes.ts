/**
 * Réglages d'alerte de l'atelier — la seule définition, côté application.
 *
 * POURQUOI ce fichier existe. `SEUIL_DLU_JOURS = 60` était recopié dans cinq fichiers React
 * (`stock/page.tsx`, `stock/[id]/page.tsx`, `lots/page.tsx`, `lots/[id]/page.tsx`,
 * `dashboard/page.tsx`, plus `PointageBouton.tsx`). Six constantes pour une seule idée : au
 * premier atelier qui aurait demandé quarante-cinq jours, il aurait fallu se souvenir des six.
 * Et le seuil n'était que **visuel** — il ne déclenchait rien, il fallait ouvrir l'écran Stock
 * pour le voir.
 *
 * Depuis le chantier « courriel du matin », le seuil vit dans `public.reglages_alertes`, il est
 * réglable par atelier, et c'est le **même** nombre qui colore les badges à l'écran et qui décide
 * ce que le récapitulatif du matin annonce. Les valeurs ci-dessous ne sont qu'un repli, aligné sur
 * les `default` de la table : elles servent au premier rendu, avant que la base ait répondu.
 */

export type ReglagesAlertes = {
  atelier_id: string;
  /** Le courriel du matin est-il envoyé ? */
  recap_actif: boolean;
  /** Heure locale (Europe/Paris) d'envoi, 0 à 23. */
  recap_heure: number;
  /** Vrai = pas de message le samedi ni le dimanche. */
  recap_jours_ouvres: boolean;
  /** En dessous de ce nombre de jours, un lot de poudre doit être écoulé en priorité. */
  seuil_dlu_jours: number;
  /** Au bout de combien de jours un devis envoyé sans réponse remonte dans le récapitulatif. */
  devis_sans_reponse_jours: number;
  /** Cadence des relances automatiques, en jours, et nombre maximal de relances par document. */
  relance_devis_jours: number;
  relance_facture_jours: number;
  relance_max: number;
  /**
   * Rappel mensuel de pesée de rendement poudre (migration 68) : section du récapitulatif
   * quotidien, coupable indépendamment de `recap_actif` — un atelier peut vouloir garder le
   * courriel du matin mais se passer de ce rappel-là (ou l'inverse n'a pas de sens : couper
   * `recap_actif` coupe tout, cette section comprise).
   */
  rappel_pesee_actif: boolean;
  /** Dernier jour (Europe/Paris) où le rappel a été effectivement montré. `null` = jamais. */
  rappel_pesee_dernier_envoi: string | null;
};

/** Repli aligné sur les `default` de `public.reglages_alertes`. */
export const REGLAGES_ALERTES_DEFAUT: Omit<ReglagesAlertes, "atelier_id"> = {
  recap_actif: true,
  recap_heure: 7,
  recap_jours_ouvres: true,
  seuil_dlu_jours: 60,
  devis_sans_reponse_jours: 7,
  relance_devis_jours: 3,
  relance_facture_jours: 5,
  relance_max: 3,
  rappel_pesee_actif: true,
  rappel_pesee_dernier_envoi: null,
};

/** Le seuil de DLU par défaut, pour les rares écrans qui n'ont pas encore le contexte d'atelier. */
export const SEUIL_DLU_JOURS_DEFAUT = REGLAGES_ALERTES_DEFAUT.seuil_dlu_jours;

/**
 * Nombre de jours avant la DLU. Négatif = lot déjà périmé.
 *
 * `T00:00:00` sans fuseau et `setHours(0,0,0,0)` des deux côtés : sans ça, un lot dont la DLU
 * tombe aujourd'hui affiche « −1 jour » en fin d'après-midi, ce qui a le très mauvais goût d'être
 * faux dans le sens qui coûte de l'argent (on jette un lot encore bon).
 */
// Deux signatures : appelée sur une DLU garantie non nulle (le cas des écrans qui ont déjà filtré
// `not("dlu","is",null)`), elle rend un nombre — sinon les appelants devraient tous écrire un `!`
// non nul de plus, ce qui est exactement le genre de bruit qui finit par masquer un vrai cas nul.
export function joursAvantDlu(dlu: string): number;
export function joursAvantDlu(dlu: string | null | undefined): number | null;
export function joursAvantDlu(dlu: string | null | undefined): number | null {
  if (!dlu) return null;
  return Math.round((new Date(`${dlu}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

/**
 * Date ISO dans N jours, pour borner une requête `lte("dlu", …)`.
 *
 * Le jour est composé chiffre à chiffre, jamais par `toISOString()` : celui-ci rend l'instant en
 * UTC, et minuit local à Paris est 22 h la veille en UTC. La borne partait donc **un jour trop
 * tôt** pour tout le fuseau français — un lot dont la DLU tombe exactement au seuil disparaissait
 * de la liste d'alerte alors que `etatDlu()`, juste à côté, l'affichait en orange. C'est
 * précisément l'incohérence que ce fichier existe pour empêcher.
 */
export function dansNJours(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type EtatDlu = "perime" | "proche" | "ok";

export function etatDlu(dlu: string | null | undefined, seuilJours: number): EtatDlu | null {
  const j = joursAvantDlu(dlu);
  if (j == null) return null;
  if (j < 0) return "perime";
  return j <= seuilJours ? "proche" : "ok";
}

export const CLASSES_DLU: Record<EtatDlu, string> = {
  perime: "bg-danger-light text-danger-dark",
  proche: "bg-warning-light text-warning-dark",
  ok: "bg-success-light text-success-dark",
};

export const TEXTE_DLU: Record<EtatDlu, string> = {
  perime: "text-danger",
  proche: "text-warning-dark",
  ok: "text-gray-400",
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Relances automatiques
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Ce qu'il faut savoir d'un document pour dire quand il sera relancé — et s'il le sera. */
export type DocumentRelancable = {
  /** `envoye_at` pour un devis, `due_date` pour une facture : le point de départ du décompte. */
  depart: string | null;
  derniere_relance_at: string | null;
  relance_count: number;
  relances_actives: boolean;
  /** L'interrupteur de la fiche client — il prime sur celui du document. */
  client_relances_actives?: boolean | null;
  /** Le document est-il encore dans un état qui appelle une relance ? */
  eligible: boolean;
};

export type EtatRelance =
  | { relancera: true; prochaine: string; restantes: number }
  | { relancera: false; motif: "client_coupe" | "document_coupe" | "plafond" | "non_eligible" | "capacite" };

/**
 * Quand partira la prochaine relance, et sinon pourquoi.
 *
 * POURQUOI ici et pas seulement en base : l'atelier doit lire la réponse **sur la fiche**, avant
 * que le message parte, pas la découvrir dans le journal après coup. Les cadences viennent des
 * mêmes colonnes que celles que lit `relancer_devis_et_factures()` — il n'y a pas deux vérités.
 */
export function etatRelance(
  doc: DocumentRelancable,
  cadenceJours: number,
  reglages: Pick<ReglagesAlertes, "relance_max">,
  capaciteOuverte = true,
): EtatRelance {
  if (!capaciteOuverte) return { relancera: false, motif: "capacite" };
  if (doc.client_relances_actives === false) return { relancera: false, motif: "client_coupe" };
  if (!doc.relances_actives) return { relancera: false, motif: "document_coupe" };
  if (!doc.eligible) return { relancera: false, motif: "non_eligible" };
  if (doc.relance_count >= reglages.relance_max) return { relancera: false, motif: "plafond" };

  const base = doc.derniere_relance_at ?? doc.depart;
  if (!base) return { relancera: false, motif: "non_eligible" };
  const d = new Date(base);
  d.setDate(d.getDate() + cadenceJours);
  // Une échéance déjà passée veut dire « au prochain passage du cron », c'est-à-dire demain 7 h.
  const maintenant = new Date();
  if (d.getTime() < maintenant.getTime()) {
    d.setTime(maintenant.getTime());
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
  }
  return {
    relancera: true,
    prochaine: d.toISOString(),
    restantes: reglages.relance_max - doc.relance_count,
  };
}

export const MOTIF_RELANCE: Record<Exclude<EtatRelance, { relancera: true }>["motif"], string> = {
  client_coupe: "Ce client est exclu des relances automatiques (réglage de sa fiche).",
  document_coupe: "Les relances sont coupées sur ce document.",
  plafond: "Le nombre maximal de relances est atteint.",
  non_eligible: "Ce document n'est pas dans un état qui appelle une relance.",
  capacite: "Les relances automatiques ne font pas partie de votre formule.",
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Ce qui est déjà parti : le sort d'une relance envoyée
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Le jour où `relances.notification_id` est apparue. Avant cette date, aucune relance ne porte le
 * lien vers le message envoyé : la colonne n'existait pas.
 *
 * POURQUOI une constante affichée à l'écran. L'écran `/relances` marquait « Trace incomplète » et
 * « destinataire inconnu » sur toutes les lignes antérieures, sans une phrase pour dire ce que
 * l'exploitant devait en faire. Un avertissement qu'on ne sait pas lever inquiète sans servir, et
 * il finit par apprendre à ignorer les avertissements — y compris les vrais. Nommer la date la
 * rend vérifiable : « avant le 20 août, on ne gardait pas ce détail » se comprend et se classe.
 */
export const DEBUT_TRACE_RELANCES = "2026-08-20T00:00:00Z";
export const DEBUT_TRACE_RELANCES_FR = "20 août 2026";

/** Une ligne de la vue `relances_envoyees`, réduite à ce qui décide de son affichage. */
export type RelanceEnvoyee = {
  sent_at: string;
  statut_envoi: string;
  erreur_envoi?: string | null;
  /** L'adresse réellement utilisée à l'envoi. NULL quand le message n'a pas été retrouvé. */
  destinataire: string | null;
  /** Ajoutés par la migration 46 ; absents si la base n'est pas encore à jour. */
  trace_disponible?: boolean | null;
  destinataire_client?: string | null;
};

export type SortRelance = {
  /** Le badge, en trois mots au plus. */
  badge: string;
  ton: "success" | "warning" | "danger" | "neutral";
  /** À qui le message est parti — ou ce qu'on peut en dire honnêtement. */
  destinataire: string;
  /**
   * La phrase à afficher **en clair** sous la ligne. Pas une infobulle : ce qui n'est lisible
   * qu'à la souris n'existe pas au doigt, et c'est précisément au téléphone qu'on ouvre le
   * journal des relances. `null` quand le badge se suffit à lui-même.
   */
  explication: string | null;
};

/**
 * Ce qu'on affiche pour une relance déjà partie : le badge, le destinataire, et — quand il y a
 * lieu — la phrase qui dit ce qui s'est passé et ce qu'il reste à faire.
 *
 * Les deux cas sans trace ne se valent pas, et les confondre serait mentir dans un sens ou dans
 * l'autre :
 *
 *  - **avant le 20/08/2026**, la relance est partie (le compteur du document en fait foi) et le
 *    détail n'était simplement pas conservé. Il n'y a rien à faire, et le dire évite qu'un
 *    exploitant cherche une panne qui n'existe pas ;
 *  - **après**, une relance comptée sans message retrouvé est une anomalie réelle : on ne peut
 *    pas affirmer que le client a reçu quoi que ce soit, et le geste sûr est de lui renvoyer le
 *    document.
 */
export function sortRelance(l: RelanceEnvoyee): SortRelance {
  const traceManquante = l.trace_disponible === false || l.statut_envoi === "inconnu";

  if (!traceManquante) {
    switch (l.statut_envoi) {
      case "sent":
        return { badge: "Envoyée", ton: "success", destinataire: l.destinataire ?? "—", explication: null };
      case "pending":
        return {
          badge: "En file d'envoi",
          ton: "warning",
          destinataire: l.destinataire ?? "—",
          explication: "Le message attend son tour dans la file : il part dans les minutes qui suivent.",
        };
      case "error":
        return {
          badge: "Échec d'envoi",
          ton: "danger",
          destinataire: l.destinataire ?? "—",
          explication:
            "Le message n'a pas pu être remis : de son point de vue, votre client n'a jamais été relancé. Corrigez son adresse sur sa fiche, puis renvoyez-lui le document.",
        };
      case "annulee":
        return {
          badge: "Annulée",
          ton: "neutral",
          destinataire: l.destinataire ?? "—",
          explication: "L'envoi a été arrêté avant de partir : votre client n'a rien reçu.",
        };
    }
  }

  // Sans trace : on ne connaît pas l'adresse de l'époque. Celle de la fiche est proposée pour
  // situer la ligne, jamais présentée comme celle qui a servi — elle a pu changer depuis.
  const destinataire = l.destinataire_client
    ? `${l.destinataire_client} (adresse actuelle du client, pas forcément celle de l'envoi)`
    : "destinataire non conservé";

  if (l.sent_at < DEBUT_TRACE_RELANCES) {
    return {
      badge: "Envoi non tracé",
      ton: "neutral",
      destinataire,
      explication:
        `Cette relance est bien partie — le compteur du document en fait foi — mais Thermogestion ne gardait pas encore le détail de l'envoi avant le ${DEBUT_TRACE_RELANCES_FR}. Vous n'avez rien à faire : les relances postérieures affichent leur destinataire et leur remise.`,
    };
  }

  return {
    badge: "Envoi non tracé",
    ton: "warning",
    destinataire,
    explication:
      "La relance a été comptée sur ce document, mais le message correspondant est introuvable : impossible d'affirmer que votre client l'a reçue. Dans le doute, renvoyez-lui le document depuis sa fiche.",
  };
}
