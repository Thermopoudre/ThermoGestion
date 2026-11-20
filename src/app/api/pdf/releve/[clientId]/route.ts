import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReleveCompteDocument, type LigneReleve } from "@/lib/pdf/releve";
import { chargerLogo, erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import type { Atelier, Client } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le relevé dépend de l'état des factures au moment de la demande : jamais mis en cache.
export const dynamic = "force-dynamic";

/**
 * Relevé de compte (lot C, C3) : toutes les factures émises et non soldées de ce client, avec leur
 * retard. La RLS de `factures`/`paiements` fait le tri par atelier — un client d'un autre atelier
 * ressort simplement introuvable, comme sur toutes les autres routes PDF du produit.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return erreurPdf("Client introuvable.", 404);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", client.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const { data: factures } = await supabase
    .from("factures")
    .select("id, numero, total_ttc, due_date")
    .eq("client_id", clientId)
    .eq("status", "emise")
    .is("deleted_at", null)
    .is("annulee_at", null)
    .neq("type", "avoir")
    .not("due_date", "is", null)
    .order("due_date");

  const ids = (factures ?? []).map((f) => f.id);
  const { data: paiements } = ids.length
    ? await supabase.from("paiements").select("facture_id, montant").in("facture_id", ids)
    : { data: [] as { facture_id: string; montant: number }[] };
  const regleParFacture = new Map<string, number>();
  for (const p of paiements ?? []) {
    regleParFacture.set(p.facture_id, (regleParFacture.get(p.facture_id) ?? 0) + Number(p.montant));
  }

  const aujourdhui = new Date();
  const lignes: LigneReleve[] = (factures ?? [])
    .map((f) => {
      const resteDu = Math.round((Number(f.total_ttc) - (regleParFacture.get(f.id) ?? 0)) * 100) / 100;
      const echeance = new Date(`${f.due_date}T00:00:00`);
      const retardJours = Math.max(0, Math.round((aujourdhui.getTime() - echeance.getTime()) / 86400000));
      return { numero: f.numero, due_date: f.due_date as string, total_ttc: Number(f.total_ttc), reste_du: resteDu, retard_jours: retardJours };
    })
    .filter((l) => l.reste_du > 0.01);

  const logo = await chargerLogo(atelier.logo_url);
  const document = ReleveCompteDocument({
    client: client as unknown as Client,
    atelier: atelier as unknown as Atelier,
    logo,
    lignes,
    genere_le: new Date().toISOString(),
  });

  const buffer = await renderToBuffer(document);
  return reponsePdfBinaire(buffer, `Releve-${client.nom}`);
}
