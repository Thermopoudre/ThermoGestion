import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lireCoordonneesBancaires } from "@/lib/coordonnees-bancaires";
import { FactureDocument } from "@/lib/pdf/document";
import { chargerLogo, erreurPdf, reponsePdfBinaire } from "@/lib/pdf/render";
import { genererPdfDocument } from "@/lib/pdf/generer";
import { donneesFacturX, facturXDepuisFacture } from "@/lib/facturx/facture";
import type { Atelier, Client, Facture } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) : ni pré-rendu, ni mis en cache par la plateforme.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  // Le PDF « simple » vient de lib/pdf/generer.ts — la même fonction que POST
  // /api/notifications/envoyer appelle pour la pièce jointe (B3). Le Factur-X, lui, a besoin de
  // l'élément <Document> React (pas d'un buffer déjà rendu) pour y emballer le XML : il refait
  // sa propre lecture ci-dessous, comme avant ce chantier.
  if (req.nextUrl.searchParams.get("facturx") !== "1") {
    const resultat = await genererPdfDocument(supabase, "facture", id);
    if (!resultat.ok) return erreurPdf(resultat.erreur, resultat.status);
    return reponsePdfBinaire(resultat.buffer, resultat.nom);
  }

  // Pas de filtre sur l'atelier ici : le RLS ne laisse remonter que les lignes de l'atelier
  // de l'utilisateur, une facture d'un autre atelier ressort donc simplement comme introuvable.
  const { data: facture } = await supabase
    .from("factures")
    // Le devis d'origine sert de référence de commande (BT-13) dans le XML Factur-X.
    .select("*, clients(*), devis(numero)")
    .eq("id", id)
    .maybeSingle();
  if (!facture) return erreurPdf("Facture introuvable.", 404);

  const { data: atelier } = await supabase
    .from("ateliers")
    .select("*")
    .eq("id", facture.atelier_id)
    .maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  /**
   * L'IBAN vit désormais dans `ateliers_bancaire`, table réservée au responsable — et il doit
   * pourtant s'imprimer sur la facture que le bureau édite. On le récupère donc côté serveur, en
   * `service_role`, après que la RLS a déjà prouvé que le demandeur appartient bien à l'atelier
   * de cette facture : sans ce droit, la requête sur `factures` ci-dessus aurait rendu « facture
   * introuvable » et on ne serait pas ici. Le navigateur ne reçoit jamais la valeur, seulement le
   * document dans lequel elle est imprimée — ce qui est précisément le but d'une facture.
   */
  const banque = await lireCoordonneesBancaires(supabase, facture.atelier_id);
  const atelierComplet = { ...atelier, iban: banque.iban, bic: banque.bic };

  const client = facture.clients as unknown as Client | null;
  if (!client) return erreurPdf("Client introuvable pour cette facture.", 404);

  const logo = await chargerLogo(atelier.logo_url);

  // Les composants sont appelés comme de simples fabriques d'éléments : la racine attendue par
  // @react-pdf est un <Document>, pas un composant de fonction à monter.
  const document = FactureDocument({
    facture: facture as unknown as Facture,
    client,
    atelier: atelierComplet as unknown as Atelier,
    logo,
  });

  const nom = facture.numero ?? "Facture-brouillon";

  // Factur-X à la demande (`?facturx=1`). Le choix n'est pas automatique : une facture encore en
  // brouillon n'a pas de numéro et n'a rien à faire dans un circuit de facturation électronique.
  if (!facture.numero) return erreurPdf("Émettez la facture avant de générer son Factur-X : elle doit porter un numéro.", 409);
  const devis = facture.devis as unknown as { numero: string | null } | null;
  const donnees = donneesFacturX(facture as unknown as Facture, client, atelierComplet as unknown as Atelier, devis?.numero ?? null);
  const { pdf, manques } = await facturXDepuisFacture(document, donnees);
  if (manques.length > 0) {
    return erreurPdf(
      `Facture électronique impossible : il manque ${manques.join(", ")}. Complétez ces informations puis relancez.`,
      409,
    );
  }
  return reponsePdfBinaire(pdf, `${nom}-facturx`);
}
