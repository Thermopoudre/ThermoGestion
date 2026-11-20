import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

/** L'IBAN et le BIC de l'atelier, tels que la facture les imprime. */
export type CoordonneesBancaires = { iban: string | null; bic: string | null };

/**
 * Lit les coordonnées bancaires de l'atelier pour les imprimer sur une facture — **sans jamais
 * faire échouer la facture**.
 *
 * POURQUOI CETTE FONCTION EXISTE. L'IBAN vit dans `ateliers_bancaire`, table réservée au
 * responsable, et doit pourtant s'imprimer sur la facture que le bureau édite. La lecture se
 * faisait donc en `service_role`, après que la RLS a déjà prouvé que le demandeur appartient à
 * l'atelier de la facture. C'est un raisonnement juste, mais il avait une conséquence que
 * personne n'avait vue : `createServiceClient()` **lève une exception** quand la variable
 * d'environnement manque, et cette exception remontait jusqu'à la route.
 *
 * Résultat constaté en production le 7 septembre 2026 : `SUPABASE_SERVICE_ROLE_KEY` n'était pas
 * configurée sur Vercel, et **toutes** les factures rendaient un 500 depuis le 3 septembre — le
 * document le plus important d'un logiciel de facturation, indisponible, sans que rien ne le
 * signale. Le PDF du devis, lui, marchait : il ne lit pas l'IBAN.
 *
 * Une facture sans IBAN reste une facture valable — les mentions obligatoires n'en imposent pas
 * un, et le client peut payer autrement. Une facture qui n'existe pas, non. On dégrade donc :
 *
 *  1. lecture en `service_role` quand la clé est là — le cas normal, tout le monde voit l'IBAN ;
 *  2. sinon, repli sur la **session de l'appelant** : le responsable verra son IBAN, le bureau
 *     n'en verra pas. Rien ne fuite, la RLS reste seule juge ;
 *  3. en dernier recours, pas d'IBAN, et la facture sort quand même.
 *
 * Le repli laisse une trace dans les journaux du serveur : une configuration incomplète doit se
 * voir, pas se deviner six semaines plus tard.
 */
export async function lireCoordonneesBancaires(
  supabase: SupabaseClient,
  atelierId: string,
): Promise<CoordonneesBancaires> {
  const vide: CoordonneesBancaires = { iban: null, bic: null };

  try {
    const { data } = await createServiceClient()
      .from("ateliers_bancaire")
      .select("iban, bic")
      .eq("atelier_id", atelierId)
      .maybeSingle();
    return { iban: data?.iban ?? null, bic: data?.bic ?? null };
  } catch (e) {
    console.warn(
      "[facture] Coordonnées bancaires lues avec la session de l'appelant : " +
        (e instanceof Error ? e.message : String(e)) +
        " — l'IBAN n'apparaîtra sur la facture que si l'utilisateur a le droit de le lire.",
    );
  }

  // Repli : la RLS décide. Le responsable lit, le bureau non — et la facture sort dans les deux cas.
  try {
    const { data } = await supabase
      .from("ateliers_bancaire")
      .select("iban, bic")
      .eq("atelier_id", atelierId)
      .maybeSingle();
    return { iban: data?.iban ?? null, bic: data?.bic ?? null };
  } catch {
    return vide;
  }
}
