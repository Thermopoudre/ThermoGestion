import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/env";

/**
 * Client Supabase "service role" — bypass RLS. À utiliser UNIQUEMENT côté serveur, pour des
 * opérations qui n'ont pas de session utilisateur (ex : webhook Stripe). Ne jamais importer
 * ce fichier depuis un composant client ("use client").
 */
export function createServiceClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant — voir le récap de déploiement pour la config Supabase.");
  }
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
