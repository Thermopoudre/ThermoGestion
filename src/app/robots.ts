import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Statique : le fichier ne dépend d'aucune requête, et un robots.txt rendu dynamiquement hérite
// du `no-store` des pages dynamiques — Google le rechargerait à chaque exploration.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Les chemins par jeton (/d/ /s/ /f/ /bl/<jeton> /rc/ /jt/ /portail/) ne sont
        // volontairement PAS interdits ici : ils sont désindexés par un en-tête
        // `X-Robots-Tag: noindex` (next.config.ts), et un robot doit pouvoir lire la page pour
        // voir cet en-tête. Les interdire des deux côtés produirait l'inverse du but recherché —
        // une URL connue, jamais explorée, donc indexable sur la seule foi d'un lien entrant.
        //
        // `/demo` est sorti de cette liste (Lot G, intro) : elle était bloquée ici tout en étant
        // recommandée dans `llms.txt` et présente dans le sitemap — la même page ne peut pas
        // dire aux robots classiques « n'entrez pas » et aux moteurs de réponse « venez voir ».
        // C'est une redirection sans contenu propre (302 vers /dashboard ou vers /), donc rien à
        // indexer de toute façon : l'interdire n'apportait qu'une incohérence, pas une protection.
        //
        // Le reste est la surface privée de l'application (le groupe de routes `(app)` du code,
        // invisible dans l'URL) : mêmes préfixes que `PREFIXES_PRIVES` dans `src/middleware.ts`,
        // qui redirige déjà tout visiteur non connecté vers `/login`. Un robot qui les suivrait
        // n'y verrait qu'un écran de connexion, mais autant lui épargner l'aller-retour et
        // préserver le budget d'exploration pour les pages qui comptent.
        disallow: [
          "/api/",
          "/dashboard", "/devis", "/projets", "/factures", "/clients", "/jantes", "/fournees",
          "/receptions", "/stock", "/lots", "/commandes", "/qualite", "/pilotage", "/pointage",
          "/reglages", "/import", "/abonnement", "/scan", "/onboarding", "/acces-reserve",
          "/comptable", "/relances", "/corbeille",
          // `/aide$` (fin exacte) + `/aide/` (ses tutoriels) plutôt que `/aide` seul : un préfixe
          // nu aurait aussi masqué `/aide-publique`, le centre d'aide public du point 6 ci-dessous.
          "/aide$", "/aide/",
          // `/bl` et `/bl/new`, `/bl/fiche/…` sont les écrans internes ; `/bl/<jeton>` (le bon
          // signé par le client) reste public, comme les autres routes par jeton.
          "/bl/new", "/bl/fiche",
          "/reinitialiser",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
