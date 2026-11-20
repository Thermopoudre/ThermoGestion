import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as chargerEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import {
  LOOKUP_KEYS,
  PRIX_SIEGE_ANNUEL,
  PRIX_SIEGE_MENSUEL,
  SIEGES_INCLUS,
  coutSiegesMensuel,
  estCleSiege,
  lookupKeySiege,
  prixSiege,
  siegesAutorises,
  siegesInclus,
  type PlanCode,
} from "@/lib/abonnement";

/**
 * Le siège supplémentaire à 5 € HT/mois — ce qui doit tenir en base, pas à l'écran.
 *
 * Même dispositif que `droits-formules.test.ts` : on n'interroge pas React, on attaque la base
 * depuis un client PostgREST ordinaire — celui dont dispose n'importe quel atelier avec la clé
 * publiable — et depuis un client anonyme. L'atelier est le jetable `TEST-AUTO-*`, supprimé par
 * `supprimer_atelier_test()` à la fin de la suite.
 *
 * Ce fichier existe surtout pour une raison : le nombre de sièges est devenu une **valeur d'argent**
 * portée par une colonne. Si un atelier peut l'écrire lui-même, il s'offre son équipe entière ;
 * si le barème de la base diverge de celui du TypeScript, on facture autre chose que ce qu'on
 * ouvre. Ce projet a déjà pris cinq verrous en défaut pour n'avoir vécu que dans le navigateur.
 */

// Le compte `service_role` n'est pas dans `.env.test` : il ne sert qu'à jouer ce que fait le
// webhook Stripe. Sans lui, les épreuves qui exigent d'écrire `sieges_supp` sont annoncées comme
// ignorées plutôt que silencieusement vertes — c'est précisément le droit qu'on refuse à l'atelier.
chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });
chargerEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
const CLE_SERVICE =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MOT_DE_PASSE_DEMO = process.env.DEMO_PASSWORD ?? "";
const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";

const sb = () => clientConnecte();
const anon = () => clientAnonyme();

/** Client `service_role` : c'est le rôle du webhook Stripe, et de lui seul. */
function clientService(): SupabaseClient {
  const ctx = contexte();
  return createClient(ctx.url, CLE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Sieges = { plan: string; inclus: number; supp: number; autorises: number; occupes: number };

async function mesSieges(): Promise<Sieges> {
  const { data, error } = await sb().rpc("mes_sieges");
  if (error) throw new Error(`mes_sieges() : ${error.message}`);
  return data as Sieges;
}

async function apercu(plan: PlanCode | null) {
  const { error } = await sb().rpc("apercu_formule", { p_plan: plan });
  if (error) throw new Error(`apercu_formule(${plan}) : ${error.message}`);
}

/** Écrit le compteur payant comme le ferait le webhook Stripe : jamais depuis le compte applicatif. */
async function poserSiegesSupp(valeur: number) {
  const { atelierId } = contexte().seed;
  const { error } = await clientService()
    .from("subscriptions")
    .update({ sieges_supp: valeur })
    .eq("atelier_id", atelierId);
  if (error) throw new Error(`écriture service de sieges_supp : ${error.message}`);
}

async function purgerInvitations() {
  const { atelierId } = contexte().seed;
  await sb().from("invitations").delete().eq("atelier_id", atelierId);
}

async function inviter(email: string, expiresAt?: string) {
  return sb()
    .from("invitations")
    .insert({ atelier_id: contexte().seed.atelierId, email, ...(expiresAt ? { expires_at: expiresAt } : {}) })
    .select("id")
    .maybeSingle();
}

describe("Le barème des sièges — la base et le code disent le même chiffre", () => {
  it("sieges_inclus() rend en base exactement ce que le TypeScript affiche, formule par formule", async () => {
    // Le test de miroir. Une divergence ici, et l'écran promet trois places là où la base en
    // accorde deux : l'atelier paie, invite, et se fait refuser.
    for (const plan of Object.keys(SIEGES_INCLUS) as PlanCode[]) {
      const { data, error } = await sb().rpc("sieges_inclus", { p_plan: plan });
      expect(error, `sieges_inclus(${plan})`).toBeNull();
      expect(data, plan).toBe(SIEGES_INCLUS[plan]);
    }
    expect(SIEGES_INCLUS).toEqual({ atelier: 2, equipe: 5, certifie: 10 });
  });

  it("une formule inventée lève au lieu de rendre null", async () => {
    // Le piège du `case … else null` : un `null` se serait propagé dans `sieges_autorises()`,
    // qui aurait rendu `null`, et la comparaison `occupes + 1 > null` est fausse en SQL — donc
    // aucun refus. Une formule inconnue doit faire du bruit, pas ouvrir la porte.
    const { error } = await sb().rpc("sieges_inclus", { p_plan: "illimite" });
    expect(error?.message ?? "").toContain("PLAN_INCONNU");
    const { error: errNull } = await sb().rpc("sieges_inclus", { p_plan: null });
    expect(errNull?.message ?? "").toContain("PLAN_INCONNU");
  });

  it("le tarif du siège passe par une lookup_key, jamais par un identifiant de prix", () => {
    expect(lookupKeySiege("mois")).toBe("thermogestion_siege_mensuel");
    expect(lookupKeySiege("an")).toBe("thermogestion_siege_annuel");
    // Les tarifs sont épinglés en euros, pas comparés aux constantes qui les portent :
    // `prixSiege()` *retourne* `PRIX_SIEGE_MENSUEL`, l'assertion resterait verte à 50 € comme à
    // 0 €. Or ces deux nombres sont ceux qu'on facture, et ceux des `lookup_keys` à créer chez
    // Stripe : ils doivent être vérifiés en valeur, une fois, quelque part.
    expect(PRIX_SIEGE_MENSUEL).toBe(5);
    expect(PRIX_SIEGE_ANNUEL).toBe(50);
    expect(prixSiege("mois")).toBe(5);
    expect(prixSiege("an")).toBe(50);
    // Deux mois offerts sur l'annuel, comme sur les formules.
    expect(PRIX_SIEGE_ANNUEL).toBe(PRIX_SIEGE_MENSUEL * 10);
    // Trois formules × deux périodicités, plus le siège × deux périodicités.
    expect(LOOKUP_KEYS).toHaveLength(8);
    expect(LOOKUP_KEYS.filter((k) => k.plan === "siege").map((k) => k.cle)).toEqual([
      "thermogestion_siege_mensuel",
      "thermogestion_siege_annuel",
    ]);
    // `estCleSiege` est ce qui empêche le webhook de prendre la ligne « siège » pour une formule.
    for (const k of LOOKUP_KEYS) expect(estCleSiege(k.cle), k.cle).toBe(k.plan === "siege");
  });

  it("le calcul du navigateur additionne la formule et les sièges payés", () => {
    // Là encore, les nombres attendus sont écrits, pas empruntés à `SIEGES_INCLUS` : deux, cinq et
    // dix places sont une promesse de la page tarifs, pas un détail d'implémentation.
    expect(SIEGES_INCLUS).toEqual({ atelier: 2, equipe: 5, certifie: 10 });
    const abo = { plan: "atelier", status: "active", trial_end: null, sieges_supp: 3 };
    expect(siegesInclus(abo)).toBe(2);
    expect(siegesAutorises(abo)).toBe(5);
    expect(coutSiegesMensuel(abo)).toBe(15);
    // Une valeur négative ne doit jamais retrancher des places à la formule.
    expect(siegesAutorises({ ...abo, sieges_supp: -5 })).toBe(2);
  });
});

describe("Un atelier ne peut pas s'attribuer des sièges tout seul", () => {
  it("l'UPDATE de sieges_supp depuis un compte applicatif ne modifie rien", async () => {
    // Le test ne cherche pas une erreur : sans policy d'UPDATE, PostgREST répond 204 en ayant
    // modifié zéro ligne. On vérifie donc l'état après coup, pas le code de retour — c'est
    // exactement le piège des garde-fous « qui ont l'air corrects ».
    const { atelierId } = contexte().seed;
    const { data: avant } = await sb().from("subscriptions").select("sieges_supp").maybeSingle();
    expect(avant?.sieges_supp).toBe(0);

    await sb().from("subscriptions").update({ sieges_supp: 99 }).eq("atelier_id", atelierId);

    const { data: apres } = await sb().from("subscriptions").select("sieges_supp").maybeSingle();
    expect(apres?.sieges_supp, "un atelier s'est offert 99 sièges").toBe(0);
  });

  it("la même tentative depuis un client anonyme ne modifie rien non plus", async () => {
    const { atelierId } = contexte().seed;
    await anon().from("subscriptions").update({ sieges_supp: 99 }).eq("atelier_id", atelierId);
    const { data } = await sb().from("subscriptions").select("sieges_supp").maybeSingle();
    expect(data?.sieges_supp).toBe(0);
  });

  it("le compteur ne se hausse pas davantage par la porte de l'aperçu de formule", async () => {
    // `apercu_formule` est la seule écriture que l'atelier a sur `subscriptions` : elle ne doit
    // toucher que la colonne d'aperçu.
    const { atelierId } = contexte().seed;
    await apercu("certifie");
    const { data } = await sb().from("subscriptions").select("sieges_supp, plan, status").maybeSingle();
    expect(data?.sieges_supp).toBe(0);
    expect(data?.plan).toBe("atelier");
    expect(data?.status).toBe("trialing");
    await apercu(null);
    expect(atelierId).toBeTruthy();
  });
});

describe("mes_sieges() ne parle que de l'atelier qui la demande", () => {
  it("elle rend la formule, les places comprises, achetées et occupées de l'atelier connecté", async () => {
    const s = await mesSieges();
    // L'atelier jetable est en essai sans aperçu : la formule effective est la plus haute.
    expect(s.plan).toBe("certifie");
    expect(s.inclus).toBe(SIEGES_INCLUS.certifie);
    expect(s.supp).toBe(0);
    expect(s.autorises).toBe(s.inclus + s.supp);
    // Le compte de test est seul dans son atelier, et aucune invitation n'est en cours.
    expect(s.occupes).toBe(1);
  });

  it("elle n'est pas exécutable par un client anonyme", async () => {
    const { error } = await anon().rpc("mes_sieges");
    expect(error, "mes_sieges() est ouverte à la clé publiable").not.toBeNull();
  });

  it("interrogée sur un autre atelier, la base ne compte personne et ne trahit pas sa formule", async () => {
    // On vise un atelier réel — celui de la démonstration publique — plutôt qu'un identifiant
    // inventé : c'est le seul moyen de prouver que ce n'est pas l'inexistence de la ligne qui
    // rend 0, mais bien la RLS. À défaut du mot de passe de démonstration, on retombe sur un
    // identifiant tiers, ce qui éprouve au moins l'absence de fuite.
    let autreAtelier: string = randomUUID();
    if (MOT_DE_PASSE_DEMO) {
      const ctx = contexte();
      const auth = createClient(ctx.url, ctx.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await auth.auth.signInWithPassword({ email: EMAIL_DEMO, password: MOT_DE_PASSE_DEMO });
      if (data.session) {
        const sbDemo = createClient(ctx.url, ctx.anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
        });
        const { data: at } = await sbDemo.from("ateliers").select("id").maybeSingle();
        if (at?.id) autreAtelier = at.id as string;
      }
    }

    const { data: occupes } = await sb().rpc("sieges_occupes", { p_atelier: autreAtelier });
    expect(occupes, "le nombre d'utilisateurs d'un autre atelier a fuité").toBe(0);
    // `plan_effectif` retombe sur la formule d'entrée quand la RLS masque l'abonnement : c'est
    // le repli voulu, et il ne dit rien de la formule réellement payée par le voisin.
    const { data: autorises } = await sb().rpc("sieges_autorises", { p_atelier: autreAtelier });
    expect(autorises).toBe(SIEGES_INCLUS.atelier);
  });
});

describe("Le trigger compte les places au moment d'inviter", () => {
  beforeAll(async () => {
    await purgerInvitations();
    // L'aperçu ramène l'atelier à deux sièges : c'est la seule façon d'atteindre le plafond sans
    // créer huit comptes. Il n'ouvre jamais rien, il ne fait que restreindre.
    await apercu("atelier");
  });
  afterAll(async () => {
    await purgerInvitations();
    await apercu(null);
  });

  it("à N places prises pour N autorisées, l'invitation suivante est refusée", async () => {
    const { data: inv1, error: e1 } = await inviter("siege-op1@test.invalid");
    expect(e1).toBeNull();
    expect(inv1).not.toBeNull();

    const s = await mesSieges();
    expect(s.inclus).toBe(SIEGES_INCLUS.atelier);
    expect(s.supp).toBe(0);
    expect(s.autorises).toBe(2);
    // Un utilisateur actif et une invitation en attente : les deux places sont prises.
    expect(s.occupes).toBe(2);

    const { error: e2 } = await inviter("siege-op2@test.invalid");
    expect(e2?.message ?? "", "la troisième place aurait dû être refusée").toContain("SIEGES_INSUFFISANTS");
  });

  it("une invitation expirée ne consomme pas de place", async () => {
    // Le contournement inverse : laisser traîner des invitations mortes ne doit pas condamner
    // des places payées. On repart d'un atelier vide d'invitations pour que le chiffre observé
    // ne dépende que de celle qu'on vient de poser.
    await purgerInvitations();
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    const { error: eMorte } = await inviter("siege-expiree@test.invalid", hier);
    expect(eMorte).toBeNull();

    const s = await mesSieges();
    expect(s.occupes, "une invitation expirée est comptée comme une place").toBe(1);

    // Et la place qu'elle ne consomme pas reste bel et bien disponible.
    const { error: eVivante } = await inviter("siege-vivante@test.invalid");
    expect(eVivante).toBeNull();
    expect((await mesSieges()).occupes).toBe(2);

    const { error: eTrop } = await inviter("siege-detrop@test.invalid");
    expect(eTrop?.message ?? "").toContain("SIEGES_INSUFFISANTS");

    await purgerInvitations();
  });

  it("le refus se rejoue à l'identique depuis un client anonyme : il ne voit même pas l'atelier", async () => {
    const { atelierId } = contexte().seed;
    const { error } = await anon().from("invitations").insert({ atelier_id: atelierId, email: "siege-anon@test.invalid" });
    expect(error, "un anonyme a pu inviter un utilisateur").not.toBeNull();
    const { data } = await sb().from("invitations").select("id").eq("email", "siege-anon@test.invalid");
    expect(data ?? []).toHaveLength(0);
  });

  it("changer de formule change le nombre de places, sans qu'aucun code applicatif s'en mêle", async () => {
    // La preuve que le trigger relit `sieges_autorises()` à chaque écriture, et ne s'appuie sur
    // aucune valeur figée : la même invitation, refusée à deux sièges, passe à cinq.
    await apercu("equipe");
    const { data: inv, error } = await inviter("siege-op2@test.invalid");
    expect(error).toBeNull();
    expect(inv).not.toBeNull();
    if (inv) await sb().from("invitations").delete().eq("id", (inv as { id: string }).id);
    await apercu("atelier");
  });
});

const avecService = CLE_SERVICE ? describe : describe.skip;

avecService("Le siège acheté ouvre une place, et une seule", () => {
  beforeAll(async () => {
    await purgerInvitations();
    await apercu("atelier");
  });
  afterAll(async () => {
    await purgerInvitations();
    await poserSiegesSupp(0);
    await apercu(null);
  });

  it("après l'écriture du webhook, l'invitation refusée passe — et la suivante est refusée à son tour", async () => {
    const { error: e1 } = await inviter("siege-achat1@test.invalid");
    expect(e1).toBeNull();

    // Plafond atteint : deux places pour deux sièges compris.
    const { error: refus } = await inviter("siege-achat2@test.invalid");
    expect(refus?.message ?? "").toContain("SIEGES_INSUFFISANTS");

    // Ce que fait le webhook `customer.subscription.updated` après l'achat d'un siège.
    await poserSiegesSupp(1);
    const s = await mesSieges();
    expect(s.supp).toBe(1);
    expect(s.autorises).toBe(SIEGES_INCLUS.atelier + 1);

    const { error: e2 } = await inviter("siege-achat2@test.invalid");
    expect(e2, "le siège payé n'a pas ouvert de place").toBeNull();

    // Une place achetée en ouvre exactement une : la troisième invitation retombe sur le refus.
    const { error: e3 } = await inviter("siege-achat3@test.invalid");
    expect(e3?.message ?? "").toContain("SIEGES_INSUFFISANTS");
  });
});

avecService("Réactiver un membre désactivé reprend une place", () => {
  const emailStaff = `siege-staff-${Date.now()}@thermogestion.internal`;
  let idStaff: string | null = null;

  beforeAll(async () => {
    await purgerInvitations();
    await apercu("atelier");
    const service = clientService();
    const { data, error } = await service.auth.admin.createUser({
      email: emailStaff,
      password: `Sg-${randomUUID()}`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`création du compte d'appoint : ${error?.message}`);
    idStaff = data.user.id;
    // Insertion en `service_role`, comme le ferait l'acceptation d'une invitation côté serveur,
    // puis désactivation : c'est l'état de départ du contournement qu'on veut fermer.
    const { error: errIns } = await service.from("users").insert({
      id: idStaff,
      atelier_id: contexte().seed.atelierId,
      email: emailStaff,
      role: "staff",
      actif: false,
    });
    if (errIns) throw new Error(`insertion du membre d'appoint : ${errIns.message}`);
  });

  afterAll(async () => {
    const service = clientService();
    if (idStaff) {
      await service.from("users").delete().eq("id", idStaff);
      await service.auth.admin.deleteUser(idStaff);
    }
    await purgerInvitations();
    await poserSiegesSupp(0);
    await apercu(null);
  });

  it("un membre inactif ne consomme aucune place", async () => {
    const s = await mesSieges();
    expect(s.occupes, "un membre désactivé est compté comme une place").toBe(1);
  });

  it("la réactivation est refusée quand toutes les places sont prises", async () => {
    // C'était le contournement évident : désactiver puis réactiver pour dépasser le compte payé.
    // La réactivation passe par un UPDATE, pas un INSERT — sans trigger dédié, elle passait.
    const { error: eInv } = await inviter("siege-reactiv@test.invalid");
    expect(eInv).toBeNull();

    const { error } = await sb().from("users").update({ actif: true }).eq("id", idStaff);
    expect(error?.message ?? "", "la réactivation a rouvert une place non payée").toContain("SIEGES_INSUFFISANTS");

    const { data } = await sb().from("users").select("actif").eq("id", idStaff).maybeSingle();
    expect(data?.actif).toBe(false);
  });

  it("le siège payé la débloque", async () => {
    await poserSiegesSupp(1);
    const { error } = await sb().from("users").update({ actif: true }).eq("id", idStaff);
    expect(error).toBeNull();

    const s = await mesSieges();
    expect(s.autorises).toBe(SIEGES_INCLUS.atelier + 1);
    // Deux membres actifs et une invitation en attente : les trois places sont prises.
    expect(s.occupes).toBe(3);
  });
});
