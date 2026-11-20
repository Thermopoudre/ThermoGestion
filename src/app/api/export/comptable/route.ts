import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lignesFec, nomFichierFec, versCsv, versFec, type FactureCompta } from "@/lib/compta/export";
import type { LigneJournal } from "@/lib/comptable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erreur(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Une date d'export ne se devine pas : sans format strict, `?fin=hier` deviendrait `1970`. */
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Export comptable d'une période : CSV de contrôle ou FEC réglementaire.
 *
 * La période porte sur la **date d'émission**, pas sur la date de création : c'est la date à
 * laquelle la facture entre en comptabilité. Les brouillons sont exclus — une facture non émise
 * n'existe pas comptablement, et l'inclure fausserait la TVA du mois.
 *
 * Les données ne viennent plus de `factures` en direct mais de `journal_ventes()`. Deux raisons.
 * La première tient au périmètre : l'expert-comptable n'a aucune policy de lecture sur les tables
 * métier, et il n'en aura pas — une policy ouvre la ligne entière, donc les notes internes de
 * l'atelier sur son client et sa remise négociée. La fonction, elle, choisit ses colonnes. La
 * seconde tient au fait qu'il n'y a plus qu'un seul chemin d'accès aux écritures, donc un seul
 * endroit où se tromper.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreur("Vous devez être connecté.", 401);

  const p = req.nextUrl.searchParams;
  const debut = p.get("debut");
  const fin = p.get("fin");
  const format = p.get("format") === "fec" ? "fec" : "csv";
  if (!debut || !fin) return erreur("Précisez une période (debut, fin).", 400);
  if (!JOUR.test(debut) || !JOUR.test(fin)) return erreur("Période mal formée (AAAA-MM-JJ attendu).", 400);
  if (debut > fin) return erreur("La fin de période précède son début.", 400);

  const { data: journal, error } = await supabase.rpc("journal_ventes", { p_debut: debut, p_fin: fin });
  if (error) return erreur("Lecture des écritures impossible.", 500);

  const { data: entete } = await supabase.rpc("entete_comptable");
  const atelier = (entete ?? null) as { nom: string; siren: string | null; siret: string | null } | null;

  const lignes: FactureCompta[] = ((journal ?? []) as LigneJournal[]).map((f) => ({
    ...f,
    // `journal_ventes()` ne rend que des pièces émises : `emise_at` y est toujours renseigné, et
    // `created_at` n'est qu'un filet de sécurité dans le formateur FEC.
    created_at: f.emise_at ?? "",
    client: f.client?.id
      ? { id: f.client.id, nom: f.client.nom ?? "", siren: f.client.siren, siret: f.client.siret }
      : null,
  })) as FactureCompta[];

  // « Exercice remis le … ». La trace est posée par la base, pas par le navigateur : c'est le
  // téléchargement effectif qui compte, y compris celui que le cabinet fait lui-même.
  const totalHt = lignes.reduce((s, f) => s + Number(f.total_ht ?? 0), 0);
  await supabase.rpc("tracer_export_comptable", {
    p_debut: debut,
    p_fin: fin,
    p_format: format,
    p_nb: lignes.length,
    p_total_ht: Math.round(totalHt * 100) / 100,
  });

  if (format === "fec") {
    const corps = versFec(lignesFec(lignes));
    return new Response(corps, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomFichierFec(atelier?.siren ?? atelier?.siret, fin)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new Response(versCsv(lignes), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-comptable-${debut}-${fin}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
