import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import {
  PREFIXES_COMMERCIAUX,
  PREFIXES_COMPTABLES,
  PREFIXES_PROPRIETAIRE,
  estRole,
  refusDeRole,
} from "@/lib/roles";

/**
 * Ce qui est protégé, plutôt que ce qui est public.
 *
 * La liste blanche précédente était le bon modèle à l'envers : toute page ajoutée à la vitrine
 * répondait 307 vers `/login` tant que personne n'avait pensé à l'y inscrire — ce qui est arrivé
 * au jour même où les pages de destination ont été publiées, et qui serait arrivé à chaque guide
 * suivant. Le produit, lui, tient dans un dossier fini : ce sont les écrans de `(app)`,
 * l'inscription guidée et les routes d'API qui parlent à l'atelier. Tout le reste est de la
 * vitrine, et la vitrine est publique par construction.
 *
 * La vraie barrière n'est pas ici de toute façon : c'est la RLS, qui s'applique à chaque table et
 * qui est attaquée depuis un client PostgREST anonyme à chaque exécution des tests. Le middleware
 * ne fait qu'éviter d'afficher une coquille vide à un visiteur non connecté.
 */
const PREFIXES_PRIVES = [
  "/dashboard", "/devis", "/projets", "/factures", "/clients", "/jantes", "/fournees",
  "/receptions", "/stock", "/lots", "/commandes", "/qualite", "/pilotage", "/pointage",
  "/reglages", "/import", "/abonnement", "/scan", "/onboarding", "/aide", "/acces-reserve",
  "/comptable", "/relances", "/corbeille", "/factures-recues",
  // `/portail/<jeton>` est volontairement absent : c'est l'espace que le client consulte sans
  // compte, comme /d/, /f/, /bl/<jeton> et /rc/. Son cloisonnement est porté par le jeton et par
  // les fonctions `portail_*`, pas par une session.
  // /api/ip, /api/leads et /api/stripe/webhook sont volontairement absents : le premier est
  // appelé par les pages de signature publiques pour horodater l'adresse du signataire, le
  // deuxième reçoit le formulaire de rappel de la vitrine, le troisième vient de Stripe.
  "/api/billing", "/api/pdf", "/api/export", "/api/factures", "/api/stripe/connect",
  "/api/adresse", "/api/entreprise", "/api/catalogue",
];

/**
 * `/bl` est le seul chemin partagé entre l'atelier et ses clients : `/bl` et `/bl/new` sont les
 * écrans de l'atelier, `/bl/fiche/<id>` la fiche interne, et `/bl/<jeton>` le bon que le client
 * signe sans compte. Les trois premiers sont privés, le dernier ne peut pas l'être.
 */
function estPrive(path: string) {
  if (path === "/bl" || path.startsWith("/bl/new") || path.startsWith("/bl/fiche")) return true;
  return PREFIXES_PRIVES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Le chemin demandé dépend-il du rôle ?
 *
 * On ne pose la question au serveur SQL que pour ces chemins-là : une requête de rôle sur chaque
 * navigation doublerait le temps de réponse de tout le produit pour protéger cinq rubriques. Et
 * ce n'est de toute façon pas ce qui protège — la RLS refuse les lignes quoi qu'il arrive. Ici on
 * évite seulement d'afficher un écran vide sans explication.
 */
function dependDuRole(path: string) {
  return [...PREFIXES_COMMERCIAUX, ...PREFIXES_PROPRIETAIRE, ...PREFIXES_COMPTABLES].some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

// Fichiers d'exploration. Le matcher les exclut déjà, mais un robots.txt qui répond 307 vers
// /login fait traiter le site comme « exploration interdite » par Google : la ceinture vaut la
// bretelle, et la règle doit rester lisible ici même si quelqu'un retouche le matcher.
const FICHIERS_CRAWL = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);

// Pages où une session existante mérite une redirection de confort vers le tableau de bord.
const REDIRIGER_SI_CONNECTE = new Set(["/", "/login", "/signup"]);

/**
 * Présence d'un cookie de session, sans aller la faire valider par Supabase.
 *
 * `supabase.auth.getUser()` est un aller-retour réseau, et le client `@supabase/ssr` repose des
 * cookies sur la réponse : appelé sur la page d'accueil, il ajoutait 150 à 250 ms au TTFB de la
 * vitrine et posait un `Set-Cookie` qui interdit toute mise en cache CDN d'une page publique.
 * Ici on ne décide que d'une redirection de confort — un cookie périmé mène à /dashboard, qui
 * est une route protégée et vérifie pour de bon avant de renvoyer vers /login. Aucun accès n'est
 * jamais accordé sur la foi de ce test.
 */
function aUnCookieDeSession(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (FICHIERS_CRAWL.has(path)) return NextResponse.next();

  if (!estPrive(path)) {
    // …sauf si le visiteur suit un lien d'invitation : le renvoyer sur son tableau de bord en
    // effaçant la requête ferait mourir le jeton, et le lien reçu passerait pour cassé.
    if (
      REDIRIGER_SI_CONNECTE.has(path) &&
      !request.nextUrl.searchParams.has("invite") &&
      aUnCookieDeSession(request)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Route protégée : là seulement, la session est réellement validée et rafraîchie.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Rubrique fermée par le rôle : on **réécrit** vers l'écran d'explication plutôt que de
  // rediriger. L'URL demandée reste dans la barre d'adresse — l'employé qui a suivi un lien
  // envoyé par son patron voit où il a atterri et pourquoi, au lieu de se retrouver sur un
  // tableau de bord sans un mot. Une redirection dirait « cette page n'existe pas » ; une page
  // vide dirait « c'est en panne ». Ni l'un ni l'autre n'est vrai.
  if (dependDuRole(path)) {
    const { data: membre } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    const role = estRole(membre?.role) ? membre.role : null;
    const refus = refusDeRole(path, role);
    if (refus) {
      const url = request.nextUrl.clone();
      url.pathname = "/acces-reserve";
      url.search = `?motif=${refus}&depuis=${encodeURIComponent(path)}`;
      return NextResponse.rewrite(url, { request });
    }
  }

  return response;
}

export const config = {
  // robots.txt, sitemap.xml et llms.txt doivent sortir du matcher : sans ça le middleware les
  // attrape avant que Next ne les serve et répond 307 vers /login — un robots.txt qui redirige
  // vers du HTML est lu par Google comme « indisponible », et l'exploration du site s'arrête là.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
