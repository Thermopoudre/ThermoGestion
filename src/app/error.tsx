"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RotateCw } from "lucide-react";
import Wordmark from "@/components/Wordmark";

/**
 * Écran de panne — celui qui s'affiche quand une page lève une exception au rendu.
 *
 * POURQUOI il fallait l'écrire. Sans `error.tsx`, Next.js remplace la page par un écran vide en
 * production : ni message, ni bouton, ni indication. L'exploitant conclut que le logiciel est
 * mort, et il appelle. La page ci-dessous dit trois choses, et pas une de plus : ce n'est pas de
 * votre faute, vos données sont intactes, voici comment réessayer.
 *
 * **On n'affiche pas `error.message`.** Ce message est écrit pour un développeur ; il contient
 * parfois un nom de table ou un fragment de requête. Le montrer inquiète sans aider, et c'est
 * exactement la ligne que l'utilisateur recopie dans un mail affolé. En revanche `error.digest`
 * est affiché : c'est l'identifiant que Vercel attache à la trace côté serveur, et c'est le seul
 * élément qui permet de retrouver l'incident dans les journaux quand l'atelier le signale.
 *
 * `reset()` rejoue le rendu du segment fautif sans recharger la page — c'est la bonne première
 * tentative pour une erreur transitoire (réseau coupé, jeton expiré au mauvais moment).
 */
export default function ErreurApplication({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // La console du navigateur reste le seul endroit où le détail complet a sa place : elle est
    // consultable par qui saura quoi en faire, et invisible pour les autres.
    console.error("Thermogestion — erreur de rendu :", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <Wordmark />
        </div>

        <div
          aria-hidden
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-light text-warning-dark"
        >
          <AlertTriangle size={24} />
        </div>

        <h1 className="font-display text-lg font-bold text-gray-900">Cet écran n&apos;a pas pu s&apos;afficher</h1>
        <p className="mt-2 text-sm text-gray-600">
          Une erreur est survenue pendant l&apos;affichage de la page. <b>Vos données sont
          intactes</b> : rien n&apos;a été enregistré ni effacé au moment de l&apos;incident.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <RotateCw size={16} aria-hidden /> Réessayer
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <LayoutDashboard size={16} aria-hidden /> Revenir au tableau de bord
          </Link>
        </div>

        <p className="mt-5 text-xs text-gray-500">
          Si l&apos;écran refuse toujours de s&apos;afficher, écrivez-nous à{" "}
          <a className="underline underline-offset-2" href="mailto:contact@thermopoudre.fr">
            contact@thermopoudre.fr
          </a>
          {error.digest ? (
            <>
              {" "}en citant la référence <code className="rounded bg-gray-100 px-1 py-0.5">{error.digest}</code> —
              elle nous mène directement à l&apos;incident.
            </>
          ) : (
            <> en décrivant ce que vous étiez en train de faire.</>
          )}
        </p>
      </div>
    </main>
  );
}
