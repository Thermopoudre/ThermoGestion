import { createClient } from "@/lib/supabase/server";
import { chargerLogo, erreurPdf, reponsePdf } from "@/lib/pdf/render";
import { capaciteServeur, messageCapacite } from "@/lib/abonnement-serveur";
import { CertificatDocument, type ControleAvecOperateur, type FourneeAvecOperateur, type ProjetCertificat } from "@/lib/pdf/qualite";
import { blocagesCertificat, certificationDeReference, labelOpposable, typesNonAttestes } from "@/lib/certificat";
import { typesControleActifs } from "@/lib/qualite";
import type { Atelier, AtelierLot2, Certification, Instrument, ReferentielQualite } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) : jamais de cache ni de pré-rendu.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  const { data: membre } = await supabase.from("users").select("atelier_id").maybeSingle();
  if (!membre) return erreurPdf("Atelier introuvable.", 404);

  // Le droit de formule est rejoué ici : une route PDF ne passe pas par le trigger d'écriture,
  // et une URL connue ne doit pas ouvrir un document que la formule ne couvre pas.
  if (!(await capaciteServeur(supabase, "certificat"))) return erreurPdf(messageCapacite("certificat"), 402);

  // Aucun filtre `atelier_id` recopié à la main : c'est RLS qui cloisonne. Un projet d'un autre
  // atelier ressort donc « introuvable », ce que la recette vérifie depuis le navigateur.
  const { data: projetBrut } = await supabase
    .from("projets")
    .select(
      "id, numero, nom, surface_m2, couches, teinte_origine, date_reception, date_livraison, " +
        "clients(nom), " +
        "poudres(marque, reference, ral, finition, type, epaisseur_um_min, epaisseur_um_max), " +
        "poudre_lots:lot_id(numero, fournisseur, dlu)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!projetBrut) return erreurPdf("Projet introuvable.", 404);
  const projet = projetBrut as unknown as ProjetCertificat;

  const [{ data: atelierBrut }, { data: controlesBruts }, { data: instrumentsBruts }, { data: fourneeLiens }, { data: certifs }, { data: refBrut }] = await Promise.all([
    supabase.from("ateliers").select("*").eq("id", membre.atelier_id).maybeSingle(),
    supabase.from("controles").select("*, users:operateur_id(nom)").eq("projet_id", id).order("mesure_at"),
    supabase.from("instruments").select("*"),
    supabase.from("fournee_projets").select("fournees(*, poudres(reference, ral), users:operateur_id(nom))").eq("projet_id", id),
    supabase.from("certifications").select("*").eq("actif", true),
    supabase.from("referentiels_qualite").select("*").eq("actif", true).order("par_defaut", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!atelierBrut) return erreurPdf("Atelier introuvable.", 404);

  const atelier = atelierBrut as Atelier & AtelierLot2;
  const controles = (controlesBruts as unknown as ControleAvecOperateur[]) ?? [];
  const instruments = (instrumentsBruts as unknown as Instrument[]) ?? [];
  const fournees = ((fourneeLiens as unknown as { fournees: FourneeAvecOperateur }[]) ?? []).map((l) => l.fournees).filter(Boolean);
  const certification = certificationDeReference((certifs as unknown as Certification[]) ?? []);
  // Contrôles réellement pratiqués par l'atelier : ils décident ce que le certificat exige, et
  // surtout ce qu'il s'interdit d'affirmer.
  const typesActifs = typesControleActifs(refBrut as ReferentielQualite | null);

  const contexte = {
    controles,
    instruments,
    fournees,
    lotNumero: projet.poudre_lots?.numero ?? null,
    certificationExpireLe: certification?.expire_le ?? null,
    certificationLabel: certification?.label ?? null,
    typesActifs,
  };
  const blocages = blocagesCertificat(contexte);
  if (blocages.length > 0) {
    // Le certificat est opposable : plutôt qu'un document trompeur, on rend la raison exacte du
    // refus, lisible dans l'onglet du navigateur qui a ouvert l'URL.
    return erreurPdf(
      `Certificat de conformité non émis pour ${projet.numero ?? projet.nom} :\n\n` +
        blocages.map((b) => `• ${b.message}`).join("\n"),
      409,
    );
  }

  const document = CertificatDocument({
    projet,
    atelier,
    controles,
    fournees,
    certification,
    label: labelOpposable(certification?.label ?? null, certification?.expire_le ?? null),
    nonAttestes: typesNonAttestes(contexte),
    logo: await chargerLogo(atelier.logo_url),
  });

  return reponsePdf(document, `certificat-conformite-${projet.numero ?? projet.id.slice(0, 8)}`);
}
