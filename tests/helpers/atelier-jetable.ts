import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { contexte } from "./contexte";

/**
 * Un atelier jetable **neuf**, distinct de celui du semis.
 *
 * Pourquoi il en faut un second. Les verrous du lot A portent sur l'histoire de l'atelier :
 * « aucun devis n'a encore été numéroté cette année », « aucune facture n'a encore été émise
 * depuis l'application ». L'atelier partagé par la suite en accumule au fil des fichiers, et
 * l'ordre d'exécution des fichiers n'est pas garanti : un test de reprise qui s'y exécuterait
 * vaudrait vrai ou faux selon le fichier qui l'a précédé. Autant dire qu'il ne prouverait rien.
 *
 * Ces ateliers portent le même préfixe `TEST-AUTO-` que celui du semis : `supprimer_atelier_test()`
 * refuse tout le reste, ce qui interdit par construction de toucher `Atelier Démo Thermolaquage`
 * ou `ThermoTest`.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const PREFIXE_JETABLE = "TEST-AUTO-";

/** `contact@x.fr` → `contact+lotA-proprio@x.fr` : un compte dérivé, jamais une adresse réelle. */
function adresse(suffixe: string): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+${suffixe}@${domaine}`;
}

async function session(suffixe: string): Promise<{ sb: SupabaseClient; id: string; email: string }> {
  const { url, anonKey } = contexte();
  const email = adresse(suffixe);
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let jeton = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!jeton) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    jeton = inscription.data.session;
  }
  if (!jeton) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jeton.access_token}` } },
  });
  return { sb, id: jeton.user.id, email };
}

export type AtelierJetable = {
  /** Client PostgREST du responsable du nouvel atelier. */
  sb: SupabaseClient;
  atelierId: string;
  /** Invite un compagnon dans cet atelier et rend son propre client PostgREST. */
  inviter: (role: "bureau" | "atelier") => Promise<SupabaseClient>;
  fermer: () => Promise<void>;
};

export async function ouvrirAtelierJetable(suffixe: string): Promise<AtelierJetable> {
  const proprio = await session(`${suffixe}-proprio`);

  // Reliquat d'une exécution interrompue. On refuse net de réutiliser un compte rattaché à un
  // atelier qui ne serait pas jetable : c'est le garde-fou qui protège les ateliers réels.
  const { data: dejaMembre } = await proprio.sb.from("users").select("atelier_id").eq("id", proprio.id).maybeSingle();
  if (dejaMembre?.atelier_id) {
    const { data: precedent } = await proprio.sb.from("ateliers").select("nom").eq("id", dejaMembre.atelier_id).maybeSingle();
    if (!precedent?.nom?.startsWith(PREFIXE_JETABLE)) {
      throw new Error(`${proprio.email} appartient à « ${precedent?.nom ?? "?"} », qui n'est pas jetable — refus.`);
    }
    const { error } = await proprio.sb.rpc("supprimer_atelier_test");
    if (error) throw new Error(`nettoyage de l'atelier précédent : ${error.message}`);
  }

  const nom = `${PREFIXE_JETABLE}${suffixe}-${Date.now()}`;
  const { data: id, error } = await proprio.sb.rpc("create_atelier", { p_nom: nom });
  if (error || !id) throw new Error(`create_atelier : ${error?.message ?? "aucun id"}`);
  const atelierId = id as string;

  const compagnons: string[] = [];

  return {
    sb: proprio.sb,
    atelierId,
    async inviter(role) {
      const invite = await session(`${suffixe}-${role}`);
      const { data: dejaLa } = await invite.sb.from("users").select("atelier_id").eq("id", invite.id).maybeSingle();
      if (dejaLa?.atelier_id && dejaLa.atelier_id !== atelierId) {
        // Membre d'un atelier jetable d'une exécution précédente : on le libère plutôt que de
        // laisser le test échouer sur un reliquat.
        const { data: a } = await invite.sb.from("ateliers").select("nom").eq("id", dejaLa.atelier_id).maybeSingle();
        if (!a?.nom?.startsWith(PREFIXE_JETABLE)) {
          throw new Error(`${invite.email} appartient à « ${a?.nom ?? "?"} », qui n'est pas jetable — refus.`);
        }
        await invite.sb.from("users").delete().eq("id", invite.id);
      }
      if (dejaLa?.atelier_id !== atelierId) {
        const { data: inv, error: errInv } = await proprio.sb
          .from("invitations")
          .insert({ atelier_id: atelierId, email: invite.email, role })
          .select("token")
          .single();
        if (errInv) throw new Error(`invitation ${role} : ${errInv.message}`);
        const { error: errAcc } = await invite.sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
        if (errAcc) throw new Error(`accept_invitation ${role} : ${errAcc.message}`);
      }
      compagnons.push(invite.id);
      return invite.sb;
    },
    async fermer() {
      // La suppression de l'atelier emporte ses membres en cascade ; on retire malgré tout les
      // lignes `users` d'abord, pour que les comptes soient réutilisables au prochain lancement
      // même si la suppression échoue.
      for (const id of compagnons) await proprio.sb.from("users").delete().eq("id", id);
      const { error } = await proprio.sb.rpc("supprimer_atelier_test");
      if (error) throw new Error(`suppression de l'atelier jetable ${nom} : ${error.message}`);
    },
  };
}
