import { createClient } from "@/lib/supabase/client";

/**
 * Analytics first-party : événements dans Supabase (aucun cookie tiers, aucun outil externe).
 *
 * `visitor_id` et `session_id` sont des identifiants aléatoires posés dans le stockage local du
 * navigateur. Sans eux on comptait des événements et jamais des personnes : le tunnel
 * « visite → ouverture de la démo → inscription » n'était pas approximatif, il était
 * structurellement incalculable. Ce ne sont ni une IP, ni une empreinte de navigateur : rien ne
 * les rattache à une personne, et vider son navigateur les efface.
 */

const CLE_VISITEUR = "tg_visitor";
const CLE_SESSION = "tg_session";
const CLE_UTM = "tg_utm";

const PARAMS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];

function identifiant() {
  // 22 caractères base64url — la policy `analytics_insert` n'accepte que [A-Za-z0-9_-]{8,40}.
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lit (ou crée) un identifiant persistant. Le stockage peut être refusé : on n'insiste pas. */
function idPersistant(stockage: Storage | undefined, cle: string): string | null {
  try {
    if (!stockage) return null;
    const existant = stockage.getItem(cle);
    if (existant) return existant;
    const neuf = identifiant();
    stockage.setItem(cle, neuf);
    return neuf;
  } catch {
    return null;
  }
}

export function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  return idPersistant(window.localStorage, CLE_VISITEUR);
}

export function sessionId(): string | null {
  if (typeof window === "undefined") return null;
  return idPersistant(window.sessionStorage, CLE_SESSION);
}

/**
 * Paramètres de campagne du premier atterrissage, mémorisés pour toute la session.
 *
 * Ils ne sont lus qu'une fois : un visiteur qui arrive par une annonce puis navigue vers
 * `/signup` n'a plus l'`utm_source` dans son URL, et sans mémorisation le premier euro de
 * publicité serait dépensé à l'aveugle.
 */
export function utm(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const trouves: Record<string, string> = {};
    for (const p of PARAMS_UTM) {
      const v = params.get(p);
      if (v) trouves[p] = v.slice(0, 120);
    }
    if (Object.keys(trouves).length > 0) {
      window.sessionStorage.setItem(CLE_UTM, JSON.stringify(trouves));
      return trouves;
    }
    const memorise = window.sessionStorage.getItem(CLE_UTM);
    return memorise ? (JSON.parse(memorise) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function track(event: string, props: Record<string, unknown> = {}) {
  try {
    const supabase = createClient();
    supabase
      .from("analytics_events")
      .insert({
        event,
        props,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        visitor_id: visitorId(),
        session_id: sessionId(),
        utm: utm(),
      })
      .then(() => undefined, () => undefined);
  } catch {
    // le tracking ne doit jamais casser l'app
  }
}
