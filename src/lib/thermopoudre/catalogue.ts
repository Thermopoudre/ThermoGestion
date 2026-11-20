import { CatalogueIndisponible, catalogueConfigure, ps, urlFicheProduit, urlImage } from "@/lib/thermopoudre/client";
import { versFiche, type FicheTp, type ProduitPs } from "@/lib/thermopoudre/fiche";

/**
 * Recherche dans le catalogue Thermopoudre.
 *
 * Deux appels seulement : la recherche du moteur de la boutique (qui connaît les synonymes et les
 * mots du métier bien mieux qu'un `LIKE`), puis une lecture groupée des fiches retenues. Le
 * webservice sait filtrer sur une liste d'identifiants — inutile d'ouvrir une requête par produit.
 */

const URLS = { fiche: urlFicheProduit, image: (id: unknown, slug: string) => urlImage(id as string, slug) };

export { CatalogueIndisponible, catalogueConfigure };
export type { FicheTp };

export async function rechercherCatalogue(requete: string, limite = 12): Promise<FicheTp[]> {
  const q = requete.trim();
  if (q.length < 2) return [];

  const recherche = await ps<{ products?: { id: number | string }[] }>("search", {
    query: q,
    language: "1",
    // La recherche est ensuite filtrée sur les seules familles poudre / jante OEM : on en demande
    // large pour ne pas rendre trois résultats après filtrage.
    limit: String(Math.max(limite * 4, 40)),
  });
  const ids = (recherche.products ?? []).map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];

  const fiches = await fichesParIds(ids.slice(0, 60));
  // L'ordre de pertinence du moteur de recherche est le bon : on le rétablit après la lecture
  // groupée, qui rend les produits triés par identifiant.
  const rang = new Map(ids.map((id, i) => [id, i]));
  return fiches.sort((a, b) => (rang.get(a.tp_product_id) ?? 999) - (rang.get(b.tp_product_id) ?? 999)).slice(0, limite);
}

export async function fichesParIds(ids: number[]): Promise<FicheTp[]> {
  if (ids.length === 0) return [];
  const data = await ps<{ products?: ProduitPs[] }>("products", {
    display: "full",
    "filter[id]": `[${ids.join("|")}]`,
    "filter[active]": "1",
  });
  return (data.products ?? []).map((p) => versFiche(p, URLS)).filter((f): f is FicheTp => f != null);
}

export async function fichePoudre(id: number): Promise<FicheTp | null> {
  const [fiche] = await fichesParIds([id]);
  return fiche ?? null;
}
