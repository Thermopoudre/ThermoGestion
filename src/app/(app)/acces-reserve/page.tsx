import Link from "next/link";
import { Lock } from "lucide-react";
import { MESSAGE_REFUS, type Refus } from "@/lib/roles";

/**
 * L'écran qu'on affiche à la place d'une rubrique fermée par le rôle.
 *
 * Il ne remplace pas le verrou — la base refuse déjà les lignes, et c'est elle qui protège. Il
 * remplace le pire des affichages : une liste vide, sans message, qui se lit comme une panne. Un
 * opérateur qui voit « Devis (0) » appelle son patron, qui appelle le support. Une phrase suffit
 * à éviter les deux appels.
 */
export default async function AccesReservePage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string; depuis?: string }>;
}) {
  const { motif, depuis } = await searchParams;
  const refus: Refus =
    motif === "proprietaire" || motif === "hors_perimetre_comptable" ? motif : "commercial";
  const { titre, texte } = MESSAGE_REFUS[refus];

  return (
    <div className="md:max-w-2xl">
      <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Lock size={16} aria-hidden />
          </span>
          <h1 className="font-display text-base font-bold text-gray-900">{titre}</h1>
        </div>

        <p className="text-sm leading-relaxed text-gray-700">{texte}</p>

        {depuis && (
          <p className="text-xs text-gray-500">
            Page demandée : <code className="rounded bg-gray-100 px-1 py-0.5">{depuis}</code>
          </p>
        )}

        <Link
          href="/dashboard"
          className="rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Revenir à mon travail →
        </Link>
      </div>
    </div>
  );
}
