import { createClient } from "@/lib/supabase/server";
import { collecterDonnees, construireZip, fichiersArchive, nomArchive, type RoleExport } from "@/lib/export/donnees";
import { estRole } from "@/lib/roles";

export const runtime = "nodejs";
// Le contenu dépend entièrement de la session : jamais de cache, jamais de pré-rendu.
export const dynamic = "force-dynamic";
// Un atelier chargé peut avoir plusieurs dizaines de milliers de lignes à parcourir.
export const maxDuration = 60;

/**
 * Sauvegarde et export total des données de l'atelier connecté (engagement des CGU).
 *
 * La lecture passe par le client porteur de la session, donc par les RLS : il n'y a pas de
 * paramètre `atelier_id` à falsifier, et un compte ne peut exporter que son propre atelier.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Vous devez être connecté pour exporter vos données.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { data: atelier } = await supabase.from("ateliers").select("nom").maybeSingle();
  const nom = atelier?.nom ?? "Atelier";
  const le = new Date();

  // Le rôle n'est pas lu pour décider de ce qu'on exporte — c'est la RLS qui décide, et c'est bien
  // ainsi. Il est lu pour l'ÉCRIRE dans l'archive : un opérateur d'atelier repart avec un ZIP sans
  // IBAN ni prix d'achat, et rien, sinon, ne le lui dirait.
  const { data: membre } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  const role: RoleExport = estRole(membre?.role) ? membre.role : null;

  const tables = await collecterDonnees(supabase);
  const archive = construireZip(fichiersArchive(tables, nom, le, role), le);

  return new Response(new Uint8Array(archive), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomArchive(nom, le)}"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "private, no-store",
    },
  });
}
