import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, contexte, nb } from "./helpers/contexte";
import { estRefus } from "./helpers/refus";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";

/**
 * Lot A2 — reprendre l'encours client.
 *
 * L'atelier pilote arrive avec 23 factures impayées. Si elles ne se reprennent pas, le tableau de
 * bord affiche 0 € de reste dû le premier matin, la relance automatique est muette, et le patron
 * rouvre son tableur — après quoi le tableur redevient la source de vérité.
 *
 * Trois mécanismes doivent traiter ces factures correctement, et ce sont trois traitements
 * DIFFÉRENTS. Le reste dû et le récapitulatif du matin doivent les voir : c'est de l'argent qu'on
 * nous doit. La relance doit les voir : c'est de l'argent en retard. Le journal des ventes ne doit
 * PAS les voir : l'ancien logiciel les a déjà comptabilisées, et les rejouer doublerait le produit
 * au crédit du 706 et la TVA au 445710.
 *
 * Atelier neuf, comme pour A1 : le verrou d'import se ferme sur la première facture émise par
 * l'application, et l'atelier du semis en accumule au fil des autres fichiers.
 */

let jetable: AtelierJetable;
let sb: SupabaseClient;
let bureau: SupabaseClient;
let clientId = "";
const annee = new Date().getFullYear();

/** Une date passée, au format que la base attend. */
function ilYA(jours: number): string {
  return new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
}

async function importer(args: Record<string, unknown>, client: SupabaseClient = sb) {
  return client.rpc("importer_facture_anterieure", {
    p_client_id: clientId,
    p_total_tva: 0,
    p_due_date: null,
    p_regle: 0,
    ...args,
  });
}

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lotA-enc");
  sb = jetable.sb;
  bureau = await jetable.inviter("bureau");

  // Pas d'adresse e-mail sur ce client : les tâches planifiées tournent sur toute la base, et une
  // relance partie vers une adresse inventée est un courriel réellement envoyé.
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: jetable.atelierId, type: "pro", nom: "Serrurerie Repriselle", siren: "812345678", delai_paiement_jours: 30 })
    .select("id")
    .single();
  if (error) throw new Error(`client de reprise : ${error.message}`);
  clientId = (data as { id: string }).id;
}, 120_000);

afterAll(async () => {
  if (jetable) await jetable.fermer();
});

describe("qui a le droit de reprendre un encours", () => {
  it("un visiteur anonyme ne peut pas fabriquer de facture émise", async () => {
    const anon = clientAnonyme(contexte());
    const { error } = await anon.rpc("importer_facture_anterieure", {
      p_client_id: clientId, p_numero: "PIRATE-1", p_emise_le: ilYA(10),
      p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120, p_due_date: null, p_regle: 0,
    });
    expect(estRefus(error), `importer_facture_anterieure ouverte à anon : ${JSON.stringify(error)}`).toBe(true);

    const { data } = await sb.from("factures").select("id").eq("numero", "PIRATE-1");
    expect(data, "une facture a été créée malgré le refus").toHaveLength(0);
  });

  it("le bureau non plus : une facture émise antidatée est une pièce comptable", async () => {
    const { error } = await importer(
      { p_numero: "BUREAU-1", p_emise_le: ilYA(10), p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120 },
      bureau,
    );
    expect(error, "un compte bureau a pu reprendre l'encours").not.toBeNull();
    const { data } = await sb.from("factures").select("id").eq("numero", "BUREAU-1");
    expect(data).toHaveLength(0);
  });
});

describe("une facture reprise naît émise, avec son numéro et sa date d'origine", () => {
  let id = "";

  it("elle est créée en une fois, avant le gel — donc sans passer par un brouillon", async () => {
    const { data, error } = await importer({
      p_numero: `FA-${annee}-0325`, p_emise_le: ilYA(75),
      p_total_ht: 1000, p_total_tva: 200, p_total_ttc: 1200,
      p_due_date: ilYA(45), p_regle: 200,
    });
    expect(error, `import : ${error?.message}`).toBeNull();
    id = data as string;

    const { data: f } = await sb
      .from("factures")
      .select("numero, status, type, origine, emise_at, due_date, total_ht, total_tva, total_ttc, items, nature_operation")
      .eq("id", id)
      .single();
    const facture = f as Record<string, unknown>;

    expect(facture.status).toBe("emise");
    expect(facture.origine).toBe("reprise");
    expect(facture.numero).toBe(`FA-${annee}-0325`);
    // La date d'origine, et non `now()` : c'est elle qui fait l'ancienneté de la créance.
    expect(String(facture.emise_at).slice(0, 10)).toBe(ilYA(75));
    expect(facture.due_date).toBe(ilYA(45));
    expect(nb(facture.total_ttc)).toBe(1200);

    // Une ligne de synthèse portant le taux effectif : sans elle, la ventilation par taux de
    // l'export comptable n'aurait rien à ventiler.
    const items = facture.items as { tva: number; total_ht: number }[];
    expect(items).toHaveLength(1);
    expect(nb(items[0].tva)).toBe(20);
    expect(nb(items[0].total_ht)).toBe(1000);
  });

  it("le montant déjà réglé devient un vrai règlement, donc un vrai reste dû", async () => {
    const { data } = await sb.from("paiements").select("montant, moyen, note").eq("facture_id", id);
    const paiements = (data ?? []) as { montant: number; note: string }[];
    expect(paiements).toHaveLength(1);
    expect(nb(paiements[0].montant)).toBe(200);
    expect(paiements[0].note).toMatch(/ancien logiciel/i);
  });

  it("elle est figée comme n'importe quelle facture émise", async () => {
    const { error } = await sb.from("factures").update({ total_ttc: 1 }).eq("id", id);
    expect(error, "une facture reprise a pu être modifiée").not.toBeNull();
    expect(String(error?.message)).toMatch(/DOCUMENT_FIGE/);
    const { data } = await sb.from("factures").select("total_ttc").eq("id", id).single();
    expect(nb((data as { total_ttc: number }).total_ttc)).toBe(1200);
  });

  it("son origine ne se réécrit pas : sinon elle entrerait deux fois en comptabilité", async () => {
    const { error } = await sb.from("factures").update({ origine: "application" }).eq("id", id);
    expect(error, "l'origine d'une facture émise a pu être réécrite").not.toBeNull();
    const { data } = await sb.from("factures").select("origine").eq("id", id).single();
    expect((data as { origine: string }).origine).toBe("reprise");
  });

  it("le tableau de bord du matin la compte dans les impayés — c'est le but", async () => {
    const { data, error } = await sb.rpc("mon_recap_quotidien");
    expect(error).toBeNull();
    const recap = data as { argent: { factures: { nb: number; total: number; liste: { numero: string; reste: number }[] } } };
    const ligne = recap.argent.factures.liste.find((l) => l.numero === `FA-${annee}-0325`);
    expect(ligne, "la facture reprise n'apparaît pas dans le récapitulatif du matin").toBeDefined();
    // Le reste dû, pas le total : 1 200 − 200 déjà réglés.
    expect(nb(ligne!.reste)).toBe(1000);
  });

  it("la file de relance la retient : une créance échue est une créance échue", async () => {
    /**
     * `relancer_devis_et_factures()` n'est appelable que par le `service_role` (c'est un cron) :
     * on rejoue donc ici sa clause de sélection, à l'identique, moins la condition d'adresse
     * e-mail — le client de test n'en a pas, exprès, pour qu'aucun courriel ne parte. Ce que le
     * test prouve est le point qui pouvait casser : `origine` n'est pas un critère d'exclusion.
     */
    const { data } = await sb
      .from("factures")
      .select("id, numero, total_ttc, status, due_date, relances_actives, annulee_at, type, deleted_at")
      .eq("status", "emise")
      .eq("relances_actives", true)
      .is("annulee_at", null)
      .is("deleted_at", null)
      .neq("type", "avoir")
      .lt("due_date", new Date().toISOString().slice(0, 10));
    const numeros = ((data ?? []) as { numero: string }[]).map((f) => f.numero);
    expect(numeros).toContain(`FA-${annee}-0325`);
  });

  it("le journal des ventes l'ignore : l'ancien logiciel l'a déjà comptabilisée", async () => {
    const { data, error } = await sb.rpc("journal_ventes", { p_debut: ilYA(400), p_fin: ilYA(0) });
    expect(error, `journal_ventes : ${error?.message}`).toBeNull();
    const numeros = ((data ?? []) as { numero: string }[]).map((f) => f.numero);
    expect(
      numeros,
      "une facture reprise est entrée dans le journal des ventes : le produit et la TVA seraient comptés deux fois",
    ).not.toContain(`FA-${annee}-0325`);
  });
});

describe("ce que la base refuse, et l'état après le refus", () => {
  it("HT + TVA qui ne fait pas le TTC : c'est une colonne mal rapprochée, pas un arrondi", async () => {
    const { error } = await importer({
      p_numero: "INCOHERENT-1", p_emise_le: ilYA(10),
      p_total_ht: 1000, p_total_tva: 200, p_total_ttc: 1500,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_TOTAUX_INCOHERENTS/);
    const { data } = await sb.from("factures").select("id").eq("numero", "INCOHERENT-1");
    expect(data).toHaveLength(0);
  });

  it("un centime d'écart passe : l'ancien logiciel arrondissait ligne à ligne", async () => {
    const { error } = await importer({
      p_numero: "ARRONDI-1", p_emise_le: ilYA(10),
      p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120.01,
    });
    expect(error, `un centime d'arrondi a été refusé : ${error?.message}`).toBeNull();
  });

  it("un règlement supérieur au dû est refusé", async () => {
    const { error } = await importer({
      p_numero: "TROPPAYE-1", p_emise_le: ilYA(10),
      p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120, p_regle: 500,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_REGLEMENT_INVALIDE/);
    const { data } = await sb.from("factures").select("id").eq("numero", "TROPPAYE-1");
    expect(data).toHaveLength(0);
  });

  it("une facture soldée à l'euro près arrive « payée », pas « émise »", async () => {
    const { data: id, error } = await importer({
      p_numero: "SOLDEE-1", p_emise_le: ilYA(20),
      p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120, p_regle: 120,
    });
    expect(error).toBeNull();
    const { data } = await sb.from("factures").select("status").eq("id", id as string).single();
    expect((data as { status: string }).status).toBe("payee");
  });

  it("une date d'émission dans le futur est refusée", async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { error } = await importer({
      p_numero: "FUTUR-1", p_emise_le: demain, p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_DATE_INVALIDE/);
  });

  it("un numéro déjà pris est refusé — un numéro de facture est unique et définitif", async () => {
    const { error } = await importer({
      p_numero: `FA-${annee}-0325`, p_emise_le: ilYA(5),
      p_total_ht: 10, p_total_tva: 2, p_total_ttc: 12,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_NUMERO_EXISTANT/);
    const { data } = await sb.from("factures").select("id").eq("numero", `FA-${annee}-0325`);
    expect(data, "le numéro existe désormais en double").toHaveLength(1);
  });

  it("un client d'un autre atelier est refusé", async () => {
    const { error } = await importer({
      p_client_id: contexte().seed.clientSimpleId,
      p_numero: "AILLEURS-1", p_emise_le: ilYA(5),
      p_total_ht: 10, p_total_tva: 2, p_total_ttc: 12,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_CLIENT_INCONNU/);
  });
});

// Ce bloc ferme définitivement la reprise pour cet atelier : il doit rester le dernier.
describe("on reprend avant, pas au milieu", () => {
  it("la reprise se ferme dès qu'une facture est émise depuis l'application", async () => {
    const { data: brouillon, error: errB } = await sb
      .from("factures")
      .insert({
        atelier_id: jetable.atelierId, client_id: clientId, type: "libre",
        items: [{ type: "libre", libelle: "Laquage", qte: 1, unite: "piece", pu_ht: 100, tva: 20, total_ht: 100 }],
        total_ht: 100, total_tva: 20, total_ttc: 120,
      })
      .select("id")
      .single();
    expect(errB, `brouillon : ${errB?.message}`).toBeNull();

    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    const { error: errE } = await sb
      .from("factures")
      .update({ status: "emise", numero, due_date: ilYA(-30) })
      .eq("id", (brouillon as { id: string }).id);
    expect(errE, `émission : ${errE?.message}`).toBeNull();

    const { error } = await importer({
      p_numero: "TROPTARD-1", p_emise_le: ilYA(30),
      p_total_ht: 100, p_total_tva: 20, p_total_ttc: 120,
    });
    expect(error, "une facture antérieure a pu s'intercaler dans une série ouverte").not.toBeNull();
    expect(String(error?.message)).toMatch(/REPRISE_ENCOURS_FERMEE/);
    const { data } = await sb.from("factures").select("id").eq("numero", "TROPTARD-1");
    expect(data).toHaveLength(0);
  });

  it("la facture émise par l'application, elle, entre bien au journal des ventes", async () => {
    const { data } = await sb.rpc("journal_ventes", { p_debut: ilYA(1), p_fin: ilYA(-1) });
    const lignes = (data ?? []) as { numero: string; origine?: string }[];
    expect(lignes.length, "le journal des ventes est vide alors qu'une facture vient d'être émise").toBeGreaterThan(0);
  });
});
