import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Dépôt d'une demande de rappel depuis la vitrine.
 *
 * Passe par une route serveur plutôt que par le client Supabase du navigateur pour trois raisons :
 * le pot de miel et la limite de débit ne se posent pas côté client, l'adresse IP n'a pas à
 * traverser le navigateur, et le formulaire fonctionne même si le visiteur bloque le SDK.
 *
 * Le garde-fou réel n'est pas ici : c'est la policy `leads_insert_public` (forme de l'e-mail,
 * longueurs, `status = 'nouveau'` imposé, aucune lecture possible). Cette route ne fait qu'ajouter
 * ce que la base ne peut pas voir. Elle utilise donc la clé anonyme, pas la clé de service :
 * une route publique n'a aucune raison de porter un pouvoir qu'elle n'utilise pas.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Limite de débit en mémoire du conteneur : dissuasive, pas infaillible — c'est assumé. */
const derniers = new Map<string, number[]>();
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 5;

function tropDeDemandes(ip: string) {
  const maintenant = Date.now();
  const recentes = (derniers.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  recentes.push(maintenant);
  derniers.set(ip, recentes);
  if (derniers.size > 5000) derniers.clear();
  return recentes.length > MAX_PAR_FENETRE;
}

function texte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function POST(request: NextRequest) {
  let corps: Record<string, unknown>;
  try {
    corps = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  // Pot de miel : un champ invisible pour un humain, rempli par la plupart des robots de
  // formulaire. On répond « c'est enregistré » sans rien écrire — un robot qui reçoit une erreur
  // réessaie, un robot qui reçoit un succès passe au site suivant.
  if (texte(corps.societe_web, 200)) return NextResponse.json({ ok: true });

  const email = texte(corps.email, 200);
  if (!email || !/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Indiquez une adresse e-mail valide." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (tropDeDemandes(ip)) {
    return NextResponse.json({ error: "Trop de demandes envoyées. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const utm = corps.utm && typeof corps.utm === "object" ? (corps.utm as Record<string, unknown>) : null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.from("leads").insert({
    nom: texte(corps.nom, 120),
    email,
    telephone: texte(corps.telephone, 40),
    atelier_nom: texte(corps.atelier_nom, 160),
    message: texte(corps.message, 2000),
    source: texte(corps.source, 60) ?? "vitrine",
    utm: utm && Object.keys(utm).length ? utm : null,
    status: "nouveau",
  });

  if (error) {
    return NextResponse.json({ error: "L'enregistrement a échoué. Écrivez-nous à contact@thermopoudre.fr." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
