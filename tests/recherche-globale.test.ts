import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { FAMILLES, SCORE, aplatir, chemin, grouper, motifLike, normaliser, type ResultatRecherche } from "@/lib/recherche";
import { COLONNES_TECHNIQUES, colonnes } from "@/lib/export/donnees";

/**
 * Recherche globale (chantier C1).
 *
 * Trois choses à prouver, et la troisième est la seule qui compte vraiment :
 *  1. on retrouve un client et un document par tout ce qu'un client dicte au téléphone — nom,
 *     ville, téléphone, SIREN, immatriculation, numéro de pièce — accents ignorés dans les deux
 *     sens ;
 *  2. la normalisation du navigateur et celle de la base rendent la **même** chaîne : si elles
 *     divergent, une fiche saisie avec accent devient introuvable et rien ne le signale ;
 *  3. la RPC est soumise aux RLS. Elle interroge dix tables d'un coup : si elle les contournait,
 *     elle livrerait la base entière à qui tape deux lettres. Elle est donc attaquée depuis un
 *     visiteur anonyme, et chaque résultat rendu à un compte connecté est confronté à ce que la
 *     RLS ordinaire l'autorise à relire.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;

/** Client accentué créé pour ce fichier : le seed n'en contient aucun. */
const NOM_ACCENTUE = "Ferronnerie Gonçalves & Frères";
const VILLE_ACCENTUEE = "Saint-Étienne";
const TELEPHONE = "06 12 34 56 78";
const SIREN = "912345678";
/** Plaque propre à ce fichier : `tests/jantes-dossier.test.ts` occupe déjà AB-123-CD, et une
 *  immatriculation est unique par atelier. */
const IMMAT = "ZW-907-QK";
let clientId: string;
let vehiculeId: string;
let devisNumero: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { data: cli, error: e1 } = await sb.from("clients").insert({
    atelier_id: ctx.seed.atelierId, type: "pro", nom: NOM_ACCENTUE, contact: "Amélie Œhler",
    ville: VILLE_ACCENTUEE, code_postal: "42000", telephone: TELEPHONE, siren: SIREN,
    email: null,
  }).select("id").single();
  if (e1) throw new Error(`création du client accentué : ${e1.message}`);
  clientId = (cli as { id: string }).id;

  const { data: veh, error: e2 } = await sb.from("vehicules").insert({
    atelier_id: ctx.seed.atelierId, client_id: clientId, marque: "Volkswagen", modele: "Golf",
    immatriculation: IMMAT,
  }).select("id").single();
  if (e2) throw new Error(`création du véhicule : ${e2.message}`);
  vehiculeId = (veh as { id: string }).id;

  const { data: numero, error: e3 } = await sb.rpc("next_numero", { p_type: "devis" });
  if (e3) throw new Error(`numérotation : ${e3.message}`);
  devisNumero = numero as string;
  const { error: e4 } = await sb.from("devis").insert({
    atelier_id: ctx.seed.atelierId, client_id: clientId, numero: devisNumero, status: "envoye",
    items: [], total_ht: 100, total_tva: 20, total_ttc: 120,
  });
  if (e4) throw new Error(`création du devis : ${e4.message}`);
});

afterAll(async () => {
  // L'atelier jetable est supprimé par le `globalSetup`, mais on ne laisse pas traîner de lignes
  // qui fausseraient les comptes des autres fichiers de la suite.
  await sb.from("devis").delete().eq("numero", devisNumero);
  await sb.from("vehicules").delete().eq("id", vehiculeId);
  await sb.from("clients").delete().eq("id", clientId);
});

async function chercher(q: string, limite = 5): Promise<ResultatRecherche[]> {
  const { data, error } = await sb.rpc("recherche_globale", { q, limite });
  if (error) throw new Error(`recherche_globale('${q}') : ${error.message}`);
  return (data as ResultatRecherche[]) ?? [];
}

describe("normalisation partagée entre le navigateur et la base", () => {
  const ECHANTILLONS = [
    "Gonçalves", "GONÇALVES", "goncalves", "Saint-Étienne", "Œuvre d'Ært", "Straße",
    "Ångström", "Nguyên", "Müller", "Øystein", "DEVIS-2026-0338", "AB-123-CD", "  ",
  ];

  it.each(ECHANTILLONS)("txt_normalise() et normaliser() rendent la même chaîne pour « %s »", async (echantillon) => {
    const { data, error } = await sb.rpc("txt_normalise", { t: echantillon });
    expect(error, `txt_normalise a échoué : ${error?.message}`).toBeNull();
    expect(data).toBe(normaliser(echantillon));
  });

  it("le motif LIKE échappe les jokers : un pourcentage tapé ne ramène pas tout", () => {
    expect(motifLike("100%")).toBe("%100\\%%");
    expect(motifLike("a_b")).toBe("%a\\_b%");
    expect(motifLike("Élodie")).toBe("%elodie%");
  });
});

describe("ce que l'atelier tape réellement", () => {
  it("retrouve le client par son nom accentué, tapé sans accent", async () => {
    const r = await chercher("goncalves");
    expect(r.some((x) => x.type === "client" && x.id === clientId)).toBe(true);
  });

  it("retrouve le même client par son nom tapé avec accent", async () => {
    const r = await chercher("Gonçalves");
    expect(r.some((x) => x.type === "client" && x.id === clientId)).toBe(true);
  });

  it("retrouve le client par sa ville, accent ignoré dans l'autre sens", async () => {
    const r = await chercher("saint-etienne");
    expect(r.some((x) => x.type === "client" && x.id === clientId)).toBe(true);
  });

  it("retrouve le client par son téléphone dicté sans espaces", async () => {
    const r = await chercher("0612345678");
    expect(r.some((x) => x.type === "client" && x.id === clientId)).toBe(true);
  });

  it("retrouve le client par son SIREN", async () => {
    const r = await chercher(SIREN);
    expect(r.some((x) => x.type === "client" && x.id === clientId)).toBe(true);
  });

  it("retrouve le devis par son numéro — le cas de départ de l'audit", async () => {
    const r = await chercher(devisNumero);
    const devis = r.find((x) => x.type === "devis");
    expect(devis, `aucun devis pour « ${devisNumero} »`).toBeDefined();
    expect(devis!.titre).toBe(devisNumero);
    expect(Number(devis!.montant)).toBeCloseTo(120, 2);
  });

  it("retrouve le devis par le nom du client, qui n'est pourtant pas dans la table devis", async () => {
    const r = await chercher("goncalves");
    expect(r.some((x) => x.type === "devis" && x.titre === devisNumero)).toBe(true);
  });

  it("retrouve le jeu de jantes par l'immatriculation, avec ou sans tirets", async () => {
    const { data: jeu, error } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, vehicule_id: vehiculeId,
      numero: await sb.rpc("next_numero", { p_type: "jantes" }).then(({ data }) => data as string),
      nb_jantes: 4, diametre_pouces: 18, finition: "mat", statut: "recu",
    }).select("id").single();
    if (error) throw new Error(`création du jeu : ${error.message}`);
    const jeuId = (jeu as { id: string }).id;
    try {
      // Les trois façons dont une plaque arrive : dictée avec tirets, retapée d'un bloc, ou
      // saisie avec des espaces. La base, elle, la range toujours sans séparateur.
      for (const saisie of [IMMAT, "zw907qk", "ZW 907 QK"]) {
        const r = await chercher(saisie);
        expect(r.some((x) => x.type === "jantes" && x.id === jeuId), `« ${saisie} » ne retrouve pas le jeu`).toBe(true);
      }
    } finally {
      await sb.from("jeux_jantes").delete().eq("id", jeuId);
    }
  });

  /**
   * Le défaut du 20/08/2026, rejoué.
   *
   * Taper une immatriculation rendait sept lignes fausses AVANT la bonne : deux clients, deux
   * devis, une facture, deux projets, puis le jeu de jantes. Ce n'était pas un seuil de
   * similarité — il n'y a aucun `similarity()` dans la RPC, et les index `gin_trgm_ops` ne font
   * qu'accélérer un `like` sans jamais l'élargir. C'était le repli « chiffres seuls », prévu
   * pour le téléphone dicté, qui s'appliquait aussi à une saisie alphanumérique : de `ab123cd`
   * il tirait le motif `123`, qui répond dans un SIRET, un code postal ou un téléphone sur deux.
   *
   * La règle tient en une phrase : le repli chiffres ne vaut que pour une saisie SANS LETTRE.
   */
  it("une immatriculation ne rend QUE le jeu de jantes, pas les fiches au SIRET voisin", async () => {
    // Un client dont le SIRET contient les chiffres de la plaque : c'est exactement la
    // configuration qui produisait le bruit en production.
    const CHIFFRES = "907";
    const { data: parasite, error: eP } = await sb.from("clients").insert({
      atelier_id: ctx.seed.atelierId, type: "pro", nom: "Parasite Chiffres SARL",
      siret: `123${CHIFFRES}45600017`, telephone: `04 ${CHIFFRES} 11 22 33`,
    }).select("id").single();
    if (eP) throw new Error(`création du client parasite : ${eP.message}`);
    const parasiteId = (parasite as { id: string }).id;

    const { data: jeu, error: eJ } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, vehicule_id: vehiculeId,
      numero: await sb.rpc("next_numero", { p_type: "jantes" }).then(({ data }) => data as string),
      nb_jantes: 4, diametre_pouces: 18, finition: "mat", statut: "recu",
    }).select("id").single();
    if (eJ) throw new Error(`création du jeu : ${eJ.message}`);
    const jeuId = (jeu as { id: string }).id;

    try {
      // Le client parasite répond bien quand on tape SES chiffres — le repli n'est pas
      // supprimé, il est restreint.
      const surChiffres = await chercher(CHIFFRES, 25);
      expect(surChiffres.some((x) => x.type === "client" && x.id === parasiteId)).toBe(true);

      // Mais plus quand on tape la plaque, qui contient pourtant les mêmes chiffres.
      for (const saisie of ["zw907qk", "ZW-907-QK", "ZW 907 QK"]) {
        const r = await chercher(saisie, 25);
        expect(r.map((x) => `${x.type}:${x.id}`), `« ${saisie} » ne doit rendre qu'une ligne`)
          .toEqual([`jantes:${jeuId}`]);
      }
    } finally {
      await sb.from("jeux_jantes").delete().eq("id", jeuId);
      await sb.from("clients").delete().eq("id", parasiteId);
    }
  });

  it("le téléphone dicté avec des séparateurs continue de retrouver sa fiche", async () => {
    // Le garde-fou du garde-fou : en restreignant le repli chiffres, on aurait pu casser
    // l'usage pour lequel il existe.
    for (const saisie of [TELEPHONE, "0612345678", "06.12.34.56.78"]) {
      const r = await chercher(saisie, 25);
      expect(r.some((x) => x.type === "client" && x.id === clientId), `« ${saisie} »`).toBe(true);
    }
  });

  it("un joker tapé dans le champ ne ramène pas l'atelier entier", async () => {
    // `%` et `_` n'étaient pas échappés côté base — ils l'étaient déjà côté navigateur. Un
    // opérateur qui tapait « 100% » déclenchait un balayage complet et récupérait tout.
    for (const joker of ["%", "%%", "a%", "_a", "%_"]) {
      expect(await chercher(joker, 25), `« ${joker} » a rendu des lignes`).toEqual([]);
    }
  });

  it("classe par pertinence : la correspondance exacte d'abord, le ricochet en dernier", async () => {
    // Le devis n'a répondu à AUCUN texte : il n'est là que parce que son client a répondu.
    // C'est ce que dit un score de 0, et c'est ce qui distingue les sept lignes parasites de
    // l'audit de la ligne cherchée.
    const r = await chercher("goncalves", 25);
    const client = r.find((x) => x.type === "client" && x.id === clientId);
    const devis = r.find((x) => x.type === "devis" && x.titre === devisNumero);
    expect(client?.score).toBe(SCORE.EXACT);
    expect(devis?.score).toBe(SCORE.RICOCHET);

    // Et le regroupement affiché suit la meilleure ligne de chaque famille.
    expect(grouper(r)[0].type).toBe("client");
  });

  it("ne charge rien en dessous de deux caractères", async () => {
    expect(await chercher("g")).toEqual([]);
    expect(await chercher("")).toEqual([]);
    expect(await chercher(" ")).toEqual([]);
  });

  it("rend des résultats typés : les six champs du contrat, et un type connu", async () => {
    const r = await chercher("goncalves");
    expect(r.length).toBeGreaterThan(0);
    const types = new Set(FAMILLES.map((f) => f.type));
    for (const x of r) {
      expect(types.has(x.type), `type inattendu : ${x.type}`).toBe(true);
      expect(x.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof x.titre).toBe("string");
      expect(x.titre.length).toBeGreaterThan(0);
      expect(["string", "object"]).toContain(typeof x.sous_titre);
      expect(chemin(x)).toMatch(/^\/[a-z/]+\/[0-9a-f-]{36}$/);
    }
  });

  it("respecte la limite demandée, famille par famille", async () => {
    const r = await chercher("testard", 1);
    for (const famille of FAMILLES) {
      expect(r.filter((x) => x.type === famille.type).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("la recherche est soumise à la RLS", () => {
  it("un visiteur anonyme ne récupère rien, quel que soit le motif", async () => {
    for (const q of ["goncalves", "Gonçalves", devisNumero, SIREN, "0612345678", "testard", "te"]) {
      const { data, error } = await anon.rpc("recherche_globale", { q, limite: 25 });
      // Deux issues acceptables : un refus net, ou une réponse vide. Une seule est inacceptable :
      // des lignes.
      expect(data ?? [], `anon a récupéré des lignes pour « ${q} » : ${JSON.stringify(data)}`).toHaveLength(0);
      if (error) expect(error.code === "42501" || /permission denied/i.test(error.message)).toBe(true);
    }
  });

  /**
   * Attaque de fond : la RPC ne doit jamais rendre une ligne que la RLS ordinaire refuserait de
   * relire. Si l'une de ses dix requêtes oubliait le cloisonnement, elle ramènerait des
   * identifiants d'autres ateliers — et la relecture par un `select` classique, elle protégée,
   * rendrait zéro ligne. C'est ce décalage que ce test cherche.
   */
  it("chaque identifiant rendu reste lisible par une lecture ordinaire du même compte", async () => {
    const TABLES: Record<string, string> = {
      client: "clients", devis: "devis", facture: "factures", projet: "projets",
      bl: "bons_livraison", reception: "receptions", jantes: "jeux_jantes",
      poudre: "poudres", lot: "poudre_lots",
    };
    const resultats = [
      ...(await chercher("te", 25)),
      ...(await chercher("goncalves", 25)),
      ...(await chercher("testard", 25)),
    ];
    expect(resultats.length, "aucun résultat : le test ne prouverait rien").toBeGreaterThan(0);

    for (const r of resultats) {
      const { data, error } = await sb.from(TABLES[r.type]).select("id, atelier_id").eq("id", r.id).maybeSingle();
      expect(error, `relecture de ${r.type} ${r.id} : ${error?.message}`).toBeNull();
      expect(data, `${r.type} ${r.id} est rendu par la recherche mais invisible en lecture ordinaire`).not.toBeNull();
      expect((data as { atelier_id: string }).atelier_id).toBe(ctx.seed.atelierId);
    }
  });

  it("la colonne technique `recherche` n'est jamais exposée en lecture par les écrans", async () => {
    // Elle existe et sert la recherche, mais elle n'a rien à faire dans l'archive que le client
    // télécharge : c'est une redondance interne, illisible et parasite.
    const { data } = await sb.from("clients").select("*").eq("id", clientId).single();
    expect(Object.keys(data as Record<string, unknown>)).toContain("recherche");
    expect(colonnes([data as Record<string, unknown>])).not.toContain("recherche");
    expect(COLONNES_TECHNIQUES.has("recherche")).toBe(true);
  });
});

describe("regroupement et navigation au clavier", () => {
  it("groupe par famille, écarte les familles vides et conserve l'ordre métier", () => {
    const faux: ResultatRecherche[] = [
      { type: "lot", id: "1", titre: "Lot A", sous_titre: null, date: null, montant: null },
      { type: "client", id: "2", titre: "Client", sous_titre: null, date: null, montant: null },
      { type: "devis", id: "3", titre: "D1", sous_titre: null, date: null, montant: 12 },
    ];
    const groupes = grouper(faux);
    expect(groupes.map((g) => g.type)).toEqual(["client", "devis", "lot"]);
    // La liste à plat est l'ordre exact que parcourent les flèches : elle doit suivre l'affichage.
    expect(aplatir(faux).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("chaque famille mène à un écran existant", () => {
    expect(FAMILLES.map((f) => f.chemin("abc"))).toEqual([
      "/clients/abc", "/devis/abc", "/factures/abc", "/projets/abc", "/jantes/abc",
      "/receptions/abc", "/bl/fiche/abc", "/stock/abc", "/lots/abc",
    ]);
  });
});
