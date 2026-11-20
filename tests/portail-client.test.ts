import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { creerDevis, finaliserDevis, ligneLibre } from "./helpers/devis";
import { calcTotaux } from "@/lib/utils";
import { formeDeJetonPortail, RUBRIQUES_PORTAIL, type PagePortail } from "@/lib/portail";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * L'espace client `/portail/<jeton>` — chantier 8.
 *
 * Ce fichier n'est pas un test de fonctionnalité, c'est un test d'attaque. Un jeton de portail
 * ouvre **l'historique commercial complet d'une entreprise** : la seule chose qui vaille d'être
 * figée ici, c'est ce que le porteur du lien ne doit jamais atteindre.
 *
 * Les six pages à jeton existantes (`/d/`, `/f/`, `/bl/`, `/rc/`, `/s/`, `/jt/`) ont déjà leur
 * recette dans `pages-publiques.test.ts`. On ne la rejoue pas : le portail ne recopie aucun
 * document, il renvoie vers ces pages-là. Ce qu'on vérifie ici, c'est la frontière.
 *
 * Tout part d'un client PostgREST **anonyme** : exactement ce dont dispose quelqu'un qui a
 * récupéré un lien, et rien de plus.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;

/** Le porteur du lien de A ne doit jamais voir une pièce de B, et réciproquement. */
type Dossier = {
  clientId: string;
  jetonPortail: string;
  devisEnvoye: string;
  devisBrouillon: string;
  factureEmise: string;
  factureBrouillon: string;
  blLivre: string;
  blBrouillon: string;
};

const A = {} as Dossier; // client avec remise négociée
const B = {} as Dossier; // client au tarif standard

/** PostgREST rend 42501 (droit refusé) ou PGRST202 (fonction masquée pour ce rôle). */
function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    ["42501", "PGRST202", "PGRST203"].includes(error.code ?? "") ||
    /permission denied|not find the function/i.test(error.message ?? "")
  );
}

/** Tous les jetons servis par une rubrique, pour un porteur de lien donné. */
async function jetonsDe(jetonPortail: string, rubrique: string): Promise<string[]> {
  const { data, error } = await anon.rpc("portail_liste", {
    p_token: jetonPortail, p_rubrique: rubrique, p_de: 0, p_a: 99,
  });
  expect(error, `portail_liste(${rubrique}) : ${error?.message}`).toBeNull();
  const page = data as PagePortail | null;
  return (page?.lignes ?? []).map((l) => (l as { jeton: string }).jeton);
}

/** Le contenu complet servi à un porteur de lien, toutes rubriques confondues, en texte brut. */
async function toutCeQueVoit(jetonPortail: string): Promise<string> {
  const { data: entete } = await anon.rpc("portail_client", { p_token: jetonPortail });
  const morceaux = [JSON.stringify(entete)];
  for (const r of RUBRIQUES_PORTAIL) {
    const { data } = await anon.rpc("portail_liste", {
      p_token: jetonPortail, p_rubrique: r.code, p_de: 0, p_a: 99,
    });
    morceaux.push(JSON.stringify(data));
  }
  return morceaux.join("\n");
}

async function semerDossier(clientId: string, marqueur: string): Promise<Dossier> {
  const items = [ligneLibre({ libelle: `Pièce ${marqueur}`, qte: 2, pu: 120, tva: 20 })];

  const brouillon = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items });
  const aEnvoyer = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items });
  const envoye = await finaliserDevis(sb, aEnvoyer.id);

  const totaux = calcTotaux(items, null);
  const { data: factures, error: errF } = await sb
    .from("factures")
    .insert([
      // `status` explicite, alors qu'il a une valeur par défaut en base : PostgREST fait l'union
      // des clés d'une insertion en lot et écrit NULL dans les colonnes absentes d'une ligne mais
      // présentes dans une autre. Le brouillon partait donc sans statut, et le test échouait pour
      // une raison qui n'avait rien à voir avec le portail.
      { atelier_id: ctx.seed.atelierId, client_id: clientId, type: "libre", items, ...totaux, status: "brouillon" },
      {
        atelier_id: ctx.seed.atelierId, client_id: clientId, type: "libre", items, ...totaux,
        status: "emise", emise_at: new Date().toISOString(), numero: await numero("facture"),
      },
    ])
    .select("id, status, public_token");
  if (errF) throw new Error(`factures ${marqueur} : ${errF.message}`);
  const emise = factures!.find((f) => f.status === "emise")!;
  const brouillonF = factures!.find((f) => f.status === "brouillon")!;

  const { data: bls, error: errBl } = await sb
    .from("bons_livraison")
    .insert([
      // `status` explicite pour la même raison que sur les factures : PostgREST fait l'union des
      // clés d'une insertion en lot et écrit NULL là où la valeur par défaut aurait dû s'appliquer.
      { atelier_id: ctx.seed.atelierId, client_id: clientId, lignes: [], status: "brouillon", note: `NOTE INTERNE ${marqueur}` },
      {
        atelier_id: ctx.seed.atelierId, client_id: clientId, lignes: [], status: "livre",
        livre_at: new Date().toISOString(), numero: await numero("bl"),
      },
    ])
    .select("id, status, public_token");
  if (errBl) throw new Error(`BL ${marqueur} : ${errBl.message}`);

  const { data: jeton, error: errP } = await sb.rpc("portail_ouvrir", { p_client: clientId });
  if (errP) throw new Error(`portail_ouvrir ${marqueur} : ${errP.message}`);

  return {
    clientId,
    jetonPortail: jeton as string,
    devisEnvoye: envoye.public_token as string,
    devisBrouillon: brouillon.public_token as string,
    factureEmise: emise.public_token as string,
    factureBrouillon: brouillonF.public_token as string,
    blLivre: bls!.find((b) => b.status === "livre")!.public_token as string,
    blBrouillon: bls!.find((b) => b.status === "brouillon")!.public_token as string,
  };
}

async function numero(type: string): Promise<string> {
  const { data, error } = await sb.rpc("next_numero", { p_type: type });
  if (error) throw new Error(`next_numero(${type}) : ${error.message}`);
  return data as string;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  Object.assign(A, await semerDossier(ctx.seed.clientRemiseId, "ALPHA"));
  Object.assign(B, await semerDossier(ctx.seed.clientSimpleId, "BETA"));
}, 120_000);

describe("le jeton de portail", () => {
  it("n'existe pas tant que l'atelier ne l'a pas ouvert", async () => {
    const { data: neuf, error } = await sb
      .from("clients")
      .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: `Portail fermé ${Date.now()}` })
      .select("id")
      .single();
    expect(error).toBeNull();

    // Le portail est fermé par défaut : on n'ouvre pas l'historique d'un client parce qu'un
    // logiciel a coché une case à sa place.
    const { data: rien } = await sb
      .from("client_portail")
      .select("jeton")
      .eq("client_id", neuf!.id)
      .maybeSingle();
    expect(rien).toBeNull();
  });

  it("est long, imprévisible et d'une autre nature que les jetons de document", () => {
    expect(formeDeJetonPortail(A.jetonPortail)).toBe(true);
    // 32 octets d'entropie contre 16 pour un jeton de document : le portail ouvre un compte,
    // pas une pièce.
    expect(A.jetonPortail.length).toBeGreaterThan(A.factureEmise.length * 2);
    expect(A.jetonPortail).not.toBe(B.jetonPortail);
  });

  it("est idempotent à l'ouverture : rouvrir ne casse pas le lien déjà envoyé", async () => {
    const { data: encore, error } = await sb.rpc("portail_ouvrir", { p_client: A.clientId });
    expect(error).toBeNull();
    expect(encore).toBe(A.jetonPortail);
  });

  it("ne rend rien sur un jeton inconnu, vide, nul ou tronqué", async () => {
    for (const faux of ["", "pc_", "pc_" + "0".repeat(64), "a".repeat(80), A.jetonPortail.slice(0, -1)]) {
      const { data } = await anon.rpc("portail_client", { p_token: faux });
      expect(data, `jeton « ${faux.slice(0, 12)}… » a rendu quelque chose`).toBeNull();
    }
    const { data: nul } = await anon.rpc("portail_client", { p_token: null });
    expect(nul).toBeNull();
  });
});

describe("cloisonnement entre clients", () => {
  it("le porteur du lien de A ne voit aucune pièce de B", async () => {
    const vuParA = await toutCeQueVoit(A.jetonPortail);
    for (const jetonDeB of [B.devisEnvoye, B.factureEmise, B.blLivre, B.devisBrouillon, B.factureBrouillon]) {
      expect(vuParA, `une pièce de B fuit dans le portail de A`).not.toContain(jetonDeB);
    }
    expect(vuParA).not.toContain("BETA");
  });

  it("le porteur du lien de B ne voit aucune pièce de A", async () => {
    const vuParB = await toutCeQueVoit(B.jetonPortail);
    for (const jetonDeA of [A.devisEnvoye, A.factureEmise, A.blLivre]) {
      expect(vuParB, `une pièce de A fuit dans le portail de B`).not.toContain(jetonDeA);
    }
    expect(vuParB).not.toContain("ALPHA");
  });

  it("chacun voit bien ses propres pièces — sinon le test précédent ne prouverait rien", async () => {
    const documentsA = await jetonsDe(A.jetonPortail, "documents");
    expect(documentsA).toContain(A.devisEnvoye);
    expect(documentsA).toContain(A.factureEmise);
    expect(documentsA).toContain(A.blLivre);
  });

  it("le nom de l'autre client n'apparaît nulle part", async () => {
    const { data: clientB } = await sb.from("clients").select("nom").eq("id", B.clientId).single();
    const { data: clientA } = await sb.from("clients").select("nom").eq("id", A.clientId).single();

    const vuParA = await toutCeQueVoit(A.jetonPortail);
    expect(vuParA).toContain(clientA!.nom); // il se reconnaît…
    expect(vuParA).not.toContain(clientB!.nom); // … et ne voit personne d'autre
  });
});

describe("aucune donnée interne ne sort", () => {
  it("ne sert ni brouillon de devis, ni brouillon de facture, ni brouillon de bon de livraison", async () => {
    const vuParA = await toutCeQueVoit(A.jetonPortail);
    // Un brouillon n'a jamais existé pour le client : l'afficher, c'est lui montrer un prix qu'on
    // n'a pas encore décidé de lui faire.
    expect(vuParA).not.toContain(A.devisBrouillon);
    expect(vuParA).not.toContain(A.factureBrouillon);
    expect(vuParA).not.toContain(A.blBrouillon);
  });

  it("ne sert aucune note interne, aucune remise négociée, aucun contact du client", async () => {
    // Fiche dédiée : on ne modifie pas les clients du semis, que d'autres fichiers de la suite
    // utilisent. Les valeurs posées ici sont reconnaissables — on cherche leur trace ensuite.
    const marqueurNote = `NOTE-INTERNE-${Date.now()}`;
    const { data: fuite, error } = await sb
      .from("clients")
      .insert({
        atelier_id: ctx.seed.atelierId, type: "pro", nom: `Portail fuite ${Date.now()}`,
        notes: marqueurNote, remise_pct: 17.3,
        email: "secret@interne.invalid", telephone: "0699887766",
        adresse: "13 impasse Confidentielle",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { data: jeton } = await sb.rpc("portail_ouvrir", { p_client: fuite!.id });
    const vu = await toutCeQueVoit(jeton as string);
    expect(vu, "la note interne du client fuit").not.toContain(marqueurNote);
    expect(vu, "la remise négociée du client fuit").not.toContain("17.3");
    expect(vu, "le courriel du client fuit").not.toContain("secret@interne.invalid");
    expect(vu, "le téléphone du client fuit").not.toContain("0699887766");
    expect(vu, "l'adresse du client fuit").not.toContain("impasse Confidentielle");
  });

  it("ne sert ni prix de revient, ni prix d'achat de poudre, ni marge, ni surface", async () => {
    const vuParA = await toutCeQueVoit(A.jetonPortail);
    for (const interdit of [
      "prix_kg", "cout_", "revient", "marge", "poudre_conso_kg", "surface_m2",
      "lot_poudre", "teinte_origine", "notes", "note",
    ]) {
      expect(vuParA, `le champ « ${interdit} » est exposé au client`).not.toContain(`"${interdit}"`);
    }
  });

  it("ne sert que le nom du client, et rien d'autre de sa fiche", async () => {
    const { data } = await anon.rpc("portail_client", { p_token: A.jetonPortail });
    expect(Object.keys((data as { client: object }).client)).toEqual(["nom"]);
  });
});

describe("ce que le portail sert vraiment", () => {
  it("annonce un reste dû qui déduit les règlements et les avoirs", async () => {
    // Une facture émise de 240 € TTC, réglée de 40 €, corrigée par un avoir de 60 € : le client
    // doit lire 140 €, pas 240. Sans la déduction des avoirs, le portail réclamerait de l'argent
    // qu'un avoir a déjà effacé — exactement l'appel téléphonique qu'on veut supprimer.
    const { data: avant } = await anon.rpc("portail_client", { p_token: B.jetonPortail });
    const duAvant = nb((avant as { resume: { reste_du: unknown } }).resume.reste_du);

    const { data: facture } = await sb
      .from("factures")
      .select("id, total_ttc")
      .eq("public_token", B.factureEmise)
      .single();

    await sb.from("paiements").insert({
      atelier_id: ctx.seed.atelierId, facture_id: facture!.id, montant: 40, moyen: "virement",
    });

    const itemsAvoir = [ligneLibre({ libelle: "Geste commercial", qte: 1, pu: 50, tva: 20 })];
    const { error: errAvoir } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: B.clientId, type: "avoir",
      items: itemsAvoir, ...calcTotaux(itemsAvoir, null),
      status: "emise", emise_at: new Date().toISOString(), numero: await numero("facture"),
    });
    expect(errAvoir).toBeNull();

    const { data: apres } = await anon.rpc("portail_client", { p_token: B.jetonPortail });
    const duApres = nb((apres as { resume: { reste_du: unknown } }).resume.reste_du);
    expect(duApres).toBeCloseTo(duAvant - 40 - 60, 2);
  });

  it("marque un avoir comme ne devant rien", async () => {
    const { data } = await anon.rpc("portail_liste", {
      p_token: B.jetonPortail, p_rubrique: "factures", p_de: 0, p_a: 99,
    });
    const avoirs = ((data as PagePortail).lignes as { type: string; reste_du: unknown }[]).filter(
      (l) => l.type === "avoir",
    );
    expect(avoirs.length).toBeGreaterThan(0);
    for (const a of avoirs) expect(nb(a.reste_du)).toBe(0);
  });

  it("rend une liste vide, jamais une erreur, sur une rubrique inventée", async () => {
    const { data, error } = await anon.rpc("portail_liste", {
      p_token: A.jetonPortail, p_rubrique: "comptabilite", p_de: 0, p_a: 24,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ total: 0, lignes: [] });
  });

  it("plafonne la page à 100 lignes quelles que soient les bornes demandées", async () => {
    // Un porteur de lien fixe lui-même les bornes : sans plafond, `p_a = 2 000 000 000`
    // transformerait la page en export complet du dossier en une seule requête.
    const { data } = await anon.rpc("portail_liste", {
      p_token: A.jetonPortail, p_rubrique: "documents", p_de: 0, p_a: 2_000_000_000,
    });
    expect((data as PagePortail).lignes.length).toBeLessThanOrEqual(100);

    // Bornes absurdes : une page, pas une erreur.
    const { data: negatif, error } = await anon.rpc("portail_liste", {
      p_token: A.jetonPortail, p_rubrique: "documents", p_de: -500, p_a: -1,
    });
    expect(error).toBeNull();
    expect((negatif as PagePortail).lignes.length).toBeGreaterThanOrEqual(0);
  });

  it("annonce un total cohérent avec la pagination", async () => {
    const { data } = await anon.rpc("portail_liste", {
      p_token: A.jetonPortail, p_rubrique: "documents", p_de: 0, p_a: 0,
    });
    const page = data as PagePortail;
    expect(page.lignes).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(3);
  });
});

describe("ce qu'un visiteur anonyme ne peut pas faire", () => {
  it("ne lit pas la table des portails", async () => {
    // Selon le droit retiré, PostgREST répond un refus ou zéro ligne. Les deux conviennent :
    // ce qui ne convient pas, c'est un jeton — ni une erreur d'un autre genre, qui rendrait
    // l'épreuve muette.
    attendreLectureFermee(await anon.from("client_portail").select("jeton"), "la table des portails");
  });

  it("n'ouvre, ne renouvelle et ne ferme aucun portail", async () => {
    for (const rpc of ["portail_ouvrir", "portail_regenerer", "portail_revoquer"]) {
      const { error } = await anon.rpc(rpc, { p_client: A.clientId });
      expect(estRefus(error), `anon a pu appeler ${rpc} : ${JSON.stringify(error)}`).toBe(true);
    }
  });

  it("ne devine pas un jeton en tapant à côté", async () => {
    // Variation d'un caractère : la table est indexée sur l'égalité stricte, il n'y a pas de
    // « à peu près ».
    const voisin = A.jetonPortail.slice(0, -1) + (A.jetonPortail.endsWith("a") ? "b" : "a");
    const { data } = await anon.rpc("portail_client", { p_token: voisin });
    expect(data).toBeNull();
  });
});

describe("l'atelier garde la main", () => {
  it("horodate la consultation sans toucher à la fiche client", async () => {
    const { data: avant } = await sb
      .from("clients")
      .select("updated_at")
      .eq("id", A.clientId)
      .single();

    const { error } = await anon.rpc("portail_vu", { p_token: A.jetonPortail });
    expect(error).toBeNull();

    const { data: portail } = await sb
      .from("client_portail")
      .select("visites, derniere_visite_at")
      .eq("client_id", A.clientId)
      .single();
    expect(nb(portail!.visites)).toBeGreaterThan(0);
    expect(portail!.derniere_visite_at).not.toBeNull();

    // La visite ne doit pas marquer la fiche client comme modifiée : sinon le journal des
    // modifications devient illisible et la liste triée par mise à jour remonte les clients les
    // plus curieux, pas les plus récents.
    const { data: apres } = await sb
      .from("clients")
      .select("updated_at")
      .eq("id", A.clientId)
      .single();
    expect(apres!.updated_at).toBe(avant!.updated_at);
  });

  it("un jeton inconnu passé à portail_vu ne casse rien", async () => {
    const { error } = await anon.rpc("portail_vu", { p_token: "pc_" + "f".repeat(64) });
    expect(error).toBeNull();
  });

  it("renouveler le lien tue immédiatement l'ancien", async () => {
    const ancien = B.jetonPortail;
    const { data: nouveau, error } = await sb.rpc("portail_regenerer", { p_client: B.clientId });
    expect(error).toBeNull();
    expect(nouveau).not.toBe(ancien);

    expect(await anon.rpc("portail_client", { p_token: ancien }).then((r) => r.data)).toBeNull();
    expect(await anon.rpc("portail_client", { p_token: nouveau }).then((r) => r.data)).not.toBeNull();

    // Le compteur repart de zéro avec le jeton : « vu la dernière fois le 12 » doit parler du
    // lien en cours, pas de celui qu'on vient de désactiver.
    const { data: p } = await sb
      .from("client_portail")
      .select("visites, derniere_visite_at")
      .eq("client_id", B.clientId)
      .single();
    expect(nb(p!.visites)).toBe(0);
    expect(p!.derniere_visite_at).toBeNull();

    B.jetonPortail = nouveau as string;
  });

  it("fermer l'espace tue le lien pour de bon", async () => {
    const { data: ferme, error } = await sb.rpc("portail_revoquer", { p_client: B.clientId });
    expect(error).toBeNull();
    expect(ferme).toBe(true);

    const { data } = await anon.rpc("portail_client", { p_token: B.jetonPortail });
    expect(data).toBeNull();

    const { data: liste } = await anon.rpc("portail_liste", {
      p_token: B.jetonPortail, p_rubrique: "factures", p_de: 0, p_a: 24,
    });
    expect(liste).toBeNull();

    // Le jeton n'existe plus nulle part : un drapeau « révoqué » laisserait le secret en base.
    const { data: reste } = await sb
      .from("client_portail")
      .select("jeton")
      .eq("client_id", B.clientId)
      .maybeSingle();
    expect(reste).toBeNull();

    // Refermer un espace déjà fermé n'est pas une erreur, c'est un non-événement.
    const { data: encore } = await sb.rpc("portail_revoquer", { p_client: B.clientId });
    expect(encore).toBe(false);
  });

  it("un client mis à la corbeille ferme son portail", async () => {
    const { data: jetable } = await sb
      .from("clients")
      .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: `Portail corbeille ${Date.now()}` })
      .select("id")
      .single();
    const { data: jeton } = await sb.rpc("portail_ouvrir", { p_client: jetable!.id });
    expect(await anon.rpc("portail_client", { p_token: jeton }).then((r) => r.data)).not.toBeNull();

    const { error } = await sb.rpc("mettre_a_la_corbeille", { p_entite: "client", p_id: jetable!.id });
    expect(error).toBeNull();

    // Une fiche jetée ne doit pas laisser une porte publique ouverte sur ce qu'elle portait.
    expect(await anon.rpc("portail_client", { p_token: jeton }).then((r) => r.data)).toBeNull();
  });

  it("refuse d'ouvrir un portail sur le client d'un autre atelier", async () => {
    const { error } = await sb.rpc("portail_ouvrir", {
      p_client: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/PORTAIL_CLIENT_INTROUVABLE/);
  });
});
