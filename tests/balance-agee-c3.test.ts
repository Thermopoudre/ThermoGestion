import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";

/**
 * Lot C, C3 — balance âgée (`balance_agee()`), et ses deux documents PDF (relevé de compte,
 * lettre de relance). Le calcul des routes `api/pdf/releve` et `api/pdf/relance` n'est pas
 * retesté ici : elles relisent les mêmes tables (`factures`, `paiements`) avec la même arithmétique
 * de reste dû que ce fichier prouve pour la RPC — ce sont des routes Next.js, hors périmètre Vitest.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let clientId: string;

function ligne(totalHt: number) {
  return [{ libelle: "Thermolaquage", qte: 1, unite: "forfait", pu_ht: totalHt, tva: 20, total_ht: totalHt }];
}

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

async function creerFacture(args: { totalHt: number; retardJours: number; status?: string; type?: string; regleeDe?: number }) {
  const totalHt = args.totalHt;
  const totalTtc = Math.round(totalHt * 1.2 * 100) / 100;
  const numero = args.status === "brouillon" ? null : (await sb.rpc("next_numero", { p_type: "facture" })).data;
  const { data, error } = await sb
    .from("factures")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, numero,
      type: args.type ?? "solde", status: args.status ?? "emise",
      items: ligne(totalHt), remise: null, total_ht: totalHt, total_tva: Math.round(totalHt * 0.2 * 100) / 100, total_ttc: totalTtc,
      nature_operation: "services", due_date: ilYA(args.retardJours),
    })
    .select("*")
    .single();
  if (error) throw new Error(`facture balance : ${error.message}`);
  if (args.regleeDe) {
    const { error: errP } = await sb.from("paiements").insert({ atelier_id: ctx.seed.atelierId, facture_id: data!.id, montant: args.regleeDe, moyen: "virement" });
    if (errP) throw new Error(`paiement balance : ${errP.message}`);
  }
  return data!;
}

type LigneBalance = {
  client_id: string;
  tranche_0_30: number;
  tranche_31_60: number;
  tranche_61_90: number;
  tranche_plus_90: number;
  total_du: number;
};

/** Ligne de `balance_agee()` pour NOTRE client seul — la RPC rend tout l'atelier. */
async function maLigne(client: SupabaseClient) {
  const { data, error } = await client.rpc("balance_agee");
  if (error) return { erreur: error, ligne: null as LigneBalance | null };
  const ligne = ((data as LigneBalance[]) ?? []).find((l) => l.client_id === clientId) ?? null;
  return { erreur: null, ligne };
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Débiteur Lot C3", delai_paiement_jours: 30 })
    .select("id")
    .single();
  if (error) throw new Error(`client C3 : ${error.message}`);
  clientId = data!.id as string;
});

describe("balance_agee() répartit le reste dû par tranche de retard", () => {
  it("une facture non échue n'apparaît pas dans la balance", async () => {
    await creerFacture({ totalHt: 100, retardJours: -10 });
    const { ligne } = await maLigne(sb);
    expect(ligne, "une facture pas encore échue apparaît dans la balance âgée").toBeNull();
  });

  it("répartit quatre factures dans leurs quatre tranches respectives", async () => {
    await creerFacture({ totalHt: 100, retardJours: 15 }); // 0-30
    await creerFacture({ totalHt: 200, retardJours: 45 }); // 31-60
    await creerFacture({ totalHt: 300, retardJours: 75 }); // 61-90
    await creerFacture({ totalHt: 400, retardJours: 120 }); // 90+

    const { erreur, ligne } = await maLigne(sb);
    expect(erreur).toBeNull();
    expect(ligne, "la balance ne rend rien pour un client qui a quatre factures en retard").not.toBeNull();
    expect(nb(ligne!.tranche_0_30)).toBeCloseTo(120, 2); // 100 HT × 1,2
    expect(nb(ligne!.tranche_31_60)).toBeCloseTo(240, 2);
    expect(nb(ligne!.tranche_61_90)).toBeCloseTo(360, 2);
    expect(nb(ligne!.tranche_plus_90)).toBeCloseTo(480, 2);
    expect(nb(ligne!.total_du)).toBeCloseTo(120 + 240 + 360 + 480, 2);
  });

  it("un règlement partiel réduit le reste dû, un règlement total sort la facture de la balance", async () => {
    const avant = (await maLigne(sb)).ligne!;
    const partielle = await creerFacture({ totalHt: 100, retardJours: 20, regleeDe: 60 }); // reste 60 TTC
    const apresPartiel = (await maLigne(sb)).ligne!;
    expect(nb(apresPartiel.total_du)).toBeCloseTo(nb(avant.total_du) + 60, 2);

    // Le solde du règlement, jusqu'au TTC exact : la facture doit disparaître du calcul.
    await sb.from("paiements").insert({ atelier_id: ctx.seed.atelierId, facture_id: partielle.id, montant: nb(partielle.total_ttc) - 60, moyen: "virement" });
    const apresSolde = (await maLigne(sb)).ligne;
    expect(nb(apresSolde?.total_du ?? 0)).toBeCloseTo(nb(avant.total_du), 2);
  });

  it("une facture brouillon, un avoir, ou une facture annulée ne comptent jamais", async () => {
    const avant = (await maLigne(sb)).ligne!;
    await creerFacture({ totalHt: 999, retardJours: 40, status: "brouillon" });
    await creerFacture({ totalHt: 999, retardJours: 40, type: "avoir" });
    const annulee = await creerFacture({ totalHt: 999, retardJours: 40 });
    await sb.from("factures").update({ status: "annulee" }).eq("id", annulee.id);

    const apres = (await maLigne(sb)).ligne!;
    expect(nb(apres.total_du)).toBeCloseTo(nb(avant.total_du), 2);
  });
});

describe("balance_agee() n'est pas ouverte à n'importe qui", () => {
  it("un visiteur anonyme ne peut pas l'appeler", async () => {
    const { error } = await anon.rpc("balance_agee");
    expect(error, "balance_agee() a répondu à un visiteur anonyme").not.toBeNull();
  });
});
