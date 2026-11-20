/**
 * Pièces jointes — le contrat partagé entre la base, le bucket et l'écran.
 *
 * Le bucket `documents` existait depuis le premier jour du produit : privé, vide, et référencé
 * nulle part. Résultat, le plan PDF du client, son bon de commande et la fiche technique du
 * fournisseur vivaient dans une boîte mail — et le jour du litige, la pièce qui protège l'atelier
 * n'était pas dans le logiciel.
 *
 * Ce fichier ne fait rien tout seul : il pose les trois règles que le navigateur, la table
 * `pieces_jointes` et le bucket doivent appliquer **à l'identique**. Les recopier à trois
 * endroits, c'est se garantir qu'elles divergeront ; les écrire ici, c'est pouvoir les tester.
 */

/** Les entités qui acceptent une pièce jointe. Miroir exact du `check` de la table. */
export const ENTITES_PIECE_JOINTE = ["client", "projet", "reception"] as const;
export type EntitePieceJointe = (typeof ENTITES_PIECE_JOINTE)[number];

/**
 * Le dossier du bucket qui correspond à chaque entité — deuxième segment du chemin.
 *
 * Ce n'est pas de la cosmétique : depuis la migration `39_stockage_roles_familles_et_demo`, c'est
 * ce segment que la policy de `storage.objects` lit pour décider QUI a le droit d'ouvrir le
 * fichier. `clients/` est réservé au bureau (bon de commande, conditions négociées signées),
 * `projets/` et `receptions/` sont ouverts à l'atelier — ils décrivent le travail à faire.
 * Un dossier absent de cette table est refusé par la base : la liste des familles est fermée,
 * ce qui interdit d'inventer un répertoire pour y héberger n'importe quoi.
 *
 * Le jumeau côté base est `public.dossier_piece_jointe(text)`. Les deux doivent dire la même
 * chose, et `tests/stockage-roles.test.ts` le vérifie ligne à ligne.
 */
export const DOSSIER_PAR_ENTITE: Record<EntitePieceJointe, string> = {
  client: "clients",
  projet: "projets",
  reception: "receptions",
};

/**
 * 10 Mo, la même valeur que `file_size_limit` sur le bucket et que la contrainte de la table.
 *
 * Au-delà, ce n'est plus une pièce jointe : c'est une sauvegarde, et elle ne passera pas la 4G
 * d'un atelier en bâtiment métallique. Le refus est prononcé ici pour être **lisible** — le
 * service de stockage, lui, répond « Payload too large » après avoir tenté l'envoi complet.
 */
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/**
 * Liste blanche, identique à `allowed_mime_types` du bucket.
 *
 * `application/octet-stream` n'y figure pas volontairement : c'est le type que présente un
 * fichier dont le navigateur ignore la nature, donc la porte ouverte à n'importe quoi. La
 * conséquence assumée est qu'un `.dwg` d'AutoCAD est refusé — il faut l'exporter en PDF, ce qui
 * est de toute façon ce qu'on envoie à un client.
 */
export const TYPES_ACCEPTES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
] as const;

/** Valeur de l'attribut `accept` du champ de fichier : elle filtre le sélecteur du système. */
export const ACCEPT_HTML = TYPES_ACCEPTES.join(",");

/** Phrase affichée sous le bouton. Écrite pour un exploitant, pas pour un développeur. */
export const AIDE_FORMATS = "PDF, photo, Word, Excel ou texte — 10 Mo maximum par fichier.";

export function estTypeAccepte(mime: string): boolean {
  return (TYPES_ACCEPTES as readonly string[]).includes(mime);
}

/**
 * Le motif de refus, ou `null` si le fichier passe.
 *
 * Deux vérifications seulement, et dans cet ordre : la taille d'abord, parce qu'un fichier de
 * 40 Mo refusé après trente secondes d'envoi est la pire des attentes.
 */
export function refusDeFichier(fichier: { name: string; size: number; type: string }): string | null {
  if (fichier.size <= 0) return `« ${fichier.name} » est vide.`;
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return `« ${fichier.name} » pèse ${tailleFr(fichier.size)} : la limite est de ${tailleFr(TAILLE_MAX_OCTETS)}.`;
  }
  if (!estTypeAccepte(fichier.type)) {
    return `« ${fichier.name} » n'est pas un format accepté. ${AIDE_FORMATS}`;
  }
  return null;
}

/** « 1,4 Mo », « 812 ko ». Le séparateur décimal est la virgule : on écrit en français. */
export function tailleFr(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Nom de fichier assaini pour le chemin de stockage.
 *
 * Le service de stockage n'accepte pas n'importe quel octet dans une clé d'objet, et un nom qui
 * contient `/` fabriquerait un sous-dossier — donc une clé qui ne commence plus par l'identifiant
 * de l'atelier, donc un refus de politique incompréhensible. Le nom d'origine, lui, est conservé
 * intact dans la colonne `nom` : c'est celui-là que l'atelier lit à l'écran.
 */
export function nomSain(nom: string): string {
  const sain = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "");
  return sain.slice(-80) || "fichier";
}

/**
 * Chemin dans le bucket `documents` : `<atelier>/<dossier>/<id de la fiche>/<horodatage>-<nom>`.
 *
 * Les deux premiers segments sont imposés par la base et ne se négocient pas :
 *  - **segment 1, l'atelier**, c'est le cloisonnement entre clients du logiciel ;
 *  - **segment 2, le dossier**, c'est le cloisonnement entre rôles depuis la migration
 *    `39_stockage_roles_familles_et_demo` — voir `DOSSIER_PAR_ENTITE`.
 * Toute autre forme part dans le vide avec un refus de droits, et la contrainte
 * `pieces_jointes_chemin_coherent` refuse en plus d'enregistrer une ligne dont le chemin ne
 * correspondrait pas à l'entité déclarée.
 *
 * (Le chemin passait auparavant par un segment fixe `pieces/`, qui ne disait rien à personne et
 * privait la policy de la seule information dont elle avait besoin pour distinguer un contrat
 * client d'un plan de chantier.)
 *
 * L'horodatage précède le nom pour que deux envois du même fichier ne s'écrasent pas, et pour
 * que le tri alphabétique du listing coïncide avec l'ordre chronologique.
 */
export function cheminPieceJointe(
  atelierId: string,
  entite: EntitePieceJointe,
  entiteId: string,
  nomFichier: string,
  horodatage = Date.now(),
): string {
  return `${atelierId}/${DOSSIER_PAR_ENTITE[entite]}/${entiteId}/${horodatage}-${nomSain(nomFichier)}`;
}

/**
 * Durée de vie d'une URL signée : cinq minutes.
 *
 * Assez pour ouvrir la pièce ou l'enregistrer, trop court pour qu'un lien copié dans une
 * conversation reste exploitable le lendemain. Les photos utilisaient une heure — un lien
 * d'accès à un document contractuel n'a pas les mêmes conséquences qu'une photo de pièce.
 */
export const DUREE_URL_SIGNEE_S = 300;

/** Icône textuelle par famille de format. Un PDF et une photo ne se cherchent pas de la même façon. */
export function familleFichier(mime: string): "pdf" | "image" | "tableur" | "texte" | "document" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("spreadsheet") || mime.includes("ms-excel") || mime === "text/csv") return "tableur";
  if (mime === "text/plain") return "texte";
  return "document";
}
