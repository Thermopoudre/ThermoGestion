/**
 * Le contrat de chemin des buckets — la seule chose que la base sache d'un fichier.
 *
 * `storage.objects` n'a pas de colonne `atelier_id`, pas de colonne `projet_id`, rien. Elle a un
 * nom de fichier. Tout ce que les policies peuvent décider, elles le décident donc à partir du
 * CHEMIN, et c'est pour ça que sa forme est une règle de sécurité et pas une convention de
 * rangement :
 *
 *     <atelier>/<dossier>/<identifiants…>/<horodatage>-<nom assaini>
 *      │          │
 *      │          └── QUI a le droit de l'ouvrir (le rôle)
 *      └───────────── DE QUI il est (le cloisonnement entre ateliers)
 *
 * Jusqu'à l'audit du 21/08/2026, les policies ne lisaient que le premier segment. Conséquences
 * mesurées : le visiteur de la démonstration écrivait dans les trois buckets, et un compte
 * `atelier` — qui ne lit aucune ligne de `factures` — téléchargeait puis supprimait le contrat
 * confidentiel d'un client. La migration `39_stockage_roles_familles_et_demo` a ajouté la lecture
 * du deuxième segment ; ce fichier est le côté navigateur de la même règle.
 *
 * Deux conséquences pratiques à ne pas oublier :
 *  - la liste des dossiers est **fermée** en base ; un dossier inventé ici serait refusé à
 *    l'envoi, pas silencieusement accepté ;
 *  - le premier segment doit être l'atelier de la donnée, pas « l'atelier de l'utilisateur »
 *    au sens large : les deux coïncident, mais c'est le chemin qui est vérifié.
 */

import { nomSain } from "@/lib/pieces-jointes";

/** Les dossiers du bucket `photos`. Miroir de `public.stockage_acces()`, branche `photos`. */
export const DOSSIERS_PHOTOS = ["projets", "receptions", "controles", "jantes"] as const;
export type DossierPhoto = (typeof DOSSIERS_PHOTOS)[number];

/**
 * Chemin d'une photo dans le bucket `photos`.
 *
 * `segments` porte les identifiants métier — le projet, la réception, le contrôle, ou le couple
 * jeu + jante. Ils ne servent qu'au rangement et à la lisibilité : la décision de droits se joue
 * sur `dossier`, et sur lui seul.
 */
export function cheminPhoto(
  atelierId: string,
  dossier: DossierPhoto,
  segments: string[],
  nomFichier: string,
  suffixe = `${Date.now()}`,
): string {
  return [atelierId, dossier, ...segments, `${suffixe}-${nomSain(nomFichier)}`].join("/");
}

/**
 * Chemin du logo d'un atelier : `<atelier>/logo-<horodatage>.<extension>`.
 *
 * Pas de dossier intermédiaire, volontairement — la policy exige que le logo soit posé
 * DIRECTEMENT dans le dossier de l'atelier. C'est ce qui interdit d'utiliser le bucket public
 * comme espace d'hébergement en inventant des sous-dossiers, et c'est aussi pourquoi seul le
 * responsable peut y écrire : le fichier n'existe que pour être recopié dans `ateliers.logo_url`,
 * une colonne que seul le responsable peut modifier.
 */
export function cheminLogo(atelierId: string, nomFichier: string, horodatage = Date.now()): string {
  const extension = (nomFichier.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${atelierId}/logo-${horodatage}.${extension}`;
}

/**
 * Formats acceptés par le bucket `logos` (`allowed_mime_types`), et par lui seul.
 *
 * `image/svg+xml` en est volontairement absent : le bucket `logos` est PUBLIC, et un SVG est un
 * document qui peut porter du script. L'accepter reviendrait à héberger un XSS stocké sur notre
 * propre domaine. L'attribut `accept` du champ de fichier reprend cette liste pour que le refus
 * arrive dans le sélecteur du système, pas après l'envoi.
 */
export const TYPES_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;
export const ACCEPT_LOGO = TYPES_LOGO.join(",");
/** 2 Mo, comme `file_size_limit` du bucket. Au-delà c'est un scan, et chaque PDF ralentira. */
export const TAILLE_MAX_LOGO = 2 * 1024 * 1024;

/** Formats acceptés par le bucket `photos`. Le HEIC des iPhone en fait partie. */
export const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const ACCEPT_PHOTO = TYPES_PHOTO.join(",");
/**
 * 15 Mo, comme `file_size_limit` du bucket — et non 10 comme les pièces jointes.
 *
 * Une photo est prise sur le poste de travail, au téléphone, et personne ne va la
 * redimensionner avant de l'envoyer : un capteur récent produit 8 à 12 Mo en HEIC.
 */
export const TAILLE_MAX_PHOTO = 15 * 1024 * 1024;

/** Le motif de refus d'une photo, ou `null` si elle passe. Écrit pour être lu par un opérateur. */
export function refusDePhoto(fichier: { name: string; size: number; type: string }): string | null {
  if (fichier.size <= 0) return `« ${fichier.name} » est vide.`;
  if (fichier.size > TAILLE_MAX_PHOTO) {
    return `« ${fichier.name} » dépasse 15 Mo. Prenez la photo en qualité normale plutôt qu'en maximum.`;
  }
  if (!(TYPES_PHOTO as readonly string[]).includes(fichier.type)) {
    return `« ${fichier.name} » n'est pas une photo (JPEG, PNG, WebP ou HEIC).`;
  }
  return null;
}
