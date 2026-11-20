import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GlobalSetupContext } from "vitest/node";
import { semer } from "./seed";
import type { ContexteTests } from "../helpers/contexte";

/** Préfixe réservé : la RPC de suppression refuse tout atelier dont le nom ne commence pas par là. */
const PREFIXE_JETABLE = "TEST-AUTO-";

function requis(nom: string): string {
  const v = process.env[nom];
  if (!v) throw new Error(`${nom} manquant — copiez .env.test.example en .env.test (voir TESTS.md).`);
  return v;
}

async function supprimerAtelierJetable(sb: SupabaseClient) {
  const { error } = await sb.rpc("supprimer_atelier_test");
  if (error) throw new Error(`suppression de l'atelier jetable : ${error.message}`);
}

export default async function setup({ provide }: GlobalSetupContext) {
  chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

  const url = requis("TEST_SUPABASE_URL");
  const anonKey = requis("TEST_SUPABASE_ANON_KEY");
  const email = requis("TEST_USER_EMAIL");
  const password = requis("TEST_USER_PASSWORD");

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const connexion = await auth.auth.signInWithPassword({ email, password });
  let accessToken = connexion.data.session?.access_token;
  if (connexion.error) {
    // Premier lancement sur un poste neuf : le compte de test n'existe pas encore.
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`connexion du compte de test impossible : ${connexion.error.message}`);
    accessToken = inscription.data.session?.access_token;
  }
  if (!accessToken) throw new Error("aucun jeton de session pour le compte de test");

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  // Reliquat d'une exécution interrompue : on ne peut créer un atelier que si le compte de test
  // n'en a plus. On refuse net de nettoyer autre chose qu'un atelier jetable — c'est le garde-fou
  // qui garantit que la suite ne peut pas toucher ThermoTest ni un atelier client.
  const { data: membre } = await sb.from("users").select("atelier_id").maybeSingle();
  if (membre?.atelier_id) {
    const { data: precedent } = await sb.from("ateliers").select("nom").eq("id", membre.atelier_id).maybeSingle();
    if (!precedent?.nom?.startsWith(PREFIXE_JETABLE)) {
      throw new Error(
        `le compte de test appartient à l'atelier « ${precedent?.nom ?? "?"} », qui n'est pas jetable. ` +
          "Refus d'exécuter la suite : utilisez un compte dédié.",
      );
    }
    await supprimerAtelierJetable(sb);
  }

  const nom = `${PREFIXE_JETABLE}${Date.now()}`;
  const { data: atelierId, error: errCreate } = await sb.rpc("create_atelier", { p_nom: nom });
  if (errCreate || !atelierId) throw new Error(`create_atelier : ${errCreate?.message ?? "aucun id"}`);

  const seed = await semer(sb, atelierId as string);
  const ctx: ContexteTests = { url, anonKey, accessToken, seed };
  provide("thermogestion", ctx);

  // Exécuté même si des tests échouent : l'atelier jetable ne survit jamais à la suite.
  return async () => {
    await supprimerAtelierJetable(sb);
  };
}
