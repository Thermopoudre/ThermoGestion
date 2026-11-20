/**
 * Corbeille — le vocabulaire partagé entre le bouton, l'écran et la base.
 *
 * Avant ce chantier, le produit ne savait rien retirer : aucun `.delete()` ne portait sur
 * `clients`, `devis`, `factures`, `projets`, `bons_livraison` ni `receptions`. Un devis créé par
 * erreur restait dans la liste pour toujours, et un client archivé par mégarde n'avait aucun
 * écran pour revenir en arrière.
 *
 * Le choix retenu est l'effacement logique : `deleted_at`. Les politiques masquent la ligne
 * partout, la corbeille la montre, la restauration passe par une RPC — un `update deleted_at =
 * null` depuis la console du navigateur ne peut rien, puisque la ligne n'y est plus visible.
 */

export const ENTITES_CORBEILLE = ["client", "devis", "facture", "projet", "bl", "reception"] as const;
export type EntiteCorbeille = (typeof ENTITES_CORBEILLE)[number];

/**
 * Table, libellé et chemin de retour, par entité.
 *
 * `table` est la seule source du nom PostgREST : le bouton et l'écran s'en servent tous les deux,
 * et une faute de frappe entre `bl` et `bons_livraison` produirait un 404 silencieux.
 */
export const CORBEILLE: Record<EntiteCorbeille, {
  table: string;
  singulier: string;
  pluriel: string;
  /** Chemin de la fiche restaurée, pour que l'écran Corbeille y renvoie directement. */
  chemin: (id: string) => string;
  /** Liste d'où l'on vient : c'est là qu'on retombe après une mise à la corbeille. */
  liste: string;
}> = {
  client:    { table: "clients",        singulier: "Client",             pluriel: "Clients",             chemin: (id) => `/clients/${id}`,   liste: "/clients" },
  devis:     { table: "devis",          singulier: "Devis",              pluriel: "Devis",               chemin: (id) => `/devis/${id}`,     liste: "/devis" },
  facture:   { table: "factures",       singulier: "Facture",            pluriel: "Factures",            chemin: (id) => `/factures/${id}`,  liste: "/factures" },
  projet:    { table: "projets",        singulier: "Projet",             pluriel: "Projets",             chemin: (id) => `/projets/${id}`,   liste: "/projets" },
  bl:        { table: "bons_livraison", singulier: "Bon de livraison",   pluriel: "Bons de livraison",   chemin: (id) => `/bl/fiche/${id}`,  liste: "/bl" },
  reception: { table: "receptions",     singulier: "Réception",          pluriel: "Réceptions",          chemin: (id) => `/receptions/${id}`, liste: "/receptions" },
};

/** Ligne rendue par la RPC `corbeille()`. Les noms viennent du type composite `ligne_corbeille`. */
export type LigneCorbeille = {
  entite: EntiteCorbeille;
  id: string;
  titre: string;
  sous_titre: string | null;
  supprime_le: string;
  purge_le: string;
};

/**
 * Trente jours, la même valeur que `public.jours_corbeille()`.
 *
 * Le temps qu'un exploitant s'aperçoive de son erreur, y compris s'il part en congés. Au-delà,
 * garder indéfiniment ce qu'on a demandé à supprimer n'est plus un service rendu.
 */
export const JOURS_CORBEILLE = 30;

/**
 * Jours restants avant la purge, jamais négatifs : « effacement imminent » se lit mieux que
 * « −3 jours ».
 *
 * Arrondi au plus proche, et non au-dessus : une pièce jetée il y a une seconde doit annoncer
 * « effacé dans 30 jours », pas 31 — sinon l'écran contredit la phrase d'en-tête qui promet
 * trente jours.
 */
export function joursAvantPurge(purgeLe: string, maintenant = Date.now()): number {
  const restant = new Date(purgeLe).getTime() - maintenant;
  return Math.max(0, Math.round(restant / 86_400_000));
}

/**
 * Ce que l'exploitant lit avant de confirmer.
 *
 * Le texte annonce le délai et la réversibilité. « Voulez-vous vraiment supprimer ? » ne dit ni
 * ce qui va disparaître, ni jusqu'à quand on peut se rétracter — et c'est cette formulation-là
 * qui fait qu'on appelle le support.
 */
export function messageMiseALaCorbeille(entite: EntiteCorbeille, libelle: string): string {
  const quoi = CORBEILLE[entite].singulier.toLowerCase();
  // Le chemin annoncé doit être celui qui existe : la recette du 20/08 a relevé que ce message
  // envoyait vers « Réglages → Corbeille », un onglet qui n'a jamais existé. La corbeille est une
  // rubrique du menu, à côté de l'aide. Un artisan qui cherche au mauvais endroit conclut que ses
  // données sont perdues.
  return `« ${libelle} » quitte les listes et part à la corbeille. Vous pouvez le restaurer pendant ${JOURS_CORBEILLE} jours depuis la rubrique Corbeille du menu ; passé ce délai, ce ${quoi} est effacé définitivement.`;
}
