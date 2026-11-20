import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_EMAIL, DEMO_PASSWORD, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Entrée dans l'atelier de démonstration, sans inscription.
 *
 * Le visiteur n'obtient pas un « mode démo » de l'interface : il entre dans le vrai produit, avec
 * les vrais écrans, sur un atelier réellement présent en base. Ce qui le tient, c'est la base :
 * l'atelier porte `demo = true` et un trigger refuse toute écriture sur ses lignes, y compris par
 * les fonctions publiques par jeton (signature de devis, pointage QR). L'interface ne fait
 * qu'expliquer ce mur, elle ne le construit pas.
 *
 * **Ce mur a eu un trou pendant plusieurs mois, et il faut savoir pourquoi pour ne pas le
 * refaire.** Le trigger `trg_interdire_ecriture_demo` protège les TABLES, en s'appuyant sur leur
 * colonne `atelier_id`. `storage.objects` n'a pas de colonne `atelier_id` : elle n'a qu'un nom de
 * fichier, et ses policies ne lisaient que le dossier de tête. La session délivrée ici — une
 * vraie session `authenticated`, propriétaire de l'atelier de démonstration — déposait donc ce
 * qu'elle voulait dans les trois buckets. Autrement dit : cette route offrait un hébergement de
 * fichiers gratuit et anonyme à qui cliquait sur « Voir la démonstration ».
 *
 * Depuis la migration `39_stockage_roles_familles_et_demo`, les policies d'écriture du stockage
 * passent par `atelier_du_membre_ecrivable()`, qui rend NULL sur un atelier de démonstration. La
 * lecture, elle, reste ouverte : la démonstration est faite pour être parcourue, photos comprises.
 *
 * La leçon générale : toute protection fondée sur `atelier_id` s'arrête là où la table n'en a
 * pas. `storage.objects` est aujourd'hui le seul cas ; s'il en apparaît un autre, il faudra le
 * traiter à part, comme celui-ci.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const destination = new URL("/dashboard", request.url);
  const accueil = new URL("/", request.url);

  if (!DEMO_PASSWORD) {
    accueil.searchParams.set("demo", "indisponible");
    return NextResponse.redirect(accueil);
  }

  // La réponse est construite d'abord : c'est sur elle que sont posés les cookies de session,
  // et une redirection émise avant ce dépôt renverrait le visiteur vers /login.
  const response = NextResponse.redirect(destination);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) {
    accueil.searchParams.set("demo", "indisponible");
    return NextResponse.redirect(accueil);
  }

  return response;
}
