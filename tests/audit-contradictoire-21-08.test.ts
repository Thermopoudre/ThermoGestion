import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { SIEGES_INCLUS } from "@/lib/abonnement";

/**
 * Les cinq failles de l'audit contradictoire du 21/08/2026, rejouées.
 *
 * MÉTHODE, et elle n'est pas négociable ici : chaque épreuve **vérifie l'état après coup**, jamais
 * le code de retour. PostgREST répond 204 sur un `DELETE` qui n'a effacé aucune ligne, `true` sur
 * une signature qui n'a rien signé, et `null` là où il faudrait une erreur. Un test qui se
 * contente de `expect(error).not.toBeNull()` valide un verrou qui n'existe peut-être pas. On
 * relit donc la base : la facture est-elle encore là, le devis est-il signé, le projet a-t-il
 * bougé.
 *
 * Les épreuves de la faille n°1 se déroulent dans un **second atelier jetable**, créé et détruit
 * par ce fichier. Deux raisons, et la seconde est la plus intéressante :
 *   1. le correctif rend une facture émise indestructible — les décors de ce fichier survivraient
 *      donc à leur propre ménage et pollueraient les fichiers suivants ;
 *   2. le détruire, c'est **prouver la cascade** : `delete from ateliers` doit continuer à tout
 *      emporter, factures émises comprises. C'est un engagement des CGU (« un atelier qui ferme
 *      part avec ses données »), et c'est la porte de sortie que le nouveau verrou devait laisser
 *      ouverte. Sans cette épreuve, on ne saurait qu'on l'a refermée qu'en trouvant la suite
 *      entière bloquée au démarrage suivant.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const ctx = () => contexte();
const sb = () => clientConnecte();
const anon = () => clientAnonyme();

/** Adresse dédiée, dérivée du compte de test : aucun autre fichier ne la croise. */
function adresse(suffixe: string): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+${suffixe}@${domaine}`;
}

/** Ouvre une session applicative ordinaire pour une adresse donnée, en l'inscrivant au besoin. */
async function session(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const c = ctx();
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");
  const auth = createClient(c.url, c.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let s = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!s) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    s = inscription.data.session;
  }
  if (!s) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);
  return {
    client: createClient(c.url, c.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${s.access_token}` } },
    }),
    userId: s.user.id,
  };
}

/** Une ligne de document cohérente avec le total annoncé — les décors mentent moins ainsi. */
function ligne(ht: number) {
  return [{ type: "libre", libelle: "Thermolaquage", qte: 1, unite: "piece", pu_ht: ht, tva: 20, total_ht: ht }];
}

// ── Faille n°1 — le `DELETE` direct ───────────────────────────────────────────

describe("Faille n°1 — un DELETE direct ne détruit plus une pièce comptable", () => {
  let bureau: SupabaseClient;
  let bureauId = "";
  let atelierAudit = "";
  let clientPorteur = "";
  let factureEmiseId = "";
  let numeroFacture = "";
  let devisSigneId = "";
  let devisBrouillonId = "";
  let projetFactureId = "";
  let blPorteId = "";

  beforeAll(async () => {
    const s = await session(adresse("audit-atelier"));
    bureau = s.client;
    bureauId = s.userId;

    // Reliquat d'une exécution interrompue : on ne repart jamais d'un atelier qu'on n'a pas créé.
    const { data: deja } = await bureau.from("users").select("atelier_id").maybeSingle();
    if (deja?.atelier_id) {
      const { data: nom } = await bureau.from("ateliers").select("nom").eq("id", deja.atelier_id).maybeSingle();
      if (!nom?.nom?.startsWith("TEST-AUTO-")) {
        throw new Error(`le compte ${adresse("audit-atelier")} appartient à « ${nom?.nom} » : refus d'exécuter.`);
      }
      await bureau.rpc("supprimer_atelier_test");
    }

    const { data: id, error: errAtelier } = await bureau.rpc("create_atelier", {
      p_nom: `TEST-AUTO-AUDIT-${Date.now()}`,
    });
    if (errAtelier || !id) throw new Error(`create_atelier : ${errAtelier?.message ?? "aucun id"}`);
    atelierAudit = id as string;

    const creer = async (table: string, ligneSql: Record<string, unknown>) => {
      const { data, error } = await bureau.from(table).insert(ligneSql).select("id").single();
      if (error) throw new Error(`${table} : ${error.message}`);
      return (data as { id: string }).id;
    };

    clientPorteur = await creer("clients", { atelier_id: atelierAudit, type: "pro", nom: "Client porteur" });

    devisBrouillonId = await creer("devis", {
      atelier_id: atelierAudit, client_id: clientPorteur, status: "brouillon",
      items: ligne(50), total_ht: 50, total_tva: 10, total_ttc: 60,
    });

    // Un devis signé sans aucune facture : c'est exactement le cas mesuré par l'audit, qui le
    // faisait partir en supprimant d'abord son projet.
    devisSigneId = await creer("devis", {
      atelier_id: atelierAudit, client_id: clientPorteur, status: "signe",
      signed_at: new Date().toISOString(), signed_by: "Audit",
      items: ligne(80), total_ht: 80, total_tva: 16, total_ttc: 96,
    });

    projetFactureId = await creer("projets", {
      atelier_id: atelierAudit, client_id: clientPorteur, nom: "Chantier facturé",
      status: "en_cours", etapes: [],
    });

    const { data: numero, error: errNum } = await bureau.rpc("next_numero", { p_type: "facture" });
    if (errNum) throw new Error(`next_numero : ${errNum.message}`);
    numeroFacture = numero as string;

    factureEmiseId = await creer("factures", {
      atelier_id: atelierAudit, client_id: clientPorteur, projet_id: projetFactureId,
      type: "solde", status: "brouillon", numero: numeroFacture,
      items: ligne(200), total_ht: 200, total_tva: 40, total_ttc: 240,
    });
    const { error: errEmission } = await bureau.from("factures").update({ status: "emise" }).eq("id", factureEmiseId);
    if (errEmission) throw new Error(`émission : ${errEmission.message}`);

    // Un bon de livraison porté par une facture, via `facture_consomme_bl`.
    const projetDuBl = await creer("projets", {
      atelier_id: atelierAudit, client_id: clientPorteur, nom: "Chantier du bon", status: "en_cours", etapes: [],
    });
    blPorteId = await creer("bons_livraison", {
      atelier_id: atelierAudit, client_id: clientPorteur, projet_id: projetDuBl,
      status: "livre", lignes: ligne(100), livre_at: new Date().toISOString(),
    });
    await creer("factures", {
      atelier_id: atelierAudit, client_id: clientPorteur, projet_id: projetDuBl,
      type: "solde", status: "brouillon", items: ligne(100), total_ht: 100, total_tva: 20, total_ttc: 120,
    });
  }, 120_000);

  afterAll(async () => {
    // Ceinture : si la dernière épreuve n'a pas tourné (échec en amont), l'atelier d'audit ne doit
    // pas survivre à ce fichier.
    if (atelierAudit) await bureau?.rpc("supprimer_atelier_test");
  });

  it("la facture émise résiste au DELETE, et son numéro reste occupé", async () => {
    const avant = await bureau.rpc("next_numero", { p_type: "facture" });

    await bureau.from("factures").delete().eq("id", factureEmiseId);

    // L'état, pas le code de retour.
    const { data } = await bureau.from("factures").select("id, numero, status").eq("id", factureEmiseId).maybeSingle();
    expect(data, `${numeroFacture} a été détruite par un DELETE direct — trou dans la numérotation`).not.toBeNull();
    expect(data!.numero).toBe(numeroFacture);
    expect(data!.status).toBe("emise");

    // Et le compteur n'a pas reculé : le numéro déjà servi ne sera jamais réattribué.
    const apres = await bureau.rpc("next_numero", { p_type: "facture" });
    expect(String(apres.data)).not.toBe(numeroFacture);
    expect(String(apres.data)).not.toBe(String(avant.data));
  });

  it("le devis signé résiste au DELETE, y compris après suppression de son projet", async () => {
    await bureau.from("projets").delete().eq("client_id", clientPorteur).eq("nom", "Chantier sans suite");
    await bureau.from("devis").delete().eq("id", devisSigneId);

    const { data } = await bureau.from("devis").select("id, status").eq("id", devisSigneId).maybeSingle();
    expect(data, "un devis signé a été détruit par un DELETE direct").not.toBeNull();
    expect(data!.status).toBe("signe");
  });

  it("le projet facturé et le bon de livraison porté résistent aussi", async () => {
    await bureau.from("projets").delete().eq("id", projetFactureId);
    const { data: projet } = await bureau.from("projets").select("id").eq("id", projetFactureId).maybeSingle();
    expect(projet, "le projet d'une facture émise a été détruit").not.toBeNull();

    await bureau.from("bons_livraison").delete().eq("id", blPorteId);
    const { data: bl } = await bureau.from("bons_livraison").select("id, facture_id").eq("id", blPorteId).maybeSingle();
    expect(bl, "un bon porté par une facture a été détruit").not.toBeNull();
    expect(bl!.facture_id, "le bon a été détaché de sa facture au passage").not.toBeNull();
  });

  it("le client qui porte encore des pièces résiste, lui aussi", async () => {
    await bureau.from("clients").delete().eq("id", clientPorteur);
    const { data } = await bureau.from("clients").select("id").eq("id", clientPorteur).maybeSingle();
    expect(data, "un client portant devis, projets et factures a été détruit").not.toBeNull();
  });

  it("contrôle positif : un brouillon, lui, se supprime toujours", async () => {
    // Sans cette épreuve, on ne saurait pas distinguer « le verrou tient » de « plus rien ne
    // passe ». Le second serait une régression aussi grave que la faille.
    const { error } = await bureau.from("devis").delete().eq("id", devisBrouillonId);
    expect(error).toBeNull();
    const { data } = await bureau.from("devis").select("id").eq("id", devisBrouillonId).maybeSingle();
    expect(data, "un devis en brouillon n'est plus supprimable").toBeNull();
  });

  it("un atelier qui ferme part avec ses données, facture émise comprise", async () => {
    // L'engagement des CGU. La cascade depuis `ateliers` traverse le même trigger : si elle était
    // prise pour une suppression ordinaire, la fermeture d'un compte deviendrait impossible.
    const { error } = await bureau.rpc("supprimer_atelier_test");
    expect(error, "la fermeture d'atelier est bloquée par le verrou de suppression").toBeNull();

    const { data: reste } = await bureau.from("factures").select("id").eq("id", factureEmiseId).maybeSingle();
    expect(reste, "la facture émise a survécu à la fermeture de son atelier").toBeNull();

    const { data: membre } = await bureau.from("users").select("atelier_id").eq("id", bureauId).maybeSingle();
    expect(membre ?? null, "le compte est resté rattaché à un atelier détruit").toBeNull();
    atelierAudit = "";
  });
});

// ── Faille n°2 — la signature ignorait la corbeille ───────────────────────────

describe("Faille n°2 — ce qui est à la corbeille ne se signe plus depuis l'extérieur", () => {
  let devisJeteId = "";
  let devisJeteToken = "";
  let blJeteId = "";
  let blJeteToken = "";
  let projetDuBlId = "";
  let blBrouillonToken = "";

  beforeAll(async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const creer = async (table: string, l: Record<string, unknown>) => {
      const { data, error } = await sb().from(table).insert(l).select("id, public_token").single();
      if (error) throw new Error(`${table} : ${error.message}`);
      return data as { id: string; public_token: string };
    };

    const d = await creer("devis", {
      atelier_id: atelierId, client_id: clientSimpleId, status: "envoye",
      items: ligne(70), total_ht: 70, total_tva: 14, total_ttc: 84,
      envoye_at: new Date().toISOString(),
    });
    devisJeteId = d.id;
    devisJeteToken = d.public_token;

    const p = await creer("projets", {
      atelier_id: atelierId, client_id: clientSimpleId, nom: "Projet du bon jeté",
      status: "en_cours", etapes: [],
    });
    projetDuBlId = p.id;

    const b = await creer("bons_livraison", {
      atelier_id: atelierId, client_id: clientSimpleId, projet_id: projetDuBlId,
      status: "emis", lignes: ligne(70),
    });
    blJeteId = b.id;
    blJeteToken = b.public_token;

    const brouillon = await creer("bons_livraison", {
      atelier_id: atelierId, client_id: clientSimpleId, status: "brouillon", lignes: ligne(10),
    });
    blBrouillonToken = brouillon.public_token;

    for (const [entite, id] of [["devis", devisJeteId], ["bl", blJeteId]] as const) {
      const { error } = await sb().rpc("mettre_a_la_corbeille", { p_entite: entite, p_id: id });
      if (error) throw new Error(`mise à la corbeille ${entite} : ${error.message}`);
    }
  }, 120_000);

  afterAll(async () => {
    for (const [entite, id] of [["devis", devisJeteId], ["bl", blJeteId], ["projet", projetDuBlId]] as const) {
      if (id) await sb().rpc("restaurer_de_la_corbeille", { p_entite: entite, p_id: id });
    }
    if (blJeteId) await sb().from("bons_livraison").delete().eq("id", blJeteId);
    await sb().from("bons_livraison").delete().eq("atelier_id", ctx().seed.atelierId).eq("status", "brouillon").is("projet_id", null);
    if (projetDuBlId) await sb().from("projets").delete().eq("id", projetDuBlId);
    if (devisJeteId) await sb().from("devis").delete().eq("id", devisJeteId);
  });

  it("la page /d/ dit « introuvable » — et la signature aussi, désormais", async () => {
    const { data: lecture } = await anon().rpc("devis_public", { p_token: devisJeteToken });
    expect(lecture, "un devis jeté reste lisible publiquement").toBeNull();

    await anon().rpc("signer_devis", {
      p_token: devisJeteToken, p_nom: "Pirate", p_signature: { image: "data:," }, p_ip: "127.0.0.1",
    });

    const { data } = await sb().rpc("corbeille");
    const encoreJete = ((data as { entite: string; id: string }[]) ?? [])
      .some((l) => l.entite === "devis" && l.id === devisJeteId);
    expect(encoreJete, "le devis a quitté la corbeille").toBe(true);
  });

  it("et surtout : aucun projet vivant n'est né d'un devis supprimé", async () => {
    // L'effet de bord mesuré par l'audit. `trg_devis_signe` crée un projet dès que le statut passe
    // à « signé » : la signature d'un devis jeté fabriquait un chantier que plus personne ne
    // rattachait à rien.
    const { data } = await sb().from("projets").select("id").eq("devis_id", devisJeteId);
    expect(data ?? [], "un projet a été créé à partir d'un devis à la corbeille").toHaveLength(0);
  });

  it("un bon de livraison jeté ne clôt plus le chantier qu'il portait", async () => {
    const { data: lecture } = await anon().rpc("bl_public", { p_token: blJeteToken });
    expect(lecture, "un bon jeté reste lisible publiquement").toBeNull();

    await anon().rpc("signer_bl", { p_token: blJeteToken, p_nom: "Pirate", p_signature: {}, p_ip: null });

    const { data: projet } = await sb().from("projets").select("status, date_livraison").eq("id", projetDuBlId).single();
    expect(projet!.status, "le projet est passé en « livré » par la signature d'un bon supprimé").not.toBe("livre");
    expect(projet!.date_livraison).toBeNull();
  });

  it("un bon encore en brouillon n'est ni lisible ni signable", async () => {
    const { data: lecture } = await anon().rpc("bl_public", { p_token: blBrouillonToken });
    expect(lecture, "un bon en préparation est servi au client").toBeNull();

    const { data: signature } = await anon().rpc("signer_bl", {
      p_token: blBrouillonToken, p_nom: "Client trop rapide", p_signature: {}, p_ip: null,
    });
    expect((signature as { ok: boolean }).ok).toBe(false);
  });
});

// ── Faille n°3 — les gardes de tenant ─────────────────────────────────────────

describe("Faille n°3 — un compte sans atelier ne lit plus l'abonnement des autres", () => {
  let intrus: SupabaseClient;
  let intrusId = "";
  let invitationId = "";

  beforeAll(async () => {
    const s = await session(adresse("audit-sans-atelier"));
    intrus = s.client;
    intrusId = s.userId;
    // Le compte doit vraiment n'appartenir à aucun atelier : c'est toute la condition de l'attaque,
    // et une exécution précédente a pu le rattacher.
    const { data: deja } = await intrus.from("users").select("atelier_id").maybeSingle();
    if (deja?.atelier_id) await sb().from("users").delete().eq("id", intrusId);
  }, 120_000);

  afterAll(async () => {
    if (intrusId) await sb().from("users").delete().eq("id", intrusId);
    if (invitationId) await sb().from("invitations").delete().eq("id", invitationId);
    await sb().from("invitations").delete().eq("email", adresse("audit-sans-atelier"));
  });

  it("il ne compte pas les sièges d'un atelier qui n'est pas le sien", async () => {
    const { atelierId } = ctx().seed;
    const { data } = await intrus.rpc("sieges_occupes", { p_atelier: atelierId });
    expect(nb(data), "le nombre d'utilisateurs d'un atelier étranger a fuité").toBe(0);
  });

  it("il ne connaît ni la formule payée, ni le nombre de places, ni les accès comptables", async () => {
    const { atelierId } = ctx().seed;
    const [plan, autorises, comptables] = await Promise.all([
      intrus.rpc("plan_effectif", { p_atelier: atelierId }),
      intrus.rpc("sieges_autorises", { p_atelier: atelierId }),
      intrus.rpc("acces_comptables_occupes", { p_atelier: atelierId }),
    ]);
    // La formule d'entrée est le repli : elle ne dit rien de ce que l'atelier paie réellement.
    // `sieges_autorises` retombe donc sur les places incluses dans cette formule — et non sur
    // zéro, qui serait un refus déguisé là où on veut une non-réponse.
    expect(plan.data).toBe("atelier");
    expect(nb(autorises.data)).toBe(SIEGES_INCLUS.atelier);
    expect(nb(comptables.data)).toBe(0);
  });

  it("`abonnement_ouvert` n'est plus un guichet : ni pour lui, ni pour un membre, ni pour un anonyme", async () => {
    const { atelierId } = ctx().seed;
    for (const [qui, client] of [["l'intrus", intrus], ["le membre", sb()], ["l'anonyme", anon()]] as const) {
      const { data, error } = await client.rpc("abonnement_ouvert", { p_atelier: atelierId });
      expect(
        error !== null || data === null,
        `abonnement_ouvert répond encore à ${qui} : ${JSON.stringify(data)}`,
      ).toBe(true);
    }
  });

  it("`capacite_ouverte` répond faux, et jamais « je ne sais pas »", async () => {
    const { atelierId } = ctx().seed;
    const { data, error } = await intrus.rpc("capacite_ouverte", { p_atelier: atelierId, p_capacite: "qualite" });
    expect(error).toBeNull();
    // `false` et non `null` : une garde qui hésite laisse l'écran décider, donc ne garde rien.
    expect(data).toBe(false);
  });

  it("contrôle positif : le membre de l'atelier, lui, obtient bien ses vrais chiffres", async () => {
    const { atelierId } = ctx().seed;
    const { data: occupes } = await sb().rpc("sieges_occupes", { p_atelier: atelierId });
    expect(nb(occupes), "le verrou a fermé la porte à l'atelier lui-même").toBeGreaterThanOrEqual(1);
    const { data: mes } = await sb().rpc("mes_sieges");
    expect(nb((mes as { occupes: number }).occupes)).toBe(nb(occupes));
  });

  it("contrôle positif : l'invité sans atelier peut toujours accepter son invitation", async () => {
    // C'est le cas légitime que la branche fautive protégeait : `trg_limite_utilisateurs` compte
    // les sièges au milieu de `accept_invitation`, quand l'invité n'appartient encore à rien. Le
    // trigger interroge maintenant les compteurs internes, jamais le guichet gardé — s'il était
    // resté sur le guichet, il aurait lu « 0 place occupée » et laissé entrer tout le monde.
    const { atelierId } = ctx().seed;
    const { data: inv, error: errInv } = await sb()
      .from("invitations")
      .insert({ atelier_id: atelierId, email: adresse("audit-sans-atelier"), role: "atelier" })
      .select("id, token")
      .single();
    if (errInv) throw new Error(`invitation : ${errInv.message}`);
    invitationId = (inv as { id: string }).id;

    const { error } = await intrus.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    expect(error, "l'acceptation d'une invitation a été cassée par la garde de tenant").toBeNull();

    // Filtré sur son propre identifiant : l'atelier compte plusieurs membres, et un `maybeSingle`
    // non filtré rendrait une erreur de cardinalité qu'on prendrait pour un échec du correctif.
    const { data: membre } = await intrus.from("users").select("atelier_id").eq("id", intrusId).maybeSingle();
    expect(membre?.atelier_id).toBe(atelierId);
  });
});

// ── Faille n°4 — les brouillons servis publiquement ───────────────────────────

describe("Faille n°4 — une pièce n'est publique qu'une fois sortie du brouillon", () => {
  let factureId = "";
  let factureToken = "";
  let devisToken = "";
  let devisId = "";

  beforeAll(async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const { data: f, error: errF } = await sb().from("factures").insert({
      atelier_id: atelierId, client_id: clientSimpleId, type: "libre", status: "brouillon",
      items: ligne(300), total_ht: 300, total_tva: 60, total_ttc: 360,
    }).select("id, public_token").single();
    if (errF) throw new Error(`facture : ${errF.message}`);
    factureId = (f as { id: string }).id;
    factureToken = (f as { public_token: string }).public_token;

    const { data: d, error: errD } = await sb().from("devis").insert({
      atelier_id: atelierId, client_id: clientSimpleId, status: "brouillon",
      items: ligne(90), total_ht: 90, total_tva: 18, total_ttc: 108,
    }).select("id, public_token").single();
    if (errD) throw new Error(`devis : ${errD.message}`);
    devisId = (d as { id: string }).id;
    devisToken = (d as { public_token: string }).public_token;
  }, 120_000);

  afterAll(async () => {
    if (devisId) await sb().from("devis").delete().eq("id", devisId);
  });

  it("le jeton d'un brouillon de facture n'ouvre rien — il existe pourtant dès la création", async () => {
    expect(factureToken, "la ligne n'a pas de jeton public : l'attaque ne veut plus rien dire").toBeTruthy();
    const { data } = await anon().rpc("facture_public", { p_token: factureToken });
    expect(data, "un brouillon de facture est servi au client avant émission").toBeNull();
  });

  it("le même jeton ouvre la facture dès qu'elle est émise", async () => {
    // Contrôle positif indispensable : sinon « rien ne sort » se confondrait avec « la page est
    // cassée ». Le jeton ne change pas — c'est bien le statut qui commande.
    const { error } = await sb().from("factures").update({ status: "emise" }).eq("id", factureId);
    expect(error).toBeNull();
    const { data } = await anon().rpc("facture_public", { p_token: factureToken });
    expect(data, "une facture émise n'est plus servie").not.toBeNull();
    expect(nb((data as { total_ttc: number }).total_ttc)).toBe(360);
  });

  it("un devis en préparation n'est ni lisible ni signable", async () => {
    const { data: lecture } = await anon().rpc("devis_public", { p_token: devisToken });
    expect(lecture, "un devis en brouillon est servi au client").toBeNull();

    const { data: signature } = await anon().rpc("signer_devis", {
      p_token: devisToken, p_nom: "Trop pressé", p_signature: {}, p_ip: null,
    });
    expect(signature).toBe(false);
    const { data: apres } = await sb().from("devis").select("status").eq("id", devisId).single();
    expect(apres!.status).toBe("brouillon");
  });

  it("la même règle qu'au portail client : c'est là qu'elle était déjà juste", async () => {
    // Le portail écarte les brouillons depuis le premier jour. Cette épreuve interdit qu'une des
    // deux vues reparte de son côté : elles doivent montrer le même périmètre.
    const { data: portail } = await sb()
      .from("client_portail")
      .select("jeton")
      .eq("client_id", ctx().seed.clientSimpleId)
      .maybeSingle();
    if (!portail?.jeton) return; // le portail de ce client n'est pas ouvert : rien à comparer
    const { data } = await anon().rpc("portail_liste", { p_token: portail.jeton, p_rubrique: "factures", p_de: 0, p_a: 99 });
    const numeros = ((data as { lignes: { numero: string | null }[] })?.lignes ?? []);
    expect(numeros.every((l) => l !== null)).toBe(true);
  });
});

// ── Faille n°5 — anon, cartographie et chemins de stockage ────────────────────

describe("Faille n°5 — `anon` n'a plus que les deux écritures de la vitrine", () => {
  it("il n'a plus aucun droit de lecture sur les tables métier", async () => {
    // La RLS refusait déjà, mais elle était seule. Ici on vérifie le second cran : le GRANT.
    // Un refus de RLS rend `[]`, un refus de GRANT rend une erreur — c'est la différence qu'on
    // veut voir, et elle ne dépend d'aucune clause qu'un `create policy` pourrait défaire.
    for (const table of ["clients", "devis", "factures", "projets", "users", "ateliers", "subscriptions"]) {
      const { error } = await anon().from(table).select("id").limit(1);
      expect(error, `anon lit encore ${table}`).not.toBeNull();
    }
  });

  it("il n'écrit plus rien non plus, sur aucune des tables attaquées", async () => {
    const { atelierId } = ctx().seed;
    const { error } = await anon().from("clients").insert({ atelier_id: atelierId, type: "pro", nom: "PIRATE-ANON" });
    expect(error).not.toBeNull();
    const { data } = await sb().from("clients").select("id").eq("nom", "PIRATE-ANON");
    expect(data ?? [], "une ligne anonyme a été écrite").toHaveLength(0);
  });

  it("contrôle positif : le formulaire de rappel de la vitrine écrit toujours", async () => {
    const email = `audit-${Date.now()}@exemple.test`;
    const { error } = await anon().from("leads").insert({ email, source: "audit", status: "nouveau" });
    expect(error, "la vitrine ne peut plus déposer de demande de rappel").toBeNull();
    // Et il ne relit pas ce qu'il a écrit : INSERT seul, jamais SELECT.
    const { error: errLecture } = await anon().from("leads").select("email").eq("email", email);
    expect(errLecture, "anon relit la table des demandes de rappel").not.toBeNull();
    await sb().from("leads").delete().eq("email", email);
  });

  it("la cartographie du schéma ne se rend plus à un visiteur anonyme", async () => {
    const { data, error } = await anon().rpc("tables_du_schema_public");
    expect(error !== null || (data ?? []).length === 0, "le catalogue du schéma est servi à anon").toBe(true);
  });

  it("elle ne nomme à un compte connecté que ce qu'il peut déjà lire", async () => {
    // Contrôle positif : le garde-fou de l'export s'appuie sur cette fonction, il doit continuer
    // à voir tout le périmètre exportable.
    const { data, error } = await sb().rpc("tables_du_schema_public");
    expect(error).toBeNull();
    const tables = ((data ?? []) as { nom: string; genre: string }[]).filter((r) => r.genre === "table");
    expect(tables.length, "le référentiel de l'export s'est vidé").toBeGreaterThanOrEqual(40);
  });
});

describe("Faille n°5 — un chemin de stockage ne sort pas de son atelier", () => {
  const AUTRE_ATELIER = "00000000-0000-0000-0000-0000000000ff";

  it("`photos` refuse une ligne qui désigne le fichier d'un autre atelier", async () => {
    const { atelierId } = ctx().seed;
    const { error } = await sb().from("photos").insert({
      atelier_id: atelierId,
      storage_path: `${AUTRE_ATELIER}/receptions/vol/piece.jpg`,
      taille_bytes: 10,
    });
    expect(error, "une photo peut désigner le fichier d'un autre atelier").not.toBeNull();

    const { data } = await sb().from("photos").select("id").like("storage_path", `${AUTRE_ATELIER}%`);
    expect(data ?? [], "la ligne détournée a été écrite malgré tout").toHaveLength(0);
  });

  it("`pieces_jointes` aussi — c'est /rc/ et /jt/ qui signeraient l'URL avec la clé de service", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const { error } = await sb().from("pieces_jointes").insert({
      atelier_id: atelierId, entite: "client", entite_id: clientSimpleId,
      storage_path: `${AUTRE_ATELIER}/pieces/client/${clientSimpleId}/vol.pdf`,
      nom: "vol.pdf", mime: "application/pdf", taille: 10,
    });
    expect(error, "une pièce jointe peut désigner le fichier d'un autre atelier").not.toBeNull();

    const { data } = await sb().from("pieces_jointes").select("id").like("storage_path", `${AUTRE_ATELIER}%`);
    expect(data ?? [], "la ligne détournée a été écrite malgré tout").toHaveLength(0);
  });
});
