import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";
import { round2 } from "@/lib/utils";

/**
 * Lot C, C7 — non-qualité cohérente entre `projet_revient` et `client_rentabilite`.
 *
 * Avant cette migration, une non-conformité posée sur une FOURNÉE ENTIÈRE (`fournee_id`,
 * `projet_id` NULL — le cas d'un lot mal cuit) n'apparaissait dans AUCUNE des deux vues : chacune
 * « avait l'air correcte » séparément. Ce fichier construit exactement ce cas — deux projets du
 * même client, cuits ensemble dans une fournée, une seule NC posée sur la fournée — et vérifie
 * que le coût se répartit au prorata de la surface, retombe identiquement dans `projet_revient`
 * ET dans `client_rentabilite`, et que la somme des deux projets égale la ligne du client.
 */
const ctx = contexte();
let sb: SupabaseClient;
let clientId: string;
let poudreId: string;
let projetGrandId: string; // 6 m²
let projetPetitId: string; // 4 m²
let fourneeId: string;

async function creerProjetCuit(nom: string, surface: number): Promise<string> {
  const { data, error } = await sb
    .from("projets")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, nom,
      status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "reception",
      surface_m2: surface, couches: 1, poudre_id: poudreId,
      date_reception: "2026-08-01", date_promise: "2026-08-10",
    })
    .select("id")
    .single();
  if (error) throw new Error(`projet ${nom} : ${error.message}`);
  for (let i = 0; i < 4; i++) {
    const { error: errEtape } = await sb.rpc("avancer_etape", { p_projet_id: data!.id });
    if (errEtape) throw new Error(`avancer_etape ${nom} : ${errEtape.message}`);
  }
  return data!.id as string;
}

async function revientDe(projetId: string) {
  const { data, error } = await sb.from("projet_revient").select("*").eq("projet_id", projetId).single();
  if (error) throw new Error(`projet_revient ${projetId} : ${error.message}`);
  return data!;
}

async function nonQualiteDe(projetId: string) {
  const { data, error } = await sb.from("projet_non_qualite").select("*").eq("projet_id", projetId).single();
  if (error) throw new Error(`projet_non_qualite ${projetId} : ${error.message}`);
  return data!;
}

async function ligneClient() {
  const { data, error } = await sb.from("client_rentabilite").select("*").eq("client_id", clientId).single();
  if (error) throw new Error(`client_rentabilite : ${error.message}`);
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);

  const { data: client, error: errClient } = await sb
    .from("clients").insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Métallerie Lot C7" }).select("id").single();
  if (errClient) throw new Error(`client C7 : ${errClient.message}`);
  clientId = client!.id as string;

  const { data: poudre, error: errPoudre } = await sb
    .from("poudres")
    .insert({
      atelier_id: ctx.seed.atelierId, marque: "TestPowder", reference: "TEST-C7-NC", ral: "9006",
      finition: "mat", rendement_m2_kg: 8, stock_kg: 0, temp_cuisson: 200, duree_cuisson_min: 18, actif: true,
    })
    .select("id").single();
  if (errPoudre) throw new Error(`poudre C7 : ${errPoudre.message}`);
  poudreId = poudre!.id as string;
  await sb.from("poudre_couts").upsert({ poudre_id: poudreId, atelier_id: ctx.seed.atelierId, prix_kg: 18 });
  const lot = await sb.rpc("receptionner_lot", {
    p_poudre_id: poudreId, p_numero: "LOT-C7-NC", p_fournisseur: "TestPowder",
    p_quantite_kg: 20, p_prix_kg: 18, p_dlu: "2027-01-31",
  });
  if (lot.error) throw new Error(`receptionner_lot C7 : ${lot.error.message}`);

  projetGrandId = await creerProjetCuit("Garde-corps 6 m²", 6);
  projetPetitId = await creerProjetCuit("Portillon 4 m²", 4);

  const { data: fournee, error: errFournee } = await sb
    .from("fournees")
    .insert({ atelier_id: ctx.seed.atelierId, numero: `F-TEST-C7-${Date.now()}`, statut: "planifiee", poudre_id: poudreId, temp_consigne: 200, duree_min: 18, date_prevue: "2026-08-05" })
    .select("id").single();
  if (errFournee) throw new Error(`fournée C7 : ${errFournee.message}`);
  fourneeId = fournee!.id as string;

  const { error: errCompo } = await sb.from("fournee_projets").insert([
    { atelier_id: ctx.seed.atelierId, fournee_id: fourneeId, projet_id: projetGrandId, surface_m2: 6, position: 0 },
    { atelier_id: ctx.seed.atelierId, fournee_id: fourneeId, projet_id: projetPetitId, surface_m2: 4, position: 1 },
  ]);
  if (errCompo) throw new Error(`fournee_projets C7 : ${errCompo.message}`);
});

describe("une non-conformité posée sur la fournée seule se répartit au prorata de la surface", () => {
  it("sans aucune NC, les deux vues ne comptent aucune non-qualité", async () => {
    const [grand, petit] = await Promise.all([nonQualiteDe(projetGrandId), nonQualiteDe(projetPetitId)]);
    expect(nb(grand.cout_non_qualite)).toBe(0);
    expect(nb(petit.cout_non_qualite)).toBe(0);
  });

  it("100 € de NC sur la fournée se répartissent 60/40, au prorata exact des surfaces (6 et 4 m²)", async () => {
    const { error } = await sb.from("non_conformites").insert({
      atelier_id: ctx.seed.atelierId, fournee_id: fourneeId, projet_id: null,
      defaut: "Cuisson insuffisante sur toute la fournée", cause: "Sonde de four", cout_estime: 100, retouche: true,
    });
    expect(error).toBeNull();

    const [grand, petit] = await Promise.all([nonQualiteDe(projetGrandId), nonQualiteDe(projetPetitId)]);
    expect(nb(grand.cout_non_qualite)).toBeCloseTo(60, 2); // 6/10 × 100
    expect(nb(petit.cout_non_qualite)).toBeCloseTo(40, 2); // 4/10 × 100
    expect(nb(grand.retouches)).toBe(1);
    expect(nb(petit.retouches)).toBe(1);
  });

  it("projet_revient intègre le même montant, après les frais généraux", async () => {
    const [grand, petit] = await Promise.all([revientDe(projetGrandId), revientDe(projetPetitId)]);
    expect(nb(grand.cout_non_qualite)).toBeCloseTo(60, 2);
    expect(nb(petit.cout_non_qualite)).toBeCloseTo(40, 2);

    // revient_total = (poudre + main d'œuvre + énergie) × (1 + frais généraux) + non-qualité —
    // la non-qualité n'est PAS elle-même majorée des frais généraux (ce n'est pas un poste de
    // production que l'atelier a « produit en trop », c'est déjà un coût complet en lui-même).
    const sansNcGrand = round2((nb(grand.cout_poudre) + nb(grand.cout_main_oeuvre) + nb(grand.cout_energie)) * 1.12);
    expect(nb(grand.revient_total)).toBeCloseTo(sansNcGrand + 60, 2);
  });

  it("client_rentabilite additionne exactement les deux projets, non-qualité comprise", async () => {
    const [grand, petit, client] = await Promise.all([revientDe(projetGrandId), revientDe(projetPetitId), ligneClient()]);
    expect(nb(client.revient_total)).toBeCloseTo(nb(grand.revient_total) + nb(petit.revient_total), 2);
    expect(nb(client.cout_non_qualite)).toBeCloseTo(60 + 40, 2);
    expect(nb(client.retouches)).toBe(2);
  });

  it("une NC directe (rattachée à UN SEUL projet) s'ajoute à la part de fournée, sans écraser ni doubler celle-ci", async () => {
    const avant = await nonQualiteDe(projetGrandId);
    const { error } = await sb.from("non_conformites").insert({
      atelier_id: ctx.seed.atelierId, projet_id: projetGrandId, fournee_id: null,
      defaut: "Rayure à la manutention", cause: "Transport", cout_estime: 50, rebut: true,
    });
    expect(error).toBeNull();

    const apres = await nonQualiteDe(projetGrandId);
    expect(nb(apres.cout_non_qualite)).toBeCloseTo(nb(avant.cout_non_qualite) + 50, 2);
    expect(nb(apres.rebuts)).toBe(1);

    // Le petit projet, lui, n'a rien à voir avec cette NC directe : sa part de fournée seule.
    const petit = await nonQualiteDe(projetPetitId);
    expect(nb(petit.cout_non_qualite)).toBeCloseTo(40, 2);

    const client = await ligneClient();
    expect(nb(client.cout_non_qualite)).toBeCloseTo(60 + 50 + 40, 2);
  });
});
