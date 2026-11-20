import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";

/**
 * Lot C, C2 — un taux horaire par personne (`users_couts`).
 *
 * Avant cette migration, `projet_temps_cout` valorisait TOUTES les minutes pointées au taux
 * unique de l'atelier (`ateliers_couts.taux_horaire`) : un apprenti et un chef d'équipe coûtaient
 * pareil sur le papier. Ce fichier prouve trois choses distinctes, chacune pouvant casser sans
 * casser les autres :
 *
 *  1. le coût du chantier est la somme de CHAQUE opérateur valorisé à SON taux, pas une moyenne ;
 *  2. la table est cloisonnée en LECTURE comme `ateliers_couts` (responsable + bureau) ;
 *  3. elle est plus fermée qu'`ateliers_couts` en ÉCRITURE : seul le responsable écrit — ni le
 *     bureau, ni a fortiori la personne concernée, ne peut se fixer ou s'ajuster son propre taux.
 *
 * Les lignes de `temps_etapes` sont insérées directement (RLS `tenant_all`, ouverte à tout membre
 * de l'atelier) avec des `minutes` figées, plutôt que rejouées via `demarrer_etape`/`avancer_etape` :
 * ces deux RPC enchaînent automatiquement l'étape suivante sous le même auteur, ce qui rendrait
 * impossible d'attribuer délibérément deux plages de temps du MÊME projet à deux personnes
 * différentes sans compter sur un délai réel écoulé entre deux appels réseau — non déterministe.
 */
const ctx = contexte();
let proprietaire: SupabaseClient;
let anon: SupabaseClient;
let projetId: string;

type Compagnon = { sb: SupabaseClient; id: string };

function adresse(suffixe: string): string {
  const base = process.env.TEST_USER_EMAIL!;
  const [locale, domaine] = base.split("@");
  return `${locale}+c2-${suffixe}@${domaine}`;
}

/** Fait entrer (ou retrouve) un compte réel dans l'atelier jetable avec le rôle demandé. */
async function rejoindre(suffixe: string, role: "bureau" | "atelier"): Promise<Compagnon> {
  const { url, anonKey, seed } = ctx;
  const email = adresse(suffixe);
  const password = process.env.TEST_USER_PASSWORD!;

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!session) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${email}`);

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: dejaMembre } = await sb.from("users").select("atelier_id").eq("id", session.user.id).maybeSingle();
  if (dejaMembre) {
    if (dejaMembre.atelier_id !== seed.atelierId) {
      throw new Error(`${email} appartient déjà à un autre atelier — refus d'exécuter le fichier.`);
    }
  } else {
    const { data: inv, error: errInv } = await proprietaire
      .from("invitations")
      .insert({ atelier_id: seed.atelierId, email, role })
      .select("token")
      .single();
    if (errInv) throw new Error(`invitation ${role} ${email} : ${errInv.message}`);
    const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    if (errAccept) throw new Error(`accept_invitation ${email} : ${errAccept.message}`);
  }
  return { sb, id: session.user.id };
}

async function poserTaux(userId: string, tauxHoraire: number) {
  const { error } = await proprietaire.from("users_couts").upsert({ atelier_id: ctx.seed.atelierId, user_id: userId, taux_horaire: tauxHoraire });
  if (error) throw new Error(`pose du taux de ${userId} : ${error.message}`);
}

async function tauxEnBase(userId: string): Promise<number | null> {
  const { data } = await proprietaire.from("users_couts").select("taux_horaire").eq("user_id", userId).maybeSingle();
  return data ? nb(data.taux_horaire) : null;
}

let operateurA: Compagnon; // 25 €/h
let operateurB: Compagnon; // 45 €/h
let bureau: Compagnon;

beforeAll(async () => {
  proprietaire = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  operateurA = await rejoindre("operateur-a", "atelier");
  operateurB = await rejoindre("operateur-b", "atelier");
  bureau = await rejoindre("bureau", "bureau");

  await poserTaux(operateurA.id, 25);
  await poserTaux(operateurB.id, 45);

  const { data: projet, error } = await proprietaire
    .from("projets")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "Chantier C2 deux opérateurs",
      status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "preparation",
      surface_m2: 5, couches: 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(`projet C2 : ${error.message}`);
  projetId = projet!.id;

  // Deux plages de temps déterministes sur le MÊME chantier, chacune attribuée à un opérateur :
  // 1 h pour A (25 €), 40 min pour B (30 €) — 55 € au total, jamais une moyenne des deux taux.
  const { error: errTemps } = await proprietaire.from("temps_etapes").insert([
    { atelier_id: ctx.seed.atelierId, projet_id: projetId, etape_code: "preparation", user_id: operateurA.id, minutes: 60, fin: new Date().toISOString() },
    { atelier_id: ctx.seed.atelierId, projet_id: projetId, etape_code: "poudrage", user_id: operateurB.id, minutes: 40, fin: new Date().toISOString() },
  ]);
  if (errTemps) throw new Error(`temps_etapes C2 : ${errTemps.message}`);
});

// Sans ce nettoyage, les trois comptes rejoints ici (operateurA, operateurB, bureau) restent membres
// de l'atelier jetable pour le reste de la suite : `sieges.test.ts`, exécuté après ce fichier, compte
// alors 4 occupants au lieu d'un et échoue sur un chiffre qui ne lui appartient pas. Même geste que
// `export-donnees.test.ts` (adresseOperateur) et les autres fichiers qui invitent un compte réel.
afterAll(async () => {
  for (const c of [operateurA, operateurB, bureau]) {
    if (c?.id) await proprietaire.from("users").delete().eq("id", c.id);
  }
});

describe("le coût de main d'œuvre additionne chaque opérateur à son propre taux", () => {
  it("projet_temps_cout : 1 h à 25 €/h + 40 min à 45 €/h = 55,00 €, pas une moyenne", async () => {
    const { data, error } = await proprietaire.from("projet_temps_cout").select("*").eq("projet_id", projetId).single();
    expect(error).toBeNull();
    expect(nb(data!.minutes_totales)).toBe(100);
    // 60/60×25 + 40/60×45 = 25 + 30 = 55. Une moyenne des deux taux (35 €/h × 100 min = 58,33 €)
    // donnerait un chiffre différent : c'est exactement ce que cette migration devait corriger.
    expect(nb(data!.cout_main_oeuvre)).toBeCloseTo(55, 2);
  });

  it("projet_revient répercute le même coût de main d'œuvre, pas un recalcul au taux unique de l'atelier", async () => {
    const { data, error } = await proprietaire.from("projet_revient").select("cout_main_oeuvre").eq("projet_id", projetId).maybeSingle();
    expect(error).toBeNull();
    // 100 minutes au taux unique de l'atelier (semé à 42 €/h, cf. tests/setup/seed.ts) ferait 70 € :
    // si ce chiffre apparaissait, projet_revient aurait cessé de lire projet_temps_cout.
    expect(nb(data?.cout_main_oeuvre)).toBeCloseTo(55, 2);
  });

  it("une personne sans taux propre retombe sur le taux de l'atelier, pas sur zéro", async () => {
    const { data: op3 } = await proprietaire
      .from("temps_etapes")
      .insert({ atelier_id: ctx.seed.atelierId, projet_id: projetId, etape_code: "cuisson", user_id: null, minutes: 30 })
      .select("id")
      .single();
    expect(op3).toBeTruthy();
    const { data } = await proprietaire.from("projet_temps_cout").select("cout_main_oeuvre").eq("projet_id", projetId).single();
    // + 30 min au taux de l'atelier (42 €/h) = 21 € de plus : 55 + 21 = 76.
    expect(nb(data!.cout_main_oeuvre)).toBeCloseTo(76, 2);
  });
});

describe("lecture de users_couts : responsable et bureau seulement", () => {
  it("le responsable lit les deux taux qu'il a posés", async () => {
    expect(await tauxEnBase(operateurA.id)).toBe(25);
    expect(await tauxEnBase(operateurB.id)).toBe(45);
  });

  it("le bureau lit les taux de l'équipe", async () => {
    const { data, error } = await bureau.sb.from("users_couts").select("user_id, taux_horaire").eq("atelier_id", ctx.seed.atelierId);
    expect(error).toBeNull();
    const parId = new Map((data ?? []).map((l) => [l.user_id as string, nb(l.taux_horaire)]));
    expect(parId.get(operateurA.id)).toBe(25);
    expect(parId.get(operateurB.id)).toBe(45);
  });

  it("un opérateur ne voit pas les taux — ni le sien, ni celui d'un collègue", async () => {
    const { data, error } = await operateurA.sb.from("users_couts").select("user_id, taux_horaire");
    // RLS filtre silencieusement (pas d'erreur) : la ligne posée pour cet opérateur n'apparaît pas.
    if (!error) expect(data).toHaveLength(0);
  });

  it("un visiteur anonyme ne lit rien du tout", async () => {
    const { data, error } = await anon.from("users_couts").select("user_id, taux_horaire");
    if (!error) expect(data).toHaveLength(0);
  });
});

describe("écriture de users_couts : le responsable seul, jamais la personne concernée", () => {
  it("un opérateur ne peut pas se fixer lui-même un taux", async () => {
    const { error } = await operateurA.sb
      .from("users_couts")
      .upsert({ atelier_id: ctx.seed.atelierId, user_id: operateurA.id, taux_horaire: 999 });
    // Qu'il y ait une erreur ou un 204 muet, l'état réel doit rester celui posé par le responsable.
    void error;
    expect(await tauxEnBase(operateurA.id), "un opérateur a réussi à modifier son propre taux horaire").toBe(25);
  });

  it("un opérateur ne peut pas non plus ajuster le taux d'un collègue", async () => {
    const { error } = await operateurA.sb
      .from("users_couts")
      .upsert({ atelier_id: ctx.seed.atelierId, user_id: operateurB.id, taux_horaire: 1 });
    void error;
    expect(await tauxEnBase(operateurB.id), "un opérateur a modifié le taux d'un collègue").toBe(45);
  });

  it("le bureau ne peut pas écrire non plus — seule la lecture lui est ouverte", async () => {
    const { error } = await bureau.sb
      .from("users_couts")
      .upsert({ atelier_id: ctx.seed.atelierId, user_id: operateurA.id, taux_horaire: 1 });
    void error;
    expect(await tauxEnBase(operateurA.id), "le bureau a réussi à modifier un taux horaire").toBe(25);
  });

  it("le responsable, lui, ajuste bien un taux", async () => {
    await poserTaux(operateurA.id, 28);
    expect(await tauxEnBase(operateurA.id)).toBe(28);
    await poserTaux(operateurA.id, 25); // remis en l'état pour ne pas fausser un test relancé.
  });
});
