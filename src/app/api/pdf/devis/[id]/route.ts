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

  // Le rendu vit dans lib/pdf/generer.ts : c'est la même fonction qu'appelle
  // POST /api/notifications/envoyer pour la pièce jointe (B3), pour ne produire ce PDF qu'à un
  // seul endroit. Le RLS y restreint déjà la lecture à l'atelier de l'utilisateur : un devis d'un
  // autre atelier ressort comme introuvable, sans fuite d'information.
  const resultat = await genererPdfDocument(supabase, "devis", id);
  if (!resultat.ok) return erreurPdf(resultat.erreur, resultat.status);

  return reponsePdfBinaire(resultat.buffer, resultat.nom);
}
