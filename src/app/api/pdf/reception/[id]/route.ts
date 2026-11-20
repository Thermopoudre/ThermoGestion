import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReceptionDocument } from "@/lib/pdf/reception";
import { chargerLogo, erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import type { Atelier, Client, Reception } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) : ni pré-rendu, ni mis en cache par la plateforme.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  // Le RLS restreint déjà la lecture à l'atelier de l'utilisateur : une réception d'un autre
  // atelier ressort comme introuvable.
  const { data: reception } = await supabase.from("receptions").select("*, clients(*)").eq("id", id).maybeSingle();
  if (!reception) return erreurPdf("Réception introuvable.", 404);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", reception.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const client = reception.clients as unknown as Client | null;
  if (!client) return erreurPdf("Client introuvable pour cette réception.", 404);

  const logo = await chargerLogo(atelier.logo_url);
  const document = ReceptionDocument({
    reception: reception as unknown as Reception,
    client,
    atelier: atelier as unknown as Atelier,
    logo,
  });

  const buffer = await renderToBuffer(document);
  return reponsePdfBinaire(buffer, `Reception-${reception.numero ?? "brouillon"}`);
}
