import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2, ligneMl, lignePieceType } from "./helpers/devis";
import type { GrilleCoef, GrillePalier } from "@/lib/types";

const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

beforeAll(async () => {
  sb = clientConnecte(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleStandardId));
});

describe("signature d'un devis depuis la page publique", () => {
  it("crée le projet, hérite de la surface à laquer et numérote les deux documents", async () => {
    const items = [
      // 4,20 m² au m² direct.
      ligneM2({ surface: 4.2, finition: "structure", complexite: "moyenne", grilleId: ctx.seed.grilleStandardId, paliers, coefs }),
      // 12,5 ml × 0,35 m de périmètre développé = 4,38 m² équivalents.
      ligneMl({ famille: "Garde-corps", tarifMlId: ctx.seed.tarifMlId, metrage: 12.5, prixMl: 28, perimetreDeveloppeM: 0.35 }),
      // Pièce type : 0,90 m² unitaire × 2.
      lignePieceType({ pieceTypeId: ctx.seed.pieceTypeId, nom: 'Jante alu 17"', prix: 55, surfaceM2: 0.9, qte: 2 }),
    ];
    const brouillon = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    expect(brouillon.numero).toBeNull();

    const envoye = await finaliserDevis(sb, brouillon.id);
    expect(envoye.numero).toMatch(/^DV-\d{4}-\d{4}$/);
    expect(envoye.status).toBe("envoye");

    // La signature passe par la RPC publique : le client n'est jamais authentifié.
    const anon = clientAnonyme(ctx);
    const { data: signe, error } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token,
      p_nom: "Patrick Testard",
      p_signature: { trace: "data:image/png;base64,AAAA", horodatage: new Date().toISOString() },
      p_ip: "90.119.33.69",
    });
    expect(error).toBeNull();
    expect(signe).toBe(true);

    const { data: relu } = await sb.from("devis").select("*").eq("id", brouillon.id).single();
    expect(relu!.status).toBe("signe");
    expect(relu!.signed_by).toBe("Patrick Testard");
    expect(relu!.signature_ip).toBe("90.119.33.69");
    expect(relu!.signed_at).not.toBeNull();

    const { data: projet } = await sb.from("projets").select("*").eq("devis_id", brouillon.id).single();
    expect(projet).not.toBeNull();
    expect(projet!.numero).toMatch(/^PR-\d{4}-\d{4}$/);
    expect(projet!.client_id).toBe(ctx.seed.clientSimpleId);
    expect(projet!.status).toBe("en_attente");
    // 4,20 (m²) + 4,38 (ml développés) + 2 × 0,90 (pièces types) = 10,38 m².
    expect(nb(projet!.surface_m2)).toBe(10.38);
    expect(projet!.etapes.length).toBeGreaterThanOrEqual(5);
    expect(projet!.etape_courante).toBe(projet!.etapes[0].code);
    expect(projet!.qr_token).toBeTruthy();
  });

  it("refuse une seconde signature du même devis", async () => {
    const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleStandardId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const envoye = await finaliserDevis(sb, devis.id);
    const anon = clientAnonyme(ctx);

    const premiere = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "A", p_signature: {}, p_ip: null });
    const seconde = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "B", p_signature: {}, p_ip: null });
    expect(premiere.data).toBe(true);
    expect(seconde.data).toBe(false);

    const { data: relu } = await sb.from("devis").select("signed_by").eq("id", devis.id).single();
    expect(relu!.signed_by).toBe("A");
  });

  it("ne signe pas un devis resté en brouillon", async () => {
    const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleStandardId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const anon = clientAnonyme(ctx);
    const { data } = await anon.rpc("signer_devis", { p_token: devis.public_token, p_nom: "C", p_signature: {}, p_ip: null });
    expect(data).toBe(false);
    const { data: relu } = await sb.from("devis").select("status").eq("id", devis.id).single();
    expect(relu!.status).toBe("brouillon");
  });

  it("numérote les devis en séquence, sans trou ni collision", async () => {
    const numeros: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await sb.rpc("next_numero", { p_type: "devis" });
      numeros.push(data as string);
    }
    const rangs = numeros.map((n) => Number(n.slice(-4)));
    expect(new Set(numeros).size).toBe(3);
    expect(rangs[1]).toBe(rangs[0] + 1);
    expect(rangs[2]).toBe(rangs[1] + 1);
  });
});
