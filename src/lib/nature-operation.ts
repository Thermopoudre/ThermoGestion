import { estDeductionAcompte, estForfaitMinimum } from "@/lib/utils";
import type { DevisItem, Prestation } from "@/lib/types";

export type NatureOperation = "biens" | "services" | "mixte";

/**
 * Catégorie de l'opération — mention obligatoire sur toute facture depuis le 01/09/2026 :
 * livraison de biens, prestation de services, ou mixte.
 *
 * POURQUOI une déduction et pas une constante. Un atelier de thermolaquage vend presque toujours
 * de la prestation, mais pas toujours : un kilo de poudre revendu, une valve TPMS, un accessoire
 * sont des livraisons de biens, et une facture qui mélange les deux est mixte. Écrire « services »
 * en dur donnerait une mention fausse sur les rares factures où elle compte vraiment — exactement
 * celles qu'un contrôle regarde.
 *
 * Cette fonction est le miroir, côté écran, de `public.nature_operation_deduite()` en base. C'est
 * la version SQL qui fait foi : elle s'applique aussi aux factures créées par l'import ou par la
 * reprise d'un devis, qui ne passent jamais par l'éditeur. Les deux doivent rester d'accord — le
 * test `tests/nature-operation.test.ts` compare leurs résultats sur les mêmes lignes.
 */
export function natureOperationDeduite(
  items: DevisItem[] | null | undefined,
  prestations: Pick<Prestation, "id" | "nature">[] | null | undefined,
): NatureOperation {
  const catalogue = new Map((prestations ?? []).map((p) => [p.id, p.nature]));

  const natures = new Set<"biens" | "services">();
  for (const l of items ?? []) {
    // Le forfait minimum est un plancher appliqué au reste : il en suit la nature, il ne la fait
    // pas. La déduction d'un acompte est un règlement déjà facturé, pas une vente. Sans cette
    // exclusion, une facture de solde intégralement en prestations basculerait en « mixte » à
    // cause de sa seule ligne de déduction.
    if (estDeductionAcompte(l) || estForfaitMinimum(l)) continue;

    const correction = l.meta?.nature;
    if (correction === "biens" || correction === "services") {
      natures.add(correction);
      continue;
    }
    const prestationId = l.meta?.prestation_id;
    const duCatalogue = typeof prestationId === "string" ? catalogue.get(prestationId) : undefined;
    natures.add(duCatalogue === "biens" ? "biens" : "services");
  }

  if (natures.size === 0) return "services";
  if (natures.size > 1) return "mixte";
  return natures.has("biens") ? "biens" : "services";
}
