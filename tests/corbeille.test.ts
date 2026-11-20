import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { CORBEILLE, ENTITES_CORBEILLE, JOURS_CORBEILLE, joursAvantPurge } from "@/lib/corbeille";

/**
 * La corbeille, prouvée dans PostgREST.
 *
 * Deux règles de méthode, les mêmes que pour les rôles :
 *
 *  1. **On vérifie l'état après coup, jamais le code de retour.** Sans policy d'UPDATE, PostgREST
 *     répond 204 en ayant modifié zéro ligne. Un test qui se contente de `expect(error).toBeNull()`
 *     valide un verrou inexistant.
 *  2. **On ne touche jamais un atelier réel.** Tout se passe dans le `TEST-AUTO-…` créé par
 *     `globalSetup`, et ce fichier remet en état tout ce qu'il crée.
 */

const ctx = () => contexte();
const sb = () => clientConnecte();

/** Les identifiants créés ici, à effacer en fin de fichier. */
let devisBrouillonId = "";
let devisFactureId = "";
let factureEmiseId = "";
let projetId = "";
let blLivreId = "";
let blFactureId = "";
let factureDuBlId = "";
let clientVierge = "";
let receptionId = "";

async function creer(table: string, ligne: Record<string, unknown>): Promise<string> {
  const { data, error } = await sb().from(table).insert(ligne).select("id").single();
  if (error) throw new Error(`${table} : ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Met à la corbeille et rend le message d'erreur éventuel — c'est lui qui porte le motif du refus.
 *
 * Par la RPC, et jamais par un `update deleted_at` : PostgREST ajoute toujours un `RETURNING`, et
 * PostgreSQL applique alors la clause `using` de la politique à la ligne telle qu'elle sort de
 * l'écriture. Cette clause porte `deleted_at is null` — c'est tout l'intérêt du dispositif — donc
 * l'écriture directe est refusée par construction. Le test qui suit le prouve.
 */
async function jeter(entite: string, id: string): Promise<string> {
  const { error } = await sb().rpc("mettre_a_la_corbeille", { p_entite: entite, p_id: id });
  return error?.message ?? "";
}

/** Relit `deleted_at` sans passer par la policy : la ligne jetée y est invisible. */
async function estDansLaCorbeille(entite: string, id: string): Promise<boolean> {
  const { data } = await sb().rpc("corbeille");
  return ((data as { entite: string; id: string }[]) ?? []).some((l) => l.entite === entite && l.id === id);
}

/**
 * Ligne de document cohérente avec les totaux annoncés.
 *
 * POURQUOI depuis l'audit du 21/08 : ce fichier posait `items: []` avec un total de 240 €. C'était
 * sans conséquence tant que le ménage effaçait tout — or une facture émise et un devis signé
 * facturé ne s'effacent plus, et c'est justement le correctif. Ils survivent donc à ce fichier, et
 * `regression-remise-facture.test.ts` vérifie l'invariant « totaux = calcTotaux(lignes, remise) »
 * sur **tous** les devis et factures de l'atelier. Un décor incohérent le faisait tomber, sur une
 * facture qui n'avait rien à voir avec lui.
 */
function ligne(ht: number) {
  return [{ type: "libre", libelle: "Thermolaquage", qte: 1, unite: "piece", pu_ht: ht, tva: 20, total_ht: ht }];
}

beforeAll(async () => {
  const { atelierId, clientSimpleId } = ctx().seed;

  devisBrouillonId = await creer("devis", {
    atelier_id: atelierId, client_id: clientSimpleId, status: "brouillon",
    items: ligne(100), total_ht: 100, total_tva: 20, total_ttc: 120,
  });

  // Un devis déjà facturé : il ne doit pas pouvoir partir, sinon la trace de ce qui a été vendu
  // disparaît de l'écran alors que la facture, elle, reste.
  devisFactureId = await creer("devis", {
    atelier_id: atelierId, client_id: clientSimpleId, status: "signe",
    items: ligne(200), total_ht: 200, total_tva: 40, total_ttc: 240,
  });
  projetId = await creer("projets", {
    atelier_id: atelierId, client_id: clientSimpleId, nom: "Projet corbeille", status: "en_cours",
    etapes: [], devis_id: devisFactureId,
  });
  factureEmiseId = await creer("factures", {
    atelier_id: atelierId, client_id: clientSimpleId, devis_id: devisFactureId, projet_id: projetId,
    type: "solde", status: "brouillon", items: ligne(200), total_ht: 200, total_tva: 40, total_ttc: 240,
  });
  // On l'émet par une seconde écriture : `trg_facture_emise` pose le numéro et `emise_at`.
  const { error: errEmission } = await sb().from("factures").update({ status: "emise" }).eq("id", factureEmiseId);
  if (errEmission) throw new Error(`émission de la facture : ${errEmission.message}`);

  blLivreId = await creer("bons_livraison", {
    atelier_id: atelierId, client_id: clientSimpleId, status: "livre", lignes: [],
    livre_at: new Date().toISOString(),
  });

  // Un bon consommé par une facture, via le trigger `facture_consomme_bl` : le bon est rattaché
  // au projet, la facture aussi, et c'est la facture qui le prend.
  const projetDuBl = await creer("projets", {
    atelier_id: atelierId, client_id: clientSimpleId, nom: "Projet BL facturé", status: "en_cours", etapes: [],
  });
  blFactureId = await creer("bons_livraison", {
    atelier_id: atelierId, client_id: clientSimpleId, projet_id: projetDuBl, status: "livre", lignes: [],
    livre_at: new Date().toISOString(),
  });
  factureDuBlId = await creer("factures", {
    atelier_id: atelierId, client_id: clientSimpleId, projet_id: projetDuBl,
    type: "solde", status: "brouillon", items: ligne(100), total_ht: 100, total_tva: 20, total_ttc: 120,
  });

  clientVierge = await creer("clients", {
    atelier_id: atelierId, type: "particulier", nom: "Corbeille Client Vierge",
  });
  receptionId = await creer("receptions", {
    atelier_id: atelierId, client_id: clientSimpleId, nb_pieces: 2, etat_constate: "bon",
  });
}, 120_000);

afterAll(async () => {
  // Une ligne en corbeille est invisible, donc non supprimable : on la restaure d'abord. Sans ça,
  // le nettoyage échouerait en silence et laisserait des lignes derrière lui.
  for (const [entite, id] of [
    ["devis", devisBrouillonId], ["projet", projetId], ["reception", receptionId],
    ["bl", blLivreId], ["client", clientVierge],
  ] as const) {
    if (id) await sb().rpc("restaurer_de_la_corbeille", { p_entite: entite, p_id: id });
  }
  // La facture d'abord : elle libère les bons de livraison qu'elle porte (trigger BEFORE DELETE).
  //
  // Trois lignes de ce fichier ne partiront pas, et c'est le correctif du 21/08 qui parle :
  // `factureEmiseId` est émise, `devisFactureId` est signé ET facturé, `projetId` est facturé.
  // Le `DELETE` direct les emportait ; il est maintenant refusé, exactement comme la corbeille les
  // refusait déjà. Elles restent donc dans l'atelier jetable jusqu'à sa destruction — c'est le
  // prix de la règle, et il est correct. Leurs décors sont cohérents pour cette raison
  // (voir `ligne()` plus haut) : ce qui survit à un fichier de tests doit être présentable aux
  // fichiers suivants.
  for (const id of [factureEmiseId, factureDuBlId]) if (id) await sb().from("factures").delete().eq("id", id);
  for (const id of [blLivreId, blFactureId]) if (id) await sb().from("bons_livraison").delete().eq("id", id);
  if (receptionId) await sb().from("receptions").delete().eq("id", receptionId);
  await sb().from("projets").delete().eq("nom", "Projet corbeille");
  await sb().from("projets").delete().eq("nom", "Projet BL facturé");
  for (const id of [devisBrouillonId, devisFactureId]) if (id) await sb().from("devis").delete().eq("id", id);
  if (clientVierge) await sb().from("clients").delete().eq("id", clientVierge);
});

// ── Le vocabulaire ────────────────────────────────────────────────────────────

describe("Le barème du code est celui de la base", () => {
  it("les six entités du code sont celles que la RPC sait restaurer", async () => {
    expect([...ENTITES_CORBEILLE].sort()).toEqual(["bl", "client", "devis", "facture", "projet", "reception"]);
    // Un type inconnu doit être refusé net : une faute de frappe côté écran ne doit pas se
    // traduire par « rien ne s'est passé ».
    const { error } = await sb().rpc("restaurer_de_la_corbeille", {
      p_entite: "poudre", p_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.message ?? "").toContain("CORBEILLE_ENTITE_INCONNUE");
  });

  it("le délai de purge du code est celui de la base", async () => {
    const { data } = await sb().rpc("jours_corbeille");
    expect(Number(data)).toBe(JOURS_CORBEILLE);
  });

  it("le compte à rebours ne descend jamais sous zéro et n'exagère pas", () => {
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    expect(joursAvantPurge(hier)).toBe(0);
    const dans10 = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect(joursAvantPurge(dans10)).toBe(10);
    // Une pièce jetée à l'instant annonce 30 jours, pas 31 : sinon l'écran contredit la phrase
    // qui promet trente jours juste au-dessus.
    const pleinDelai = new Date(Date.now() + JOURS_CORBEILLE * 86_400_000 + 500).toISOString();
    expect(joursAvantPurge(pleinDelai)).toBe(JOURS_CORBEILLE);
  });

  it("chaque entité connaît sa table PostgREST", () => {
    expect(CORBEILLE.bl.table).toBe("bons_livraison");
    expect(CORBEILLE.facture.table).toBe("factures");
  });
});

// ── Le cycle complet ──────────────────────────────────────────────────────────

describe("Un devis en brouillon part, se retrouve, et revient", () => {
  it("il quitte la liste — vérifié en relisant la liste, pas le code de retour", async () => {
    const { data: avant } = await sb().from("devis").select("id").eq("id", devisBrouillonId);
    expect(avant ?? [], "le devis doit exister avant d'être jeté").toHaveLength(1);

    expect(await jeter("devis", devisBrouillonId)).toBe("");

    const { data: apres } = await sb().from("devis").select("id").eq("id", devisBrouillonId);
    expect(apres ?? [], "un devis en corbeille reste visible dans la liste").toHaveLength(0);
  });

  it("un `update deleted_at` direct, lui, ne passe pas — et c'est voulu", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const temoin = await creer("devis", {
      atelier_id: atelierId, client_id: clientSimpleId, status: "brouillon", items: [],
    });
    try {
      const { error } = await sb().from("devis")
        .update({ deleted_at: new Date().toISOString() }).eq("id", temoin);
      // PostgREST ajoute un `RETURNING` à toute écriture ; PostgreSQL applique alors la clause
      // `using` de la politique à la ligne telle qu'elle sort, et `deleted_at is null` n'y est
      // plus vrai. Le refus est la contrepartie exacte de l'invisibilité recherchée.
      expect(error, "un update direct a réussi à poser deleted_at").not.toBeNull();
      const { data } = await sb().from("devis").select("id").eq("id", temoin);
      expect(data ?? [], "le devis témoin a disparu de la liste").toHaveLength(1);
    } finally {
      await sb().from("devis").delete().eq("id", temoin);
    }
  });

  it("il est dans la corbeille, avec sa date de purge", async () => {
    const { data } = await sb().rpc("corbeille");
    const ligne = ((data as { entite: string; id: string; purge_le: string; supprime_le: string }[]) ?? [])
      .find((l) => l.id === devisBrouillonId);
    expect(ligne, "le devis jeté doit apparaître dans la corbeille").toBeTruthy();
    const jours = joursAvantPurge(ligne!.purge_le);
    expect(jours).toBeGreaterThan(JOURS_CORBEILLE - 2);
    expect(jours).toBeLessThanOrEqual(JOURS_CORBEILLE);
  });

  it("il ne se dé-supprime pas par un simple `update` : la ligne n'est plus visible", async () => {
    await sb().from("devis").update({ deleted_at: null }).eq("id", devisBrouillonId);
    expect(await estDansLaCorbeille("devis", devisBrouillonId), "un update a fait sortir la ligne de la corbeille").toBe(true);
  });

  it("la RPC de restauration, elle, le remet dans la liste", async () => {
    const { error } = await sb().rpc("restaurer_de_la_corbeille", { p_entite: "devis", p_id: devisBrouillonId });
    expect(error).toBeNull();
    const { data } = await sb().from("devis").select("id").eq("id", devisBrouillonId);
    expect(data ?? [], "le devis restauré doit être revenu").toHaveLength(1);
  });

  it("restaurer deux fois refuse plutôt que de faire semblant", async () => {
    const { error } = await sb().rpc("restaurer_de_la_corbeille", { p_entite: "devis", p_id: devisBrouillonId });
    expect(error?.message ?? "").toContain("RESTAURATION_IMPOSSIBLE");
  });
});

// ── Ce qu'on refuse de jeter ──────────────────────────────────────────────────

describe("On ne met pas à la corbeille ce qui soutient un document comptable émis", () => {
  it("une facture émise est refusée, et le message dit quoi faire à la place", async () => {
    const message = await jeter("facture", factureEmiseId);
    expect(message).toContain("DOCUMENT_EMIS_NON_SUPPRIMABLE");

    const { data } = await sb().from("factures").select("id, status").eq("id", factureEmiseId);
    expect(data ?? [], "une facture émise a été mise à la corbeille").toHaveLength(1);
    expect(await estDansLaCorbeille("facture", factureEmiseId)).toBe(false);
  });

  it("le devis que cette facture porte est refusé lui aussi", async () => {
    expect(await jeter("devis", devisFactureId)).toContain("RATTACHE_A_FACTURE_EMISE");
    const { data } = await sb().from("devis").select("id").eq("id", devisFactureId);
    expect(data ?? []).toHaveLength(1);
  });

  it("et le projet facturé également", async () => {
    expect(await jeter("projet", projetId)).toContain("RATTACHE_A_FACTURE_EMISE");
    const { data } = await sb().from("projets").select("id").eq("id", projetId);
    expect(data ?? []).toHaveLength(1);
  });

  it("un bon de livraison porté par une facture est refusé — c'est le verrou anti-double facturation", async () => {
    const { data: bl } = await sb().from("bons_livraison").select("facture_id, status").eq("id", blFactureId).single();
    expect(bl?.facture_id, "le bon doit avoir été consommé par la facture").toBe(factureDuBlId);

    expect(await jeter("bl", blFactureId)).toContain("BL_PORTE_PAR_FACTURE");
    const { data } = await sb().from("bons_livraison").select("id").eq("id", blFactureId);
    expect(data ?? []).toHaveLength(1);
  });

  it("un client qui porte encore des pièces est refusé : on l'archive, on ne le jette pas", async () => {
    const message = await jeter("client", ctx().seed.clientSimpleId);
    expect(message).toContain("CLIENT_ENCORE_ACTIF");
    const { data } = await sb().from("clients").select("id").eq("id", ctx().seed.clientSimpleId);
    expect(data ?? [], "un client avec des documents a été jeté").toHaveLength(1);
  });
});

describe("Jeter un brouillon de facture libère les bons qu'il portait", () => {
  it("le bon redevient facturable au lieu de rester bloqué au profit d'une facture invisible", async () => {
    expect(await jeter("facture", factureDuBlId)).toBe("");
    const { data } = await sb().from("bons_livraison").select("facture_id, status").eq("id", blFactureId).single();
    expect(data?.facture_id, "le bon est resté rattaché à une facture jetée").toBeNull();
    expect(data?.status).toBe("livre");
  });
});

// ── Le client vierge, et l'archivage ──────────────────────────────────────────

describe("Un client sans aucune pièce part, et revient archivé", () => {
  it("il part", async () => {
    expect(await jeter("client", clientVierge)).toBe("");
    const { data } = await sb().from("clients").select("id").eq("id", clientVierge);
    expect(data ?? []).toHaveLength(0);
  });

  it("il revient archivé, pas actif : il avait quitté les listes deux fois", async () => {
    const { error } = await sb().rpc("restaurer_de_la_corbeille", { p_entite: "client", p_id: clientVierge });
    expect(error).toBeNull();
    const { data } = await sb().from("clients").select("archive").eq("id", clientVierge).single();
    expect(data?.archive, "un client restauré doit revenir archivé").toBe(true);
  });

  it("et le désarchivage, lui, est un simple `update` que l'écran sait faire", async () => {
    const { error } = await sb().from("clients").update({ archive: false }).eq("id", clientVierge);
    expect(error).toBeNull();
    const { data } = await sb().from("clients").select("archive").eq("id", clientVierge).single();
    expect(data?.archive).toBe(false);
  });
});

// ── Les liens publics et les crons ────────────────────────────────────────────

describe("Un document jeté cesse d'exister pour le monde extérieur", () => {
  it("le lien public d'une réception jetée ne rend plus rien", async () => {
    const { data: r } = await sb().from("receptions").select("public_token").eq("id", receptionId).single();
    const token = r?.public_token as string;

    const { data: avant } = await clientAnonyme().rpc("reception_public", { p_token: token });
    expect(avant, "le bon public doit répondre avant la mise à la corbeille").toBeTruthy();

    expect(await jeter("reception", receptionId)).toBe("");
    const { data: apres } = await clientAnonyme().rpc("reception_public", { p_token: token });
    expect(apres, "un bon de réception jeté est encore servi par son lien public").toBeNull();
  });
});

// ── Ce qui n'appartient à personne d'autre ────────────────────────────────────

describe("La corbeille est cloisonnée comme le reste", () => {
  it("un visiteur anonyme ne lit pas la corbeille et ne restaure rien", async () => {
    const anon = clientAnonyme();
    const { data, error } = await anon.rpc("corbeille");
    // Selon l'état de la session, PostgREST refuse ou rend zéro ligne : les deux conviennent,
    // ce qui ne conviendrait pas serait une ligne.
    expect(error !== null || (data as unknown[] ?? []).length === 0).toBe(true);

    await anon.rpc("restaurer_de_la_corbeille", { p_entite: "reception", p_id: receptionId });
    expect(await estDansLaCorbeille("reception", receptionId), "un anonyme a restauré une réception").toBe(true);
  });

  it("un visiteur anonyme ne jette rien non plus", async () => {
    const { data: avant } = await sb().from("bons_livraison").select("id").eq("id", blLivreId);
    expect(avant ?? [], "le bon témoin doit exister").toHaveLength(1);

    await clientAnonyme().rpc("mettre_a_la_corbeille", { p_entite: "bl", p_id: blLivreId });
    // L'état, relu avec le compte du responsable : un 204 sans effet ne prouverait rien.
    const { data: apres } = await sb().from("bons_livraison").select("id").eq("id", blLivreId);
    expect(apres ?? [], "un anonyme a mis un bon de livraison à la corbeille").toHaveLength(1);
  });

  it("la purge n'est pas exposée à l'API : c'est un travail de cron, pas un bouton", async () => {
    const { error } = await sb().rpc("purger_corbeille");
    expect(error, "purger_corbeille est appelable depuis PostgREST").not.toBeNull();
  });

  it("rien de récent ne peut être purgé, même par erreur de programmation", async () => {
    // On vérifie la borne, pas l'effet : la fonction n'est pas appelable ici (et c'est le point
    // précédent). Ce que ce test protège, c'est la date de purge annoncée à l'écran.
    const { data } = await sb().rpc("corbeille");
    for (const l of (data as { purge_le: string }[]) ?? []) {
      expect(new Date(l.purge_le).getTime()).toBeGreaterThan(Date.now());
    }
  });
});
