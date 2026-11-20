import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireCoordonneesBancaires } from "@/lib/coordonnees-bancaires";
import { DevisDocument, FactureDocument, BonLivraisonDocument } from "@/lib/pdf/document";
import { chargerLogo } from "@/lib/pdf/render";
import type { Atelier, BonLivraison, Client, Devis, Facture } from "@/lib/types";

export type TypeDocumentPdf = "devis" | "facture" | "bl";

/**
 * Conditions générales de vente à imprimer (migration 76) : le texte figé du document s'il existe
 * (devis envoyé/signé, facture émise/payée/annulée), sinon — sur un brouillon — celui en vigueur
 * à l'instant du rendu (surcharge du client, sinon défaut de l'atelier). Même règle que
 * `trg_figer_cgv` côté base, rejouée ici pour l'aperçu d'un document pas encore parti.
 */
function cgvEffectif(texteFige: string | null | undefined, client: { cgv?: string | null } | null, atelier: { cgv?: string | null } | null): string | null {
  return texteFige ?? client?.cgv ?? atelier?.cgv ?? null;
}

export type ResultatPdf =
  | { ok: true; buffer: Buffer; nom: string; numero: string | null }
  | { ok: false; erreur: string; status: number };

/**
 * Le rendu du PDF, sorti de `api/pdf/{devis,facture,bl}/[id]/route.ts` pour être appelé sans
 * détour HTTP.
 *
 * POURQUOI. B3 (la pièce jointe) a besoin exactement du même PDF que le bouton « PDF de la
 * facture » — mêmes en-têtes, même IBAN, même logo — mais depuis une route serveur qui ne peut
 * pas s'appeler elle-même en HTTP sans réintroduire une latence et une source d'échec de plus.
 * Cette fonction est donc la source unique : les trois routes `api/pdf/*` l'appellent pour
 * l'aperçu dans l'onglet, `api/notifications/envoyer` l'appelle pour la pièce jointe en base64.
 *
 * `supabase` porte la session de l'appelant : la RLS décide seule de ce qui est lisible, ici comme
 * dans les routes GET d'origine — un devis d'un autre atelier ressort « introuvable », jamais une
 * erreur d'autorisation qui confirmerait son existence.
 */
export async function genererPdfDocument(
  supabase: SupabaseClient,
  type: TypeDocumentPdf,
  id: string,
): Promise<ResultatPdf> {
  if (type === "devis") {
    const { data: devis } = await supabase.from("devis").select("*, clients(*)").eq("id", id).maybeSingle();
    if (!devis) return { ok: false, erreur: "Devis introuvable.", status: 404 };
    const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", devis.atelier_id).maybeSingle();
    if (!atelier) return { ok: false, erreur: "Atelier introuvable.", status: 404 };
    const client = devis.clients as unknown as Client | null;
    if (!client) return { ok: false, erreur: "Client introuvable pour ce devis.", status: 404 };
    const logo = await chargerLogo(atelier.logo_url);
    const cgvTexte = cgvEffectif(devis.cgv_texte, client, atelier);
    const document = DevisDocument({ devis: devis as unknown as Devis, client, atelier: atelier as unknown as Atelier, logo, cgvTexte });
    const buffer = await renderToBuffer(document);
    return { ok: true, buffer, nom: devis.numero ?? "Devis-brouillon", numero: devis.numero ?? null };
  }

  if (type === "facture") {
    const { data: facture } = await supabase
      .from("factures")
      .select("*, clients(*), devis(numero)")
      .eq("id", id)
      .maybeSingle();
    if (!facture) return { ok: false, erreur: "Facture introuvable.", status: 404 };
    const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", facture.atelier_id).maybeSingle();
    if (!atelier) return { ok: false, erreur: "Atelier introuvable.", status: 404 };
    // L'IBAN vit dans `ateliers_bancaire`, réservée au responsable — cf. api/pdf/facture/[id].
    // La lecture est déléguée : elle se dégrade au lieu de faire échouer la facture quand la clé
    // de service manque en environnement (voir `lireCoordonneesBancaires`, qui explique pourquoi).
    const banque = await lireCoordonneesBancaires(supabase, facture.atelier_id);
    const atelierComplet = { ...atelier, iban: banque.iban, bic: banque.bic };
    const client = facture.clients as unknown as Client | null;
    if (!client) return { ok: false, erreur: "Client introuvable pour cette facture.", status: 404 };
    const logo = await chargerLogo(atelier.logo_url);
    const cgvTexte = cgvEffectif(facture.cgv_texte, client, atelier);
    const document = FactureDocument({
      facture: facture as unknown as Facture,
      client,
      atelier: atelierComplet as unknown as Atelier,
      logo,
      cgvTexte,
    });
    const buffer = await renderToBuffer(document);
    return { ok: true, buffer, nom: facture.numero ?? "Facture-brouillon", numero: facture.numero ?? null };
  }

  // bl
  const { data: bl } = await supabase.from("bons_livraison").select("*, clients(*)").eq("id", id).maybeSingle();
  if (!bl) return { ok: false, erreur: "Bon de livraison introuvable.", status: 404 };
  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", bl.atelier_id).maybeSingle();
  if (!atelier) return { ok: false, erreur: "Atelier introuvable.", status: 404 };
  const client = bl.clients as unknown as Client | null;
  if (!client) return { ok: false, erreur: "Client introuvable pour ce bon de livraison.", status: 404 };
  const logo = await chargerLogo(atelier.logo_url);
  const document = BonLivraisonDocument({ bl: bl as unknown as BonLivraison, client, atelier: atelier as unknown as Atelier, logo });
  const buffer = await renderToBuffer(document);
  return { ok: true, buffer, nom: bl.numero ?? "BL-brouillon", numero: bl.numero ?? null };
}
