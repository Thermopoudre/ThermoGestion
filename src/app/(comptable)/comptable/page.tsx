import { createClient } from "@/lib/supabase/server";
import EspaceComptable from "@/components/EspaceComptable";
import { accesCommercial, estRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Écritures et exports — accès expert-comptable",
  robots: { index: false, follow: false },
};

/**
 * L'écran d'accueil du cabinet.
 *
 * Le rôle est résolu ici, côté serveur, et descendu à l'écran : c'est lui qui décide si la carte
 * « cadence de remise » s'affiche. Ce n'est pas un verrou — la RLS refuse déjà l'écriture au
 * comptable — c'est ce qui évite de lui montrer un formulaire que la base rejettera.
 */
export default async function PageComptable() {
  const supabase = await createClient();
  const { data: membre } = await supabase.from("users").select("role").maybeSingle();
  const role = estRole(membre?.role) ? membre.role : null;

  const { data: entete } = await supabase.rpc("entete_comptable");
  const atelier = (entete ?? null) as { nom: string | null; siren: string | null } | null;

  return (
    <EspaceComptable
      atelierNom={atelier?.nom ?? ""}
      peutRegler={accesCommercial(role)}
    />
  );
}
