/**
 * Les quatre rôles — le vocabulaire du métier, pas celui de la base.
 *
 * Ce fichier ne protège rien : la protection est en RLS, table par table, colonne sortie par
 * colonne sortie. Ce qui est ici sert à deux choses seulement — dire à l'exploitant, en une
 * phrase, ce que chaque rôle voit au moment où il invite quelqu'un, et éviter d'afficher une
 * rubrique sur laquelle la base répondra « zéro ligne ».
 *
 * La règle qui gouverne le découpage : **l'argent d'un côté, la production de l'autre.** Ce qui
 * révèle une marge, un prix d'achat ou un chiffre d'affaires appartient au bureau ; ce qui fait
 * avancer une pièce dans l'atelier appartient à tout le monde.
 *
 * Le quatrième rôle, `comptable`, ne se range dans aucune des deux colonnes : il n'appartient pas
 * à l'entreprise. C'est un cabinet extérieur, qui vient chercher des pièces comptables et rien
 * d'autre, et qui n'écrit jamais. En base il est traité à l'envers des trois autres :
 * `current_atelier_id()` ne lui rend rien, donc toutes les policies existantes le refusent par
 * défaut, et une poignée de fonctions nommément ouvertes lui rendent ce à quoi il a droit.
 */

export const ROLES = ["owner", "bureau", "atelier", "comptable"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Les rôles qu'un atelier attribue à ses propres salariés — donc les seuls qu'on puisse
 * CHANGER après coup depuis la fiche d'un membre. Un comptable qu'on ferait passer « bureau »
 * par cette liste perdrait son accès sans qu'on l'ait voulu : pour changer, on retire et on
 * réinvite.
 */
export const ROLES_INTERNES = ["owner", "bureau", "atelier"] as const;

/**
 * Les rôles proposés au moment d'INVITER, cabinet compris.
 *
 * Le comptable y figure en dernier et il est le seul à ne pas être un salarié. Il a longtemps
 * été absent de cette liste, au motif qu'on « ouvre un accès » plutôt qu'on ne « donne un rôle » ;
 * la conséquence à l'écran a été qu'un exploitant cherchant à faire entrer son cabinet ouvrait le
 * sélecteur, comptait trois lignes, et en concluait que le produit ne savait pas le faire.
 * Le hors-barème reste vrai en base — `trg_limite_utilisateurs` compte le comptable sur
 * `plafond_comptables()` et jamais sur les sièges — il n'a simplement plus à se deviner.
 */
export const ROLES_INVITABLES = [...ROLES_INTERNES, "comptable"] as const;

/**
 * Accès comptables gratuits par atelier, miroir de `plafond_comptables()` en base — qui est la
 * seule règle qui compte. Deux : l'expert et le collaborateur qui saisit, la composition
 * ordinaire d'un dossier en cabinet.
 */
export const ACCES_COMPTABLES_INCLUS = 2;

export function estRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * Une phrase par rôle, écrite pour être lue par un patron d'atelier de quatre personnes au
 * moment où il coche une case qui lui coûte 5 € HT par mois. Pas de jargon, pas de « permissions
 * étendues » : ce que la personne verra, et ce qu'elle ne verra pas.
 */
export const LIBELLE_ROLE: Record<Role, { titre: string; phrase: string }> = {
  owner: {
    titre: "Responsable",
    phrase:
      "Voit et fait tout, y compris l'abonnement, les coordonnées bancaires et la composition de l'équipe.",
  },
  bureau: {
    titre: "Bureau",
    phrase:
      "Devis, factures, clients, tarifs et rentabilité — tout le commercial, sans l'abonnement ni l'IBAN.",
  },
  atelier: {
    titre: "Atelier",
    phrase:
      "Production seule : pointage, étapes, contrôles, réceptions, fournées, scan et stock. Aucune marge, aucun prix d'achat, aucun tarif modifiable.",
  },
  // Chaque morceau de cette phrase a été relu dans la base avant d'être écrit, parce qu'une
  // promesse d'accès qui déborde de ce que la RLS ouvre vraiment est un engagement qu'on ne
  // tient pas. Ce que le cabinet obtient, nommément : `journal_ventes()` — factures ÉMISES ou
  // PAYÉES de la période, avoirs compris, avec leurs lignes, le client (nom, SIREN, SIRET, TVA
  // intracommunautaire, adresse), les règlements et le reste dû ; `entete_comptable()` — nom,
  // SIREN, SIRET et ville de l'atelier ; `exports_comptables` et `reglages_comptable` en
  // LECTURE. Rien d'autre : `current_atelier_id()` lui rend NULL, ce qui fait refuser par
  // défaut toutes les autres politiques. Ni brouillon de facture, ni pièce mise à la corbeille.
  // La seule écriture qu'il produise est la trace de ses propres téléchargements
  // (`tracer_export_comptable()`), qui ne touche aucune donnée de l'atelier.
  comptable: {
    // Le titre reste court : il sert aussi d'étiquette dans le journal des modifications et sur
    // la fiche d'un membre, où « (cabinet extérieur) » ferait déborder la ligne. C'est la phrase
    // qui porte la nuance.
    titre: "Expert-comptable",
    phrase:
      "Vos factures émises et payées de la période, avoirs compris, avec les règlements et le FEC ou le CSV à télécharger — en lecture seule. Il ne voit ni vos devis, ni vos projets, ni votre production, ni vos marges, ni vos prix d'achat, ni votre IBAN, ni vos factures en brouillon. Accès gratuit, il ne consomme aucun siège.",
  },
};

/** Les rôles qui voient l'argent : marges, prix d'achat, devis, factures, grilles modifiables. */
export function accesCommercial(role: Role | null | undefined): boolean {
  return role === "owner" || role === "bureau";
}

export function estProprietaire(role: Role | null | undefined): boolean {
  return role === "owner";
}

/** Le cabinet extérieur : il regarde la comptabilité de l'atelier, il n'est pas l'atelier. */
export function estComptable(role: Role | null | undefined): boolean {
  return role === "comptable";
}

/**
 * Rubriques fermées, par préfixe d'URL.
 *
 * Volontairement court : on ne ferme que ce que la base ferme déjà. Une entrée de plus ici
 * n'ajouterait aucune sécurité et créerait le pire des cas — un écran interdit à l'affichage mais
 * ouvert en REST, c'est-à-dire un verrou qui rassure sans protéger. C'est exactement le défaut
 * que ce chantier corrige.
 *
 * `/pilotage` n'y figure pas : la page est déjà vide pour l'opérateur (les vues ne lui rendent
 * aucune ligne) et elle porte le verrou de formule. On préfère lui montrer l'explication du
 * verrou de rôle — voir `RUBRIQUES_COMMERCIALES` ci-dessous, utilisé par le même mécanisme.
 */
// `/relances` liste ce qui est parti aux clients de l'atelier — numéros de devis et de factures,
// montants dus, adresses. C'est exactement ce que la RLS refuse à l'opérateur sur `notifications` :
// laisser l'écran ouvert lui présenterait une page vide qui ressemble à une panne.
export const PREFIXES_COMMERCIAUX = ["/devis", "/factures", "/commandes", "/pilotage", "/relances"];
export const PREFIXES_PROPRIETAIRE = ["/abonnement"];

/**
 * L'espace du cabinet. Il est ouvert au bureau et au responsable — c'est là que l'atelier règle
 * la cadence de remise et vérifie ce qui est déjà parti — mais fermé à l'opérateur, qui n'a rien
 * à faire dans les pièces comptables.
 *
 * `/factures-recues` y figure depuis l'amélioration n°1 (07/09/2026) : un comptable doit pouvoir
 * lire les factures fournisseurs reçues (RLS déjà ouverte côté base, migration 66,
 * `factures_recues_select`), exactement comme il lit déjà `reglages_comptable`/`exports_comptables`.
 * L'ajouter ici ouvre l'écran au cabinet ET continue de le fermer à l'opérateur (deuxième ligne de
 * `refusDeRole` ci-dessous) sans rien changer pour le responsable ni pour le bureau.
 */
export const PREFIXES_COMPTABLES = ["/comptable", "/factures-recues"];

export type Refus = "commercial" | "proprietaire" | "hors_perimetre_comptable";

/** Le rôle a-t-il le droit d'ouvrir ce chemin ? Renvoie le motif du refus, ou `null`. */
export function refusDeRole(path: string, role: Role | null | undefined): Refus | null {
  const commence = (p: string) => path === p || path.startsWith(`${p}/`);
  // Le comptable n'a qu'une seule adresse. Le dire ici évite de lui servir un tableau de bord
  // d'atelier de laquage vidé de ses lignes par la RLS, qui ressemblerait à une panne.
  if (estComptable(role)) return PREFIXES_COMPTABLES.some(commence) ? null : "hors_perimetre_comptable";
  if (PREFIXES_COMPTABLES.some(commence) && !accesCommercial(role)) return "commercial";
  if (PREFIXES_PROPRIETAIRE.some(commence) && !estProprietaire(role)) return "proprietaire";
  if (PREFIXES_COMMERCIAUX.some(commence) && !accesCommercial(role)) return "commercial";
  return null;
}

/** Le texte affiché à la place de l'écran. Il explique, il ne s'excuse pas. */
export const MESSAGE_REFUS: Record<Refus, { titre: string; texte: string }> = {
  proprietaire: {
    titre: "Cette page est réservée au responsable de l'atelier",
    texte:
      "L'abonnement, les sièges et les coordonnées bancaires sont pilotés par le responsable. Demandez-lui d'ouvrir ce qu'il vous faut — ou de vous nommer responsable depuis Réglages → Équipe.",
  },
  commercial: {
    titre: "Cette page est réservée au bureau",
    texte:
      "Devis, factures, achats de poudre et rentabilité font partie du périmètre commercial. Votre compte est un compte d'atelier : il donne accès à la production — projets, pointage, réceptions, fournées, contrôles et stock.",
  },
  hors_perimetre_comptable: {
    titre: "Cette page appartient à l'atelier, pas à son cabinet",
    texte:
      "Votre accès porte sur les pièces comptables : factures, avoirs, règlements et exports de la période. Le reste — devis en cours, projets, production, marges, prix d'achat — relève de l'atelier lui-même. Tout ce dont vous avez besoin tient sur votre écran d'accueil.",
  },
};
