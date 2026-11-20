import { TP_API_URL, TP_BOUTIQUE_URL, TP_WS_KEY } from "@/lib/env";

/**
 * Accès bas niveau au webservice REST de thermopoudre.fr (PrestaShop 8).
 *
 * Le jeton n'existe que côté serveur : il ouvre l'API marchande de la boutique et ne doit jamais
 * partir dans le navigateur d'un atelier abonné. Tout passe donc par les routes `/api/catalogue/*`.
 */

export class CatalogueIndisponible extends Error {
  constructor(
    message: string,
    readonly cause_technique?: string,
  ) {
    super(message);
    this.name = "CatalogueIndisponible";
  }
}

/** Le catalogue n'est branché que si la clé est présente : sans elle, l'app affiche un mode dégradé. */
export function catalogueConfigure(): boolean {
  return TP_WS_KEY.length > 0;
}

export const boutiqueUrl = () => TP_BOUTIQUE_URL.replace(/\/$/, "");

/** URL publique d'une fiche produit : `index.php?id_product=` redirige vers l'URL réécrite. */
export function urlFicheProduit(id: number) {
  return `${boutiqueUrl()}/index.php?id_product=${id}&controller=product`;
}

/** Vignette PrestaShop : `<id_image>-home_default/<slug>.jpg`. */
export function urlImage(idImage: string | number | null | undefined, slug: string | null | undefined) {
  if (!idImage) return null;
  return `${boutiqueUrl()}/${idImage}-home_default/${slug || "produit"}.jpg`;
}

/**
 * Appel JSON au webservice. Le délai est court et l'erreur explicite : une boutique lente ne doit
 * jamais faire tourner un écran de l'atelier dans le vide.
 */
export async function ps<T>(ressource: string, params: Record<string, string>): Promise<T> {
  if (!catalogueConfigure()) throw new CatalogueIndisponible("Catalogue Thermopoudre non connecté.");
  const url = new URL(`${TP_API_URL.replace(/\/$/, "")}/${ressource}`);
  url.searchParams.set("ws_key", TP_WS_KEY);
  url.searchParams.set("output_format", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch (e) {
    throw new CatalogueIndisponible("La boutique Thermopoudre ne répond pas.", String(e));
  }
  if (res.status === 401) throw new CatalogueIndisponible("Clé d'accès au catalogue Thermopoudre refusée.");
  if (!res.ok) throw new CatalogueIndisponible("La boutique Thermopoudre a renvoyé une erreur.", `HTTP ${res.status}`);

  const brut = await res.text();
  // Une recherche sans résultat renvoie une chaîne vide ou `[]`, pas un objet : ce n'est pas une erreur.
  if (!brut.trim() || brut.trim() === "[]") return {} as T;
  try {
    return JSON.parse(brut) as T;
  } catch {
    throw new CatalogueIndisponible("Réponse illisible de la boutique Thermopoudre.");
  }
}
