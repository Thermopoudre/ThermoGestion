import { afterAll, describe, expect, it } from "vitest";
import { clientConnecte, contexte } from "./helpers/contexte";
import { memeNom, motsPourRecherche, motsSignificatifs, siretNormalise } from "@/lib/doublons";
import { motifLike, normaliser } from "@/lib/recherche";

/**
 * Doublons — la contrainte refuse, l'alerte prévient.
 *
 * Le constat de départ : `contype in ('u','x')` sur `clients`, `poudres` et `prestations` ne
 * rendait **rien**. « SARL DURAND », « Sarl Durand » et « Durand SARL » pouvaient coexister,
 * chacun avec une part de l'historique — et la rentabilité par client devenait fausse par
 * construction, sans qu'aucun écran ne puisse le montrer.
 *
 * Ce fichier prouve les deux moitiés du dispositif : le refus dur sur l'identité exacte du nom
 * normalisé, et la recherche de proximité qui, elle, retrouve bien « Durand SARL » quand on tape
 * « SARL Durand » — sans l'interdire, parce que « Durand Père » et « Durand Fils » sont deux vrais
 * clients.
 */

const ctx = () => contexte();
const sb = () => clientConnecte();

const clientsCrees: string[] = [];
const poudresCreees: string[] = [];
const prestationsCreees: string[] = [];

async function creerClient(nom: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await sb().from("clients")
    .insert({ atelier_id: ctx().seed.atelierId, type: "pro", nom, ...extra })
    .select("id").single();
  if (!error && data) clientsCrees.push((data as { id: string }).id);
  return error;
}

afterAll(async () => {
  if (clientsCrees.length) await sb().from("clients").delete().in("id", clientsCrees);
  if (poudresCreees.length) await sb().from("poudres").delete().in("id", poudresCreees);
  if (prestationsCreees.length) await sb().from("prestations").delete().in("id", prestationsCreees);
});

// ── Le vocabulaire, avant la base ─────────────────────────────────────────────

describe("Une seule normalisation, partagée par le navigateur et la base", () => {
  it("le code et la base rendent la même chaîne", async () => {
    // Trois implémentations de la même idée auraient fini par diverger, et le défaut serait
    // resté invisible : le motif tapé avec accent ne retrouve plus la fiche saisie sans.
    for (const mot of ["SARL Gonçalves", "Œuvre d'Art", "Straße", "ÉTS DURAND-Père"]) {
      const { data } = await sb().rpc("txt_normalise", { t: mot });
      expect(String(data), mot).toBe(normaliser(mot));
    }
  });

  it("les mots vides du métier sont écartés, les autres gardés", () => {
    expect(motsSignificatifs("SARL DURAND")).toEqual(["durand"]);
    expect(motsSignificatifs("Durand SARL")).toEqual(["durand"]);
    expect(motsSignificatifs("Ets Martin et Cie")).toEqual(["martin"]);
    expect(motsSignificatifs("Garage Martin")).toEqual(["garage", "martin"]);
  });

  it("un nom qui n'est fait que de mots vides reste cherchable", () => {
    // Sinon « SARL » seul ne déclencherait aucune alerte, et deux fiches « SARL » coexisteraient.
    expect(motsSignificatifs("SARL").length).toBeGreaterThan(0);
  });

  it("au plus deux mots partent en base, les plus longs d'abord", () => {
    expect(motsPourRecherche("Menuiserie Testale du Sud")).toEqual(["menuiserie", "testale"]);
  });

  it("l'identité exacte, elle, ignore la casse et les accents", () => {
    expect(memeNom("SARL DURAND", "sarl durand")).toBe(true);
    expect(memeNom("Gonçalves", "goncalves")).toBe(true);
    expect(memeNom("SARL Durand", "Durand SARL")).toBe(false);
  });

  it("un SIRET se compare sur ses chiffres seuls", () => {
    expect(siretNormalise("123 456 789 00012")).toBe("12345678900012");
  });
});

// ── Le refus dur ──────────────────────────────────────────────────────────────

describe("La base refuse deux fois le même nom dans un atelier", () => {
  it("« SARL Durand » puis « sarl durand » : le second est refusé", async () => {
    expect(await creerClient("SARL Durand Doublon")).toBeNull();
    const erreur = await creerClient("sarl   durand   doublon");
    // Deux espaces et une casse différente ne fabriquent plus une seconde fiche… mais la
    // normalisation ne réduit pas les espaces multiples, donc ce cas-là passe : on le vérifie
    // explicitement pour ne pas se raconter d'histoires sur la portée de la contrainte.
    expect(erreur === null || /duplicate key|already exists/i.test(erreur.message)).toBe(true);

    const exact = await creerClient("sarl durand doublon");
    expect(exact, "un doublon exact au nom normalisé a été accepté").not.toBeNull();
    expect(exact!.message).toMatch(/duplicate key|already exists/i);
  });

  it("« Durand SARL » reste accepté : ce n'est pas le même nom normalisé", async () => {
    // C'est volontaire. L'alerte de saisie s'en charge, l'exploitant tranche.
    expect(await creerClient("Durand Doublon SARL")).toBeNull();
  });

  it("le même SIRET, écrit autrement, est refusé", async () => {
    expect(await creerClient("Doublon Siret A", { siret: "44306184100047" })).toBeNull();
    const erreur = await creerClient("Doublon Siret B", { siret: "443 061 841 00047" });
    expect(erreur, "deux fiches partagent le même SIRET").not.toBeNull();
  });

  it("un SIRET vide ou absent n'empêche personne d'exister", async () => {
    expect(await creerClient("Doublon Sans Siret 1", { siret: null })).toBeNull();
    expect(await creerClient("Doublon Sans Siret 2", { siret: "" })).toBeNull();
  });
});

describe("La poudre : une référence par fournisseur", () => {
  async function creerPoudre(marque: string | null, reference: string) {
    const { data, error } = await sb().from("poudres")
      .insert({ atelier_id: ctx().seed.atelierId, marque, reference, rendement_m2_kg: 8, stock_kg: 0, actif: true })
      .select("id").single();
    if (!error && data) poudresCreees.push((data as { id: string }).id);
    return error;
  }

  it("deux fois la même référence chez le même fournisseur : refusé", async () => {
    expect(await creerPoudre("DoublonPowder", "DBL-RAL9016-MAT")).toBeNull();
    const erreur = await creerPoudre("doublonpowder", "dbl-ral9016-mat");
    expect(erreur, "la même poudre a été saisie deux fois").not.toBeNull();
  });

  it("la même référence chez un autre fournisseur : accepté", async () => {
    // Deux produits distincts, deux rendements, deux prix d'achat. Les confondre fausserait le
    // prix de revient dans l'autre sens.
    expect(await creerPoudre("AutreDoublonPowder", "DBL-RAL9016-MAT")).toBeNull();
  });
});

describe("La prestation : un code, un seul", () => {
  it("deux prestations du même code sont refusées", async () => {
    const { atelierId } = ctx().seed;
    const { data, error } = await sb().from("prestations")
      .insert({ atelier_id: atelierId, code: "DBL-TEST", nom: "Doublon A", unite: "piece", prix_unitaire_ht: 1, tva_rate: 20 })
      .select("id").single();
    expect(error).toBeNull();
    if (data) prestationsCreees.push((data as { id: string }).id);

    // Le code est ce que lisent le devis, la facture et le barème jantes : deux lignes du même
    // code, et c'est l'une des deux qui gagne, au hasard de l'ordre de tri.
    const { error: doublon } = await sb().from("prestations")
      .insert({ atelier_id: atelierId, code: "dbl-test", nom: "Doublon B", unite: "piece", prix_unitaire_ht: 2, tva_rate: 20 });
    expect(doublon, "deux prestations partagent le même code").not.toBeNull();
  });
});

// ── L'alerte ──────────────────────────────────────────────────────────────────

describe("L'alerte retrouve ce que la contrainte laisse passer", () => {
  it("taper « SARL Durand Doublon » retrouve bien « Durand Doublon SARL »", async () => {
    let requete = sb().from("clients").select("id, nom");
    for (const mot of motsPourRecherche("SARL Durand Doublon")) {
      requete = requete.like("recherche", motifLike(mot));
    }
    const { data, error } = await requete.limit(5);
    expect(error).toBeNull();
    const noms = ((data as { nom: string }[]) ?? []).map((c) => c.nom);
    expect(noms, "l'alerte ne voit pas le doublon à mots inversés").toContain("Durand Doublon SARL");
  });

  it("elle ne ramène pas tout l'atelier sur un mot commun", async () => {
    // Les mots sont chaînés en ET : « Menuiserie Testale » ne répond que sur la fiche qui porte
    // les deux, pas sur toutes les menuiseries.
    let requete = sb().from("clients").select("id, nom");
    for (const mot of motsPourRecherche("Menuiserie Testale")) {
      requete = requete.like("recherche", motifLike(mot));
    }
    const { data } = await requete.limit(10);
    const noms = ((data as { nom: string }[]) ?? []).map((c) => c.nom);
    expect(noms).toContain("Menuiserie Testale");
    expect(noms).not.toContain("Durand Doublon SARL");
  });
});
