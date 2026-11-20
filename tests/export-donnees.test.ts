import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import {
  COLONNES_SECRETES,
  TABLES_EXPORT,
  TABLES_HORS_EXPORT,
  VUES_HORS_EXPORT,
  collecterDonnees,
  colonnes,
  construireZip,
  crc32,
  fichiersArchive,
  lisezMoi,
  nomArchive,
  versCsvTable,
  type TableCollectee,
} from "@/lib/export/donnees";

/**
 * Export total des données (lot 5) — l'engagement des CGU rendu exécutable.
 *
 * Trois choses à prouver, et les deux dernières sont celles qui comptent :
 *  1. l'archive est complète et réellement lisible (un ZIP mal formé est pire que pas de bouton) ;
 *  2. **le périmètre est établi par la base, pas par le code qui produit l'archive.** La version
 *     précédente de ce fichier comparait la sortie de l'export à `TABLES_EXPORT.length` : elle est
 *     restée verte pendant que dix tables sortaient du périmètre, dont l'IBAN de l'atelier et les
 *     deux prix d'achat au kilo, déplacés dans des tables satellites par le chantier « rôles ». Un
 *     test qui se compare à sa propre source ne teste rien. Le référentiel est désormais
 *     `tables_du_schema_public()`, c'est-à-dire le catalogue Postgres ;
 *  3. **on n'exporte que ce que son compte peut lire.** C'est une fonction qui lit toutes les
 *     tables d'un coup : si elle contournait les RLS, elle livrerait la base entière à qui clique
 *     sur le bouton. Elle est donc lancée depuis un visiteur anonyme (qui ne doit rien récupérer)
 *     et depuis un opérateur d'atelier (qui doit récupérer strictement moins que le responsable).
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

type Relation = { nom: string; genre: string; porte_atelier_id: boolean };

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let tables: TableCollectee[];
/** Inventaire réel du schéma, lu en base. Le référentiel de tout ce fichier. */
let enBase: Relation[] = [];

/** Compte opérateur créé ici, et son ménage. Adresse dédiée pour ne croiser aucun autre fichier. */
function adresseOperateur(): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+export-atelier@${domaine}`;
}

let operateur: SupabaseClient | undefined;
let operateurId = "";
let lotId = "";

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { data, error } = await sb.rpc("tables_du_schema_public");
  // Un référentiel vide rendrait toutes les assertions de couverture triviallement vraies : c'est
  // exactement le défaut qu'on corrige. On refuse net plutôt que de continuer à vide.
  if (error) throw new Error(`tables_du_schema_public() : ${error.message}`);
  enBase = (data ?? []) as Relation[];
  if (enBase.filter((r) => r.genre === "table").length < 40) {
    throw new Error(`référentiel suspect : ${enBase.length} relations lues — la RPC répond-elle vraiment ?`);
  }

  // Un lot de poudre et son prix d'achat : sans ligne à voir, « l'opérateur ne voit pas les prix
  // d'achat » serait vrai pour tout le monde et ne prouverait rien. Le prix par poudre, lui, est
  // déjà semé par `globalSetup`.
  const { data: l, error: errL } = await sb
    .from("poudre_lots")
    .insert({
      atelier_id: ctx.seed.atelierId, poudre_id: ctx.seed.poudreId, numero: "EXPORT-LOT-1",
      fournisseur: "TestPowder", quantite_kg: 5, restant_kg: 5, recu_le: "2026-08-01",
    })
    .select("id")
    .single();
  if (errL) throw new Error(`lot du fichier export : ${errL.message}`);
  lotId = (l as { id: string }).id;
  const { error: errLc } = await sb
    .from("poudre_lot_couts")
    .upsert({ lot_id: lotId, atelier_id: ctx.seed.atelierId, prix_kg: 18.4 });
  if (errLc) throw new Error(`poudre_lot_couts : ${errLc.message}`);

  tables = await collecterDonnees(sb);

  operateur = await rejoindreOperateur();
}, 120_000);

afterAll(async () => {
  // Un siège oublié ferait échouer `sieges.test.ts` et `droits-formules.test.ts` sans rapport.
  if (operateurId) await sb.from("users").delete().eq("id", operateurId);
  await sb.from("invitations").delete().eq("email", adresseOperateur());
  if (lotId) {
    await sb.from("poudre_lot_couts").delete().eq("lot_id", lotId);
    await sb.from("poudre_lots").delete().eq("id", lotId);
  }
});

/** Ouvre une vraie session d'opérateur d'atelier dans l'atelier jetable. */
async function rejoindreOperateur(): Promise<SupabaseClient> {
  const email = adresseOperateur();
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

  const auth = createClient(ctx.url, ctx.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!session) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);
  operateurId = session.user.id;

  const client = createClient(ctx.url, ctx.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: deja } = await client.from("users").select("atelier_id").eq("id", session.user.id).maybeSingle();
  if (deja) {
    if (deja.atelier_id !== ctx.seed.atelierId) {
      throw new Error(`${email} appartient déjà à un autre atelier — refus d'exécuter le fichier.`);
    }
  } else {
    const { data: inv, error: errInv } = await sb
      .from("invitations")
      .insert({ atelier_id: ctx.seed.atelierId, email, role: "atelier" })
      .select("token")
      .single();
    if (errInv) throw new Error(`invitation opérateur : ${errInv.message}`);
    const { error: errAccept } = await client.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    if (errAccept) throw new Error(`accept_invitation opérateur : ${errAccept.message}`);
  }
  return client;
}

// ── Le garde-fou : la base arbitre, pas la constante ──────────────────────────

describe("périmètre de l'export — arbitré par le schéma réel", () => {
  const exportees = () => new Set(TABLES_EXPORT.map((t) => t.nom));
  const ecartees = () => new Set(TABLES_HORS_EXPORT.map((t) => t.nom));

  it("chaque table de la base est soit exportée, soit écartée avec un motif écrit", () => {
    const oubliees = enBase
      .filter((r) => r.genre === "table")
      .map((r) => r.nom)
      .filter((n) => !exportees().has(n) && !ecartees().has(n));
    // Le message porte l'instruction : celui qui fait tomber ce test est celui qui vient d'ajouter
    // la table, et il doit trancher maintenant — pas six mois plus tard, dans la sauvegarde d'un
    // client qui part.
    expect(
      oubliees,
      `table(s) ni exportée(s) ni écartée(s) : ${oubliees.join(", ")}. ` +
        "Ajoutez-les à TABLES_EXPORT si ce sont des données de l'atelier, ou à TABLES_HORS_EXPORT " +
        "avec le motif de l'exclusion. Ne les laissez pas dans le silence.",
    ).toEqual([]);
  });

  it("aucune entrée fantôme : tout ce qui est listé existe encore en base", () => {
    // Le symétrique du test précédent. Une table renommée laisserait sinon une ligne morte dans
    // TABLES_EXPORT, un CSV vide dans l'archive, et une couverture qui semble intacte.
    const noms = new Set(enBase.map((r) => r.nom));
    const fantomes = [...exportees(), ...ecartees()].filter((n) => !noms.has(n));
    expect(fantomes, `listée(s) dans l'export mais absente(s) de la base : ${fantomes.join(", ")}`).toEqual([]);
  });

  it("une table ne peut pas être à la fois exportée et écartée", () => {
    const doubles = [...exportees()].filter((n) => ecartees().has(n));
    expect(doubles).toEqual([]);
  });

  it("chaque exclusion porte une justification lisible, pas un mot", () => {
    for (const t of [...TABLES_HORS_EXPORT, ...VUES_HORS_EXPORT]) {
      expect(t.motif.length, `${t.nom} : motif trop court pour être une décision`).toBeGreaterThan(40);
    }
  });

  it("les vues sont écartées une par une, y compris celles créées depuis", () => {
    // Une vue ordinaire se recalcule ; une vue *matérialisée* porterait de la donnée que rien
    // d'autre ne contient. Les énumérer force l'arbitrage au cas par cas.
    const vuesEnBase = enBase.filter((r) => r.genre !== "table").map((r) => r.nom);
    const connues = new Set(VUES_HORS_EXPORT.map((v) => v.nom));
    const nouvelles = vuesEnBase.filter((n) => !connues.has(n) && !exportees().has(n));
    expect(nouvelles, `vue(s) non arbitrée(s) : ${nouvelles.join(", ")}`).toEqual([]);
  });

  it("les quatre tables satellites du chantier « rôles » sont bien dans l'archive", () => {
    // Assertion nommée, en plus de la couverture générale : c'est la régression exacte qui a été
    // mesurée, et la nommer garde l'histoire lisible dans dix ans.
    for (const n of ["ateliers_bancaire", "ateliers_couts", "poudre_couts", "poudre_lot_couts"]) {
      expect(exportees().has(n), `${n} — l'IBAN et les prix d'achat au kilo doivent sortir`).toBe(true);
    }
    // Et leurs colonnes sensibles arrivent réellement dans l'archive, pas seulement leur nom.
    const banque = tables.find((t) => t.nom === "ateliers_bancaire")!;
    expect(banque.lignes).toHaveLength(1);
    expect(banque.lignes[0].iban).toBe("FR7630001007941234567890185");
    expect(banque.lignes[0].bic).toBe("BDFEFRPPXXX");
    const couts = tables.find((t) => t.nom === "ateliers_couts")!;
    expect(Number(couts.lignes[0].taux_horaire)).toBe(42);
    // Les lignes sont retrouvées par leur clé, jamais par leur rang : les autres fichiers de la
    // suite créent eux aussi des poudres et des lots, et un `lignes[0]` prendrait le prix d'un
    // voisin — un test qui passe ou casse selon l'ordre d'exécution ne prouve rien non plus.
    const prixPoudre = tables.find((t) => t.nom === "poudre_couts")!.lignes
      .find((l) => l.poudre_id === ctx.seed.poudreId);
    expect(Number(prixPoudre?.prix_kg)).toBe(15.9);
    const prixLot = tables.find((t) => t.nom === "poudre_lot_couts")!.lignes
      .find((l) => l.lot_id === lotId);
    expect(Number(prixLot?.prix_kg)).toBe(18.4);
  });

  it("les six tables nées aujourd'hui sont couvertes", () => {
    for (const n of [
      "pieces_jointes", "client_portail", "reglages_alertes",
      "recap_destinataires", "exports_comptables", "reglages_comptable",
    ]) {
      expect(exportees().has(n), `${n} manquante dans TABLES_EXPORT`).toBe(true);
    }
  });

  it("les mécanismes internes restent dehors", () => {
    for (const n of ["compteurs", "reglages_app", "leads", "analytics_events"]) {
      expect(ecartees().has(n), `${n} ne devrait pas être exportée`).toBe(true);
      expect(exportees().has(n)).toBe(false);
    }
  });

  it("aucune table n'échoue à la lecture", () => {
    const enErreur = tables.filter((t) => t.erreur);
    expect(enErreur.map((t) => `${t.nom} : ${t.erreur}`)).toEqual([]);
    // Le compte se fait contre la base, plus contre `TABLES_EXPORT.length` : c'est précisément la
    // tautologie qui a laissé passer la régression.
    const attendu = enBase.filter((r) => r.genre === "table").length - TABLES_HORS_EXPORT.length;
    expect(tables).toHaveLength(attendu);
  });

  it("rapatrie bien les données de l'atelier — et seulement les siennes", () => {
    const atelier = tables.find((t) => t.nom === "ateliers")!;
    expect(atelier.lignes).toHaveLength(1);
    expect(atelier.lignes[0].id).toBe(ctx.seed.atelierId);

    const clients = tables.find((t) => t.nom === "clients")!;
    expect(clients.lignes.length).toBeGreaterThanOrEqual(2);
    for (const t of tables) {
      for (const ligne of t.lignes) {
        if ("atelier_id" in ligne) {
          expect(ligne.atelier_id, `${t.nom} contient une ligne d'un autre atelier`).toBe(ctx.seed.atelierId);
        }
      }
    }
  });

  it("un visiteur anonyme n'exporte rien : les RLS s'appliquent à l'export comme au reste", async () => {
    const vol = await collecterDonnees(anon);
    const total = vol.reduce((s, t) => s + t.lignes.length, 0);
    expect(total, "l'export a livré des données à un client non authentifié").toBe(0);
  });
});

// ── Les jetons vivants ────────────────────────────────────────────────────────

describe("secrets retirés, données conservées", () => {
  it("aucun jeton d'accès encore valide ne sort dans l'archive", () => {
    for (const [table, cols] of Object.entries(COLONNES_SECRETES)) {
      const t = tables.find((x) => x.nom === table);
      expect(t, `${table} devrait être exportée`).toBeDefined();
      for (const ligne of t!.lignes) {
        for (const c of cols) {
          expect(c in ligne, `${table}.${c} — un jeton d'accès dans l'archive`).toBe(false);
        }
      }
    }
  });

  it("mais les lignes qui les portaient restent exportées", () => {
    // Retirer la clé, pas l'information : on doit toujours savoir qu'une invitation a été émise.
    const invitations = tables.find((t) => t.nom === "invitations")!;
    expect(invitations.erreur).toBeUndefined();
    for (const l of invitations.lignes) expect("email" in l).toBe(true);
  });

  it("les liens publics de documents, eux, sont conservés", () => {
    // Ils sont déjà entre les mains des clients et imprimés sur les papiers : les retirer
    // casserait le rapprochement entre l'archive et un QR collé sur une palette.
    const devis = tables.find((t) => t.nom === "devis")!;
    if (devis.lignes.length > 0) expect("public_token" in devis.lignes[0]).toBe(true);
  });

  it("la colonne de recherche calculée n'encombre aucun CSV", () => {
    for (const t of tables) {
      for (const l of t.lignes) expect("recherche" in l, `${t.nom}.recherche`).toBe(false);
    }
  });
});

// ── Les rôles ─────────────────────────────────────────────────────────────────

describe("l'export respecte les rôles — et le dit", () => {
  it("un opérateur d'atelier n'exporte ni IBAN, ni taux horaire, ni prix d'achat", async () => {
    const sien = await collecterDonnees(operateur!);
    // On vérifie l'état obtenu, jamais le code de retour : PostgREST rend `200` et zéro ligne
    // quand la RLS filtre, ce qui ressemble à un succès.
    for (const n of ["ateliers_bancaire", "ateliers_couts", "poudre_couts", "poudre_lot_couts"]) {
      const chezLui = sien.find((t) => t.nom === n)!;
      const chezLePatron = tables.find((t) => t.nom === n)!;
      expect(chezLePatron.lignes.length, `${n} : le responsable devrait en avoir`).toBeGreaterThan(0);
      expect(chezLui.lignes, `${n} : un opérateur ne doit pas l'exporter`).toEqual([]);
    }
    // Et il obtient bien quelque chose : la production reste son métier, l'archive n'est pas vide.
    expect(sien.find((t) => t.nom === "projets")).toBeDefined();
    expect(sien.reduce((s, t) => s + t.lignes.length, 0)).toBeLessThan(
      tables.reduce((s, t) => s + t.lignes.length, 0),
    );
  }, 120_000);

  it("le LISEZ-MOI annonce noir sur blanc qu'une archive d'opérateur est partielle", () => {
    const texte = lisezMoi(tables, "ThermoTest", new Date("2026-08-20T12:00:00Z"), "atelier");
    expect(texte).toContain("PARTIELLE");
    expect(texte).toContain("coordonnées bancaires");
    expect(texte).toContain("prix d'achat au kilo");
    expect(texte).toContain("compte responsable");
  });

  it("et qu'une archive de responsable est complète", () => {
    const texte = lisezMoi(tables, "ThermoTest", new Date("2026-08-20T12:00:00Z"), "owner");
    expect(texte).toContain("archive complète");
    expect(texte).not.toContain("PARTIELLE");
  });

  it("le JSON porte le rôle qui a produit l'archive", () => {
    const fichiers = fichiersArchive(tables, "ThermoTest", new Date(), "bureau");
    const objet = JSON.parse(fichiers.find((f) => f.nom === "donnees.json")!.contenu as string);
    expect(objet.role_exportateur).toBe("bureau");
  });
});

// ── Formats ───────────────────────────────────────────────────────────────────

describe("format des fichiers", () => {
  it("CSV : BOM, point-virgule, guillemets doublés, jsonb sérialisé", () => {
    const csv = versCsvTable([
      { id: "1", nom: 'Menuiserie "Sud" ; Sarl', items: [{ libelle: "Ligne", total_ht: 12.5 }], note: null },
      { id: "2", nom: "Ligne\navec retour", items: null, note: "ok" },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lignes = csv.split("\r\n");
    expect(lignes[0]).toBe('﻿"id";"nom";"items";"note"');
    expect(lignes[1]).toContain('"Menuiserie ""Sud"" ; Sarl"');
    expect(lignes[1]).toContain('"[{""libelle"":""Ligne"",""total_ht"":12.5}]"');
    // Une valeur nulle devient une cellule *vide et non guillemetée* — ce qui la distingue d'une
    // chaîne vide enregistrée, écrite `""`. Un tableur lit les deux comme vides, un import les
    // distingue.
    expect(lignes[1].endsWith(";")).toBe(true);
    expect(versCsvTable([{ a: null, b: "" }]).split("\r\n")[1]).toBe(';""');
  });

  it("CSV : une table vide ne produit pas d'en-tête inventé", () => {
    expect(versCsvTable([])).toBe("﻿");
    expect(colonnes([])).toEqual([]);
  });

  it("CSV : les colonnes apparues sur une ligne tardive ne sont pas perdues", () => {
    expect(colonnes([{ a: 1 }, { a: 2, b: 3 }])).toEqual(["a", "b"]);
    const csv = versCsvTable([{ a: 1 }, { a: 2, b: 3 }]);
    expect(csv.split("\r\n")[0]).toBe('﻿"a";"b"');
    expect(csv.split("\r\n")[1]).toBe('"1";');
  });

  it("le fichier JSON est relisible et contient chaque table", () => {
    const fichiers = fichiersArchive(tables, "ThermoTest");
    const json = fichiers.find((f) => f.nom === "donnees.json")!;
    const objet = JSON.parse(json.contenu as string);
    // La liste attendue vient de la base, pas de `TABLES_EXPORT` : sinon l'assertion redeviendrait
    // circulaire, exactement comme celle qu'on remplace.
    const attendues = enBase
      .filter((r) => r.genre === "table" && !TABLES_HORS_EXPORT.some((h) => h.nom === r.nom))
      .map((r) => r.nom)
      .sort();
    expect(Object.keys(objet.tables).sort()).toEqual(attendues);
    expect(objet.tables.ateliers[0].id).toBe(ctx.seed.atelierId);
    // Les colonnes jsonb sortent en objets, pas en chaînes : c'est tout l'intérêt de ce fichier.
    const devis = objet.tables.devis as { items?: unknown }[];
    if (devis.length > 0) expect(Array.isArray(devis[0].items)).toBe(true);
  });

  it("le LISEZ-MOI annonce le compte réel de lignes, table par table", () => {
    const texte = lisezMoi(tables, "ThermoTest", new Date("2026-08-18T12:00:00Z"));
    const total = tables.reduce((s, t) => s + t.lignes.length, 0);
    expect(texte).toContain(`${total} enregistrements`);
    for (const t of tables) expect(texte).toContain(t.nom);
    expect(texte).toContain("ThermoTest");
    // Les motifs d'exclusion sont recopiés dans l'archive : le client qui part lit lui aussi ce
    // qu'on a décidé de ne pas lui donner, et pourquoi.
    for (const h of TABLES_HORS_EXPORT) expect(texte).toContain(h.nom);
  });
});

describe("archive ZIP", () => {
  const octets = (u: Uint8Array, i: number, n: number) => [...u.slice(i, i + n)];

  it("porte les signatures attendues et déclare le bon nombre d'entrées", () => {
    const zip = construireZip([
      { nom: "LISEZ-MOI.txt", contenu: "bonjour" },
      { nom: "csv/clients.csv", contenu: '﻿"id"\r\n' },
    ]);
    // En-tête local « PK\x03\x04 » en tête de fichier.
    expect(octets(zip, 0, 4)).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // Fin de répertoire central « PK\x05\x06 » : 22 derniers octets, deux entrées annoncées.
    const fin = zip.length - 22;
    expect(octets(zip, fin, 4)).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const vue = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(vue.getUint16(fin + 8, true)).toBe(2);
    expect(vue.getUint16(fin + 10, true)).toBe(2);
    // Le répertoire central annoncé se trouve bien là où il est écrit.
    const debutCentral = vue.getUint32(fin + 16, true);
    expect(octets(zip, debutCentral, 4)).toEqual([0x50, 0x4b, 0x01, 0x02]);
  });

  it("le CRC et la taille inscrits correspondent au contenu réellement stocké", () => {
    const contenu = "Sauvegarde Thermogestion — accents compris : é à ü";
    const attendu = new TextEncoder().encode(contenu);
    const zip = construireZip([{ nom: "test.txt", contenu }]);
    const vue = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(vue.getUint32(14, true)).toBe(crc32(attendu));
    expect(vue.getUint32(18, true)).toBe(attendu.length);
    expect(vue.getUint32(22, true)).toBe(attendu.length);
    const nomLong = vue.getUint16(26, true);
    const debut = 30 + nomLong;
    expect([...zip.slice(debut, debut + attendu.length)]).toEqual([...attendu]);
  });

  it("CRC32 : vecteur de référence", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("l'archive complète contient le LISEZ-MOI, le JSON et un CSV par table", () => {
    const fichiers = fichiersArchive(tables, "ThermoTest");
    expect(fichiers[0].nom).toBe("LISEZ-MOI.txt");
    expect(fichiers.some((f) => f.nom === "donnees.json")).toBe(true);
    for (const t of TABLES_EXPORT) {
      expect(fichiers.some((f) => f.nom === `csv/${t.nom}.csv`), `csv/${t.nom}.csv manquant`).toBe(true);
    }
    const zip = construireZip(fichiers);
    expect(zip.length).toBeGreaterThan(1000);
    // Les noms de fichiers sont écrits en clair dans l'archive (entrées stockées, non compressées).
    const brut = new TextDecoder("utf-8", { fatal: false }).decode(zip);
    expect(brut).toContain("csv/factures.csv");
    expect(brut).toContain("csv/ateliers_bancaire.csv");
    expect(brut).toContain("LISEZ-MOI.txt");
  });

  it("le nom de l'archive est daté et sans caractère problématique", () => {
    expect(nomArchive("Thermolaquage de l'Étang & Fils", new Date("2026-08-18T09:00:00Z")))
      .toBe("thermogestion-thermolaquage-de-l-etang-fils-2026-08-18.zip");
    expect(nomArchive("", new Date("2026-01-02T09:00:00Z"))).toBe("thermogestion-atelier-2026-01-02.zip");
  });
});
