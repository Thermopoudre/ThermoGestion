import { createClient } from "@/lib/supabase/server";
import { chargerLogo, erreurPdf, reponsePdf } from "@/lib/pdf/render";
import { capaciteServeur, messageCapacite } from "@/lib/abonnement-serveur";
import { FicheCuissonDocument, type FourneeAvecOperateur, type LigneCuisson } from "@/lib/pdf/qualite";
import type { Atelier, AtelierFour } from "@/lib/types";

export const runtime = "nodejs";
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
  if (!(await capaciteServeur(supabase, "fiche_cuisson"))) return erreurPdf(messageCapacite("fiche_cuisson"), 402);

  const [{ data: fourneeBrute }, { data: compo }, { data: atelierBrut }] = await Promise.all([
    supabase.from("fournees").select("*, poudres(reference, ral), users:operateur_id(nom)").eq("id", id).maybeSingle(),
    supabase
      .from("fournee_projets")
      .select("surface_m2, position, projets(numero, nom, couches, clients(nom), poudre_lots:lot_id(numero))")
      .eq("fournee_id", id)
      .order("position"),
    supabase.from("ateliers").select("*").eq("id", membre.atelier_id).maybeSingle(),
  ]);
  if (!fourneeBrute) return erreurPdf("Fournée introuvable.", 404);
  if (!atelierBrut) return erreurPdf("Atelier introuvable.", 404);

  const document = FicheCuissonDocument({
    fournee: fourneeBrute as unknown as FourneeAvecOperateur,
    lignes: (compo as unknown as LigneCuisson[]) ?? [],
    atelier: atelierBrut as Atelier & AtelierFour,
    logo: await chargerLogo(atelierBrut.logo_url),
  });

  const numero = (fourneeBrute as { numero: string | null }).numero;
  return reponsePdf(document, `fiche-cuisson-${numero ?? id.slice(0, 8)}`);
}
