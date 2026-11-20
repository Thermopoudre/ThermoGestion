import { errorFr } from "@/lib/errors";

type Pousser = (message: string, type?: "success" | "error") => void;

/**
 * Exécute une écriture Supabase et remonte son échec à l'opérateur.
 *
 * Le motif `await supabase.from(...).update(...)` sans destructuration ne lève rien : PostgREST
 * répond 4xx, le client range l'erreur dans `error`, et personne ne la lit. À l'écran, l'atelier
 * appuie sur « Valider l'étape » et il ne se passe strictement rien — ni changement, ni message,
 * ni trace en console. C'est exactement ce que produisent en production un abonnement expiré
 * (`ABONNEMENT_REQUIS`), l'atelier de démonstration (`DEMO_LECTURE_SEULE`), un refus RLS ou un
 * réseau coupé dans un bâtiment métallique. L'opérateur appuie deux fois, ou croit l'étape
 * validée. C'est aussi ce qui a fait perdre les photos de cinq réceptions.
 *
 * Renvoie `true` si l'écriture est passée, pour que l'appelant n'enchaîne pas sur un rechargement
 * ou un message de succès après un échec.
 */
export async function ecrire(
  requete: PromiseLike<{ error: unknown }>,
  toast: Pousser,
  succes?: string,
): Promise<boolean> {
  const { error } = await requete;
  if (error) {
    toast(errorFr(error), "error");
    return false;
  }
  if (succes) toast(succes);
  return true;
}
