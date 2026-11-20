import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";

/**
 * Atelier de démonstration : consultable par tout le monde, modifiable par personne.
 *
 * Le garde-fou doit tenir **en base** et pas dans l'interface. Un visiteur qui obtient la session
 * de démonstration obtient aussi un jeton PostgREST : il peut appeler l'API directement depuis la
 * console de son navigateur. Ces tests font exactement cela.
 *
 * Le point qui a failli passer à travers : les fonctions `SECURITY DEFINER` s'exécutent sous le
 * rôle `postgres`. Un contrôle fondé sur `current_user` les aurait toutes laissées écrire — donc
 * la signature d'un devis, le pointage d'une étape, un mouvement de stock. Le contrôle porte sur
 * le jeton, et le test le vérifie sur une RPC autant que sur une table.
 */

const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";
const MOT_DE_PASSE_DEMO = process.env.DEMO_PASSWORD ?? "";

let sbDemo: SupabaseClient;
let atelierDemo: string | null = null;

// Le mot de passe de la démonstration n'a pas sa place dans le dépôt : il est repris de
// `.env.test`, à l'identique de la variable Vercel.
const decrire = MOT_DE_PASSE_DEMO ? describe : describe.skip;

beforeAll(async () => {
  if (!MOT_DE_PASSE_DEMO) return;
  const ctx = contexte();
  const auth = createClient(ctx.url, ctx.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: EMAIL_DEMO, password: MOT_DE_PASSE_DEMO });
  if (error || !data.session) throw new Error(`connexion au compte de démonstration impossible : ${error?.message}`);
  sbDemo = createClient(ctx.url, ctx.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  const { data: at } = await sbDemo.from("ateliers").select("id, demo").maybeSingle();
  atelierDemo = at?.id ?? null;
  expect(at?.demo, "l'atelier joint au compte de démonstration doit porter le drapeau demo").toBe(true);
});

/** Le message est le même partout : c'est lui qui distingue un verrou d'un bug. */
function estRefusDemo(erreur: { message?: string } | null) {
  return !!erreur?.message?.includes("DEMO_LECTURE_SEULE");
}

decrire("l'atelier de démonstration se visite", () => {
  it("laisse lire ce qu'un prospect vient voir : clients, devis, projets, poudres", async () => {
    const [clients, devis, projets, poudres] = await Promise.all([
      sbDemo.from("clients").select("id"),
      sbDemo.from("devis").select("id"),
      sbDemo.from("projets").select("id"),
      sbDemo.from("poudres").select("id"),
    ]);
    expect(clients.error).toBeNull();
    expect((clients.data ?? []).length).toBeGreaterThan(0);
    expect((devis.data ?? []).length).toBeGreaterThan(0);
    expect((projets.data ?? []).length).toBeGreaterThan(0);
    expect((poudres.data ?? []).length).toBeGreaterThan(0);
  });

  it("ne laisse voir aucun autre atelier", async () => {
    const { data } = await sbDemo.from("ateliers").select("id");
    expect(data).toHaveLength(1);
  });
});

decrire("l'atelier de démonstration ne se modifie pas", () => {
  it("refuse la création d'un client", async () => {
    const { error } = await sbDemo.from("clients").insert({ atelier_id: atelierDemo, nom: "Visiteur SARL" });
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse la modification de l'atelier lui-même", async () => {
    const { error } = await sbDemo.from("ateliers").update({ nom: "Détourné" }).eq("id", atelierDemo!);
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse la suppression d'un devis", async () => {
    const { error } = await sbDemo.from("devis").delete().eq("atelier_id", atelierDemo!);
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse une écriture passant par une fonction SECURITY DEFINER (numérotation)", async () => {
    const { error } = await sbDemo.rpc("next_numero", { p_type: "devis" });
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse un mouvement de stock, qui passe aussi par une fonction SECURITY DEFINER", async () => {
    const { data: poudre } = await sbDemo.from("poudres").select("id").limit(1).maybeSingle();
    const { error } = await sbDemo.rpc("mouvement_stock", {
      p_poudre_id: poudre!.id, p_type: "ajustement", p_valeur_kg: 999, p_projet_id: null,
      p_note: null, p_lot_numero: null, p_lot_fournisseur: null,
    });
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse l'ouverture d'un panier de réapprovisionnement", async () => {
    const { error } = await sbDemo.rpc("panier_poudre");
    expect(estRefusDemo(error)).toBe(true);
  });

  it("refuse un dossier jantes — les quatre tables du module sont couvertes", async () => {
    // Un module neuf qui oublierait le verrou serait le seul écran écrivable de la démonstration
    // publique. Les quatre tables sont donc attaquées une par une, pas en principe.
    const { data: cli } = await sbDemo.from("clients").select("id").limit(1).maybeSingle();
    const refus = await Promise.all([
      sbDemo.from("vehicules").insert({ atelier_id: atelierDemo, marque: "Visiteur" }),
      sbDemo.from("jeux_jantes").insert({ atelier_id: atelierDemo, client_id: cli!.id, diametre_pouces: 19 }),
      sbDemo.from("jantes").insert({ atelier_id: atelierDemo, jeu_id: cli!.id, position: "avg" }),
      sbDemo.from("jante_paliers").insert({ atelier_id: atelierDemo, grille_id: cli!.id, diametre_min: 0, prix_jante_ht: 1 }),
    ]);
    for (const r of refus) expect(estRefusDemo(r.error)).toBe(true);
  });

  it("refuse la signature du devis de démonstration par un visiteur anonyme muni du jeton public", async () => {
    // La page publique de devis n'exige aucune session : c'est ce chemin-là qu'il fallait fermer.
    // `.limit(1).maybeSingle()` sans tri piochait un devis au hasard parmi les « envoyé » : la
    // démonstration en porte plusieurs, et un devis dont la validité a expiré entre-temps déclenche
    // `DEVIS_EXPIRE` avant même que le verrou démo soit atteint — un faux rouge qui ne prouve rien
    // sur le verrou. On écarte donc les devis périmés, ici, en repliant la même règle que
    // `devis_perime` (jours calendaires, approximation suffisante pour un test).
    const { data: candidats } = await sbDemo
      .from("devis")
      .select("public_token, envoye_at, created_at, validite_jours")
      .eq("status", "envoye");
    const maintenant = Date.now();
    const devis = (candidats ?? []).find((d) => {
      const depart = new Date(d.envoye_at ?? d.created_at).getTime();
      return depart + d.validite_jours * 86_400_000 > maintenant;
    });
    expect(
      devis?.public_token,
      "la démonstration doit contenir un devis envoyé et non périmé, sinon ce test ne prouve rien",
    ).toBeTruthy();
    const anon = clientAnonyme();
    const { error } = await anon.rpc("signer_devis", {
      p_token: devis!.public_token,
      p_nom: "Visiteur",
      p_signature: { image: null },
      p_ip: "127.0.0.1",
    });
    expect(estRefusDemo(error)).toBe(true);
  });

  // Lot D — D2 : `JeuJantesPublicClient` distingue déjà « démonstration » d'un échec technique
  // (`error.message.includes("DEMO_LECTURE_SEULE")`), mais ce test n'existait pas côté base : rien
  // ne garantissait que `signer_jeu_jantes` lève réellement ce code sur le chemin public anonyme.
  it("refuse la signature d'un jeu de jantes de démonstration par un visiteur anonyme muni du jeton public", async () => {
    const { data: jeu } = await sbDemo
      .from("jeux_jantes").select("public_token").is("signed_at", null).limit(1).maybeSingle();
    expect(jeu?.public_token, "la démonstration doit contenir un jeu de jantes signable, sinon ce test ne prouve rien").toBeTruthy();
    const anon = clientAnonyme();
    const { data, error } = await anon.rpc("signer_jeu_jantes", {
      p_token: jeu!.public_token,
      p_nom: "Visiteur",
      p_signature: { image: null },
      p_ip: "127.0.0.1",
    });
    // `signer_jeu_jantes` répond en jsonb sur ses refus « métier » (déjà signé, nom requis), mais
    // le verrou de démonstration, lui, reste une exception PostgreSQL — même mécanique que
    // `signer_devis` juste au-dessus.
    expect(data).toBeNull();
    expect(estRefusDemo(error)).toBe(true);
  });
});

/**
 * L'inventaire, et pas seulement les cas connus.
 *
 * Ce bloc existe parce que la correction ponctuelle ne suffit pas. Le verrou n'est pas une
 * politique RLS mais un DÉCLENCHEUR, posé table par table à la main : une table créée dans un
 * chantier ultérieur naît sans lui, et rien ne le signale — l'écriture répond 200. Trois tables
 * étaient dans ce cas au 20/08/2026 (`reglages_comptable`, `exports_comptables`, `audit_logs`),
 * et une seule s'est vue, à l'écran, des semaines après.
 *
 * `verrous_demo_manquants()` fait donc l'inventaire en base, et ce test en fait une règle. Le
 * jour où quelqu'un crée une table portant `atelier_id` sans poser le déclencheur, c'est ici
 * que ça casse — pas en production.
 */
describe("aucune table de données d'atelier n'échappe au verrou", () => {
  it("l'inventaire des verrous manquants est vide", async () => {
    const sb = clientConnecte();
    const { data, error } = await sb.rpc("verrous_demo_manquants");
    expect(error, `verrous_demo_manquants a échoué : ${error?.message}`).toBeNull();
    const manquants = (data ?? []) as { nom: string; motif: string }[];
    expect(
      manquants.map((m) => `${m.nom} — ${m.motif}`),
      "des tables portent `atelier_id` sans `trg_interdire_ecriture_demo` : la démonstration " +
        "publique y est modifiable. Posez le déclencheur, ne retirez pas ce test.",
    ).toEqual([]);
  });

  it("l'inventaire reste fermé à un visiteur anonyme", async () => {
    // Il ne rend que des noms de tables, mais il n'a rien à faire dans la surface publique :
    // c'est une liste de cibles servie clé en main.
    const { data, error } = await clientAnonyme().rpc("verrous_demo_manquants");
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});

/**
 * Les trois tables qui avaient échappé au verrou, attaquées une par une.
 *
 * Chacune a un chemin d'écriture DIFFÉRENT, et c'est tout l'intérêt de les prendre séparément :
 *  • `reglages_comptable` s'écrit en PostgREST direct — ses politiques `insert`/`update`
 *    s'ouvrent à `acces_commercial()`, et le compte de démonstration est `owner`. C'est le
 *    bouton « Enregistrer la cadence » qui répondait 200 en production ;
 *  • `exports_comptables` n'a aucune politique d'écriture, mais `tracer_export_comptable()` est
 *    SECURITY DEFINER : elle contourne la RLS. C'est le chemin qu'un contrôle fondé sur
 *    `current_user` aurait laissé passer ;
 *  • `audit_logs` n'est écrite que par `trg_journal()`, elle aussi SECURITY DEFINER.
 *
 * Chaque refus est suivi d'une **relecture de l'état** : un `raise` qui laisserait quand même
 * une ligne serait un verrou décoratif.
 */
decrire("les tables comptables de la démonstration ne s'écrivent pas non plus", () => {
  it("refuse d'enregistrer une cadence de remise, et n'en laisse aucune trace", async () => {
    const avant = await sbDemo
      .from("reglages_comptable").select("cadence, destinataire_email").maybeSingle();

    const { error } = await sbDemo.from("reglages_comptable").upsert(
      {
        atelier_id: atelierDemo,
        cadence: "mensuelle",
        format: "fec",
        destinataire_email: "pirate@test.invalid",
        jour_du_mois: 5,
      },
      { onConflict: "atelier_id" },
    );
    expect(estRefusDemo(error), `l'écriture n'a pas été refusée : ${error?.message ?? "200"}`).toBe(true);

    const apres = await sbDemo
      .from("reglages_comptable").select("cadence, destinataire_email").maybeSingle();
    expect(apres.data ?? null).toEqual(avant.data ?? null);
    expect((apres.data as { destinataire_email: string | null } | null)?.destinataire_email ?? null)
      .not.toBe("pirate@test.invalid");
  });

  it("refuse la trace d'un export comptable, qui passe pourtant par une fonction SECURITY DEFINER", async () => {
    const avant = await sbDemo
      .from("exports_comptables").select("id", { count: "exact", head: true });

    const { error } = await sbDemo.rpc("tracer_export_comptable", {
      p_debut: "2026-07-01", p_fin: "2026-07-31", p_format: "fec", p_nb: 1, p_total_ht: 1,
    });
    expect(estRefusDemo(error), `la trace n'a pas été refusée : ${error?.message ?? "200"}`).toBe(true);

    const apres = await sbDemo
      .from("exports_comptables").select("id", { count: "exact", head: true });
    expect(apres.count ?? 0).toBe(avant.count ?? 0);
  });

  it("refuse une écriture directe dans le journal des modifications", async () => {
    const { error } = await sbDemo.from("audit_logs").insert({
      atelier_id: atelierDemo, acteur: "utilisateur", action: "creation", entity: "pirate",
    });
    // Deux refus sont acceptables ici — la RLS n'ouvre aucune politique d'écriture sur
    // `audit_logs`, le verrou de démonstration arrive derrière. Ce qui ne l'est pas, c'est une
    // ligne écrite.
    expect(error, "l'insertion dans audit_logs a été acceptée").not.toBeNull();
    const { count } = await sbDemo
      .from("audit_logs").select("id", { count: "exact", head: true }).eq("entity", "pirate");
    expect(count ?? 0).toBe(0);
  });
});
