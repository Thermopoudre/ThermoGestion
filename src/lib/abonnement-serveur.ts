import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBELLE_CAPACITE, nomPlan, planRequis, type Capacite } from "@/lib/abonnement";

/**
 * Droit de formule vérifié **côté serveur**, sur la même règle que la base.
 *
 * Les routes PDF ne sont pas couvertes par le trigger `exiger_capacite` : elles ne font que lire.
 * Or c'est précisément le document qui se vend — un certificat de conformité ou une fiche de
 * cuisson téléchargés par un atelier dont la formule ne les couvre pas seraient un droit ouvert
 * par simple connaissance de l'URL. On rejoue donc la règle ici, en interrogeant la base
 * (`ma_capacite`) plutôt qu'en refaisant le calcul : une seule vérité, celle du serveur SQL.
 */
export async function capaciteServeur(supabase: SupabaseClient, capacite: Capacite): Promise<boolean> {
  const { data, error } = await supabase.rpc("ma_capacite", { p_capacite: capacite });
  // En cas d'erreur on ferme : une vérification de droit qui échoue n'accorde rien.
  if (error) return false;
  return data === true;
}

/** Message servi quand le document demandé n'est pas couvert par la formule. */
export function messageCapacite(capacite: Capacite): string {
  return `${LIBELLE_CAPACITE[capacite].titre} — cette pièce fait partie de la formule ${nomPlan(planRequis(capacite))}. Ouvrez-la depuis l'écran Abonnement pour l'éditer.`;
}
