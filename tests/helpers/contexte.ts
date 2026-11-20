import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

/** Identifiants du jeu de données semé dans l'atelier jetable, partagés par tous les fichiers. */
export type Seed = {
  atelierId: string;
  grilleStandardId: string;
  grilleContratId: string;
  clientRemiseId: string;
  clientSimpleId: string;
  prestationSablageId: string;
  prestationMlId: string;
  prestationDevoilageId: string;
  prestationTpmsId: string;
  tarifMlId: string;
  pieceTypeId: string;
  pieceTypePortailId: string;
  poudreId: string;
};

export type ContexteTests = {
  url: string;
  anonKey: string;
  accessToken: string;
  seed: Seed;
};

declare module "vitest" {
  interface ProvidedContext {
    thermogestion: ContexteTests;
  }
}

export function contexte(): ContexteTests {
  return inject("thermogestion");
}

/**
 * Client PostgREST porteur du jeton de l'utilisateur de test. Le jeton est passé en en-tête
 * plutôt que via une session : `globalSetup` s'authentifie dans un autre processus que les
 * fichiers de test, seule la chaîne du jeton peut traverser.
 */
export function clientConnecte(ctx = contexte()): SupabaseClient {
  return createClient(ctx.url, ctx.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
  });
}

/** Client anonyme : exactement ce dont dispose un visiteur d'une page publique. */
export function clientAnonyme(ctx = contexte()): SupabaseClient {
  return createClient(ctx.url, ctx.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** PostgREST rend les `numeric` en chaîne : sans coercition, les comparaisons de montants mentent. */
export function nb(v: unknown): number {
  return Number(v ?? 0);
}
