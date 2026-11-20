import { createClient } from "@/lib/supabase/server";
import { CatalogueIndisponible, catalogueConfigure, fichePoudre, rechercherCatalogue } from "@/lib/thermopoudre/catalogue";

export const dynamic = "force-dynamic";

/**
 * Recherche dans le catalogue Thermopoudre, côté serveur uniquement.
 *
 * La clé du webservice ouvre l'API marchande de la boutique : elle ne sort jamais du serveur.
 * L'accès est réservé aux utilisateurs connectés — ce n'est pas un proxy de catalogue ouvert.
 *
 * Le mode dégradé est explicite (`configure: false`) : quand la clé n'est pas posée, l'écran doit
 * dire « catalogue non connecté », surtout pas afficher une liste vide qui ferait croire que la
 * boutique n'a rien en stock.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ erreur: "Non autorisé" }, { status: 401 });

  if (!catalogueConfigure()) {
    return Response.json({
      configure: false,
      resultats: [],
      message: "Catalogue Thermopoudre non connecté.",
    });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const id = url.searchParams.get("id");

  try {
    const resultats = id ? [await fichePoudre(Number(id))].filter(Boolean) : await rechercherCatalogue(q);
    return Response.json({ configure: true, resultats });
  } catch (e) {
    if (e instanceof CatalogueIndisponible) {
      return Response.json({ configure: true, resultats: [], message: e.message }, { status: 502 });
    }
    return Response.json({ configure: true, resultats: [], message: "Catalogue Thermopoudre indisponible." }, { status: 502 });
  }
}
