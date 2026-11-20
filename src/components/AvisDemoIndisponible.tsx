"use client";
import { useSearchParams } from "next/navigation";

/**
 * Avis « la démonstration est indisponible », lu côté navigateur.
 *
 * Raison d'être : tant que la page d'accueil lit `searchParams` côté serveur, Next.js la rend
 * dynamiquement à chaque visite — `x-vercel-cache: MISS` sur toutes les requêtes, TTFB de 250 à
 * 380 ms sur une page marketing qui ne change jamais. Déplacer la seule dépendance à l'URL dans
 * un composant client rend la page entièrement statique.
 *
 * À poser dans `src/app/page.tsx` en remplacement du bloc `demo === "indisponible"` :
 *
 *   export default function Home() {            // ni `async`, ni `searchParams`
 *     ...
 *     <Suspense fallback={null}><AvisDemoIndisponible /></Suspense>
 *
 * `useSearchParams` impose la frontière `<Suspense>` dans une page prérendue.
 */
export default function AvisDemoIndisponible() {
  if (useSearchParams().get("demo") !== "indisponible") return null;
  return (
    <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
      La démonstration est momentanément indisponible. Écrivez-nous à contact@thermopoudre.fr,
      nous vous la montrons en direct.
    </p>
  );
}
