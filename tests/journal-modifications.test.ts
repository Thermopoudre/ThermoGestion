import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { JOURS_JOURNAL, entreeJournal, phraseComplete, valeurFr, type LigneJournal } from "@/lib/journal";
// Les montants cherchés *à l'intérieur d'une phrase* passent par `eur()` : `Intl` sépare les
// milliers par une espace fine insécable (U+202F), invisible à la relecture et fatale à un test
// écrit à la main. Le format rendu par `valeurFr`, lui, est épinglé en dur plus bas — le comparer
// à `eur()` reviendrait à comparer la fonction à elle-même.
import { eur } from "@/lib/utils";

/**
 * Le journal des modifications, prouvé dans PostgREST.
 *
 * Trois règles de méthode, les mêmes que pour les rôles et la corbeille :
 *
 *  1. **On vérifie l'état après coup, jamais le code de retour.** Sans politique d'UPDATE,
 *     PostgREST répond 204 en n'ayant rien modifié : un test qui se contente de
 *     `expect(error).toBeNull()` valide un verrou inexistant. Ici, la question porte en plus sur
 *     une table de preuve — se tromper coûterait la promesse commerciale de la formule Certifié.
 *  2. **On attaque depuis les deux côtés**, anonyme et authentifié. Le journal doit être
 *     illisible au visiteur et inaltérable au responsable lui-même.
 *  3. **On ne touche jamais un atelier réel.** Tout se passe dans le `TEST-AUTO-…` de
 *     `globalSetup`, et ce fichier remet en état ce qu'il crée.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const ctx = () => contexte();
const patron = () => clientConnecte();

let devisId = "";
let clientId = "";
let palierId = "";
/** Compte jetable, créé le temps de prouver qu'un employé qui part est bien supprimable. */
let partant: { sb: SupabaseClient; id: string } | null = null;

/** Les lignes du journal d'une pièce, de la plus récente à la plus ancienne. */
async function journal(entite: string, id: string): Promise<LigneJournal[]> {
  const { data, error } = await patron()
    .from("audit_logs")
    .select("id, created_at, acteur, auteur_nom, action, entity, entity_id, payload")
    .eq("entity", entite)
    .eq("entity_id", id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`lecture du journal : ${error.message}`);
  return (data ?? []) as LigneJournal[];
}

/** Les champs enregistrés par la ligne la plus récente, triés — l'ordre jsonb n'est pas garanti. */
function champsDe(l: LigneJournal | undefined): string[] {
  return Object.keys(l?.payload?.champs ?? {}).sort();
}

/** Adresse dérivée du compte de test : `contact@x.fr` → `contact+journal@x.fr`. */
function adressePartant(): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+journal@${domaine}`;
}

beforeAll(async () => {
  const { atelierId, clientSimpleId, grilleStandardId } = ctx().seed;

  const { data: d, error: errD } = await patron()
    .from("devis")
    .insert({
      atelier_id: atelierId, client_id: clientSimpleId, status: "brouillon",
      items: [], total_ht: 1400, total_tva: 280, total_ttc: 1680, notes: "Devis du journal",
    })
    .select("id")
    .single();
  if (errD) throw new Error(`devis du journal : ${errD.message}`);
  devisId = (d as { id: string }).id;

  const { data: c, error: errC } = await patron()
    .from("clients")
    .insert({ atelier_id: atelierId, type: "pro", nom: "Journal SARL", ville: "Aix" })
    .select("id")
    .single();
  if (errC) throw new Error(`client du journal : ${errC.message}`);
  clientId = (c as { id: string }).id;

  const { data: p, error: errP } = await patron()
    .from("grille_paliers")
    .insert({ atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 900, surface_max: 999, prix_m2: 22 })
    .select("id")
    .single();
  if (errP) throw new Error(`palier du journal : ${errP.message}`);
  palierId = (p as { id: string }).id;
});

afterAll(async () => {
  if (partant?.id) await patron().from("users").delete().eq("id", partant.id);
  await patron().from("invitations").delete().eq("email", adressePartant());
  if (devisId) await patron().from("devis").delete().eq("id", devisId);
  if (clientId) await patron().from("clients").delete().eq("id", clientId);
  if (palierId) await patron().from("grille_paliers").delete().eq("id", palierId);
});

// ── Ce que le journal enregistre ──────────────────────────────────────────────

describe("Le journal enregistre ce qui s'est passé, et lui seul", () => {
  it("une création laisse une ligne signée du membre qui l'a faite", async () => {
    const lignes = await journal("devis", devisId);
    const creation = lignes.find((l) => l.action === "creation");
    expect(creation, "la création du devis n'a rien écrit").toBeDefined();
    expect(creation?.acteur).toBe("utilisateur");
    // Le nom est recopié dans la ligne : c'est ce qui la rend lisible après le départ du membre.
    expect(creation?.auteur_nom, "l'auteur n'est pas nommé").toBeTruthy();
  });

  it("seuls les champs réellement modifiés sont enregistrés", async () => {
    const avant = (await journal("devis", devisId)).length;
    const { error } = await patron()
      .from("devis")
      .update({ total_ttc: 1780, notes: "Total revu à la hausse" })
      .eq("id", devisId);
    expect(error).toBeNull();

    const lignes = await journal("devis", devisId);
    expect(lignes.length, "une modification n'a produit aucune ligne").toBe(avant + 1);
    // Deux champs touchés, deux champs enregistrés. Ni `updated_at`, ni la ligne entière.
    expect(champsDe(lignes[0])).toEqual(["notes", "total_ttc"]);
    expect(nb(lignes[0].payload?.champs?.total_ttc.avant)).toBe(1680);
    expect(nb(lignes[0].payload?.champs?.total_ttc.apres)).toBe(1780);
  });

  it("la colonne `recherche`, recalculée toute seule, ne pollue pas le journal", async () => {
    // `clients.recherche` est une colonne générée à partir du nom : sans la liste d'exclusion,
    // le moindre changement de nom produirait deux lignes de journal dont une illisible.
    const { error } = await patron().from("clients").update({ nom: "Journal SAS" }).eq("id", clientId);
    expect(error).toBeNull();
    const lignes = await journal("clients", clientId);
    expect(champsDe(lignes[0])).toEqual(["nom"]);
  });

  it("réécrire la même valeur n'écrit rien du tout", async () => {
    const avant = (await journal("devis", devisId)).length;
    // Le cas le plus fréquent de l'application : un écran réenregistre le formulaire entier
    // alors que l'exploitant n'a rien changé. Un journal qui compterait ça serait illisible en
    // une semaine.
    const { error } = await patron().from("devis").update({ total_ttc: 1780 }).eq("id", devisId);
    expect(error).toBeNull();
    expect((await journal("devis", devisId)).length, "une écriture sans changement a été journalisée").toBe(avant);
  });

  it("le bruit technique n'écrit rien non plus", async () => {
    const avant = (await journal("devis", devisId)).length;
    // `pdf_url` est régénéré à chaque édition du document : le tracer noierait le seul champ qui
    // compte, le total.
    const { error } = await patron().from("devis").update({ pdf_url: "https://exemple.test/x.pdf" }).eq("id", devisId);
    expect(error).toBeNull();
    expect((await journal("devis", devisId)).length, "un champ de bruit a été journalisé").toBe(avant);
  });

  it("un prix de grille qui change, puis qui disparaît, reste retrouvable", async () => {
    const { atelierId, grilleStandardId } = ctx().seed;
    await patron().from("grille_paliers").update({ prix_m2: 26 }).eq("id", palierId);

    const apresChangement = await journal("grille_paliers", palierId);
    expect(nb(apresChangement[0].payload?.champs?.prix_m2.avant)).toBe(22);
    expect(nb(apresChangement[0].payload?.champs?.prix_m2.apres)).toBe(26);

    // Un palier n'a pas de corbeille : sa suppression est définitive, et c'est la seule occasion
    // d'enregistrer ce qu'il valait.
    const { error } = await patron().from("grille_paliers").delete().eq("id", palierId);
    expect(error).toBeNull();
    const apresSuppression = await journal("grille_paliers", palierId);
    expect(apresSuppression[0].action).toBe("suppression");
    expect(nb(apresSuppression[0].payload?.ligne?.prix_m2)).toBe(26);

    // Reposé pour l'`afterAll` et pour ne pas laisser la grille amputée aux fichiers suivants.
    const { data } = await patron()
      .from("grille_paliers")
      .insert({ atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 900, surface_max: 999, prix_m2: 22 })
      .select("id")
      .single();
    palierId = (data as { id: string } | null)?.id ?? "";
  });
});

// ── Qui a le droit de lire ────────────────────────────────────────────────────

describe("Le journal ne se lit pas par-dessus l'épaule", () => {
  it("un visiteur anonyme n'en voit pas une ligne", async () => {
    const { data } = await clientAnonyme().from("audit_logs").select("id");
    expect(data ?? [], "le journal est lisible sans être connecté").toHaveLength(0);
  });

  it("le responsable, lui, lit le journal de son atelier", async () => {
    const { data, error } = await patron().from("audit_logs").select("id").limit(1);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

// ── Qui a le droit d'écrire ───────────────────────────────────────────────────

describe("Une table de preuve où chacun écrit ne prouve rien", () => {
  it("le responsable ne peut pas y poser une ligne de sa main", async () => {
    const { atelierId } = ctx().seed;
    const avant = (await patron().from("audit_logs").select("id", { count: "exact", head: true })).count ?? 0;
    await patron().from("audit_logs").insert({
      atelier_id: atelierId, action: "modification", entity: "devis", entity_id: devisId,
      payload: { champs: { total_ttc: { avant: 9, apres: 9 } } },
    });
    const apres = (await patron().from("audit_logs").select("id", { count: "exact", head: true })).count ?? 0;
    expect(apres, "une ligne a été fabriquée à la main dans le journal").toBe(avant);
  });

  it("un visiteur anonyme non plus", async () => {
    const { atelierId } = ctx().seed;
    const avant = (await patron().from("audit_logs").select("id", { count: "exact", head: true })).count ?? 0;
    await clientAnonyme().from("audit_logs").insert({
      atelier_id: atelierId, action: "creation", entity: "devis", entity_id: devisId, payload: {},
    });
    const apres = (await patron().from("audit_logs").select("id", { count: "exact", head: true })).count ?? 0;
    expect(apres).toBe(avant);
  });

  it("une ligne du journal ne se corrige pas", async () => {
    const [ligne] = await journal("devis", devisId);
    await patron().from("audit_logs").update({ auteur_nom: "Quelqu'un d'autre" }).eq("id", ligne.id);
    const { data } = await patron().from("audit_logs").select("auteur_nom").eq("id", ligne.id).maybeSingle();
    expect(data?.auteur_nom, "le journal a été réécrit").not.toBe("Quelqu'un d'autre");
  });

  it("et ne s'efface pas — la ligne est toujours là après la tentative", async () => {
    const [ligne] = await journal("devis", devisId);
    await patron().from("audit_logs").delete().eq("id", ligne.id);
    const { data } = await patron().from("audit_logs").select("id").eq("id", ligne.id).maybeSingle();
    expect(data?.id, "une ligne du journal a été supprimée").toBe(ligne.id);
  });

  it("les fonctions du journal ne s'appellent pas depuis PostgREST", async () => {
    // `revoke ... from public` ne suffit pas : Supabase accorde EXECUTE nommément à `anon` par
    // ALTER DEFAULT PRIVILEGES. Sans révocation explicite, n'importe qui pourrait déclencher la
    // purge — et vider deux ans de preuves en un appel.
    for (const fn of ["purger_journal", "jours_journal", "journal_champs_ignores"]) {
      const connecte = await patron().rpc(fn, fn === "journal_champs_ignores" ? { p_table: "devis" } : {});
      expect(connecte.error, `${fn} est appelable par un membre connecté`).not.toBeNull();
      const anonyme = await clientAnonyme().rpc(fn, fn === "journal_champs_ignores" ? { p_table: "devis" } : {});
      expect(anonyme.error, `${fn} est appelable anonymement`).not.toBeNull();
    }
  });
});

// ── Le départ d'un employé ────────────────────────────────────────────────────

describe("Un employé qui part ne bloque rien et n'emporte rien", () => {
  it("son compte se supprime, ses devis restent", async () => {
    const { url, anonKey, seed } = ctx();
    const email = adressePartant();
    const password = process.env.TEST_USER_PASSWORD;
    if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

    const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
    if (!session) {
      const inscription = await auth.auth.signUp({ email, password });
      if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
      session = inscription.data.session;
    }
    if (!session) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);
    const sb = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });

    const { data: deja } = await sb.from("users").select("atelier_id").eq("id", session.user.id).maybeSingle();
    if (!deja) {
      const { data: inv, error: errInv } = await patron()
        .from("invitations")
        .insert({ atelier_id: seed.atelierId, email, role: "bureau" })
        .select("token")
        .single();
      if (errInv) throw new Error(`invitation : ${errInv.message}`);
      const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
      if (errAccept) throw new Error(`accept_invitation : ${errAccept.message}`);
    } else if (deja.atelier_id !== seed.atelierId) {
      throw new Error(`${email} appartient déjà à un autre atelier — refus d'exécuter ce test.`);
    }
    partant = { sb, id: session.user.id };

    // Le devis qu'il a établi. `created_by` était en NO ACTION : cette ligne suffisait à rendre
    // son compte indestructible, et l'erreur 23503 ne dit rien à personne.
    const { data: sien, error: errSien } = await sb
      .from("devis")
      .insert({
        atelier_id: seed.atelierId, client_id: seed.clientSimpleId, status: "brouillon",
        items: [], total_ttc: 500, created_by: session.user.id,
      })
      .select("id")
      .single();
    if (errSien) throw new Error(`devis du partant : ${errSien.message}`);
    const devisDuPartant = (sien as { id: string }).id;

    const { error } = await patron().from("users").delete().eq("id", session.user.id);
    expect(error, "un membre ayant établi un devis reste indestructible").toBeNull();

    // SET NULL et non CASCADE : on garde la pièce, on perd l'auteur. L'inverse ferait disparaître
    // le chiffre d'affaires de l'atelier le jour où un salarié s'en va.
    const { data: apres } = await patron().from("devis").select("id, created_by").eq("id", devisDuPartant).maybeSingle();
    expect(apres?.id, "le devis a disparu avec son auteur").toBe(devisDuPartant);
    expect(apres?.created_by).toBeNull();

    // Le journal, lui, garde le nom : c'est tout l'intérêt de recopier plutôt que de référencer.
    const trace = (await journal("devis", devisDuPartant)).find((l) => l.action === "creation");
    expect(trace?.auteur_nom, "le journal a perdu l'auteur en même temps que son compte").toBeTruthy();

    partant = null;
    await patron().from("devis").delete().eq("id", devisDuPartant);
    await patron().from("invitations").delete().eq("email", email);
  });
});

// ── Le français ───────────────────────────────────────────────────────────────

describe("Le journal se lit en français, pas en JSON", () => {
  const ligne = (payload: LigneJournal["payload"], extra: Partial<LigneJournal> = {}): LigneJournal => ({
    id: 1,
    created_at: "2026-08-18T12:12:00.000Z",
    acteur: "utilisateur",
    auteur_nom: "Julien",
    action: "modification",
    entity: "devis",
    entity_id: "00000000-0000-0000-0000-000000000000",
    payload,
    ...extra,
  });

  it("un total qui change se dit avec des euros et un nom", () => {
    const p = phraseComplete(ligne({ champs: { total_ttc: { avant: 1400, apres: 1780 } } }));
    expect(p).toContain("Julien a fait passer le total TTC de");
    expect(p).toContain(eur(1400));
    expect(p).toContain(eur(1780));
    expect(p, "un nom de colonne est ressorti à l'écran").not.toContain("total_ttc");
  });

  it("une écriture du cron n'est attribuée à personne", () => {
    const e = entreeJournal(ligne({ champs: { relances_actives: { avant: true, apres: false } } }, { acteur: "systeme", auteur_nom: null }));
    expect(e.qui).toBe("Le logiciel");
    expect(e.phrases[0]).toBe("a fait passer les relances automatiques de oui à non");
  });

  it("la signature d'un client depuis le lien public se distingue de l'atelier", () => {
    const e = entreeJournal(ligne({ champs: { signed_by: { avant: null, apres: "M. Durand" } } }, { acteur: "public", auteur_nom: null }));
    expect(e.qui).toBe("Le client, depuis le lien public");
    expect(e.phrases[0]).toBe("a renseigné le signataire : M. Durand");
  });

  it("la corbeille est un geste, pas une date qui change", () => {
    const jete = entreeJournal(ligne({ champs: { deleted_at: { avant: null, apres: "2026-08-18T12:00:00Z" } } }));
    expect(jete.phrases[0]).toBe("a mis la fiche à la corbeille");
    const rendu = entreeJournal(ligne({ champs: { deleted_at: { avant: "2026-08-18T12:00:00Z", apres: null } } }));
    expect(rendu.phrases[0]).toBe("a restauré la fiche depuis la corbeille");
  });

  it("un champ qu'on ne sait pas nommer est compté, jamais affiché en technique", () => {
    const e = entreeJournal(ligne({ champs: { stripe_payment_link: { avant: null, apres: "https://x" }, total_ttc: { avant: 10, apres: 20 } } }));
    expect(e.nonTraduits).toBe(1);
    expect(e.phrases.join(" "), "un nom de colonne technique est affiché").not.toContain("stripe");
  });

  it("les prix, les surfaces et les statuts prennent leur unité", () => {
    // Valeurs attendues écrites en toutes lettres, pas recalculées avec `eur()` et `nombreFr()` :
    // ce sont ces mêmes fonctions que `valeurFr` appelle, et une assertion qui les rejoue reste
    // verte même si le journal se met à afficher « 26 € » ou « 12.5 m² ». C'est le format lu par
    // l'exploitant qu'on épingle ici, pas la mécanique qui le produit.
    // L'espace avant l'euro est insécable et sa nature varie selon la version d'ICU : on la
    // normalise plutôt que de figer un caractère invisible.
    const lisible = (s: string) => s.replace(/[  ]/g, " ");
    expect(lisible(valeurFr("grille_paliers", "prix_m2", 26))).toBe("26,00 €");
    expect(lisible(valeurFr("projets", "surface_m2", 12.5))).toBe("12,5 m²");
    expect(valeurFr("devis", "status", "signe")).toBe("Signé");
    expect(lisible(valeurFr("clients", "remise_pct", 15))).toBe("15 %");
    expect(valeurFr("devis", "items", [1, 2, 3])).toBe("3 lignes");
  });

  it("la rétention affichée est celle de la base", () => {
    // Doublon assumé de `public.jours_journal()`. Si l'un bouge sans l'autre, l'écran ment.
    expect(JOURS_JOURNAL).toBe(730);
  });
});
