import type { ErreurAssistant } from "@/lib/assistant/types";

/**
 * F6 — les décisions de sécurité de la route, sorties du corps de `route.ts` pour pouvoir être
 * éprouvées SANS session, SANS base et SANS appel au modèle.
 *
 * POURQUOI un fichier à part pour une poignée de lignes : la route elle-même ne se teste pas sans
 * une vraie session Supabase (elle ouvre `createClient()`, qui lit les cookies de la requête). Une
 * décision aussi sensible qu'« un cabinet comptable ne doit jamais recevoir de réponse de
 * l'assistant » mérite un test qui ne dépende de rien d'autre que la valeur du rôle — sans ça, la
 * seule façon de la vérifier serait de rejouer toute la route avec une vraie base de test.
 */

/**
 * Le refus opposé à un rôle avant même d'appeler le modèle, ou `null` si le rôle peut continuer.
 *
 * Le cabinet comptable n'a pas d'atelier au sens de `current_atelier_id()` : tous les outils lui
 * rendraient zéro ligne, et un assistant qui répond « vous n'avez aucune facture » à un
 * expert-comptable est pire qu'un assistant absent.
 */
export function refusPourRole(role: string | null | undefined): ErreurAssistant | null {
  if (role === "comptable") {
    return {
      code: "hors_perimetre",
      message:
        "L'assistant interroge les données d'exploitation de l'atelier. Votre accès porte sur " +
        "les pièces comptables : tout ce dont vous avez besoin est sur votre écran d'accueil.",
    };
  }
  return null;
}

/** Code HTTP associé à chaque refus rendu par la route. Un seul endroit, pour ne pas le recopier. */
export const STATUT_HTTP: Record<ErreurAssistant["code"], number> = {
  non_authentifie: 401,
  assistant_non_configure: 503,
  question_invalide: 400,
  quota_atteint: 429,
  hors_perimetre: 403,
  erreur_modele: 502,
};
