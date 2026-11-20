import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EtiquetteProjetDocument } from "@/lib/pdf/etiquette";
import { chargerLogo, erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import { SITE_URL } from "@/lib/env";
import type { Atelier, Client, Poudre, Projet } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) : ni pré-rendu, ni mis en cache par la plateforme.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projetId: string }> }) {
  const { projetId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  // Le RLS restreint déjà la lecture à l'atelier de l'utilisateur : un projet d'un autre atelier
  // ressort comme introuvable.
  const { data: projet } = await supabase.from("projets").select("*, clients(*)").eq("id", projetId).maybeSingle();
  if (!projet) return erreurPdf("Projet introuvable.", 404);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", projet.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const client = projet.clients as unknown as Client | null;
  if (!client) return erreurPdf("Client introuvable pour ce projet.", 404);

  let poudre: Poudre | null = null;
  if (projet.poudre_id) {
    const { data } = await supabase.from("poudres").select("*").eq("id", projet.poudre_id).maybeSingle();
    poudre = (data as unknown as Poudre) ?? null;
  }

  const logo = await chargerLogo(atelier.logo_url);
  // Le QR encode l'URL de scan atelier (`/scan/<qr_token>`) : c'est elle qui valide l'étape en
  // cours à chaque passage, exactement comme le QR affiché sur la fiche projet elle-même.
  const qrDataUrl = await QRCode.toDataURL(`${SITE_URL}/scan/${projet.qr_token}`, { width: 300, margin: 1 });

  const document = EtiquetteProjetDocument({
    projet: projet as unknown as Projet,
    client,
    atelier: atelier as unknown as Atelier,
    poudre,
    logo,
    qrDataUrl,
  });

  const buffer = await renderToBuffer(document);
  return reponsePdfBinaire(buffer, `Fiche-suiveuse-${projet.numero ?? "brouillon"}`);
}
