import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { genererPdfDocument, type TypeDocumentPdf } from "@/lib/pdf/generer";
import { errorFr } from "@/lib/errors";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: TypeDocumentPdf[] = ["devis", "facture", "bl"];

/**
 * B1 + B3 — le bouton « Envoyer » des trois fiches (devis/[id], factures/[id], bl/fiche/[id])
 * appelle cette route plutôt qu'un `mailto:`.
 *
 * Deux écritures, dans cet ordre :
 *  1. `envoyer_document()` — la RPC (session utilisateur, jamais la clé de service : la RLS fait
 *     le cloisonnement) pose la ligne dans `notifications`, statut `pending`. C'est elle qui
 *     vérifie le rôle, le destinataire et que le document est bien finalisé.
 *  2. Le PDF est généré ici (lib/pdf/generer.ts, le même rendu que les routes `api/pdf/*`),
 *     encodé en base64 et posé sur la notification par `joindre_piece_jointe_notification()`.
 *     **Best-effort** : un échec de génération du PDF n'annule pas l'envoi — le client recevra le
 *     lien sans pièce jointe plutôt que rien du tout. `process_notifications()` (cron, toutes les
 *     5 minutes) reste la seule file qui parle réellement au relais : cette route n'appelle jamais
 *     `tg-mailer.php` elle-même.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  let body: { type?: string; id?: string; destinataire?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const { type, id, destinataire, message } = body;
  if (!type || !TYPES.includes(type as TypeDocumentPdf) || !id) {
    return NextResponse.json({ error: "Document non reconnu." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("envoyer_document", {
    p_type: type,
    p_id: id,
    p_destinataire: destinataire?.trim() || null,
    p_message: message?.trim() || null,
  });
  if (error) return NextResponse.json({ error: errorFr(error) }, { status: 400 });

  const resultat = data as { notification_id: string; destinataire: string; deja_envoye: boolean };

  // Un second appel dans les dix secondes (double-clic, requête relancée) : la ligne existe déjà,
  // inutile de regénérer un PDF pour une notification déjà en file.
  if (resultat.deja_envoye) {
    return NextResponse.json({ notificationId: resultat.notification_id, destinataire: resultat.destinataire, dejaEnvoye: true });
  }

  let pdfJoint = false;
  try {
    const pdf = await genererPdfDocument(supabase, type as TypeDocumentPdf, id);
    if (pdf.ok) {
      const base64 = pdf.buffer.toString("base64");
      const { data: pose } = await supabase.rpc("joindre_piece_jointe_notification", {
        p_notification_id: resultat.notification_id,
        p_filename: `${pdf.nom}.pdf`,
        p_mime: "application/pdf",
        p_base64: base64,
      });
      pdfJoint = pose === true;
    }
  } catch {
    // Best-effort : le PDF n'est pas indispensable à l'envoi, le lien public suffit toujours.
    pdfJoint = false;
  }

  return NextResponse.json({
    notificationId: resultat.notification_id,
    destinataire: resultat.destinataire,
    dejaEnvoye: false,
    pdfJoint,
  });
}
