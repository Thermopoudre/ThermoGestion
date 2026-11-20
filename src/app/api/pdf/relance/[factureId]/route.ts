import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LettreRelanceDocument } from "@/lib/pdf/releve";
import { chargerLogo, erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import type { Atelier, Client } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le retard et le reste dû changent d'un jour à l'autre : jamais mis en cache.
export const dynamic = "force-dynamic";

/**
 * Lettre de relance papier (lot C, C3) sur UNE facture précise — mentions L441-10 du code de
 * commerce (pénalités de retard + indemnité forfaitaire de 40 €), déjà rappelées sur la facture
 * elle-même (lib/pdf/document.tsx) et reprises ici avec le montant réellement couru.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ factureId: string }> }) {
  const { factureId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  const { data: facture } = await supabase
    .from("factures")
    .select("id, numero, total_ttc, due_date, client_id, atelier_id, status, type, deleted_at, annulee_at")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return erreurPdf("Facture introuvable.", 404);
  if (!facture.due_date) return erreurPdf("Cette facture n'a pas d'échéance : rien à relancer.", 409);

  const { data: client } = await supabase.from("clients").select("*").eq("id", facture.client_id).maybeSingle();
  if (!client) return erreurPdf("Client introuvable pour cette facture.", 404);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", facture.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const { data: paiements } = await supabase.from("paiements").select("montant").eq("facture_id", factureId);
  const regle = (paiements ?? []).reduce((s, p) => s + Number(p.montant), 0);
  const resteDu = Math.round((Number(facture.total_ttc) - regle) * 100) / 100;
  if (resteDu <= 0.01) return erreurPdf("Cette facture est déjà soldée : rien à relancer.", 409);

  const echeance = new Date(`${facture.due_date}T00:00:00`);
  const retardJours = Math.max(0, Math.round((Date.now() - echeance.getTime()) / 86400000));

  const logo = await chargerLogo(atelier.logo_url);
  const document = LettreRelanceDocument({
    client: client as unknown as Client,
    atelier: atelier as unknown as Atelier,
    logo,
    numero: facture.numero,
    due_date: facture.due_date as string,
    reste_du: resteDu,
    retard_jours: retardJours,
    genere_le: new Date().toISOString(),
  });

  const buffer = await renderToBuffer(document);
  return reponsePdfBinaire(buffer, `Relance-${facture.numero ?? "facture"}`);
}
