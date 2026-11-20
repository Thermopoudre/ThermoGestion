"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { PRIX_ENTREE } from "@/lib/abonnement";
import { usePiegeFocus } from "@/components/usePiegeFocus";

/**
 * Fin d'essai : l'atelier garde ses données sous les yeux mais ne peut plus rien modifier.
 * L'écran est volontairement grisé plutôt que vidé — voir son propre atelier derrière le
 * voile est plus convaincant qu'une page blanche, et rassure sur le fait que rien n'est perdu.
 * Le blocage réel est en base (trigger `exiger_abonnement`), ceci n'en est que la traduction visuelle.
 */
export default function BlocageAbonnement() {
  const path = usePathname();
  // On laisse passer la page d'abonnement, les réglages et l'aide : sans ça, impossible de payer,
  // et un atelier bloqué qui cherche à comprendre ce qui lui arrive n'a plus aucune lecture.
  const masque = !!(path?.startsWith("/abonnement") || path?.startsWith("/reglages") || path?.startsWith("/aide"));
  // Piège de focus sans Échap : ce voile ne se ferme pas, il n'y a rien à annuler. Sans lui, la
  // tabulation traversait le voile et permettait de créer un devis avec un abonnement expiré —
  // en apparence seulement (la base refuse), mais l'atelier voyait un formulaire s'ouvrir sous
  // un écran qui lui dit qu'il ne peut plus rien créer.
  //
  // Le crochet est appelé avant tout `return` : React interdit d'appeler un hook après une sortie
  // conditionnelle, et le blocage se démonte à chaque changement de page.
  const boite = usePiegeFocus<HTMLDivElement>(!masque);
  if (masque) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-gray-900/40 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="Votre essai est terminé">
      <div ref={boite} className="m-4 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-brand">
          <Lock size={20} aria-hidden />
        </div>
        <h2 className="font-display text-lg font-bold">Votre essai est terminé</h2>
        <p className="mt-2 text-sm text-gray-600">
          Tout votre travail est là, intact et consultable. Vous ne pouvez simplement plus créer ni
          modifier. Choisissez une formule pour reprendre la main sur vos devis, vos projets et
          votre stock — sur les mêmes données.
        </p>
        <Link
          href="/abonnement"
          data-focus-initial
          className="mt-4 block rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Voir les formules
        </Link>
        <p className="mt-3 text-xs text-gray-500">
          À partir de {PRIX_ENTREE} € HT par mois, sans engagement.
        </p>
      </div>
    </div>
  );
}
