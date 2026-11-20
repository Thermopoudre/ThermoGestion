import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import { genererPdfDocument } from "@/lib/pdf/generer";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) : ni pré-rendu, ni mis en cache par la plateforme.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  // Même fonction de rendu que POST /api/notifications/envoyer (B3) — cf. lib/pdf/generer.ts.
  // Le RLS restreint déjà la lecture à l'atelier de l'utilisateur : un bon de livraison d'un
  // autre atelier ressort comme introuvable.
  const resultat = await genererPdfDocument(supabase, "bl", id);
  if (!resultat.ok) return erreurPdf(resultat.erreur, resultat.status);

  return reponsePdfBinaire(resultat.buffer, resultat.nom);
}
