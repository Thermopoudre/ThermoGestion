import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2, ligneLibre } from "./helpers/devis";
import type { GrilleCoef, GrillePalier } from "@/lib/types";

/**
 * Lot D — D2 : le message d'échec de signature ne doit plus mentir.
 *
 * `signer_devis` renvoie `false` sans distinguer la cause : un devis déjà signé (double clic,
 * deux onglets) répond exactement comme un jeton mort. `DevisPublicClient.signer()` corrige ça en
 * relisant `devis_public(token)` après un refus sans exception — si le statut est « signé »,
 * l'écran bascule sur l'écran d'acceptation au lieu d'afficher un message d'échec. Ces tests
 * vérifient le mécanisme dont dépend cette correction : ce que `devis_public` rend réellement
 * après une seconde tentative de signature, et ce que `signer_bl` rend, lui, en clair.
 */
const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

beforeAll(async () => {
  sb = clientConnecte(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleStandardId));
});

describe("devis — une seconde signature devient un « déjà signé », pas un échec générique", () => {
  it("après le refus silencieux (data=false), devis_public confirme le statut réellement signé", async () => {
    const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleStandardId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const envoye = await finaliserDevis(sb, devis.id);
    const anon = clientAnonyme(ctx);

    const premiere = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Premier", p_signature: {}, p_ip: null });
    expect(premiere.data).toBe(true);

    // Reproduction exacte du double clic / deux onglets que la recette a signalé.
    const seconde = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Second", p_signature: {}, p_ip: null });
    expect(seconde.error).toBeNull();
    expect(seconde.data).toBe(false);

    // C'est cette relecture que fait `DevisPublicClient` pour distinguer « déjà signé » d'un
    // échec technique : elle doit rendre un statut exploitable, pas relancer l'ambiguïté.
    const { data: relu, error: errRelu } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect(errRelu).toBeNull();
    expect(relu.status).toBe("signe");

    await sb.from("devis").delete().eq("id", devis.id);
  });

  it("un jeton qui n'a jamais existé ne se confond pas avec un devis déjà signé", async () => {
    const anon = clientAnonyme(ctx);
    const { data, error } = await anon.rpc("devis_public", { p_token: "jeton-totalement-invente-00000000" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe("bon de livraison — signer_bl distingue déjà « introuvable » et « déjà signé »", () => {
  it("répond en clair sur une seconde signature, sans qu'une exception soit nécessaire", async () => {
    // BL minimal, directement en base : émis (hors brouillon), comme l'exige `signer_bl`.
    const ligne = ligneLibre({ libelle: "TEST-AUTO", qte: 1, pu: 50 });
    const { data: bl, error: errBl } = await sb.from("bons_livraison").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, status: "emis", lignes: [ligne],
    }).select("public_token").single();
    expect(errBl).toBeNull();

    const anon = clientAnonyme(ctx);
    const premiere = await anon.rpc("signer_bl", { p_token: bl!.public_token, p_nom: "Premier", p_signature: {}, p_ip: null });
    expect((premiere.data as { ok?: boolean }).ok).toBe(true);

    const seconde = await anon.rpc("signer_bl", { p_token: bl!.public_token, p_nom: "Second", p_signature: {}, p_ip: null });
    expect(seconde.error).toBeNull();
    const res = seconde.data as { ok?: boolean; erreur?: string };
    expect(res.ok).toBe(false);
    // C'est ce texte, déjà en clair depuis la base, que `BLPublicClient` affiche directement —
    // rien à deviner côté écran pour ce cas précis.
    expect(res.erreur).toMatch(/déjà été signé/i);

    await sb.from("bons_livraison").delete().eq("public_token", bl!.public_token);
  });

  it("un jeton introuvable répond aussi en clair, pas par une exception", async () => {
    const anon = clientAnonyme(ctx);
    const { data, error } = await anon.rpc("signer_bl", {
      p_token: "jeton-totalement-invente-00000000", p_nom: "X", p_signature: {}, p_ip: null,
    });
    expect(error).toBeNull();
    const res = data as { ok?: boolean; erreur?: string };
    expect(res.ok).toBe(false);
    expect(res.erreur).toMatch(/introuvable/i);
  });
});
