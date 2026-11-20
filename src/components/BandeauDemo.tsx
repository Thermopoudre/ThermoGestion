"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Bandeau de l'atelier de démonstration.
 *
 * Il dit deux choses au visiteur : où il est, et pourquoi ses clics d'enregistrement ne feront
 * rien. Le verrou lui-même est en base (`ateliers.demo`), ce bandeau ne fait que l'annoncer —
 * sans lui, le visiteur croirait à un bug.
 */
export default function BandeauDemo() {
  const router = useRouter();

  async function quitter() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-xs text-white">
      <span>
        <b>Démonstration</b> — vous visitez un atelier fictif. Tout est consultable, rien n&apos;est
        enregistrable.
      </span>
      {/* Reliquat vague 3 — ni le lien ni le bouton de ce bandeau n'avaient d'indicateur de focus
          clavier. `outline-white`, pas `outline-brand` : ce bandeau est sombre (`bg-ink`), comme
          l'en-tête de la vitrine (`marketing/Chrome.tsx`), qui fait le même choix pour la même
          raison de contraste. */}
      <Link href="/signup" className="rounded bg-tpblue px-2.5 py-1 font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Créer mon atelier
      </Link>
      <button type="button" onClick={quitter} className="rounded underline underline-offset-2 text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Quitter la démo
      </button>
    </div>
  );
}
