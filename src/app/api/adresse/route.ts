import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Base Adresse Nationale — normalise et géolocalise une adresse française.
// Sert à deux choses : éviter les adresses mal saisies sur les factures (mention obligatoire),
// et récupérer lat/lon pour les tournées et la carte.
const BAN = "https://api-adresse.data.gouv.fr/search/";

export async function GET(req: NextRequest) {
  // Audit sécurité du 07/09/2026 (constat 3) : cette route relaie vers une API publique de
  // l'État, mais sans rien devant elle, n'importe qui peut s'en servir comme proxy anonyme
  // (consommation de quota, risque de blocage de l'IP Vercel). `/api/adresse` est déjà dans
  // `PREFIXES_PRIVES` du middleware (src/middleware.ts) — vérifié en production le 07/09/2026,
  // un appel sans session y reçoit un 307 vers /login — mais compter uniquement sur cette liste
  // est fragile : un futur retrait de la ligne rouvrirait la route sans qu'aucun test ne le voie.
  // Seuls des écrans connectés l'appellent (ClientForm, AdresseInput, réglages, onboarding — aucun
  // formulaire d'inscription avant connexion) : la session est donc exigée ici aussi, en défense
  // en profondeur, avec le même motif que les autres routes API du produit.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const cp = (req.nextUrl.searchParams.get("cp") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ resultats: [] });

  try {
    const url = new URL(BAN);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");
    if (/^\d{5}$/.test(cp)) url.searchParams.set("postcode", cp);

    const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();

    const resultats = (data.features ?? []).map((f: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => {
      const p = f.properties;
      return {
        label: p.label as string,
        adresse: [p.housenumber, p.street].filter(Boolean).join(" ") || (p.name as string) || "",
        code_postal: (p.postcode as string) ?? "",
        ville: (p.city as string) ?? "",
        // Le score BAN va de 0 à 1. En dessous de ~0,6 le rapprochement est douteux,
        // on préfère alors ne pas marquer l'adresse comme vérifiée.
        score: Number(p.score ?? 0),
        latitude: f.geometry?.coordinates?.[1] ?? null,
        longitude: f.geometry?.coordinates?.[0] ?? null,
      };
    });

    return NextResponse.json({ resultats });
  } catch {
    return NextResponse.json({ resultats: [], erreur: "Vérification d'adresse indisponible." });
  }
}
