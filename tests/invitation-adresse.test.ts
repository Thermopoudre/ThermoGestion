import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { errorFr } from "@/lib/errors";

/**
 * Le lien d'invitation n'est plus un porteur : il vaut pour une adresse, et pour elle seule.
 *
 * L'attaque rejouée ici est celle de l'audit contradictoire du 21/08/2026, à l'identique :
 * une invitation est émise pour `quelquun.dautre@exemple.invalid` en rôle `bureau`, puis elle
 * est acceptée par un compte fraîchement inscrit sous une AUTRE adresse. Elle réussissait.
 * `accept_invitation()` vérifiait l'existence du jeton, son acceptation, son expiration et que
 * l'appelant n'avait pas déjà d'atelier — jamais à qui le lien avait été envoyé.
 *
 * Ce que ça valait : sept jours de devis, factures, clients, tarifs, rentabilité et jetons de
 * portail, pour qui trouvait le lien dans une boîte partagée ou dans les journaux d'un relais
 * SMTP.
 *
 * Comme partout dans cette suite, **on vérifie l'état après coup** : `accept_invitation()`
 * pourrait très bien lever une exception APRÈS avoir inséré la ligne `users` si l'ordre des
 * instructions changeait un jour. Un test qui se contenterait du message d'erreur validerait
 * alors un verrou qui ne verrouille plus rien.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const ctx = () => contexte();
const patron = () => clientConnecte();

/** L'adresse invitée dans le scénario de l'audit. Le domaine `.invalid` ne peut pas exister. */
const ADRESSE_INVITEE = "quelquun.dautre@exemple.invalid";

/** Adresse du compte tiers : `contact@x.fr` → `contact+secu-tiers@x.fr`. */
function adresseTiers(): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+secu-tiers@${domaine}`;
}

let tiers: SupabaseClient;
let tiersId = "";
let jeton = "";
let invitationId = "";

beforeAll(async () => {
  const { url, anonKey, seed } = ctx();
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");
  const email = adresseTiers();

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!session) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);
  tiersId = session.user.id;
  tiers = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // Reliquat d'une exécution interrompue : le tiers ne doit appartenir à aucun atelier, sinon le
  // test ne prouve rien (il échouerait sur « user already belongs to an atelier », pour la
  // mauvaise raison).
  const { data: dejaMembre } = await tiers.from("users").select("atelier_id").eq("id", tiersId).maybeSingle();
  if (dejaMembre) {
    await patron().from("users").delete().eq("id", tiersId);
  }

  const { data: inv, error } = await patron()
    .from("invitations")
    .insert({ atelier_id: seed.atelierId, email: ADRESSE_INVITEE, role: "bureau" })
    .select("id, token")
    .single();
  if (error) throw new Error(`invitation du scénario d'audit : ${error.message}`);
  invitationId = (inv as { id: string }).id;
  jeton = (inv as { token: string }).token;
}, 120_000);

afterAll(async () => {
  const sb = patron();
  // Si le verrou cédait, le tiers serait devenu `bureau` de l'atelier jetable : on le retire pour
  // ne pas laisser un siège occupé aux fichiers suivants, qui les comptent.
  if (tiersId) await sb.from("users").delete().eq("id", tiersId);
  await sb.from("invitations").delete().eq("email", ADRESSE_INVITEE);
  // L'invitation légitime a été enregistrée telle que saisie — majuscules et espaces compris :
  // un `eq` sur l'adresse normalisée ne la retrouverait pas.
  await sb.from("invitations").delete().ilike("email", "%secu-tiers%");
});

describe("un lien d'invitation ne se transfère pas", () => {
  it("refuse le compte tiers, et NOMME l'adresse attendue sous forme masquée", async () => {
    const { error } = await tiers.rpc("accept_invitation", { p_token: jeton });
    expect(error, "l'acceptation par une autre adresse doit être refusée").not.toBeNull();
    expect(error!.message).toContain("INVITATION_AUTRE_ADRESSE");
    // L'adresse est masquée jusque dans le message d'erreur : le tiers apprend qu'il n'est pas
    // le destinataire, pas qui l'est.
    expect(error!.message).toContain("@exemple.invalid");
    expect(error!.message).not.toContain("quelquun.dautre");
  });

  it("l'état après coup : le tiers n'appartient à aucun atelier", async () => {
    // Vue du responsable — la seule qui voie toute la table de l'atelier.
    const { data: membres } = await patron().from("users").select("id").eq("id", tiersId);
    expect(membres ?? [], "aucune ligne d'équipe n'a été créée").toHaveLength(0);

    // Vue du tiers lui-même : il n'a pas non plus d'atelier de son côté.
    const { data: moi } = await tiers.from("users").select("atelier_id").eq("id", tiersId).maybeSingle();
    expect(moi).toBeNull();

    // Et le refus n'a rien changé aux données de l'atelier : le tiers ne lit toujours rien.
    const { data: clients } = await tiers.from("clients").select("id");
    expect(clients ?? []).toHaveLength(0);
  });

  it("l'invitation reste vivante pour son vrai destinataire", async () => {
    // Un refus qui « consommerait » l'invitation transformerait la faille en déni de service :
    // il suffirait d'ouvrir le lien intercepté pour empêcher l'employé d'entrer.
    const { data } = await patron()
      .from("invitations")
      .select("accepted_at")
      .eq("id", invitationId)
      .maybeSingle();
    expect((data as { accepted_at: string | null } | null)?.accepted_at).toBeNull();
  });

  it("le message affiché dit quoi faire, pas seulement que c'est refusé", async () => {
    const { error } = await tiers.rpc("accept_invitation", { p_token: jeton });
    const phrase = errorFr(error);
    expect(phrase).toContain("a été envoyé à");
    expect(phrase).toContain("Réglages → Équipe");
    expect(phrase).not.toBe("Une erreur est survenue. Réessayez, et contactez-nous si ça persiste.");
  });
});

describe("ce que le jeton donne le droit de savoir", () => {
  it("`invitation_publique` ne rend plus l'adresse en clair", async () => {
    // Elle est ouverte à `anon` : c'est le visiteur pas encore inscrit qui l'appelle.
    const { data, error } = await clientAnonyme().rpc("invitation_publique", { p_token: jeton });
    expect(error).toBeNull();
    const inv = data as Record<string, unknown>;
    expect(inv.atelier_nom, "le nom de l'atelier reste : sans lui l'invité croit qu'on lui vend un abonnement").toBeTruthy();
    expect(inv.role).toBe("bureau");
    expect(inv.email, "l'adresse en clair a disparu").toBeUndefined();
    expect(inv.email_masque).toBe("q•••e@exemple.invalid");
  });

  it("`invitation_correspond` répond avant l'inscription, et ne dit que oui ou non", async () => {
    const anon = clientAnonyme();
    const bonne = await anon.rpc("invitation_correspond", { p_token: jeton, p_email: ADRESSE_INVITEE });
    expect(bonne.error).toBeNull();
    expect(bonne.data).toBe(true);

    const mauvaise = await anon.rpc("invitation_correspond", { p_token: jeton, p_email: adresseTiers() });
    expect(mauvaise.data).toBe(false);

    const jetonInconnu = await anon.rpc("invitation_correspond", { p_token: "jeton-qui-n-existe-pas", p_email: ADRESSE_INVITEE });
    expect(jetonInconnu.data).toBe(false);
  });

  it("`accept_invitation` reste fermée à `anon` : Supabase accorde EXECUTE nommément", async () => {
    const { error } = await clientAnonyme().rpc("accept_invitation", { p_token: jeton });
    expect(error).not.toBeNull();
  });

  it("les aides de masquage ne sont pas appelables depuis l'extérieur", async () => {
    // `masquer_email` et `email_normalise` ne servent qu'aux fonctions `security definer` qui les
    // appellent : les exposer donnerait un outil de normalisation d'adresses à qui n'a rien à en
    // faire, et surtout un point d'entrée de plus à surveiller.
    for (const fn of ["masquer_email", "email_normalise"]) {
      const { error } = await patron().rpc(fn, { p_email: "jean@exemple.fr" });
      expect(error, `${fn} doit être refusée`).not.toBeNull();
    }
  });
});

describe("l'employé invité, lui, entre normalement", () => {
  it("accepte l'invitation émise à son adresse exacte, quelle que soit la casse", async () => {
    const { seed } = ctx();
    // L'artisan tape parfois l'adresse en majuscules, ou colle un espace en fin de champ. Refuser
    // pour ça serait tenir la règle contre l'utilisateur au lieu de la tenir contre l'attaquant.
    const { data: inv, error: errInv } = await patron()
      .from("invitations")
      .insert({ atelier_id: seed.atelierId, email: `  ${adresseTiers().toUpperCase()} `, role: "atelier" })
      .select("token")
      .single();
    expect(errInv).toBeNull();

    const { data: atelierId, error } = await tiers.rpc("accept_invitation", {
      p_token: (inv as { token: string }).token,
    });
    expect(error, "l'invité légitime doit entrer").toBeNull();
    expect(atelierId).toBe(seed.atelierId);

    // L'état après coup : le rôle enregistré est bien celui de l'invitation, pas un rôle deviné.
    const { data: moi } = await tiers.from("users").select("role, atelier_id").eq("id", tiersId).maybeSingle();
    expect((moi as { role: string } | null)?.role).toBe("atelier");

    // On le retire aussitôt : les fichiers suivants comptent les sièges occupés.
    await patron().from("users").delete().eq("id", tiersId);
  });
});
