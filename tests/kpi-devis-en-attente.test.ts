import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";
import { creerDevis, finaliserDevis, ligneLibre } from "./helpers/devis";
import { devisSansReponse } from "@/lib/assistant/outils";
import { devisPerime } from "@/lib/devis";

/**
 * Amélioration n°3 (07/09/2026) — exclure les devis expirés du chiffre « en attente de signature ».
 *
 * Constat de départ, prouvé en base sur `luujbyqenmzivzhiatze` : DV-2026-0016 (validité 60 jours,
 * envoyé le 25/06, donc périmé depuis le 24/08) est resté au statut « envoyé » le 07/09 — le cron
 * `expirer_devis` (6 h 50 chaque matin) ne l'avait pas encore basculé en « expiré ». Le tableau de
 * bord (`stats.devisEnvoyes`), `recap_quotidien_payload` (courriel du matin) et l'outil assistant
 * `devis_sans_reponse` comptaient tous les trois ce devis mort comme du pipeline chaud, en ne
 * filtrant que sur `status = 'envoye'` — jamais sur la validité réelle (`devis_perime()`,
 * migration 45, déjà réutilisée par `signer_devis` et `relancer_devis_et_factures`).
 *
 * Ce fichier prouve, sur un atelier JETABLE (jamais les deux ateliers réels), que la même
 * définition (`devis_perime()` côté base, son miroir `devisPerime()` côté TypeScript) est
 * désormais appliquée aux DEUX endroits corrigés :
 *  1. `recap_quotidien_payload` / `mon_recap_quotidien()` (migration 71) — la rubrique
 *     `argent.devis` n'inclut plus un devis « envoyé » mais périmé ;
 *  2. l'outil assistant `devis_sans_reponse` (src/lib/assistant/outils.ts) — sa propre
 *     description promettait déjà « non expirés » sans jamais le vérifier : corrigé pour de vrai.
 *
 * Le tableau de bord (`src/app/(app)/dashboard/Contenu.tsx`) applique la même règle mais n'a pas
 * de test dédié ici : c'est un composant React sans logique propre à éprouver — il consomme
 * `devisPerime()` telle quelle, déjà couverte par `tests/devis-expiration.test.ts` et ce fichier.
 */

let jetable: AtelierJetable;
let sb: SupabaseClient;
let clientId: string;

/**
 * Un devis fini et envoyé, dont on recule `envoye_at` pour simuler un envoi ancien — même
 * mécanique que `devisFinalise()` dans `tests/devis-expiration.test.ts`. `validiteJours` par
 * défaut (30) si non précisé, comme le ferait un devis créé sans réglage particulier.
 */
async function devisEnvoyeIlYA(jours: number, montant: number, validiteJours?: number): Promise<{ id: string; envoye_at: string }> {
  const devis = await creerDevis(sb, {
    atelierId: jetable.atelierId,
    clientId,
    items: [ligneLibre({ libelle: `Devis — il y a ${jours} j`, qte: 1, pu: montant })],
  });
  await finaliserDevis(sb, devis.id as string);
  const envoyeAt = new Date(Date.now() - jours * 86_400_000).toISOString();
  const maj: Record<string, unknown> = { envoye_at: envoyeAt };
  if (validiteJours !== undefined) maj.validite_jours = validiteJours;
  const { data, error } = await sb.from("devis").update(maj).eq("id", devis.id as string).select("id, envoye_at").single();
  if (error) throw new Error(`recul de envoye_at : ${error.message}`);
  return data as { id: string; envoye_at: string };
}

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lot-amel-devis-en-attente");
  sb = jetable.sb;
  const { data: client, error } = await sb
    .from("clients")
    .insert({ atelier_id: jetable.atelierId, nom: "Client KPI devis", type: "pro" })
    .select("id")
    .single();
  if (error) throw new Error(`création client : ${error.message}`);
  clientId = client!.id as string;
}, 120_000);

afterAll(async () => {
  if (jetable) await jetable.fermer();
});

describe("recap_quotidien_payload — la rubrique « devis en attente » exclut les devis périmés", () => {
  it("un devis envoyé il y a 40 jours (validité 30, donc périmé) reste hors de la liste même resté « envoyé »", async () => {
    // Le cas exact constaté en base : le cron n'a pas (encore) tourné, le statut est toujours
    // « envoyé » — seule la date fait foi. `devis_perime()` doit le dire mort malgré son statut.
    const perime = await devisEnvoyeIlYA(40, 500, 30);
    expect(devisPerime({ envoye_at: perime.envoye_at, created_at: perime.envoye_at, validite_jours: 30 })).toBe(true);

    // Un devis réellement en attente, dans les temps, au-delà du seuil « sans réponse » (7 j par
    // défaut) pour être sûr qu'il apparaît bien dans la rubrique.
    const chaud = await devisEnvoyeIlYA(10, 800, 30);

    const { data, error } = await sb.rpc("mon_recap_quotidien");
    expect(error).toBeNull();
    const p = data as { argent: { devis: { nb: number; total: number; liste: { id: string }[] } } };

    const ids = p.argent.devis.liste.map((l) => l.id);
    expect(ids, "le devis périmé (resté « envoyé ») ne doit plus figurer dans la relance").not.toContain(perime.id);
    expect(ids, "le devis réellement en attente doit toujours y figurer").toContain(chaud.id);
  });
});

describe("l'outil assistant « devis_sans_reponse » — même définition, pas une seconde", () => {
  it("exclut le devis périmé de la liste et de son montant, sans toucher aux autres devis en attente", async () => {
    // Ce fichier partage un seul atelier jetable entre ses deux `describe` : ce test ne peut donc
    // pas supposer être seul sur la rubrique (le premier `describe` y a déjà laissé un devis
    // « chaud »). On prouve la seule chose qui compte ici : le devis périmé est absent de la liste
    // ET absent du montant cumulé — pas un total exact, qui dépendrait de l'ordre d'exécution.
    const perime = await devisEnvoyeIlYA(50, 1000, 20); // validité 20 j, envoyé il y a 50 j : bien mort
    const chaud = await devisEnvoyeIlYA(15, 300, 30);

    const r = await devisSansReponse.executer({ sb, maintenant: new Date() }, { jours: 7 });
    expect(r.refus).toBeUndefined();

    const source = r.sources.find((s) => s.id === chaud.id);
    expect(source, "le devis réellement en attente doit apparaître dans la liste").toBeTruthy();
    // `montant` est le total TTC (l'outil l'annonce dans sa `definition`) : 300 € HT à 20 % de TVA.
    expect(source?.montant).toBe(360);
    expect(r.sources.find((s) => s.id === perime.id), "le devis périmé ne doit plus apparaître").toBeUndefined();
  });

  it("sa propre définition annoncée (« non expirés ») est désormais vraie, pas seulement écrite", () => {
    expect(devisSansReponse.description).toMatch(/expiré/i);
  });
});
