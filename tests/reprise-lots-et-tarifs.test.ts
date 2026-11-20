import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, contexte, nb } from "./helpers/contexte";
import { estRefus } from "./helpers/refus";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";

/**
 * Lots A3 et A4 — reprendre le stock détaillé, les tarifs négociés et la grille au m².
 *
 * A3 se joue autour d'un piège précis. `receptionner_lot()` compense l'écart entre le stock de la
 * fiche poudre et la somme de ses lots par un lot fantôme « STOCK-INITIAL » : c'est le bon geste
 * au quotidien, et le mauvais à la reprise. L'atelier importe d'abord ses poudres AVEC leur stock
 * (380 kg), puis ses 9 lots : sans précaution, le premier lot fabriquerait un STOCK-INITIAL de
 * 380 kg en face des 380 kg réels, et l'atelier démarrerait avec le double de son stock.
 */

let jetable: AtelierJetable;
let sb: SupabaseClient;
let bureau: SupabaseClient;
let poudreId = "";
let poudreTemoinId = "";
let clientId = "";
let prestationId = "";
let grilleId = "";

/** Le stock que l'atelier a déclaré sur sa fiche poudre, avant de détailler ses lots. */
const STOCK_DECLARE = 380;

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lotA-stock");
  sb = jetable.sb;
  bureau = await jetable.inviter("bureau");
  const a = jetable.atelierId;

  const poudres = await sb
    .from("poudres")
    .insert([
      { atelier_id: a, marque: "TestPowder", reference: "REPRISE-RAL9010", ral: "9010", finition: "mat", rendement_m2_kg: 8, stock_kg: STOCK_DECLARE, actif: true },
      { atelier_id: a, marque: "TestPowder", reference: "REPRISE-RAL7016", ral: "7016", finition: "texture", rendement_m2_kg: 7, stock_kg: STOCK_DECLARE, actif: true },
    ])
    .select("id, reference");
  if (poudres.error) throw new Error(`poudres : ${poudres.error.message}`);
  const liste = poudres.data as { id: string; reference: string }[];
  poudreId = liste.find((p) => p.reference === "REPRISE-RAL9010")!.id;
  poudreTemoinId = liste.find((p) => p.reference === "REPRISE-RAL7016")!.id;

  const cli = await sb
    .from("clients")
    .insert({ atelier_id: a, type: "pro", nom: "Menuiserie Tarifelle", siren: "812345678" })
    .select("id")
    .single();
  if (cli.error) throw new Error(`client : ${cli.error.message}`);
  clientId = (cli.data as { id: string }).id;

  const pres = await sb
    .from("prestations")
    .insert({ atelier_id: a, code: "SAB", nom: "Sablage", unite: "piece", prix_unitaire_ht: 9, tva_rate: 20, ordre: 1, actif: true })
    .select("id")
    .single();
  if (pres.error) throw new Error(`prestation : ${pres.error.message}`);
  prestationId = (pres.data as { id: string }).id;

  const gr = await sb
    .from("grilles_tarifaires")
    .insert({ atelier_id: a, nom: "Grille standard", is_default: true, forfait_minimum: 50 })
    .select("id")
    .single();
  if (gr.error) throw new Error(`grille : ${gr.error.message}`);
  grilleId = (gr.data as { id: string }).id;
}, 120_000);

afterAll(async () => {
  if (jetable) await jetable.fermer();
});

describe("A3 — les lots de poudre", () => {
  it("importer_lot_poudre n'est pas ouverte à un visiteur anonyme", async () => {
    const anon = clientAnonyme(contexte());
    const { error } = await anon.rpc("importer_lot_poudre", {
      p_poudre_id: poudreId, p_numero: "PIRATE", p_fournisseur: null,
      p_quantite_kg: 99, p_restant_kg: 99, p_dlu: null, p_recu_le: null, p_prix_kg: null,
    });
    expect(estRefus(error), `importer_lot_poudre ouverte à anon : ${JSON.stringify(error)}`).toBe(true);
    const { data } = await sb.from("poudre_lots").select("id").eq("numero", "PIRATE");
    expect(data).toHaveLength(0);
  });

  /**
   * Régression trouvée à la recette de la vague 1 : la fonction était ouverte à tout membre de
   * l'atelier, alors que ses deux sœurs de reprise exigent le responsable. Ce n'est pas le lot
   * qui pose problème — la RLS de `poudre_lots` laisse déjà le bureau en écrire un — c'est le
   * réalignement de `poudres.stock_kg` sur la somme des lots, que cette fonction fait sans écrire
   * de mouvement d'ajustement : un écart d'inventaire s'effaçait alors sans laisser de trace dans
   * `stock_mouvements`, table que la RLS interdit précisément d'écrire en direct.
   */
  it("le bureau ne reprend pas le stock : la reprise réaligne le stock sans mouvement tracé", async () => {
    const avant = await sb.from("poudres").select("stock_kg").eq("id", poudreTemoinId).single();

    const { error } = await bureau.rpc("importer_lot_poudre", {
      p_poudre_id: poudreTemoinId, p_numero: "BUREAU-LOT-1", p_fournisseur: null,
      p_quantite_kg: 40, p_restant_kg: 40, p_dlu: null, p_recu_le: null, p_prix_kg: null,
    });
    expect(error, "un compte bureau a pu reprendre le stock").not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_RESERVEE_PROPRIETAIRE/);

    // Un refus qui aurait quand même écrit serait pire qu'une absence de refus : ni lot créé, ni
    // stock déclaré déplacé au passage.
    const { data } = await sb.from("poudre_lots").select("id").eq("numero", "BUREAU-LOT-1");
    expect(data).toHaveLength(0);
    const apres = await sb.from("poudres").select("stock_kg").eq("id", poudreTemoinId).single();
    expect(nb((apres.data as { stock_kg: number }).stock_kg)).toBe(nb((avant.data as { stock_kg: number }).stock_kg));
  });

  it("le stock détaillé remplace le stock déclaré, il ne s'y ajoute pas", async () => {
    const lots = [
      { numero: "L-2026-001", quantite: 200, reste: 120, dlu: "2027-03-31", recu: "2026-02-10" },
      { numero: "L-2026-002", quantite: 200, reste: 180, dlu: "2027-06-30", recu: "2026-05-04" },
    ];
    for (const l of lots) {
      const { error } = await sb.rpc("importer_lot_poudre", {
        p_poudre_id: poudreId, p_numero: l.numero, p_fournisseur: "TestPowder",
        p_quantite_kg: l.quantite, p_restant_kg: l.reste, p_dlu: l.dlu, p_recu_le: l.recu, p_prix_kg: 15.9,
      });
      expect(error, `import du lot ${l.numero} : ${error?.message}`).toBeNull();
    }

    const { data } = await sb
      .from("poudre_lots")
      .select("numero, quantite_kg, restant_kg, dlu, recu_le, fournisseur")
      .eq("poudre_id", poudreId)
      .order("numero");
    const enBase = (data ?? []) as { numero: string; quantite_kg: number; restant_kg: number; dlu: string; recu_le: string; fournisseur: string }[];

    // LE point du chantier : aucun lot fantôme n'a été fabriqué en face du stock déclaré.
    expect(
      enBase.map((l) => l.numero),
      "un lot STOCK-INITIAL a été créé : l'atelier démarrerait avec le double de son stock",
    ).toEqual(["L-2026-001", "L-2026-002"]);

    expect(nb(enBase[0].restant_kg)).toBe(120);
    expect(nb(enBase[0].quantite_kg)).toBe(200);
    // La DLU et la date de réception d'origine, sans quoi l'alerte de péremption et le FIFO
    // repartiraient tous les deux du jour de l'installation.
    expect(enBase[0].dlu).toBe("2027-03-31");
    expect(enBase[0].recu_le).toBe("2026-02-10");
    expect(enBase[0].fournisseur).toBe("TestPowder");

    const { data: p } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).single();
    expect(nb((p as { stock_kg: number }).stock_kg)).toBe(300);
  });

  it("le mouvement de stock tracé porte la photo d'après l'ajustement du reste", async () => {
    const { data } = await sb
      .from("stock_mouvements")
      .select("type, delta_kg, stock_apres_kg, lot_numero, dlu")
      .eq("poudre_id", poudreId)
      .order("lot_numero");
    const mouvements = (data ?? []) as { type: string; stock_apres_kg: number; lot_numero: string }[];
    expect(mouvements.map((m) => m.lot_numero)).toEqual(["L-2026-001", "L-2026-002"]);
    expect(mouvements.every((m) => m.type === "reception")).toBe(true);
    expect(nb(mouvements[1].stock_apres_kg)).toBe(300);
  });

  it("témoin : la réception ordinaire, elle, fabrique bien le lot de rattrapage", async () => {
    /**
     * Ce test n'éprouve pas un défaut : il documente pourquoi `importer_lot_poudre` existe. La
     * réception du quotidien DOIT rattraper le stock non détaillé — un atelier qui commence à
     * tracer ses lots ne doit pas perdre ce qu'il avait déjà. C'est le même geste qui, à la
     * reprise, doublerait le stock.
     */
    const { error } = await sb.rpc("receptionner_lot", {
      p_poudre_id: poudreTemoinId, p_numero: "L-QUOTIDIEN-1", p_fournisseur: "TestPowder",
      p_quantite_kg: 20, p_prix_kg: 15.9, p_dlu: "2027-12-31",
    });
    expect(error, `receptionner_lot : ${error?.message}`).toBeNull();

    const { data } = await sb.from("poudre_lots").select("numero, restant_kg").eq("poudre_id", poudreTemoinId).order("numero");
    const lots = (data ?? []) as { numero: string; restant_kg: number }[];
    expect(lots.map((l) => l.numero)).toEqual(["L-QUOTIDIEN-1", "STOCK-INITIAL"]);
    expect(nb(lots.find((l) => l.numero === "STOCK-INITIAL")!.restant_kg)).toBe(STOCK_DECLARE);
  });

  it("une poudre inconnue est refusée, et non créée au passage", async () => {
    const { error } = await sb.rpc("importer_lot_poudre", {
      p_poudre_id: "00000000-0000-0000-0000-000000000000", p_numero: "L-ORPHELIN",
      p_fournisseur: null, p_quantite_kg: 10, p_restant_kg: 10, p_dlu: null, p_recu_le: null, p_prix_kg: null,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/LOT_POUDRE_INCONNUE/);
    const { data } = await sb.from("poudre_lots").select("id").eq("numero", "L-ORPHELIN");
    expect(data).toHaveLength(0);
  });

  it("un reste supérieur à la quantité reçue est refusé, et le stock ne bouge pas", async () => {
    const { data: avant } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).single();
    const { error } = await sb.rpc("importer_lot_poudre", {
      p_poudre_id: poudreId, p_numero: "L-IMPOSSIBLE", p_fournisseur: null,
      p_quantite_kg: 10, p_restant_kg: 40, p_dlu: null, p_recu_le: null, p_prix_kg: null,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/LOT_RESTANT_INVALIDE/);
    const { data: apres } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).single();
    expect(nb((apres as { stock_kg: number }).stock_kg)).toBe(nb((avant as { stock_kg: number }).stock_kg));
  });

  it("une réception datée de demain est refusée", async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { error } = await sb.rpc("importer_lot_poudre", {
      p_poudre_id: poudreId, p_numero: "L-DEMAIN", p_fournisseur: null,
      p_quantite_kg: 10, p_restant_kg: 10, p_dlu: null, p_recu_le: demain, p_prix_kg: null,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/LOT_RECEPTION_FUTURE/);
  });
});

describe("A4 — tarifs négociés et grille au m²", () => {
  it("un tarif négocié s'enregistre sur le couple client + prestation", async () => {
    const { error } = await sb.from("client_tarifs").insert({
      atelier_id: jetable.atelierId, client_id: clientId, prestation_id: prestationId, prix_ht: 7.2,
    });
    expect(error, `tarif négocié : ${error?.message}`).toBeNull();
    const { data } = await sb.from("client_tarifs").select("prix_ht").eq("client_id", clientId).single();
    expect(nb((data as { prix_ht: number }).prix_ht)).toBe(7.2);
  });

  it("le même couple ne se pose pas deux fois : un import relancé ne double pas les prix", async () => {
    const { error } = await sb.from("client_tarifs").insert({
      atelier_id: jetable.atelierId, client_id: clientId, prestation_id: prestationId, prix_ht: 6,
    });
    expect(error, "un second tarif a pu être posé sur le même couple").not.toBeNull();
    const { data } = await sb.from("client_tarifs").select("prix_ht").eq("client_id", clientId);
    expect(data).toHaveLength(1);
    expect(nb((data as { prix_ht: number }[])[0].prix_ht)).toBe(7.2);
  });

  it("un prix négocié négatif est refusé en base, pas seulement à l'écran", async () => {
    const { error } = await sb.from("client_tarifs").insert({
      atelier_id: jetable.atelierId, client_id: clientId, prestation_id: null, prix_ht: -5,
    });
    expect(error).not.toBeNull();
  });

  it("un palier dont la borne haute passe sous la borne basse est refusé", async () => {
    const { error } = await sb.from("grille_paliers").insert({
      atelier_id: jetable.atelierId, grille_id: grilleId, surface_min: 10, surface_max: 5, prix_m2: 30,
    });
    expect(error, "un palier impossible a été accepté : il chiffrerait à zéro sans rien dire").not.toBeNull();
    const { data } = await sb.from("grille_paliers").select("id").eq("grille_id", grilleId);
    expect(data).toHaveLength(0);
  });

  it("un prix au m² négatif est refusé", async () => {
    const { error } = await sb.from("grille_paliers").insert({
      atelier_id: jetable.atelierId, grille_id: grilleId, surface_min: 0, surface_max: 1, prix_m2: -10,
    });
    expect(error).not.toBeNull();
  });

  it("des paliers valides, eux, s'enregistrent — dernière tranche sans plafond comprise", async () => {
    const { error } = await sb.from("grille_paliers").insert([
      { atelier_id: jetable.atelierId, grille_id: grilleId, surface_min: 0, surface_max: 1, prix_m2: 90 },
      { atelier_id: jetable.atelierId, grille_id: grilleId, surface_min: 1, surface_max: 5, prix_m2: 60 },
      { atelier_id: jetable.atelierId, grille_id: grilleId, surface_min: 5, surface_max: null, prix_m2: 35 },
    ]);
    expect(error, `paliers : ${error?.message}`).toBeNull();
    const { data } = await sb.from("grille_paliers").select("surface_min, surface_max, prix_m2").eq("grille_id", grilleId).order("surface_min");
    expect(data).toHaveLength(3);
    expect((data as { surface_max: number | null }[])[2].surface_max).toBeNull();
  });
});

describe("A5 — une seconde grille tarifaire", () => {
  let dediee = "";

  it("une grille non par défaut peut exister : c'est ce que la fiche client propose déjà", async () => {
    const { data, error } = await sb
      .from("grilles_tarifaires")
      .insert({ atelier_id: jetable.atelierId, nom: "Grille contrat menuisier", is_default: false, forfait_minimum: 0 })
      .select("id, is_default")
      .single();
    expect(error, `création de la grille dédiée : ${error?.message}`).toBeNull();
    dediee = (data as { id: string }).id;
    expect((data as { is_default: boolean }).is_default).toBe(false);
  });

  it("elle s'affecte à un client, et le client la garde", async () => {
    const { error } = await sb.from("clients").update({ grille_id: dediee }).eq("id", clientId);
    expect(error, `affectation : ${error?.message}`).toBeNull();
    const { data } = await sb.from("clients").select("grille_id").eq("id", clientId).single();
    expect((data as { grille_id: string }).grille_id).toBe(dediee);
  });

  it("la grille d'un autre atelier est refusée : sinon un client hériterait des prix du voisin", async () => {
    const { error } = await sb
      .from("clients")
      .update({ grille_id: contexte().seed.grilleStandardId })
      .eq("id", clientId);
    expect(error, "un client a pu être rattaché à la grille d'un autre atelier").not.toBeNull();
    const { data } = await sb.from("clients").select("grille_id").eq("id", clientId).single();
    expect((data as { grille_id: string }).grille_id).toBe(dediee);
  });

  it("promouvoir une grille en standard rétrograde l'autre : jamais deux standards", async () => {
    const { error } = await sb.from("grilles_tarifaires").update({ is_default: true }).eq("id", dediee);
    expect(error, `promotion : ${error?.message}`).toBeNull();

    const { data } = await sb.from("grilles_tarifaires").select("id, is_default").eq("actif", true);
    const defauts = ((data ?? []) as { id: string; is_default: boolean }[]).filter((g) => g.is_default);
    expect(defauts.map((g) => g.id)).toEqual([dediee]);

    // On repose la standard d'origine, pour laisser l'atelier dans un état lisible.
    const { error: errRetour } = await sb.from("grilles_tarifaires").update({ is_default: true }).eq("id", grilleId);
    expect(errRetour).toBeNull();
    const { data: apres } = await sb.from("grilles_tarifaires").select("id, is_default").eq("actif", true);
    expect(((apres ?? []) as { id: string; is_default: boolean }[]).filter((g) => g.is_default).map((g) => g.id)).toEqual([grilleId]);
  });
});
