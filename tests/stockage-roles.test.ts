import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte } from "./helpers/contexte";
import { DOSSIER_PAR_ENTITE, ENTITES_PIECE_JOINTE, cheminPieceJointe } from "@/lib/pieces-jointes";
import { DOSSIERS_PHOTOS, cheminLogo, cheminPhoto } from "@/lib/stockage";

/**
 * Le stockage, rejoué exactement comme l'audit contradictoire du 21/08/2026 l'a pris en défaut.
 *
 * Trois attaques avaient réussi, toutes fondées sur le même oubli : les policies de
 * `storage.objects` ne lisaient que le premier segment du chemin (l'atelier), donc ni le rôle du
 * porteur du jeton, ni le caractère « démonstration » de l'atelier n'entraient dans la décision.
 *
 *   1. `GET /demo` délivre une vraie session `authenticated` à n'importe quel visiteur. Trois
 *      `POST /storage/v1/object/...` répondaient 200 : hébergement de fichiers gratuit et
 *      anonyme, et logo de la démonstration écrasable.
 *   2. Le compte `atelier` — qui ne lit aucune ligne de `factures` — listait le bucket
 *      `documents`, téléchargeait « CONTRAT CONFIDENTIEL — marge 42 % » et le supprimait.
 *   3. Aucune policy `DELETE` sur `logos` : ce qui y tombait n'était plus retirable par le
 *      produit.
 *
 * Deux règles de méthode, reprises de `roles-rls.test.ts` parce qu'elles ont déjà sauvé la mise :
 *
 *   - **On vérifie l'état après coup, jamais le code de retour.** Le service de stockage répond
 *     parfois 200 sur une opération qui n'a rien écrit, et PostgREST répond 204 sur un DELETE qui
 *     n'a supprimé aucune ligne. Chaque attaque se termine donc par une relecture faite avec la
 *     session du responsable — la seule qui voit tout.
 *   - **On ne touche jamais un atelier réel.** Tout se passe dans le `TEST-AUTO-…` de
 *     `globalSetup`, sauf les tentatives d'écriture sur la démonstration, qui doivent justement
 *     échouer — et dont l'échec est vérifié en relisant le bucket.
 *
 * Les deux comptes compagnons portent les mêmes adresses que `roles-rls.test.ts` (`+role-bureau@`,
 * `+role-atelier@`) et sont retirés en fin de fichier : les autres fichiers comptent les sièges
 * occupés et tomberaient sur un siège oublié. L'aide `rejoindre()` y est volontairement recopiée
 * plutôt qu'importée — deux fichiers de tests qui se tiennent l'un l'autre s'écroulent ensemble.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

type Compagnon = { sb: SupabaseClient; id: string };

const ctx = () => contexte();
const patron = () => clientConnecte();

const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";
const MOT_DE_PASSE_DEMO = process.env.DEMO_PASSWORD ?? "";

/** Adresse dérivée du compte de test : `contact@x.fr` → `contact+role-bureau@x.fr`. */
function adresse(role: string): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+role-${role}@${domaine}`;
}

async function rejoindre(role: "bureau" | "atelier" | "comptable"): Promise<Compagnon> {
  const { url, anonKey, seed } = ctx();
  const email = adresse(role);
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

  const { data: dejaMembre } = await sb.from("users").select("atelier_id").eq("id", session.user.id).maybeSingle();
  if (dejaMembre) {
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

/** Un fichier minuscule mais d'un type réellement accepté : on teste des droits, pas des octets. */
function fichier(contenu: string, type: string): Blob {
  return new Blob([contenu], { type });
}

let bureau: Compagnon;
let atelier: Compagnon;
let comptable: Compagnon;
let sbDemo: SupabaseClient | null = null;
let atelierDemo = "";

/** Chemins déposés par le fichier, retirés en fin de course quoi qu'il arrive. */
const aNettoyerDocuments: string[] = [];
const aNettoyerPhotos: string[] = [];
const aNettoyerLogos: string[] = [];

beforeAll(async () => {
  bureau = await rejoindre("bureau");
  atelier = await rejoindre("atelier");
  comptable = await rejoindre("comptable");

  if (MOT_DE_PASSE_DEMO) {
    const { url, anonKey } = ctx();
    const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: EMAIL_DEMO, password: MOT_DE_PASSE_DEMO });
    if (error || !data.session) throw new Error(`connexion au compte de démonstration impossible : ${error?.message}`);
    sbDemo = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
    const { data: at } = await sbDemo.from("ateliers").select("id, demo").maybeSingle();
    atelierDemo = (at as { id: string } | null)?.id ?? "";
    expect((at as { demo: boolean } | null)?.demo, "le compte de démonstration doit viser un atelier demo").toBe(true);
  }
}, 120_000);

afterAll(async () => {
  const sb = patron();
  if (aNettoyerDocuments.length) await sb.storage.from("documents").remove(aNettoyerDocuments);
  if (aNettoyerPhotos.length) await sb.storage.from("photos").remove(aNettoyerPhotos);
  if (aNettoyerLogos.length) await sb.storage.from("logos").remove(aNettoyerLogos);
  await sb.from("pieces_jointes").delete().eq("atelier_id", ctx().seed.atelierId);
  // Les comptes compagnons repartent : `sieges.test.ts` et `droits-formules.test.ts` comptent les
  // places occupées, et un siège oublié ici les ferait échouer sans aucun rapport.
  if (atelier?.id) await sb.from("users").delete().eq("id", atelier.id);
  if (bureau?.id) await sb.from("users").delete().eq("id", bureau.id);
  if (comptable?.id) await sb.from("users").delete().eq("id", comptable.id);
  await sb.from("invitations").delete().in("email", [adresse("bureau"), adresse("atelier"), adresse("comptable")]);
});

// ───────────────────────────────────────────────────────────────────────────
// Faille n°1 — le visiteur de la démonstration écrivait dans les trois buckets
// ───────────────────────────────────────────────────────────────────────────

const decrireDemo = MOT_DE_PASSE_DEMO ? describe : describe.skip;

decrireDemo("le visiteur de la démonstration ne dépose rien", () => {
  it("refuse les trois dépôts que l'audit avait réussis, et le bucket reste vide après coup", async () => {
    const sb = sbDemo!;
    const marque = `AUDIT-SECU-${Date.now()}`;

    // Exactement les trois requêtes de l'audit, chemins valides compris — ce n'est pas la forme
    // du chemin qui doit les arrêter, c'est le drapeau `demo` de l'atelier.
    const cibles = [
      { bucket: "documents", chemin: `${atelierDemo}/projets/${crypto.randomUUID()}/${marque}.txt`, corps: fichier("x", "text/plain") },
      { bucket: "photos", chemin: `${atelierDemo}/projets/${crypto.randomUUID()}/${marque}.png`, corps: fichier("x", "image/png") },
      { bucket: "logos", chemin: `${atelierDemo}/logo-${marque}.png`, corps: fichier("x", "image/png") },
    ];

    for (const cible of cibles) {
      const { error } = await sb.storage.from(cible.bucket).upload(cible.chemin, cible.corps);
      expect(error, `dépôt refusé dans ${cible.bucket}`).not.toBeNull();
    }

    // L'état après coup, et c'est lui qui compte : un 200 sur un objet inexistant ne prouverait
    // rien, un refus suivi d'un fichier présent prouverait l'inverse de ce qu'on croit tester.
    for (const cible of cibles) {
      const dossier = cible.chemin.split("/").slice(0, -1).join("/");
      const { data } = await sb.storage.from(cible.bucket).list(dossier);
      expect((data ?? []).some((f) => f.name.includes(marque)), `${cible.bucket} ne contient rien`).toBe(false);
    }
  });

  it("laisse la démonstration se visiter : la lecture du bucket reste ouverte", async () => {
    // Le contre-test. Une correction qui fermerait aussi la LECTURE viderait la démonstration de
    // ses photos, c'est-à-dire de ce qu'un prospect vient voir.
    const { error } = await sbDemo!.storage.from("photos").list(atelierDemo);
    expect(error).toBeNull();
  });

  it("laisse le logo de la démonstration intact : il n'est ni écrasable ni supprimable", async () => {
    const sb = sbDemo!;
    const { data: avant } = await sb.storage.from("logos").list(atelierDemo);
    const logo = (avant ?? [])[0];
    if (!logo) return; // la démonstration n'a pas encore de logo : rien à défendre ici

    const chemin = `${atelierDemo}/${logo.name}`;
    const { error: errMaj } = await sb.storage.from("logos").update(chemin, fichier("x", "image/png"));
    expect(errMaj, "l'écrasement du logo de la démonstration doit être refusé").not.toBeNull();
    const { error: errSuppr } = await sb.storage.from("logos").remove([chemin]);
    // `remove` ne remonte pas toujours une erreur : c'est l'état après coup qui tranche.
    void errSuppr;
    const { data: apres } = await sb.storage.from("logos").list(atelierDemo);
    expect((apres ?? []).some((f) => f.name === logo.name), "le logo est toujours là").toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Faille n°2 — les quatre rôles s'arrêtaient à la porte du bucket
// ───────────────────────────────────────────────────────────────────────────

describe("le contrat confidentiel d'un client reste au bureau", () => {
  let cheminContrat = "";

  it("le responsable dépose une pièce sur une fiche client", async () => {
    const { seed } = ctx();
    cheminContrat = cheminPieceJointe(seed.atelierId, "client", seed.clientRemiseId, "contrat-cadre.pdf");
    aNettoyerDocuments.push(cheminContrat);

    const { error } = await patron()
      .storage.from("documents")
      .upload(cheminContrat, fichier("CONTRAT CONFIDENTIEL - marge 42%", "application/pdf"), {
        contentType: "application/pdf",
      });
    expect(error, "le responsable, lui, doit pouvoir déposer").toBeNull();

    const { error: errLigne } = await patron().from("pieces_jointes").insert({
      atelier_id: seed.atelierId,
      entite: "client",
      entite_id: seed.clientRemiseId,
      storage_path: cheminContrat,
      nom: "contrat-cadre.pdf",
      mime: "application/pdf",
      taille: 31,
    });
    expect(errLigne).toBeNull();
  });

  it("l'opérateur ne le voit pas dans le listing du bucket", async () => {
    const dossier = cheminContrat.split("/").slice(0, -1).join("/");
    const { data } = await atelier.sb.storage.from("documents").list(dossier);
    expect(data ?? []).toHaveLength(0);
  });

  it("l'opérateur ne le télécharge pas, même avec le chemin exact sous les yeux", async () => {
    // C'est la vraie situation : le chemin n'est pas un secret, il apparaît dans le journal
    // réseau du navigateur dès qu'un collègue ouvre la fiche depuis le même poste.
    const { data, error } = await atelier.sb.storage.from("documents").download(cheminContrat);
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    // Une URL signée non plus : c'est la voie qu'emprunte réellement l'écran.
    const { data: signee } = await atelier.sb.storage.from("documents").createSignedUrl(cheminContrat, 60);
    expect(signee?.signedUrl ?? null).toBeNull();
  });

  it("l'opérateur ne lit même pas la LIGNE qui le décrit — un nom de fichier est déjà un renseignement", async () => {
    const { data } = await atelier.sb
      .from("pieces_jointes")
      .select("id, nom")
      .eq("entite", "client");
    expect(data ?? []).toHaveLength(0);
  });

  it("l'opérateur ne le supprime pas, et le fichier est toujours là après sa tentative", async () => {
    await atelier.sb.storage.from("documents").remove([cheminContrat]);
    await atelier.sb.from("pieces_jointes").delete().eq("storage_path", cheminContrat);

    // Relecture avec la session du responsable : `remove()` répond volontiers sans avoir rien
    // fait, et un DELETE PostgREST sans policy répond 204 en ayant supprimé zéro ligne.
    const dossier = cheminContrat.split("/").slice(0, -1).join("/");
    const { data: restants } = await patron().storage.from("documents").list(dossier);
    expect((restants ?? []).length, "le fichier a survécu à la tentative").toBe(1);
    const { data: ligne } = await patron().from("pieces_jointes").select("id").eq("storage_path", cheminContrat);
    expect(ligne ?? []).toHaveLength(1);
  });

  it("le bureau, lui, l'ouvre sans difficulté", async () => {
    const { data, error } = await bureau.sb.storage.from("documents").download(cheminContrat);
    expect(error).toBeNull();
    expect(await data!.text()).toContain("CONTRAT CONFIDENTIEL");
  });

  it("le cabinet comptable ne voit rien des documents de l'atelier", async () => {
    // `current_atelier_id()` lui rend NULL : c'est le refus par défaut voulu par le chantier C7.
    const { data: lignes } = await comptable.sb.from("pieces_jointes").select("id");
    expect(lignes ?? []).toHaveLength(0);
    const { data: fichiers } = await comptable.sb.storage.from("documents").list(`${ctx().seed.atelierId}/clients`);
    expect(fichiers ?? []).toHaveLength(0);
  });
});

describe("ce qui décrit le travail reste ouvert à l'atelier", () => {
  // Le contre-test du bloc précédent. Une correction qui fermerait tout le bucket à l'opérateur
  // serait « sûre » et inutilisable : il ne verrait plus le plan du chantier qu'il doit réaliser.
  let cheminPlan = "";
  let cheminPhotoProjet = "";

  it("le bureau dépose le plan d'un chantier, l'opérateur le télécharge", async () => {
    const { seed } = ctx();
    const projetFictif = crypto.randomUUID();
    cheminPlan = cheminPieceJointe(seed.atelierId, "projet", projetFictif, "plan-garde-corps.pdf");
    aNettoyerDocuments.push(cheminPlan);

    const { error } = await bureau.sb
      .storage.from("documents")
      .upload(cheminPlan, fichier("PLAN", "application/pdf"), { contentType: "application/pdf" });
    expect(error).toBeNull();

    const { data, error: errLecture } = await atelier.sb.storage.from("documents").download(cheminPlan);
    expect(errLecture).toBeNull();
    expect(await data!.text()).toBe("PLAN");
  });

  it("l'opérateur photographie un projet et relit sa photo", async () => {
    const { seed } = ctx();
    cheminPhotoProjet = cheminPhoto(seed.atelierId, "projets", [crypto.randomUUID()], "piece.png");
    aNettoyerPhotos.push(cheminPhotoProjet);

    const { error } = await atelier.sb
      .storage.from("photos")
      .upload(cheminPhotoProjet, fichier("PNG", "image/png"), { contentType: "image/png" });
    expect(error, "l'opérateur doit pouvoir photographier : c'est son métier").toBeNull();

    const { data } = await atelier.sb.storage.from("photos").createSignedUrl(cheminPhotoProjet, 60);
    expect(data?.signedUrl).toBeTruthy();
  });

  it("les quatre dossiers de photos sont ouverts à l'opérateur", async () => {
    for (const dossier of DOSSIERS_PHOTOS) {
      const chemin = cheminPhoto(ctx().seed.atelierId, dossier, [crypto.randomUUID()], "p.png");
      aNettoyerPhotos.push(chemin);
      const { error } = await atelier.sb
        .storage.from("photos")
        .upload(chemin, fichier("PNG", "image/png"), { contentType: "image/png" });
      expect(error, `dossier photos/${dossier}`).toBeNull();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La liste fermée des dossiers : plus d'hébergement gratuit, même pour un membre
// ───────────────────────────────────────────────────────────────────────────

describe("le bucket n'est pas un disque dur", () => {
  it("refuse un dossier inventé, même au responsable et dans son propre atelier", async () => {
    const { seed } = ctx();
    const chemin = `${seed.atelierId}/mes-vacances/${Date.now()}-photo.png`;
    const { error } = await patron()
      .storage.from("photos")
      .upload(chemin, fichier("PNG", "image/png"), { contentType: "image/png" });
    expect(error, "un dossier hors barème doit être refusé").not.toBeNull();

    const { data } = await patron().storage.from("photos").list(`${seed.atelierId}/mes-vacances`);
    expect(data ?? []).toHaveLength(0);
  });

  it("refuse un fichier posé à la racine du bucket, sans dossier d'atelier", async () => {
    const { error } = await patron()
      .storage.from("photos")
      .upload(`${Date.now()}-orphelin.png`, fichier("PNG", "image/png"), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuse le dossier d'un autre atelier", async () => {
    const chemin = cheminPhoto(crypto.randomUUID(), "projets", [crypto.randomUUID()], "p.png");
    const { error } = await patron()
      .storage.from("photos")
      .upload(chemin, fichier("PNG", "image/png"), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuse un format qui n'est pas une image dans le bucket photos", async () => {
    // `photos` n'avait ni plafond de taille ni liste blanche : le bucket acceptait un `.txt`,
    // et l'audit y a déposé `audit-secu.txt` sous une extension `.png`.
    const chemin = cheminPhoto(ctx().seed.atelierId, "projets", [crypto.randomUUID()], "faux.png");
    const { error } = await patron()
      .storage.from("photos")
      .upload(chemin, fichier("ceci est du texte", "text/plain"), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("refuse un logo trop lourd : le plafond du bucket est de 2 Mo", async () => {
    // Le plafond de `photos` (15 Mo) n'est pas éprouvé ici, volontairement : il coûterait un
    // téléversement de 15 Mo à chaque exécution de la suite pour vérifier la même mécanique.
    const trop = new Blob([new Uint8Array(2 * 1024 * 1024 + 1024)], { type: "image/png" });
    const chemin = cheminLogo(ctx().seed.atelierId, "gros.png");
    const { error } = await patron().storage.from("logos").upload(chemin, trop, { contentType: "image/png" });
    expect(error).not.toBeNull();
  }, 60_000);
});

// ───────────────────────────────────────────────────────────────────────────
// Faille n°3 — le bucket `logos` n'avait aucune policy DELETE
// ───────────────────────────────────────────────────────────────────────────

describe("le logo se change et se retire", () => {
  it("le responsable dépose un logo, puis le supprime — et il a bien disparu", async () => {
    const { seed } = ctx();
    const chemin = cheminLogo(seed.atelierId, "logo.png");
    const { error: errDepot } = await patron()
      .storage.from("logos")
      .upload(chemin, fichier("PNG", "image/png"), { contentType: "image/png" });
    expect(errDepot).toBeNull();
    aNettoyerLogos.push(chemin);

    await patron().storage.from("logos").remove([chemin]);
    const { data } = await patron().storage.from("logos").list(seed.atelierId);
    expect((data ?? []).some((f) => f.name === chemin.split("/")[1]), "le logo a bien été retiré").toBe(false);
  });

  it("l'opérateur ne dépose pas de logo : ce n'est pas lui qui décide de l'identité de l'atelier", async () => {
    const chemin = cheminLogo(ctx().seed.atelierId, "pirate.png");
    const { error } = await atelier.sb.storage.from("logos").upload(chemin, fichier("PNG", "image/png"), {
      contentType: "image/png",
    });
    expect(error).not.toBeNull();
    const { data } = await patron().storage.from("logos").list(ctx().seed.atelierId);
    expect((data ?? []).some((f) => f.name.includes("pirate")), "rien n'a été déposé").toBe(false);
  });

  it("refuse un sous-dossier dans le bucket public — c'est par là qu'on héberge n'importe quoi", async () => {
    const chemin = `${ctx().seed.atelierId}/n-importe-quoi/fichier.png`;
    const { error } = await patron().storage.from("logos").upload(chemin, fichier("PNG", "image/png"), {
      contentType: "image/png",
    });
    expect(error).not.toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Le contrat de chemin : une règle écrite à deux endroits finit par diverger
// ───────────────────────────────────────────────────────────────────────────

describe("le navigateur et la base disent la même chose", () => {
  it("chaque entité de pièce jointe range dans le dossier que la base attend", async () => {
    for (const entite of ENTITES_PIECE_JOINTE) {
      const { data, error } = await patron().rpc("dossier_piece_jointe", { p_entite: entite });
      expect(error).toBeNull();
      expect(data, `dossier de ${entite}`).toBe(DOSSIER_PAR_ENTITE[entite]);
    }
  });

  it("le tableau des droits de la base est celui que le produit croit appliquer", async () => {
    // Le tableau attendu, écrit à la main : c'est la seule façon qu'un test de règles ait une
    // valeur. Le recalculer avec la même formule que la base ne prouverait rien du tout.
    const attendu: [string, string | null, string, boolean, boolean][] = [
      ["documents", "clients", "atelier", false, false],
      ["documents", "clients", "bureau", false, true],
      ["documents", "clients", "owner", true, true],
      ["documents", "projets", "atelier", true, true],
      ["documents", "receptions", "atelier", true, true],
      ["documents", "comptable", "comptable", false, true],
      ["documents", "comptable", "comptable", true, false],
      ["documents", "inventé", "owner", false, false],
      ["photos", "projets", "atelier", true, true],
      ["photos", "clients", "owner", false, false],
      ["photos", null, "owner", true, false],
      ["logos", null, "owner", true, true],
      ["logos", null, "bureau", true, false],
      ["logos", null, "atelier", true, false],
      ["logos", "sous-dossier", "owner", true, false],
    ];
    for (const [bucket, famille, role, ecriture, autorise] of attendu) {
      const { data, error } = await patron().rpc("stockage_acces", {
        p_bucket: bucket,
        p_famille: famille,
        p_role: role,
        p_ecriture: ecriture,
      });
      expect(error).toBeNull();
      expect(data, `${bucket}/${famille ?? "(racine)"} · ${role} · ${ecriture ? "écriture" : "lecture"}`).toBe(autorise);
    }
  });

  it("refuse une ligne dont le chemin ne correspond pas à l'entité déclarée", async () => {
    // Sans cette contrainte, un compte `bureau` pourrait déclarer `entite = 'projet'` — lisible
    // par l'atelier — en pointant vers un objet rangé dans `clients/`.
    const { seed } = ctx();
    const cheminClient = cheminPieceJointe(seed.atelierId, "client", seed.clientSimpleId, "faux.pdf");
    const { error } = await patron().from("pieces_jointes").insert({
      atelier_id: seed.atelierId,
      entite: "projet",
      entite_id: seed.clientSimpleId,
      storage_path: cheminClient,
      nom: "faux.pdf",
      mime: "application/pdf",
      taille: 10,
    });
    expect(error, "la contrainte pieces_jointes_chemin_coherent doit refuser").not.toBeNull();
  });
});
