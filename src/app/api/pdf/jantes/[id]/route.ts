import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BonJantesDocument, type PhotoPdf } from "@/lib/pdf/jantes";
import { chargerLogo, erreurPdf, reponsePdf } from "@/lib/pdf/render";
import { POSITIONS_JANTE } from "@/lib/jantes";
import type { Atelier, Client, Jante, JeuJantes, Vehicule } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDRE = POSITIONS_JANTE.map((p) => p.code);
const FORMATS: Record<string, "png" | "jpg"> = { png: "png", jpg: "jpg", jpeg: "jpg" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  // Le RLS restreint la lecture à l'atelier de l'utilisateur : un dossier d'un autre atelier
  // ressort comme introuvable.
  const { data: jeu } = await supabase
    .from("jeux_jantes")
    .select("*, clients(*), vehicules(*), jantes(*)")
    .eq("id", id)
    .maybeSingle();
  if (!jeu) return erreurPdf("Dossier de jantes introuvable.", 404);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", jeu.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const client = jeu.clients as unknown as Client | null;
  if (!client) return erreurPdf("Client introuvable pour ce dossier.", 404);

  const jantes = [...((jeu.jantes ?? []) as Jante[])].sort((a, b) => ORDRE.indexOf(a.position) - ORDRE.indexOf(b.position));

  // Les photos sont téléchargées ici plutôt que laissées à @react-pdf : le bucket est privé, il
  // faut une URL signée, et un fichier manquant ne doit pas faire échouer tout le document.
  const { data: lignes } = await supabase
    .from("photos")
    .select("jante_id, storage_path")
    .eq("jeu_jantes_id", id)
    .not("jante_id", "is", null)
    .order("created_at");

  const photos: Record<string, PhotoPdf[]> = {};
  for (const ligne of (lignes ?? []) as { jante_id: string; storage_path: string }[]) {
    // Six photos par jante suffisent à un constat : au-delà, le PDF pèse plus qu'il n'informe.
    if ((photos[ligne.jante_id] ?? []).length >= 6) continue;
    const extension = (ligne.storage_path.split(".").pop() ?? "").toLowerCase();
    const format = FORMATS[extension];
    if (!format) continue;
    try {
      const { data: fichier } = await supabase.storage.from("photos").download(ligne.storage_path);
      if (!fichier) continue;
      (photos[ligne.jante_id] ??= []).push({ data: Buffer.from(await fichier.arrayBuffer()), format });
    } catch {
      /* une photo illisible ne doit pas empêcher le constat de sortir */
    }
  }

  const document = BonJantesDocument({
    jeu: jeu as unknown as JeuJantes,
    jantes,
    vehicule: (jeu.vehicules as unknown as Vehicule | null) ?? null,
    client,
    atelier: atelier as unknown as Atelier,
    logo: await chargerLogo(atelier.logo_url),
    photos,
  });

  return reponsePdf(document, jeu.numero ?? "prise-en-charge-jantes");
}
