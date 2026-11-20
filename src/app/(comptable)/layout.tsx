import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import { accesCommercial, estComptable, estRole } from "@/lib/roles";

/**
 * La coquille du cabinet.
 *
 * Volontairement séparée de celle de l'atelier, et volontairement pauvre : pas de barre de
 * production, pas de bandeau d'essai, pas de blocage d'abonnement. Un expert-comptable qui ouvre
 * le lien qu'on lui a envoyé doit voir une chose et une seule — les écritures de son client — et
 * comprendre en trois secondes qu'il n'a rien à administrer ici. Lui servir le gabarit d'un
 * atelier de thermolaquage, avec « Fournées » et « Pointage » dans le menu, ce serait lui donner
 * l'impression d'être entré par erreur dans un logiciel qui n'est pas pour lui.
 *
 * Le bureau et le responsable y ont accès aussi : c'est là qu'ils règlent la cadence de remise et
 * vérifient ce qui est déjà parti. Ils gardent leur propre navigation par ailleurs.
 */
export default async function LayoutComptable({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membre } = await supabase.from("users").select("role").maybeSingle();
  if (!membre) redirect("/onboarding");
  const role = estRole(membre.role) ? membre.role : null;
  // L'opérateur d'atelier n'a rien à faire dans les pièces comptables. Le middleware le renvoie
  // déjà, mais un verrou d'affichage qui ne tient que par le middleware est un verrou qui saute
  // au premier changement de matcher.
  if (!estComptable(role) && !accesCommercial(role)) {
    redirect("/acces-reserve?motif=commercial&depuis=/comptable");
  }

  const { data: entete } = await supabase.rpc("entete_comptable");
  const atelier = (entete ?? null) as { nom: string | null } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            {atelier?.nom && (
              <span className="hidden truncate text-sm text-gray-500 sm:inline">
                dossier <b className="font-medium text-gray-800">{atelier.nom}</b>
              </span>
            )}
          </div>
          {/* Le responsable et le bureau reviennent chez eux ; le comptable n'a pas de « chez
              lui » ailleurs, et cette sortie ne s'affiche donc pas pour lui. */}
          {accesCommercial(role) && (
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              ← Mon atelier
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:px-8 md:py-6">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-xs text-gray-500 md:px-8">
        Accès expert-comptable en lecture seule. Aucune écriture n&apos;est possible depuis cet
        espace : les pièces que vous consultez sont figées côté atelier.
      </footer>
    </div>
  );
}
