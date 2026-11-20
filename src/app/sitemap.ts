import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-static";

/**
 * Pages réellement publiques et indexables. Tout le reste vit derrière l'authentification —
 * `/login` en est sorti (Lot G, point 3) : elle porte `robots: { index: false }` depuis
 * `src/app/login/layout.tsx`, et un sitemap qui recommande une page en `noindex` est justement
 * l'incohérence que Google signale dans la Search Console.
 *
 * `misAJour` remplace `new Date()` recalculée à chaque build (Lot G, point 3) : un `lastModified`
 * qui change à chaque déploiement sans que le contenu ait bougé n'a aucune valeur pour un robot
 * qui décide de repasser ou non — et à la longue, il apprend à l'ignorer. La date est pour
 * l'instant tenue à la main, au dernier changement réel connu du contenu de chaque page ; le jour
 * où une page a un vrai horodatage de modification (CMS, base), c'est lui qu'il faudra lire ici.
 */
const PAGES: {
  chemin: string;
  priorite: number;
  frequence: MetadataRoute.Sitemap[number]["changeFrequency"];
  misAJour: string;
}[] = [
  { chemin: "/", priorite: 1, frequence: "weekly", misAJour: "2026-09-04" },
  // Les deux pages de métier portent le référencement : l'accueil distribue, elles convertissent.
  { chemin: "/logiciel-renovation-jantes", priorite: 0.9, frequence: "monthly", misAJour: "2026-08-20" },
  { chemin: "/logiciel-sous-traitance-thermolaquage", priorite: 0.9, frequence: "monthly", misAJour: "2026-08-20" },
  { chemin: "/prix-logiciel-thermolaquage", priorite: 0.8, frequence: "monthly", misAJour: "2026-08-20" },
  { chemin: "/signup", priorite: 0.8, frequence: "monthly", misAJour: "2026-09-04" },
  // Centre d'aide public (Lot G, point 6) : `/aide` est déjà pris par le centre d'aide de
  // l'application, fermé aux visiteurs sans session — voir `src/app/aide-publique/page.tsx`.
  { chemin: "/aide-publique", priorite: 0.6, frequence: "monthly", misAJour: "2026-09-04" },
  // Route d'entrée dans l'atelier de démonstration : toujours une redirection (vers /dashboard ou
  // vers / en cas d'échec), jamais de contenu propre. Elle reste dans le sitemap pour la même
  // raison qu'elle reste dans `llms.txt` — un visiteur ou un moteur de réponse qui la suit
  // atterrit sur le vrai produit — et sort du `disallow` de `robots.ts` pour la même raison
  // (Lot G, intro : elle y était bloquée tout en étant recommandée dans `llms.txt`).
  { chemin: "/demo", priorite: 0.5, frequence: "monthly", misAJour: "2026-08-21" },
  { chemin: "/legal/mentions", priorite: 0.2, frequence: "yearly", misAJour: "2026-08-21" },
  { chemin: "/legal/cgu", priorite: 0.2, frequence: "yearly", misAJour: "2026-08-21" },
  { chemin: "/legal/confidentialite", priorite: 0.2, frequence: "yearly", misAJour: "2026-08-21" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ chemin, priorite, frequence, misAJour }) => ({
    url: `${SITE_URL}${chemin}`,
    lastModified: new Date(misAJour),
    changeFrequency: frequence,
    priority: priorite,
  }));
}
