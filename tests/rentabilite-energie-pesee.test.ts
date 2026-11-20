import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";
import { coutFournee, SEUIL_REMPLISSAGE_ALERTE_PCT, surfaceEmbarquee } from "@/lib/energie";

/**
 * Trois points laissés ouverts par la recette du lot 2, refermés ici :
 *
 *  1. le coût énergétique restait au niveau du projet : la fiche de cuisson affichait des kWh
 *     et jamais leur valeur, alors que `ateliers.prix_kwh` existait déjà ;
 *  2. un chantier livré et pas encore facturé ressemblait à une perte sèche sur l'écran de
 *     rentabilité — exact, mais illisible ;
 *  3. le taux de perte par teinte n'existe pas sans pesée, et rien ne le disait.
 *
 * La vue `client_rentabilite` ayant été modifiée (migration 23), elle est de nouveau attaquée
 * depuis un client PostgREST **anonyme** — celui du bundle JavaScript de tout visiteur — et
 * depuis un compte atelier réel : c'est cette vue qui avait laissé fuiter le prix de revient de
 * tous les ateliers, et une colonne ajoutée ne doit pas rouvrir la porte.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;

/** Client dont le travail est fait mais dont la facture n'est pas partie. */
let clientAttenteId: string;
/** Client entièrement facturé, mais facturé sous son prix de revient. */
let clientPerteId: string;
let projetAttenteId: string;
let projetPerteId: string;
let blAttenteId: string;

/** Teinte dédiée à la pesée : la vue agrège par poudre, une teinte partagée fausserait tout. */
let poudrePeseeId: string;
/** Teinte et projets dédiés à la fournée chiffrée. */
let poudreFourId: string;
let fourneeId: string;

function ligneDoc(totalHt: number, libelle = "Thermolaquage") {
  return [{ libelle, qte: 1, unite: "forfait", pu_ht: totalHt, tva: 20, total_ht: totalHt }];
}

async function ligneClient(id: string) {
  const { data, error } = await sb.from("client_rentabilite").select("*").eq("client_id", id).single();
  if (error) throw new Error(`client_rentabilite : ${error.message}`);
  return data!;
}

async function creerClient(nom: string): Promise<string> {
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom, email: null })
    .select("id")
    .single();
  if (error) throw new Error(`client « ${nom} » : ${error.message}`);
  return data!.id;
}

async function creerPoudre(reference: string): Promise<string> {
  const { data, error } = await sb
    .from("poudres")
    .insert({
      atelier_id: ctx.seed.atelierId, marque: "TestPowder", reference, ral: "9010",
      finition: "mat", rendement_m2_kg: 8, stock_kg: 0,
      temp_cuisson: 190, duree_cuisson_min: 20, actif: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`poudre ${reference} : ${error.message}`);
  const { error: errPrix } = await sb
    .from("poudre_couts")
    .upsert({ poudre_id: data!.id, atelier_id: ctx.seed.atelierId, prix_kg: 15 });
  if (errPrix) throw new Error(`prix poudre ${reference} : ${errPrix.message}`);
  const lot = await sb.rpc("receptionner_lot", {
    p_poudre_id: data!.id, p_numero: `LOT-${reference}`, p_fournisseur: "TestPowder",
    p_quantite_kg: 25, p_prix_kg: 15, p_dlu: "2027-06-30",
  });
  if (lot.error) throw new Error(`receptionner_lot ${reference} : ${lot.error.message}`);
  return data!.id;
}

/** Crée un projet et le fait avancer jusqu'à la cuisson incluse — c'est elle qui pose
 *  `poudre_conso_kg` et décompte le lot, donc qui donne un prix de revient au projet. */
async function creerProjetCuit(args: { clientId: string; nom: string; surface: number; poudreId: string }): Promise<string> {
  const { data, error } = await sb
    .from("projets")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: args.clientId, nom: args.nom,
      status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "reception",
      surface_m2: args.surface, couches: 1, poudre_id: args.poudreId,
      date_reception: "2026-08-01", date_promise: "2026-08-12",
    })
    .select("id")
    .single();
  if (error) throw new Error(`projet ${args.nom} : ${error.message}`);
  for (let i = 0; i < 4; i++) {
    const { error: errEtape } = await sb.rpc("avancer_etape", { p_projet_id: data!.id });
    if (errEtape) throw new Error(`avancer_etape ${args.nom} : ${errEtape.message}`);
  }
  return data!.id;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  poudrePeseeId = await creerPoudre("TEST-PESEE-EXACTE");
  poudreFourId = await creerPoudre("TEST-FOURNEE-COUT");

  clientAttenteId = await creerClient("Serrurerie En Attente");
  clientPerteId = await creerClient("Ferronnerie Vendue Trop Bas");

  projetAttenteId = await creerProjetCuit({ clientId: clientAttenteId, nom: "Portail en attente de facture", surface: 6, poudreId: poudrePeseeId });
  projetPerteId = await creerProjetCuit({ clientId: clientPerteId, nom: "Garde-corps bradé", surface: 4, poudreId: poudreFourId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Coût énergétique par fournée
// ─────────────────────────────────────────────────────────────────────────────

describe("coût énergétique d'une fournée", () => {
  it("n'affiche aucun euro tant que le prix du kWh n'est pas renseigné", () => {
    const c = coutFournee({ consoKwh: 18, prixKwh: null, surfaceM2: 6, capaciteM2: 9 });
    expect(c.manque).toBe("prix_kwh");
    expect(c.coutEur).toBeNull();
    expect(c.coutM2Eur).toBeNull();
    expect(c.surcoutVideEur).toBeNull();
    // Le remplissage, lui, ne dépend pas du prix : il reste calculé et affichable.
    expect(c.tauxRemplissagePct).toBe(67);
  });

  it("traite un prix du kWh à zéro comme non renseigné plutôt que de chiffrer 0 €", () => {
    // Un zéro laissé dans le formulaire produirait « 0,00 € » — parfaitement crédible et faux.
    expect(coutFournee({ consoKwh: 18, prixKwh: 0, surfaceM2: 6, capaciteM2: 9 }).manque).toBe("prix_kwh");
    expect(coutFournee({ consoKwh: 18, prixKwh: -0.2, surfaceM2: 6, capaciteM2: 9 }).coutEur).toBeNull();
  });

  it("n'affiche aucun euro sur une fournée dont la consommation n'a pas été relevée", () => {
    const c = coutFournee({ consoKwh: null, prixKwh: 0.19, surfaceM2: 6, capaciteM2: 9 });
    expect(c.manque).toBe("conso_kwh");
    expect(c.coutEur).toBeNull();
  });

  it("chiffre le cycle et le ramène au m² embarqué", () => {
    const c = coutFournee({ consoKwh: 18, prixKwh: 0.19, surfaceM2: 6, capaciteM2: 9 });
    expect(c.manque).toBeNull();
    expect(c.coutEur).toBeCloseTo(3.42, 2); // 18 × 0,19
    expect(c.coutM2Eur).toBeCloseTo(0.57, 2); // 3,42 / 6
    expect(c.coutM2PleinEur).toBeCloseTo(0.38, 2); // 3,42 / 9
    expect(c.fourneeCreuse).toBe(false);
  });

  it("fait sauter aux yeux la fournée lancée à moitié vide, et chiffre la chauffe payée pour du vide", () => {
    const c = coutFournee({ consoKwh: 18, prixKwh: 0.19, surfaceM2: 3, capaciteM2: 9 });
    expect(c.tauxRemplissagePct).toBe(33);
    expect(c.tauxRemplissagePct!).toBeLessThan(SEUIL_REMPLISSAGE_ALERTE_PCT);
    expect(c.fourneeCreuse).toBe(true);
    expect(c.coutM2Eur).toBeCloseTo(1.14, 2); // 3,42 / 3 — trois fois le coût à four plein
    expect(c.surcoutVideEur).toBeCloseTo(2.28, 2); // 3,42 × (1 − 3/9)
  });

  it("ne transforme jamais un four qui déborde en gain", () => {
    // Au-delà de 100 % de remplissage, la part de vide est nulle, pas négative : un surcoût
    // négatif se lirait comme une économie.
    const c = coutFournee({ consoKwh: 18, prixKwh: 0.19, surfaceM2: 12, capaciteM2: 9 });
    expect(c.tauxRemplissagePct).toBe(133);
    expect(c.surcoutVideEur).toBe(0);
    expect(c.fourneeCreuse).toBe(false);
  });

  it("sans capacité de four paramétrée, chiffre le coût mais ne prétend rien sur le remplissage", () => {
    const c = coutFournee({ consoKwh: 18, prixKwh: 0.19, surfaceM2: 6, capaciteM2: null });
    expect(c.coutEur).toBeCloseTo(3.42, 2);
    expect(c.coutM2Eur).toBeCloseTo(0.57, 2);
    expect(c.tauxRemplissagePct).toBeNull();
    expect(c.coutM2PleinEur).toBeNull();
    expect(c.surcoutVideEur).toBeNull();
    expect(c.fourneeCreuse).toBe(false);
  });

  it("ne calcule pas de coût au m² sur une fournée sans surface saisie", () => {
    const c = coutFournee({ consoKwh: 18, prixKwh: 0.19, surfaceM2: 0, capaciteM2: 9 });
    expect(c.coutEur).toBeCloseTo(3.42, 2);
    expect(c.coutM2Eur).toBeNull();
  });

  it("le réglage a un effet réel : une fournée en base retombe sur le prix du kWh de l'atelier", async () => {
    // C'est le point qui manquait : `prix_kwh` était un réglage affiché sans effet au niveau de
    // la fournée. On le rejoue de bout en bout, avec les vraies colonnes.
    const numero = `F-TEST-${Date.now()}`;
    const { data: fournee, error } = await sb
      .from("fournees")
      .insert({
        atelier_id: ctx.seed.atelierId, numero, statut: "planifiee",
        poudre_id: poudreFourId, temp_consigne: 190, duree_min: 20,
        date_prevue: "2026-08-14",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    fourneeId = fournee!.id;

    const { error: errCompo } = await sb.from("fournee_projets").insert({
      atelier_id: ctx.seed.atelierId, fournee_id: fourneeId, projet_id: projetPerteId,
      surface_m2: 4, position: 0,
    });
    expect(errCompo).toBeNull();

    const { error: errClot } = await sb
      .from("fournees")
      .update({ statut: "terminee", terminee_at: new Date().toISOString(), temp_relevee: 191, conso_kwh: 18 })
      .eq("id", fourneeId);
    expect(errClot).toBeNull();

    const [{ data: f }, { data: compo }, { data: atelier }] = await Promise.all([
      sb.from("fournees").select("conso_kwh").eq("id", fourneeId).single(),
      sb.from("fournee_projets").select("surface_m2").eq("fournee_id", fourneeId),
      sb.from("ateliers").select("prix_kwh, four_capacite_m2").eq("id", ctx.seed.atelierId).single(),
    ]);

    const surface = surfaceEmbarquee((compo ?? []) as { surface_m2: number | null }[]);
    expect(surface).toBe(4);

    const c = coutFournee({
      consoKwh: f!.conso_kwh,
      prixKwh: atelier!.prix_kwh,
      surfaceM2: surface,
      capaciteM2: atelier!.four_capacite_m2,
    });
    expect(nb(atelier!.prix_kwh)).toBe(0.19);
    expect(c.coutEur).toBeCloseTo(3.42, 2);
    expect(c.coutM2Eur).toBeCloseTo(0.855, 3); // 3,42 / 4 m²
    expect(c.tauxRemplissagePct).toBe(44); // four de 9 m²
    expect(c.fourneeCreuse).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Reste à facturer contre perte réelle
// ─────────────────────────────────────────────────────────────────────────────

describe("un chantier livré non facturé n'est pas une perte", () => {
  it("avant toute facture, le client est négatif mais n'est pas déclaré en perte réelle", async () => {
    const l = await ligneClient(clientAttenteId);
    expect(nb(l.facture_ht)).toBe(0);
    expect(nb(l.marge_eur)).toBeLessThan(0);
    // Le revient engagé sur du travail pas encore facturé explique, à l'euro près, le négatif.
    expect(nb(l.projets_non_factures)).toBe(1);
    expect(nb(l.revient_non_facture)).toBeCloseTo(nb(l.revient_total), 2);
    expect(l.perte_reelle).toBe(false);
  });

  it("un bon de livraison livré et non facturé devient un montant exact à côté de la marge", async () => {
    const numero = await sb.rpc("next_numero", { p_type: "bl" });
    const { data: bl, error } = await sb
      .from("bons_livraison")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientAttenteId, projet_id: projetAttenteId,
        numero: numero.data, status: "livre", lignes: ligneDoc(180), remise: null,
        livre_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    blAttenteId = bl!.id;

    const l = await ligneClient(clientAttenteId);
    expect(nb(l.reste_a_facturer)).toBe(180);
    expect(nb(l.bl_a_facturer)).toBe(1);
    expect(l.perte_reelle).toBe(false);
  });

  it("la remise du bon de livraison est déduite, comme le ferait la facture récapitulative", async () => {
    // Sans ça, l'écran annoncerait 180 € à encaisser là où la facture n'en portera que 162.
    const { error } = await sb
      .from("bons_livraison")
      .update({ remise: { type: "pct", valeur: 10 } })
      .eq("id", blAttenteId);
    expect(error).toBeNull();
    expect(nb((await ligneClient(clientAttenteId)).reste_a_facturer)).toBe(162);
  });

  it("un bon de livraison encore en brouillon ne compte pas dans ce qui attend une facture", async () => {
    const avant = nb((await ligneClient(clientAttenteId)).reste_a_facturer);
    const { error } = await sb.from("bons_livraison").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientAttenteId, projet_id: null,
      numero: null, status: "brouillon", lignes: ligneDoc(999), remise: null,
    });
    expect(error).toBeNull();
    expect(nb((await ligneClient(clientAttenteId)).reste_a_facturer)).toBe(avant);
  });

  it("une fois le bon de livraison rattaché à une facture, il sort du reste à facturer", async () => {
    const numeroFacture = await sb.rpc("next_numero", { p_type: "facture" });
    const { data: facture, error: errFacture } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: clientAttenteId,
        numero: numeroFacture.data, type: "libre", status: "emise", items: ligneDoc(162), remise: null,
        total_ht: 162, total_tva: 32.4, total_ttc: 194.4, nature_operation: "services",
      })
      .select("id")
      .single();
    expect(errFacture).toBeNull();

    const { error } = await sb
      .from("bons_livraison")
      .update({ facture_id: facture!.id, status: "facture" })
      .eq("id", blAttenteId);
    expect(error).toBeNull();

    const l = await ligneClient(clientAttenteId);
    expect(nb(l.reste_a_facturer)).toBe(0);
    expect(nb(l.bl_a_facturer)).toBe(0);
    // Le projet est désormais rattaché à une facture par son BL : il n'attend plus rien.
    expect(nb(l.projets_non_factures)).toBe(0);
    expect(nb(l.facture_ht)).toBe(162);
  });

  it("un client entièrement facturé sous son prix de revient est, lui, une perte réelle", async () => {
    const numero = await sb.rpc("next_numero", { p_type: "facture" });
    const { error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientPerteId, projet_id: projetPerteId,
      numero: numero.data, type: "solde", status: "emise", items: ligneDoc(5), remise: null,
      total_ht: 5, total_tva: 1, total_ttc: 6, nature_operation: "services",
    });
    expect(error).toBeNull();

    const l = await ligneClient(clientPerteId);
    expect(nb(l.facture_ht)).toBe(5);
    expect(nb(l.projets_non_factures)).toBe(0);
    expect(nb(l.reste_a_facturer)).toBe(0);
    expect(nb(l.marge_eur)).toBeLessThan(0);
    // Rien n'attend d'être facturé et le facturé reste sous le revient : c'est le seul cas où
    // l'écran surligne en rouge.
    expect(l.perte_reelle).toBe(true);
  });

  it("une facture d'acompte ne solde pas un chantier : le reste est bien encore à facturer", async () => {
    const clientAcompteId = await creerClient("Menuiserie Acompte Seul");
    const projetId = await creerProjetCuit({ clientId: clientAcompteId, nom: "Véranda acompte", surface: 3, poudreId: poudreFourId });
    const numero = await sb.rpc("next_numero", { p_type: "facture" });
    const { error } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: clientAcompteId, projet_id: projetId,
      numero: numero.data, type: "acompte", status: "emise", items: ligneDoc(60), remise: null,
      total_ht: 60, total_tva: 12, total_ttc: 72, nature_operation: "services",
    });
    expect(error).toBeNull();

    const l = await ligneClient(clientAcompteId);
    expect(nb(l.facture_ht)).toBe(60);
    expect(nb(l.projets_non_factures)).toBe(1);
    expect(l.perte_reelle).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Discipline de pesée
// ─────────────────────────────────────────────────────────────────────────────

describe("rendement par teinte : la pesée est la seule mesure réelle", () => {
  it("sans pesée, la teinte n'affiche aucun taux — mais le kilo théorique, lui, est connu", async () => {
    const { data, error } = await sb.from("poudre_rendement").select("*").eq("poudre_id", poudrePeseeId).single();
    expect(error).toBeNull();
    expect(nb(data!.pesees)).toBe(0);
    expect(data!.taux_perte_pct).toBeNull();
    expect(data!.rendement_reel_m2_kg).toBeNull();
    // 6 m² ÷ 8 m²/kg = 0,75 kg décomptés à la cuisson : c'est ce chiffre-là qui n'est contrôlé
    // par personne tant que la teinte n'est pas passée sur une balance.
    expect(nb(data!.theorique_kg)).toBeCloseTo(0.75, 3);
    expect(nb(data!.surface_m2)).toBeCloseTo(6, 2);
  });

  it("une pesée qui tombe pile reste une mesure : 0 % de perte, et non « pesée nécessaire »", async () => {
    // Régression : l'écran /stock/<id> se déclenchait sur la **somme des écarts** et non sur le
    // nombre de pesées. Une pesée sans écart le faisait disparaître, alors que Pilotage →
    // Rendement teintes affichait bien 0 %. Deux écrans, deux réponses, la même donnée.
    const { data: poudre } = await sb.from("poudres").select("stock_kg").eq("id", poudrePeseeId).single();
    const { error } = await sb.rpc("mouvement_stock", {
      p_poudre_id: poudrePeseeId, p_type: "pesee", p_valeur_kg: nb(poudre!.stock_kg),
      p_projet_id: null, p_note: "Pesée de contrôle sans écart", p_lot_numero: null, p_lot_fournisseur: null,
    });
    expect(error).toBeNull();

    const { data } = await sb.from("poudre_rendement").select("*").eq("poudre_id", poudrePeseeId).single();
    expect(nb(data!.pesees)).toBe(1);
    expect(nb(data!.ecart_pesees_kg)).toBeCloseTo(0, 3);
    expect(data!.taux_perte_pct).not.toBeNull();
    expect(nb(data!.taux_perte_pct)).toBeCloseTo(0, 1);
    // Rendement réel = rendement annoncé : la teinte tient exactement sa promesse.
    expect(nb(data!.rendement_reel_m2_kg)).toBeCloseTo(8, 2);
    expect(nb(data!.valeur_perte_eur)).toBeCloseTo(0, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La vue modifiée est de nouveau attaquée
// ─────────────────────────────────────────────────────────────────────────────

function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42501", "PGRST202", "PGRST205"].includes(error.code ?? "")
    || /permission denied|does not exist|not find the table/i.test(error.message ?? "");
}

const COLONNES_SENSIBLES = ["revient_total", "marge_eur", "reste_a_facturer", "revient_non_facture"];

describe("client_rentabilite après modification : la fuite reste fermée", () => {
  it("est refusée à un visiteur anonyme, colonnes ajoutées comprises", async () => {
    const { data, error } = await anon.from("client_rentabilite").select(COLONNES_SENSIBLES.join(","));
    if (!estRefus(error)) {
      expect(error, "client_rentabilite lisible par anon sans erreur").toBeNull();
      expect(data, `client_rentabilite a laissé fuiter ${data?.length} lignes à un visiteur anonyme`).toHaveLength(0);
    }
  });

  it("n'est pas non plus lisible en la nommant explicitement colonne par colonne", async () => {
    for (const colonne of COLONNES_SENSIBLES) {
      const { data, error } = await anon.from("client_rentabilite").select(colonne).limit(1);
      if (!estRefus(error)) expect(data, `colonne ${colonne} lisible par anon`).toHaveLength(0);
    }
  });

  it("ne montre à un compte atelier aucune ligne d'un autre atelier", async () => {
    const { data, error } = await sb.from("client_rentabilite").select("atelier_id, reste_a_facturer");
    expect(error).toBeNull();
    const etrangers = (data ?? []).filter((l) => (l as { atelier_id: string }).atelier_id !== ctx.seed.atelierId);
    expect(etrangers, `client_rentabilite expose ${etrangers.length} lignes d'un autre atelier`).toHaveLength(0);
  });

  /**
   * ⚠ LIMITE MESURÉE DE CETTE ATTAQUE, à ne pas oublier en relisant ce fichier.
   *
   * Le test ci-dessus **ne détecte pas** la perte de `security_invoker` sur CETTE vue. Vérifié
   * en production sur deux vues sondes : une vue nue sans l'option rend 8 lignes de 2 ateliers à
   * un compte authentifié qui n'appartient à aucun des deux ; la même vue augmentée du
   * `where capacite_ouverte(atelier_id, 'rentabilite')` de `client_rentabilite` en rend 0.
   * La raison : `plan_effectif`, appelée par `capacite_ouverte`, est SECURITY INVOKER et lit
   * `subscriptions` sous RLS — pour un atelier étranger elle ne voit rien, retombe sur la formule
   * d'entrée, et la clause filtre la ligne. La clause de formule masque donc la fuite.
   *
   * Ce qui protège réellement ici, dans cet ordre : (1) le GRANT — `anon` n'a aucun droit,
   * `authenticated` n'a que SELECT ; (2) `security_invoker = true` ; (3) l'advisor Supabase
   * `security_definer_view`, qui est le seul détecteur fiable et qui a effectivement rattrapé
   * la perte de l'option provoquée par un `CREATE OR REPLACE VIEW` nu (migration 23c → 23d).
   *
   * Le test qui suit reste utile : il tombe dès que la clause de formule cesse de masquer.
   */
  it("ne rend jamais plus de clients que n'en montre la table `clients` sous RLS", async () => {
    const [vue, base] = await Promise.all([
      sb.from("client_rentabilite").select("client_id"),
      sb.from("clients").select("id"),
    ]);
    expect(vue.error).toBeNull();
    expect(base.error).toBeNull();
    const visibles = new Set((base.data ?? []).map((c) => (c as { id: string }).id));
    const inconnus = (vue.data ?? []).filter((l) => !visibles.has((l as { client_id: string }).client_id));
    expect(inconnus, `${inconnus.length} clients rendus par la vue sont invisibles dans la table`).toHaveLength(0);
  });

  it("n'est pas modifiable par un compte atelier : c'est une vue de lecture", async () => {
    const { error } = await sb
      .from("client_rentabilite")
      .update({ reste_a_facturer: 0 })
      .eq("client_id", clientAttenteId);
    expect(error, "client_rentabilite accepte une écriture").not.toBeNull();
  });
});
