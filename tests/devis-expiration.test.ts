import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as chargerEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { creerDevis, finaliserDevis, ligneLibre } from "./helpers/devis";
import { devisPerime, echeanceDevis } from "@/lib/devis";

/**
 * L'expiration des devis — ce qui doit tenir en base, pas à l'écran.
 *
 * CE QUI EST ÉPROUVÉ ICI, et pourquoi ça vaut la peine : avant la migration 45, `status =
 * 'expire'` était autorisé par la contrainte, **lu** partout (filtre de la liste, `peutRouvrir`,
 * type TypeScript) et **écrit nulle part**. Aucune des 131 fonctions du schéma ne le posait,
 * aucun cron ne le posait. Résultat : `validite_jours` valait 30, « Devis valable 30 jours »
 * s'imprimait sur le PDF et sur la page publique, et un devis de l'an dernier se signait encore
 * aujourd'hui — au prix de l'an dernier — avec création automatique du projet derrière.
 *
 * Deux règles de méthode, comme sur les autres verrous du projet :
 *
 *  1. **On vérifie l'état après coup, jamais le code de retour.** Un refus qui laisse quand même
 *     la ligne signée n'est pas un refus. Chaque épreuve relit `status`, `signed_at`, et
 *     l'absence de projet créé par `trg_devis_signe`.
 *  2. **On ne touche jamais un atelier réel.** Tout se passe dans l'atelier `TEST-AUTO-…` du
 *     `globalSetup`, et l'appel à `expirer_devis` est **borné à cet atelier** par son paramètre
 *     `p_atelier` : lancer le balayage complet ferait vieillir les devis de `ThermoTest` et de
 *     `Atelier Démo Thermolaquage`, ce qui est exactement ce qu'on s'interdit.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });
chargerEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

/** Le cron tourne en `service_role` : sans cette clé, les épreuves du balayage sont annoncées ignorées. */
const CLE_SERVICE =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const ctx = () => contexte();
const sb = () => clientConnecte();
const anon = () => clientAnonyme();

function clientService(): SupabaseClient {
  const c = contexte();
  return createClient(c.url, CLE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** PostgREST rend 42501 (droit refusé) ou PGRST202 (fonction masquée pour ce rôle). */
function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    ["42501", "PGRST202", "PGRST203"].includes(error.code ?? "") ||
    /permission denied|not find the function/i.test(error.message ?? "")
  );
}

type DevisEnBase = {
  id: string;
  status: string;
  public_token: string;
  signed_at: string | null;
  envoye_at: string | null;
  created_at: string;
  validite_jours: number;
};

const crees: string[] = [];

/** Un devis finalisé, dont on recule la date d'envoi pour le rendre périmé sans attendre un mois. */
async function devisFinalise(jourDEnvoi: number): Promise<DevisEnBase> {
  const c = ctx();
  const avantEnvoi = await creerDevis(sb(), {
    atelierId: c.seed.atelierId,
    clientId: c.seed.clientSimpleId,
    items: [ligneLibre({ libelle: "Thermolaquage — épreuve d'expiration", qte: 1, pu: 200 })],
  });
  crees.push(avantEnvoi.id as string);
  await finaliserDevis(sb(), avantEnvoi.id as string);

  // `envoye_at` n'est pas une colonne figée (`trg_figer_document` ne verrouille que les totaux,
  // les lignes et le client, et seulement sur un devis signé) : on peut la reculer.
  const envoye = new Date(Date.now() - jourDEnvoi * 86400000).toISOString();
  const { data, error } = await sb()
    .from("devis")
    .update({ envoye_at: envoye })
    // C'est le devis qu'on vient de finaliser qu'on recule — pas `brouillon`, qui est le
    // brouillon jamais envoyé, créé plus bas dans `beforeAll` et donc encore `undefined` ici.
    .eq("id", avantEnvoi.id as string)
    .select("id, status, public_token, signed_at, envoye_at, created_at, validite_jours")
    .single();
  if (error) throw new Error(`recul de envoye_at : ${error.message}`);
  return data as DevisEnBase;
}

async function relire(id: string): Promise<DevisEnBase> {
  const { data, error } = await sb()
    .from("devis")
    .select("id, status, public_token, signed_at, envoye_at, created_at, validite_jours")
    .eq("id", id)
    .single();
  if (error) throw new Error(`relecture devis : ${error.message}`);
  return data as DevisEnBase;
}

async function aUnProjet(devisId: string): Promise<boolean> {
  const { data } = await sb().from("projets").select("id").eq("devis_id", devisId);
  return (data ?? []).length > 0;
}

/** La signature telle qu'elle part de la page publique : client anonyme, RPC, rien d'autre. */
async function signerEnAnonyme(token: string) {
  return anon().rpc("signer_devis", {
    p_token: token,
    p_nom: "Client de passage",
    p_signature: { image: "data:image/png;base64,AAA", at: new Date().toISOString(), ua: "vitest", ip: "203.0.113.9" },
    p_ip: "203.0.113.9",
  });
}

let perime: DevisEnBase;
let valide: DevisEnBase;
let brouillon: DevisEnBase;

beforeAll(async () => {
  // 40 jours : au-delà des 30 de validité, quelle que soit l'heure à laquelle tourne la suite.
  perime = await devisFinalise(40);
  // 2 jours : parti, largement dans les temps.
  valide = await devisFinalise(2);

  const c = ctx();
  const b = await creerDevis(sb(), {
    atelierId: c.seed.atelierId,
    clientId: c.seed.clientSimpleId,
    items: [ligneLibre({ libelle: "Brouillon jamais envoyé", qte: 1, pu: 100 })],
  });
  crees.push(b.id as string);
  brouillon = (await relire(b.id as string)) as DevisEnBase;
});

afterAll(async () => {
  // Les projets créés par `trg_devis_signe` tiennent le devis par une clé étrangère.
  for (const id of crees) await sb().from("projets").delete().eq("devis_id", id);
  for (const id of crees) await sb().from("devis").delete().eq("id", id);
  // Le devis mis à la corbeille est invisible aux policies de lecture, donc indélébile par le
  // compte de l'atelier : c'est le `service_role` qui fait le ménage, quand il est disponible.
  if (CLE_SERVICE) {
    const service = clientService();
    for (const id of crees) await service.from("projets").delete().eq("devis_id", id);
    for (const id of crees) await service.from("devis").delete().eq("id", id);
  }
});

describe("l'échéance, calculée au même endroit des deux côtés", () => {
  it("la base et le TypeScript rendent la même date", async () => {
    const { data, error } = await anon().rpc("devis_public", { p_token: perime.public_token });
    expect(error).toBeNull();
    const vue = data as { expire_le: string; validite_jours: number; envoye_at: string | null };
    expect(vue.expire_le).toBe(echeanceDevis(perime));
  });

  it("le jour de l'échéance, le devis est encore signable", () => {
    // Exactement 30 jours après l'envoi : l'échéance est aujourd'hui, la comparaison est stricte.
    const envoyeIlYA30Jours = new Date(Date.now() - 30 * 86400000).toISOString();
    const d = { envoye_at: envoyeIlYA30Jours, created_at: envoyeIlYA30Jours, validite_jours: 30 };
    expect(devisPerime(d)).toBe(false);
  });

  it("la validité court depuis l'envoi, pas depuis la saisie du brouillon", () => {
    // Devis saisi il y a un an, envoyé hier : il est valable, et c'est tout l'intérêt du
    // rattrapage par « Revenir au brouillon » puis refinalisation.
    const d = {
      created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
      envoye_at: new Date(Date.now() - 86400000).toISOString(),
      validite_jours: 30,
    };
    expect(devisPerime(d)).toBe(false);
  });
});

describe("la signature d'un devis périmé est refusée en base", () => {
  it("un client anonyme est refusé, avec un message qui dit quoi faire", async () => {
    const { data, error } = await signerEnAnonyme(perime.public_token);
    expect(data).not.toBe(true);
    expect(error?.message ?? "").toMatch(/DEVIS_EXPIRE/i);

    // L'état après coup : c'est lui qui prouve le verrou, pas le code de retour.
    const apres = await relire(perime.id);
    expect(apres.status).toBe("envoye");
    expect(apres.signed_at).toBeNull();
    expect(await aUnProjet(perime.id), "trg_devis_signe a créé un projet malgré le refus").toBe(false);
  });

  it("le même refus vaut pour un compte connecté qui appellerait la RPC", async () => {
    const { data, error } = await sb().rpc("signer_devis", {
      p_token: perime.public_token,
      p_nom: "Le patron lui-même",
      p_signature: { image: null, at: new Date().toISOString() },
      p_ip: "203.0.113.9",
    });
    expect(data).not.toBe(true);
    expect(error?.message ?? "").toMatch(/DEVIS_EXPIRE/i);
    expect((await relire(perime.id)).status).toBe("envoye");
  });

  it("contrôle positif : un devis dans les temps se signe toujours", async () => {
    const { data, error } = await signerEnAnonyme(valide.public_token);
    expect(error).toBeNull();
    expect(data).toBe(true);

    const apres = await relire(valide.id);
    expect(apres.status).toBe("signe");
    expect(apres.signed_at).not.toBeNull();
    expect(await aUnProjet(valide.id)).toBe(true);
  });
});

describe("le statut expiré se pose tout seul", () => {
  it("expirer_devis est refusée à un visiteur anonyme", async () => {
    const { error } = await anon().rpc("expirer_devis", {});
    expect(estRefus(error), `anon a pu déclencher le balayage : ${JSON.stringify(error)}`).toBe(true);
  });

  it("expirer_devis est refusée à un compte d'atelier connecté", async () => {
    const { error } = await sb().rpc("expirer_devis", {});
    expect(estRefus(error), `un atelier a pu déclencher le balayage : ${JSON.stringify(error)}`).toBe(true);
  });
});

/**
 * Le balayage lui-même, joué comme le joue pg_cron. Borné à l'atelier jetable : sans ce bornage,
 * l'épreuve ferait vieillir les devis des deux ateliers réels, ce que la consigne interdit.
 */
const avecService = CLE_SERVICE ? describe : describe.skip;

avecService("le balayage quotidien, borné à l'atelier de test", () => {
  it("expire le devis périmé, et lui seul", async () => {
    const service = clientService();
    const { data, error } = await service.rpc("expirer_devis", { p_atelier: ctx().seed.atelierId });
    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThanOrEqual(1);

    expect((await relire(perime.id)).status, "le devis périmé n'a pas été expiré").toBe("expire");
    expect((await relire(valide.id)).status, "un devis signé a été expiré").toBe("signe");
    expect((await relire(brouillon.id)).status, "un brouillon a été expiré").toBe("brouillon");
  });

  it("un second passage ne compte rien de plus — le balayage est idempotent", async () => {
    const service = clientService();
    const { data, error } = await service.rpc("expirer_devis", { p_atelier: ctx().seed.atelierId });
    expect(error).toBeNull();
    expect(Number(data)).toBe(0);
  });

  it("un devis à la corbeille n'est pas touché", async () => {
    const c = ctx();
    const jetable = await devisFinalise(40);
    const { error } = await sb().rpc("mettre_a_la_corbeille", { p_entite: "devis", p_id: jetable.id });
    expect(error).toBeNull();

    const service = clientService();
    await service.rpc("expirer_devis", { p_atelier: c.seed.atelierId });

    // La ligne est invisible en lecture ordinaire : on la relit en service_role.
    const { data } = await service.from("devis").select("status").eq("id", jetable.id).single();
    expect((data as { status: string }).status).toBe("envoye");
  });
});

describe("l'exploitant peut rattraper un devis expiré", () => {
  it("le retour au brouillon puis la refinalisation font repartir la validité", async () => {
    // `perime` est en « expire » si le balayage a tourné, en « envoye » sinon : `rouvrir_devis`
    // accepte les deux, et c'est bien ce qu'on veut prouver.
    const { error } = await sb().rpc("rouvrir_devis", { p_id: perime.id });
    expect(error).toBeNull();

    const enBrouillon = await relire(perime.id);
    expect(enBrouillon.status).toBe("brouillon");
    expect(enBrouillon.envoye_at, "rouvrir_devis doit effacer la date d'envoi").toBeNull();

    await finaliserDevis(sb(), perime.id);
    const refinalise = await relire(perime.id);
    expect(refinalise.status).toBe("envoye");
    expect(devisPerime(refinalise), "la validité n'est pas repartie à la refinalisation").toBe(false);

    // Et le client peut de nouveau signer : c'est la seule preuve qui compte pour l'atelier.
    const { data } = await signerEnAnonyme(refinalise.public_token);
    expect(data).toBe(true);
  });
});
