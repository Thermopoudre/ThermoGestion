import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Annuaire des entreprises (API publique de l'État, sans clé ni quota contractuel).
// On passe par une route serveur plutôt que d'appeler depuis le navigateur : ça évite
// les surprises CORS et ça nous laisse la main pour mettre en cache si le volume monte.
const API = "https://recherche-entreprises.api.gouv.fr/search";

// Codes INSEE de catégorie juridique les plus courants chez nos ateliers.
const FORMES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5410": "SARL",
  "5498": "EURL",
  "5499": "SARL",
  "5505": "SA",
  "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "5785": "SAS",
  "6540": "SCI",
};

export async function GET(req: NextRequest) {
  // Audit sécurité du 07/09/2026 (constat 3) : même raisonnement que /api/adresse — proxy public
  // sans borne propre, déjà dans `PREFIXES_PRIVES` du middleware (vérifié en production : 307 vers
  // /login sans session), mais la session est exigée ici aussi en défense en profondeur. Seuls
  // ClientForm (fiche client) et l'onboarding, tous deux connectés, appellent cette route ; aucun
  // formulaire d'inscription ne recherche un SIREN avant la création du compte dans ce dépôt.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const siren = (req.nextUrl.searchParams.get("siren") ?? "").replace(/\D/g, "");
  if (siren.length !== 9 && siren.length !== 14) {
    return NextResponse.json({ error: "Indiquez un SIREN (9 chiffres) ou un SIRET (14 chiffres)." }, { status: 400 });
  }

  try {
    const res = await fetch(`${API}?q=${siren.slice(0, 9)}&page=1&per_page=1`, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) {
      return NextResponse.json({ error: "Aucune entreprise trouvée pour ce numéro." }, { status: 404 });
    }
    const siege = r.siege ?? {};
    const codeForme = String(r.nature_juridique ?? "");

    return NextResponse.json({
      siren: r.siren,
      siret: siege.siret ?? null,
      nom: r.nom_raison_sociale || r.nom_complet || null,
      forme_juridique: FORMES[codeForme] ?? (codeForme || null),
      code_ape: r.activite_principale ?? null,
      adresse: siege.adresse ?? null,
      code_postal: siege.code_postal ?? null,
      ville: siege.libelle_commune ?? null,
      latitude: siege.latitude ? Number(siege.latitude) : null,
      longitude: siege.longitude ? Number(siege.longitude) : null,
      cessee: r.etat_administratif === "C",
    });
  } catch {
    return NextResponse.json(
      { error: "L'annuaire des entreprises est momentanément indisponible. Vous pouvez saisir les informations à la main." },
      { status: 502 }
    );
  }
}
