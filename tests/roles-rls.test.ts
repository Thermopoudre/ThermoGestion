import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { LIBELLE_ROLE, ROLES, accesCommercial, refusDeRole } from "@/lib/roles";

/**
 * Les trois rôles, prouvés là où ça compte : dans PostgREST.
 *
 * Ce fichier ne regarde aucun écran. Il ouvre **trois vraies sessions** — un responsable, un
 * bureau, un opérateur — dans le même atelier jetable, et leur fait poser les questions qu'un
 * employé curieux poserait depuis la console de son navigateur. C'est le seul niveau où la
 * réponse a une valeur : masquer une entrée de menu ne masque rien du tout, et le produit s'est
 * déjà fait prendre cinq fois à ce jeu-là.
 *
 * Deux règles de méthode, apprises à nos dépens :
 *
 *  1. **On vérifie l'état après coup, jamais le code de retour.** Sans policy d'UPDATE, PostgREST
 *     répond 204 en ayant modifié zéro ligne : un test qui se contente de `expect(error).toBeNull()`
 *     valide un verrou inexistant, et un test qui attend une erreur échoue sur un verrou qui
 *     marche. On relit donc la valeur avec le compte du responsable.
 *  2. **On ne touche jamais un atelier réel.** Tout se passe dans le `TEST-AUTO-…` créé par
 *     `globalSetup`, et les deux comptes ajoutés ici sont retirés en fin de fichier — les autres
 *     fichiers de la suite comptent les sièges occupés et tomberaient sinon.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

type Compagnon = { sb: SupabaseClient; id: string };

const ctx = () => contexte();
const patron = () => clientConnecte();

/** Adresse dérivée du compte de test : `contact@x.fr` → `contact+role-bureau@x.fr`. */
function adresse(role: string): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+role-${role}@${domaine}`;
}

/**
 * Crée (ou retrouve) un compte réel, le fait entrer dans l'atelier jetable avec le rôle demandé,
 * et rend un client PostgREST porteur de SON jeton — pas de celui du responsable.
 */
async function rejoindre(role: "bureau" | "atelier"): Promise<Compagnon> {
  const { url, anonKey, seed } = ctx();
  const email = adresse(role);
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!session) {
    // Premier lancement sur un poste neuf : le compte n'existe pas encore. Inscription ordinaire,
    // exactement comme un employé qui suit le lien d'invitation.
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: dejaMembre } = await sb.from("users").select("atelier_id, role").eq("id", session.user.id).maybeSingle();
  if (dejaMembre) {
    // Reliquat d'une exécution interrompue. On refuse net d'utiliser un compte rattaché ailleurs.
    if (dejaMembre.atelier_id !== seed.atelierId) {
      throw new Error(`${email} appartient déjà à un autre atelier — refus d'exécuter le fichier.`);
    }
  } else {
    const { data: inv, error: errInv } = await patron()
      .from("invitations")
      .insert({ atelier_id: seed.atelierId, email, role })
      .select("token")
      .single();
    if (errInv) throw new Error(`invitation ${role} : ${errInv.message}`);
    const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    if (errAccept) throw new Error(`accept_invitation ${role} : ${errAccept.message}`);
  }

  return { sb, id: session.user.id };
}

let bureau: Compagnon;
let atelier: Compagnon;
let monId = "";
let poudreRoleId = "";
let lotRoleId = "";
let devisRoleId = "";

beforeAll(async () => {
  const { seed } = ctx();
  const { data: me } = await patron().auth.getUser();
  monId = me.user?.id ?? "";

  bureau = await rejoindre("bureau");
  atelier = await rejoindre("atelier");

  // Un lot de poudre avec son prix d'achat, et un devis : sans donnée à voir, « l'opérateur ne
  // voit rien » serait vrai pour tout le monde et ne prouverait rien.
  const { data: p, error: errP } = await patron()
    .from("poudres")
    .insert({
      atelier_id: seed.atelierId, marque: "TestPowder", reference: "ROLES-TEST-9005",
      ral: "9005", finition: "mat", rendement_m2_kg: 8, stock_kg: 0, actif: true,
    })
    .select("id")
    .single();
  if (errP) throw new Error(`poudre du fichier rôles : ${errP.message}`);
  poudreRoleId = (p as { id: string }).id;

  const { error: errPc } = await patron()
    .from("poudre_couts")
    .upsert({ poudre_id: poudreRoleId, atelier_id: seed.atelierId, prix_kg: 21.5 });
  if (errPc) throw new Error(`poudre_couts : ${errPc.message}`);

  const { data: l, error: errL } = await patron()
    .from("poudre_lots")
    .insert({
      atelier_id: seed.atelierId, poudre_id: poudreRoleId, numero: "ROLES-LOT-1",
      fournisseur: "TestPowder", quantite_kg: 10, restant_kg: 10, recu_le: "2026-08-01",
    })
    .select("id")
    .single();
  if (errL) throw new Error(`lot du fichier rôles : ${errL.message}`);
  lotRoleId = (l as { id: string }).id;

  const { error: errLc } = await patron()
    .from("poudre_lot_couts")
    .upsert({ lot_id: lotRoleId, atelier_id: seed.atelierId, prix_kg: 21.5 });
  if (errLc) throw new Error(`poudre_lot_couts : ${errLc.message}`);

  const { data: d, error: errD } = await patron()
    .from("devis")
    .insert({ atelier_id: seed.atelierId, client_id: seed.clientSimpleId, status: "brouillon", items: [] })
    .select("id")
    .single();
  if (errD) throw new Error(`devis du fichier rôles : ${errD.message}`);
  devisRoleId = (d as { id: string }).id;
}, 120_000);

afterAll(async () => {
  // Les deux comptes ajoutés doivent repartir : `sieges.test.ts` et `droits-formules.test.ts`
  // comptent les places occupées, et un siège oublié ici les ferait échouer sans rapport.
  if (devisRoleId) await patron().from("devis").delete().eq("id", devisRoleId);
  if (lotRoleId) await patron().from("poudre_lots").delete().eq("id", lotRoleId);
  if (poudreRoleId) await patron().from("poudres").delete().eq("id", poudreRoleId);
  if (atelier?.id) await patron().from("users").delete().eq("id", atelier.id);
  if (bureau?.id) await patron().from("users").delete().eq("id", bureau.id);
  await patron().from("invitations").delete().in("email", [adresse("bureau"), adresse("atelier")]);
});

// ── Le vocabulaire ────────────────────────────────────────────────────────────

describe("Quatre rôles, et une phrase par rôle", () => {
  it("le barème du code est celui de la base", async () => {
    // Le quatrième est arrivé avec l'accès expert-comptable : il est vérifié en détail dans
    // `comptable-lecture-seule.test.ts`, mais il doit figurer au barème dès ici, sinon les deux
    // fichiers pourraient diverger sans que rien ne le signale.
    expect([...ROLES]).toEqual(["owner", "bureau", "atelier", "comptable"]);
    // La contrainte CHECK doit refuser tout autre mot : sans elle, une faute de frappe dans une
    // invitation fabriquerait un rôle que `acces_commercial()` ne reconnaît pas — donc, par
    // chance et non par décision, un compte sans aucun droit commercial.
    const { error } = await patron()
      .from("invitations")
      .insert({ atelier_id: ctx().seed.atelierId, email: "role-invente@test.invalid", role: "admin" });
    expect(error).not.toBeNull();
  });

  it("chaque rôle explique en une phrase ce qu'il voit", () => {
    for (const r of ROLES) {
      expect(LIBELLE_ROLE[r].titre.length, r).toBeGreaterThan(2);
      expect(LIBELLE_ROLE[r].phrase.length, r).toBeGreaterThan(40);
    }
    expect(accesCommercial("owner")).toBe(true);
    expect(accesCommercial("bureau")).toBe(true);
    expect(accesCommercial("atelier")).toBe(false);
    expect(accesCommercial("comptable")).toBe(false);
  });

  it("les rubriques fermées sont celles annoncées", () => {
    expect(refusDeRole("/devis", "atelier")).toBe("commercial");
    expect(refusDeRole("/factures/123", "atelier")).toBe("commercial");
    expect(refusDeRole("/pilotage", "atelier")).toBe("commercial");
    expect(refusDeRole("/abonnement", "bureau")).toBe("proprietaire");
    expect(refusDeRole("/abonnement", "owner")).toBeNull();
    // La production reste ouverte : c'est le métier de l'opérateur, il ne doit rien y perdre.
    for (const p of ["/projets", "/pointage", "/receptions", "/fournees", "/stock", "/lots", "/scan/abc", "/qualite"]) {
      expect(refusDeRole(p, "atelier"), p).toBeNull();
    }
  });

  it("l'invitation pose bien le rôle choisi, et `accept_invitation` le respecte", async () => {
    const { data } = await patron().from("users").select("id, role").eq("atelier_id", ctx().seed.atelierId);
    const parId = Object.fromEntries(((data as { id: string; role: string }[]) ?? []).map((u) => [u.id, u.role]));
    expect(parId[monId]).toBe("owner");
    expect(parId[bureau.id]).toBe("bureau");
    expect(parId[atelier.id]).toBe("atelier");
  });
});

// ── Ce que l'opérateur ne voit pas ────────────────────────────────────────────

describe("L'opérateur ne lit ni marge, ni prix de revient, ni rendement chiffré", () => {
  it("la rentabilité client lui rend zéro ligne, là où le responsable en a", async () => {
    const { data: vuPatron, error: errPatron } = await patron().from("client_rentabilite").select("client_id, marge_eur");
    expect(errPatron).toBeNull();
    expect((vuPatron ?? []).length, "le responsable doit voir sa rentabilité").toBeGreaterThan(0);

    const { data: vuBureau } = await bureau.sb.from("client_rentabilite").select("client_id");
    expect((vuBureau ?? []).length, "le bureau facture : il doit voir la marge").toBeGreaterThan(0);

    const { data: vuAtelier, error } = await atelier.sb.from("client_rentabilite").select("client_id");
    expect(error).toBeNull();
    expect(vuAtelier ?? [], "l'opérateur a lu la marge de vos clients").toHaveLength(0);
  });

  it("le rendement par teinte et le prix de revient lui sont fermés", async () => {
    const { data: rPatron } = await patron().from("poudre_rendement").select("poudre_id");
    expect((rPatron ?? []).length).toBeGreaterThan(0);

    const { data: rAtelier } = await atelier.sb.from("poudre_rendement").select("poudre_id");
    expect(rAtelier ?? []).toHaveLength(0);

    const { data: revient } = await atelier.sb.from("projet_revient").select("projet_id");
    expect(revient ?? []).toHaveLength(0);
  });

  it("son pointage lui reste visible, mais sans le prix de son heure", async () => {
    // Le temps est son travail ; ce que coûte son heure ne l'est pas. La vue rend donc la ligne
    // avec les minutes et `null` en euros — jamais « 0,00 € », qui se lirait comme du gratuit.
    const { error } = await atelier.sb.from("projet_temps_cout").select("projet_id, minutes_totales, cout_main_oeuvre");
    expect(error, "la vue de temps doit rester lisible par l'opérateur").toBeNull();
    const { data: couts } = await atelier.sb.from("projet_temps_cout").select("cout_main_oeuvre");
    for (const l of (couts as { cout_main_oeuvre: number | null }[]) ?? []) {
      expect(l.cout_main_oeuvre, "coût de main d'œuvre lisible par l'opérateur").toBeNull();
    }
  });
});

describe("Le prix d'achat de la poudre a quitté la fiche", () => {
  it("`prix_kg` n'existe plus sur `poudre_lots` ni sur `poudres`", async () => {
    // Ce n'est pas une politique : la colonne n'est plus là. Un privilège de colonne n'aurait pas
    // suffi — owner, bureau et atelier partagent le rôle Postgres `authenticated`.
    const { error: e1 } = await atelier.sb.from("poudre_lots").select("prix_kg").limit(1);
    expect(e1, "prix_kg est encore exposé sur poudre_lots").not.toBeNull();
    const { error: e2 } = await atelier.sb.from("poudres").select("prix_kg").limit(1);
    expect(e2, "prix_kg est encore exposé sur poudres").not.toBeNull();
  });

  it("l'opérateur voit ses lots et leur DLU, jamais leur prix", async () => {
    const { data, error } = await atelier.sb
      .from("poudre_lots")
      .select("id, numero, restant_kg, dlu, poudre_lot_couts(prix_kg)")
      .eq("id", lotRoleId);
    expect(error).toBeNull();
    expect(data ?? [], "l'opérateur doit continuer à voir le stock").toHaveLength(1);
    expect((data as { poudre_lot_couts: unknown }[])[0].poudre_lot_couts).toBeNull();

    const { data: couts } = await atelier.sb.from("poudre_lot_couts").select("prix_kg");
    expect(couts ?? []).toHaveLength(0);
    const { data: catalogue } = await atelier.sb.from("poudre_couts").select("prix_kg");
    expect(catalogue ?? []).toHaveLength(0);
  });

  it("le responsable et le bureau, eux, l'ont", async () => {
    const { data: p } = await patron().from("poudre_lot_couts").select("prix_kg").eq("lot_id", lotRoleId).maybeSingle();
    expect(nb(p?.prix_kg)).toBe(21.5);
    const { data: b } = await bureau.sb.from("poudre_lot_couts").select("prix_kg").eq("lot_id", lotRoleId).maybeSingle();
    expect(nb(b?.prix_kg)).toBe(21.5);
  });

  it("l'opérateur ne peut pas non plus l'écrire", async () => {
    await atelier.sb.from("poudre_couts").upsert({ poudre_id: poudreRoleId, atelier_id: ctx().seed.atelierId, prix_kg: 1 });
    const { data } = await patron().from("poudre_couts").select("prix_kg").eq("poudre_id", poudreRoleId).maybeSingle();
    expect(nb(data?.prix_kg), "un opérateur a réécrit un prix d'achat").toBe(21.5);
  });
});

describe("Les tarifs se lisent, ne se modifient pas", () => {
  it("l'opérateur lit la grille et les prestations — il en a besoin en production", async () => {
    const { data: prestations, error } = await atelier.sb.from("prestations").select("id, nom, unite");
    expect(error).toBeNull();
    expect((prestations ?? []).length).toBeGreaterThan(0);
    const { data: paliers } = await atelier.sb.from("grille_paliers").select("id");
    expect((paliers ?? []).length).toBeGreaterThan(0);
  });

  it("il ne peut pas changer le forfait minimum — on vérifie la valeur, pas le code de retour", async () => {
    const { grilleStandardId } = ctx().seed;
    const { data: avant } = await patron().from("grilles_tarifaires").select("forfait_minimum").eq("id", grilleStandardId).single();
    await atelier.sb.from("grilles_tarifaires").update({ forfait_minimum: 999 }).eq("id", grilleStandardId);
    const { data: apres } = await patron().from("grilles_tarifaires").select("forfait_minimum").eq("id", grilleStandardId).single();
    expect(nb(apres?.forfait_minimum), "un opérateur a changé votre forfait minimum").toBe(nb(avant?.forfait_minimum));
  });

  it("il ne peut pas ajouter un palier ni une prestation", async () => {
    const { atelierId, grilleStandardId } = ctx().seed;
    const { count: avant } = await patron().from("grille_paliers").select("id", { count: "exact", head: true });
    await atelier.sb.from("grille_paliers").insert({ atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 0, surface_max: 1, prix_m2: 1 });
    const { count: apres } = await patron().from("grille_paliers").select("id", { count: "exact", head: true });
    expect(apres, "un opérateur a ajouté un palier tarifaire").toBe(avant);

    const { count: avantP } = await patron().from("prestations").select("id", { count: "exact", head: true });
    await atelier.sb.from("prestations").insert({ atelier_id: atelierId, nom: "Prestation pirate", unite: "piece", prix_unitaire_ht: 1, tva_rate: 20 });
    const { count: apresP } = await patron().from("prestations").select("id", { count: "exact", head: true });
    expect(apresP, "un opérateur a ajouté une prestation").toBe(avantP);
  });

  it("le bureau, lui, écrit bien la grille", async () => {
    const { grilleStandardId } = ctx().seed;
    const { data: avant } = await patron().from("grilles_tarifaires").select("forfait_minimum").eq("id", grilleStandardId).single();
    const cible = nb(avant?.forfait_minimum) + 1;
    await bureau.sb.from("grilles_tarifaires").update({ forfait_minimum: cible }).eq("id", grilleStandardId);
    const { data: apres } = await patron().from("grilles_tarifaires").select("forfait_minimum").eq("id", grilleStandardId).single();
    expect(nb(apres?.forfait_minimum), "le bureau doit pouvoir tenir sa grille").toBe(cible);
    // On repose la valeur : les fichiers de chiffrage qui suivent s'appuient dessus.
    await patron().from("grilles_tarifaires").update({ forfait_minimum: nb(avant?.forfait_minimum) }).eq("id", grilleStandardId);
  });
});

describe("Le commerce est fermé à l'atelier", () => {
  it("il ne lit ni devis, ni factures, ni abonnement, ni journal", async () => {
    for (const table of ["devis", "factures", "paiements", "commandes_poudre", "subscriptions", "audit_logs"]) {
      const { data } = await atelier.sb.from(table).select("id");
      expect(data ?? [], `l'opérateur lit ${table}`).toHaveLength(0);
    }
  });

  it("le bureau lit les devis, le responsable aussi", async () => {
    const { data: b } = await bureau.sb.from("devis").select("id").eq("id", devisRoleId);
    expect(b ?? []).toHaveLength(1);
    const { data: p } = await patron().from("devis").select("id").eq("id", devisRoleId);
    expect(p ?? []).toHaveLength(1);
  });

  it("l'abonnement et le journal sont réservés au responsable", async () => {
    const { data: p } = await patron().from("subscriptions").select("plan");
    expect((p ?? []).length).toBe(1);
    const { data: b } = await bureau.sb.from("subscriptions").select("plan");
    expect(b ?? [], "le bureau lit l'abonnement").toHaveLength(0);
    const { data: j } = await bureau.sb.from("audit_logs").select("id");
    expect(j ?? []).toHaveLength(0);
  });

  it("mais tout le monde connaît l'état de son abonnement, sinon l'app se fige", async () => {
    // `mon_abonnement()` rend le plan et l'essai sans les identifiants Stripe : sans elle, fermer
    // la table à l'opérateur lui présenterait un atelier « sans abonnement », donc figé en
    // lecture seule. Un verrou qui casse le produit n'est pas un verrou.
    const { data, error } = await atelier.sb.rpc("mon_abonnement");
    expect(error).toBeNull();
    expect((data as { status: string } | null)?.status).toBe("trialing");
  });
});

describe("L'IBAN de l'entreprise n'appartient qu'au patron", () => {
  it("ni le bureau ni l'atelier ne le lisent", async () => {
    const { data: p } = await patron().from("ateliers_bancaire").select("iban, bic").maybeSingle();
    expect(p?.iban).toBe("FR7630001007941234567890185");

    const { data: b } = await bureau.sb.from("ateliers_bancaire").select("iban");
    expect(b ?? [], "le bureau lit l'IBAN de l'entreprise").toHaveLength(0);
    const { data: a } = await atelier.sb.from("ateliers_bancaire").select("iban");
    expect(a ?? [], "l'opérateur lit l'IBAN de l'entreprise").toHaveLength(0);
  });

  it("`ateliers` ne le porte plus du tout", async () => {
    const { error } = await atelier.sb.from("ateliers").select("iban").limit(1);
    expect(error, "iban est encore une colonne de ateliers").not.toBeNull();
  });

  it("personne d'autre que le patron ne peut le remplacer", async () => {
    const { atelierId } = ctx().seed;
    await bureau.sb.from("ateliers_bancaire").update({ iban: "FR76PIRATE" }).eq("atelier_id", atelierId);
    await atelier.sb.from("ateliers_bancaire").update({ iban: "FR76PIRATE" }).eq("atelier_id", atelierId);
    const { data } = await patron().from("ateliers_bancaire").select("iban").maybeSingle();
    expect(data?.iban, "l'IBAN de l'atelier a été réécrit par quelqu'un d'autre").toBe("FR7630001007941234567890185");
  });

  it("le taux horaire et les frais généraux sont ouverts au bureau, fermés à l'atelier", async () => {
    const { data: b } = await bureau.sb.from("ateliers_couts").select("taux_horaire").maybeSingle();
    expect(nb(b?.taux_horaire)).toBe(42);
    const { data: a } = await atelier.sb.from("ateliers_couts").select("taux_horaire");
    expect(a ?? []).toHaveLength(0);
    const { error } = await atelier.sb.from("ateliers").select("taux_horaire").limit(1);
    expect(error, "taux_horaire est encore une colonne de ateliers").not.toBeNull();
  });
});

// ── Le rôle lui-même ──────────────────────────────────────────────────────────

describe("Personne ne se promeut tout seul", () => {
  it("l'opérateur ne peut pas se nommer responsable", async () => {
    const { error } = await atelier.sb.from("users").update({ role: "owner" }).eq("id", atelier.id);
    expect(error?.message ?? "").toContain("ROLE_RESERVE_PROPRIETAIRE");
    // Et surtout : l'état, relu par le responsable. Un 204 sans effet ne prouverait rien.
    const { data } = await patron().from("users").select("role").eq("id", atelier.id).single();
    expect(data?.role, "un opérateur s'est promis responsable").toBe("atelier");
  });

  it("le bureau ne se promeut pas davantage, ni ne promeut un collègue", async () => {
    const { error } = await bureau.sb.from("users").update({ role: "owner" }).eq("id", bureau.id);
    expect(error?.message ?? "").toContain("ROLE_RESERVE_PROPRIETAIRE");
    await bureau.sb.from("users").update({ role: "bureau" }).eq("id", atelier.id);
    const { data } = await patron().from("users").select("role").eq("id", atelier.id).single();
    expect(data?.role).toBe("atelier");
  });

  it("un membre ne peut pas changer d'atelier", async () => {
    const { error } = await atelier.sb
      .from("users")
      .update({ atelier_id: "00000000-0000-0000-0000-000000000000" })
      .eq("id", atelier.id);
    expect(error).not.toBeNull();
    const { data } = await patron().from("users").select("atelier_id").eq("id", atelier.id).single();
    expect(data?.atelier_id).toBe(ctx().seed.atelierId);
  });

  it("le responsable, lui, change bien le rôle d'un membre", async () => {
    await patron().from("users").update({ role: "bureau" }).eq("id", atelier.id);
    const { data: promu } = await patron().from("users").select("role").eq("id", atelier.id).single();
    expect(promu?.role).toBe("bureau");
    await patron().from("users").update({ role: "atelier" }).eq("id", atelier.id);
    const { data: revenu } = await patron().from("users").select("role").eq("id", atelier.id).single();
    expect(revenu?.role).toBe("atelier");
  });
});

describe("Un atelier garde toujours un responsable", () => {
  it("le dernier propriétaire ne peut ni se rétrograder, ni se désactiver, ni se supprimer", async () => {
    const rétrogradation = await patron().from("users").update({ role: "bureau" }).eq("id", monId);
    expect(rétrogradation.error?.message ?? "").toContain("DERNIER_PROPRIETAIRE");

    const desactivation = await patron().from("users").update({ actif: false }).eq("id", monId);
    expect(desactivation.error?.message ?? "").toContain("DERNIER_PROPRIETAIRE");

    const suppression = await patron().from("users").delete().eq("id", monId);
    expect(suppression.error?.message ?? "").toContain("DERNIER_PROPRIETAIRE");

    const { data } = await patron().from("users").select("role, actif").eq("id", monId).single();
    expect(data?.role).toBe("owner");
    expect(data?.actif).toBe(true);
  });

  it("dès qu'il y en a deux, la rétrogradation redevient possible", async () => {
    // La règle n'est pas « le patron est intouchable » : c'est « l'atelier ne se retrouve jamais
    // sans patron ». On le prouve en nommant un second responsable, puis en revenant en arrière.
    await patron().from("users").update({ role: "owner" }).eq("id", bureau.id);
    try {
      const { error } = await patron().from("users").update({ role: "bureau" }).eq("id", monId);
      expect(error, "avec deux responsables, la rétrogradation doit passer").toBeNull();
      const { data } = await patron().from("users").select("role").eq("id", monId).single();
      expect(data?.role).toBe("bureau");
    } finally {
      // Remise en état par le second responsable — le compte de test doit repartir `owner`,
      // sinon `supprimer_atelier_test()` refusera de nettoyer l'atelier jetable.
      await bureau.sb.from("users").update({ role: "owner" }).eq("id", monId);
      await patron().from("users").update({ role: "bureau" }).eq("id", bureau.id);
    }
    const { data: fin } = await patron().from("users").select("role").eq("id", monId).single();
    expect(fin?.role, "le compte de test doit rester responsable de l'atelier jetable").toBe("owner");
  });
});
