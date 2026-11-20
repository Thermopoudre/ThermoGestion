import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";

/**
 * Lot 2 — rentabilité par client, rendement par teinte, certifications.
 *
 * Le premier bloc de ce fichier n'est pas un test métier : la vue `projet_revient` avait été
 * créée sans `security_invoker`, donc avec les droits de `postgres`, qui ignore RLS. La clé
 * publique du front — celle qui est dans le bundle JavaScript de tout visiteur — suffisait à
 * lire le prix de revient de tous les projets de tous les ateliers. C'est le quatrième verrou
 * de ce projet qui « avait l'air correct » sans rien protéger : il est désormais attaqué depuis
 * l'extérieur à chaque exécution de la suite.
 *
 * Le reste travaille sur un client et une poudre créés ici, et pas sur ceux du semis : les
 * autres fichiers de la suite consomment le même atelier jetable, et des assertions posées sur
 * des objets partagés dépendraient de l'ordre d'exécution.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let clientId: string;
let poudreId: string;
let projetId: string;

const VUES_SENSIBLES = ["projet_revient", "projet_temps_cout", "client_rentabilite", "poudre_rendement"];

/** Ligne cohérente avec `calcTotaux` : un autre test vérifie cet invariant sur TOUS les documents
 *  de l'atelier, un montant posé sans ligne le ferait tomber. */
function ligne(totalHt: number) {
  return [{ libelle: "Laquage", qte: 1, unite: "forfait", pu_ht: totalHt, tva: 20, total_ht: totalHt }];
}

function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42501", "PGRST202", "PGRST205"].includes(error.code ?? "") || /permission denied|does not exist|not find the table/i.test(error.message ?? "");
}

async function ligneClient() {
  const { data, error } = await sb.from("client_rentabilite").select("*").eq("client_id", clientId).single();
  if (error) throw new Error(`client_rentabilite : ${error.message}`);
  return data!;
}

async function ligneTeinte() {
  const { data, error } = await sb.from("poudre_rendement").select("*").eq("poudre_id", poudreId).single();
  if (error) throw new Error(`poudre_rendement : ${error.message}`);
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { data: client, error: errClient } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Industrie Lot2", email: null })
    .select("id")
    .single();
  if (errClient) throw new Error(`client lot 2 : ${errClient.message}`);
  clientId = client!.id;

  const { data: poudre, error: errPoudre } = await sb
    .from("poudres")
    .insert({
      atelier_id: ctx.seed.atelierId, marque: "TestPowder", reference: "TEST-LOT2-RENDEMENT", ral: "6005",
      finition: "mat", rendement_m2_kg: 8, stock_kg: 0, temp_cuisson: 200, duree_cuisson_min: 18, actif: true,
    })
    .select("id")
    .single();
  if (errPoudre) throw new Error(`poudre lot 2 : ${errPoudre.message}`);
  poudreId = poudre!.id;
  const { error: errPrix } = await sb
    .from("poudre_couts")
    .upsert({ poudre_id: poudreId, atelier_id: ctx.seed.atelierId, prix_kg: 20 });
  if (errPrix) throw new Error(`prix poudre lot 2 : ${errPrix.message}`);

  const lot = await sb.rpc("receptionner_lot", {
    p_poudre_id: poudreId, p_numero: "LOT-LOT2", p_fournisseur: "TestPowder",
    p_quantite_kg: 10, p_prix_kg: 20, p_dlu: "2027-01-31",
  });
  if (lot.error) throw new Error(`receptionner_lot : ${lot.error.message}`);

  const { data: projet, error } = await sb
    .from("projets")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, nom: "Garde-corps lot 2",
      status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "reception",
      surface_m2: 8, couches: 1, poudre_id: poudreId,
      date_reception: "2026-08-03", date_promise: "2026-08-10",
    })
    .select("id")
    .single();
  if (error) throw new Error(`projet lot 2 : ${error.message}`);
  projetId = projet!.id;

  // Jusqu'à la cuisson incluse : c'est elle qui pose `poudre_conso_kg` et décompte le lot.
  for (let i = 0; i < 4; i++) await sb.rpc("avancer_etape", { p_projet_id: projetId });
});

describe("les vues de coût ne sont pas lisibles sans être connecté", () => {
  it.each(VUES_SENSIBLES)("%s est refusée à un visiteur anonyme", async (vue) => {
    const { data, error } = await anon.from(vue).select("*");
    // Soit le droit est refusé, soit — au pire — la vue applique RLS et ne rend rien.
    if (!estRefus(error)) {
      expect(error, `${vue} lisible par anon sans erreur`).toBeNull();
      expect(data, `${vue} a laissé fuiter ${data?.length} lignes à un visiteur anonyme`).toHaveLength(0);
    }
  });

  it.each(VUES_SENSIBLES)("%s ne montre à un compte atelier que son propre atelier", async (vue) => {
    const { data, error } = await sb.from(vue).select("atelier_id");
    expect(error).toBeNull();
    const etrangers = (data ?? []).filter((l) => (l as { atelier_id: string }).atelier_id !== ctx.seed.atelierId);
    expect(etrangers, `${vue} expose ${etrangers.length} lignes d'un autre atelier`).toHaveLength(0);
  });
});

describe("rentabilité par client", () => {
  it("le revient du client est la somme du revient de ses projets", async () => {
    const [{ data: revients }, ligne] = await Promise.all([
      sb.from("projet_revient").select("projet_id, revient_total"),
      ligneClient(),
    ]);
    const attendu = (revients ?? []).filter((r) => r.projet_id === projetId).reduce((s, r) => s + nb(r.revient_total), 0);
    expect(attendu).toBeGreaterThan(0);
    expect(nb(ligne.revient_total)).toBeCloseTo(Math.round(attendu * 100) / 100, 2);
    expect(nb(ligne.cout_poudre)).toBeGreaterThan(0);
    expect(nb(ligne.projets)).toBe(1);
  });

  it("un client qui n'a jamais été facturé apparaît quand même, en perte sèche", async () => {
    const ligne = await ligneClient();
    expect(nb(ligne.facture_ht)).toBe(0);
    expect(nb(ligne.marge_eur)).toBeLessThan(0);
    // Sans chiffre d'affaires, un pourcentage de marge n'a aucun sens : mieux vaut ne rien afficher.
    expect(ligne.marge_pct).toBeNull();
  });

  it("le délai accordé et la taille moyenne des séries sont exposés — ce sont les causes du déficit", async () => {
    const ligne = await ligneClient();
    expect(nb(ligne.delai_moyen_jours)).toBe(7); // 03/08 → 10/08
    expect(nb(ligne.surface_moyenne_m2)).toBe(8);
  });

  it("une non-conformité chiffrée pèse sur la marge du client qui l'a provoquée", async () => {
    const avant = await ligneClient();
    const { error } = await sb.from("non_conformites").insert({
      atelier_id: ctx.seed.atelierId, projet_id: projetId, defaut: "Peau d'orange",
      cause: "Application poudre", cout_estime: 68.5, retouche: true,
    });
    expect(error).toBeNull();
    const apres = await ligneClient();
    expect(nb(apres.cout_non_qualite)).toBe(68.5);
    expect(nb(apres.retouches)).toBe(1);
    expect(nb(apres.marge_eur)).toBeCloseTo(nb(avant.marge_eur) - 68.5, 2);
  });

  it("une facture émise remonte le client, un avoir le redescend", async () => {
    const numero = await sb.rpc("next_numero", { p_type: "facture" });
    const { error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, projet_id: projetId,
      numero: numero.data, type: "solde", status: "emise", items: ligne(400), remise: null,
      total_ht: 400, total_tva: 80, total_ttc: 480, nature_operation: "services",
    });
    expect(error).toBeNull();

    const apresFacture = await ligneClient();
    expect(nb(apresFacture.facture_ht)).toBe(400);
    expect(nb(apresFacture.marge_pct)).toBeGreaterThan(0);

    const numeroAvoir = await sb.rpc("next_numero", { p_type: "facture" });
    await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId, projet_id: projetId,
      numero: numeroAvoir.data, type: "avoir", status: "emise", items: ligne(150), remise: null,
      total_ht: 150, total_tva: 30, total_ttc: 180, nature_operation: "services",
    });
    expect(nb((await ligneClient()).facture_ht)).toBe(250);
  });

  it("une facture restée en brouillon ne compte pas", async () => {
    const avant = await ligneClient();
    await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientId,
      numero: null, type: "libre", status: "brouillon", items: ligne(999), remise: null,
      total_ht: 999, total_tva: 199.8, total_ttc: 1198.8, nature_operation: "services",
    });
    expect(nb((await ligneClient()).facture_ht)).toBe(nb(avant.facture_ht));
  });
});

describe("rendement réel contre théorique, par teinte", () => {
  it("sans pesée, aucun taux de perte n'est affiché plutôt qu'un taux inventé", async () => {
    const t = await ligneTeinte();
    expect(nb(t.pesees)).toBe(0);
    expect(t.taux_perte_pct).toBeNull();
    expect(t.rendement_reel_m2_kg).toBeNull();
    // 8 m² ÷ 8 m²/kg = 1 kg décompté à la cuisson.
    expect(nb(t.theorique_kg)).toBeCloseTo(1, 3);
    expect(nb(t.reel_kg)).toBeCloseTo(1, 3);
  });

  it("une pesée qui révèle un manque devient une perte chiffrée et un rendement réel dégradé", async () => {
    const { data: poudre } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).single();
    // L'atelier pèse et trouve 0,25 kg de moins que ce que l'application croyait.
    const { error } = await sb.rpc("mouvement_stock", {
      p_poudre_id: poudreId, p_type: "pesee", p_valeur_kg: nb(poudre!.stock_kg) - 0.25,
      p_projet_id: null, p_note: "Pesée de contrôle", p_lot_numero: null, p_lot_fournisseur: null,
    });
    expect(error).toBeNull();

    const t = await ligneTeinte();
    expect(nb(t.pesees)).toBe(1);
    expect(nb(t.ecart_pesees_kg)).toBeCloseTo(-0.25, 3);
    expect(nb(t.perte_kg)).toBeCloseTo(0.25, 3);
    expect(nb(t.reel_kg)).toBeCloseTo(1.25, 3);
    // 0,25 / 1,25 = 20 % de perte.
    expect(nb(t.taux_perte_pct)).toBeCloseTo(20, 1);
    // 8 m² pour 1,25 kg réellement partis = 6,4 m²/kg au lieu des 8 annoncés.
    expect(nb(t.rendement_reel_m2_kg)).toBeCloseTo(6.4, 2);
    expect(nb(t.rendement_theorique_m2_kg)).toBe(8);
    expect(nb(t.valeur_perte_eur)).toBeCloseTo(5, 2); // 0,25 kg × 20 €/kg
  });
});

describe("certifications de l'atelier", () => {
  it("se créent, se lisent, et ne sont pas lisibles par un visiteur anonyme", async () => {
    const { data, error } = await sb
      .from("certifications")
      .insert({ atelier_id: ctx.seed.atelierId, label: "Qualicoat", organisme: "AFNOR Certification", numero: "QC-TEST-01", obtenue_le: "2026-01-15", expire_le: "2027-01-14" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();

    const lecture = await anon.from("certifications").select("id");
    if (!estRefus(lecture.error)) expect(lecture.data).toHaveLength(0);
  });

  it("ne peut pas être posée dans un autre atelier", async () => {
    const { error } = await sb.from("certifications").insert({
      atelier_id: "00000000-0000-0000-0000-000000000000", label: "Qualicoat",
    });
    expect(error).not.toBeNull();
  });
});
