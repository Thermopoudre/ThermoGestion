import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Etape, GrilleCoef, GrillePalier, TempsEtape } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2 } from "./helpers/devis";

/**
 * Chronométrage de bout en bout (R8) et temps partagé entre plusieurs pièces (B2).
 *
 * Deux ruptures traitées ensemble parce qu'elles vivent dans la même table :
 *
 *  - R8 : la première étape n'était jamais ouverte, la dernière jamais fermée (un BL signé clôt le
 *    projet sans passer par `avancer_etape`), et la vue de coût ne comptait que les lignes closes.
 *    La fiche projet affichait donc « 48 h » à côté de « 0 € de main d'œuvre » : deux chiffres
 *    contradictoires sur le même écran, et l'atelier arrête de scanner.
 *  - B2 : au sablage, plusieurs pièces passent ensemble en cabine. L'opérateur relève un temps
 *    global, réparti au prorata des dimensions — la même logique que le kWh d'une fournée dans
 *    `projet_revient`.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];

async function creerProjet(nom: string, surface: number | null) {
  const { data, error } = await sb
    .from("projets")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom, surface_m2: surface,
      etapes: [
        { code: "reception", libelle: "Réception" },
        { code: "preparation", libelle: "Préparation / sablage" },
        { code: "poudrage", libelle: "Poudrage" },
      ],
      etape_courante: "reception",
      status: "en_attente",
    })
    .select("*")
    .single();
  if (error) throw new Error(`projet ${nom} : ${error.message}`);
  return data!;
}

async function lignes(projetId: string): Promise<TempsEtape[]> {
  const { data } = await sb.from("temps_etapes").select("*").eq("projet_id", projetId).order("debut");
  return (data as TempsEtape[]) ?? [];
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
});

describe("R8 — la première étape est ouverte, la dernière est fermée", () => {
  it("`demarrer_etape` ouvre le chrono de l'étape courante et met le projet en production", async () => {
    const projet = await creerProjet("Chrono — première étape", 3);
    expect(await lignes(projet.id)).toHaveLength(0);

    const { data: res, error } = await sb.rpc("demarrer_etape", { p_projet: projet.id });
    expect(error).toBeNull();
    expect(res.ok).toBe(true);
    expect(res.etape).toBe("reception");

    const t = await lignes(projet.id);
    expect(t, "la première étape n'a pas été chronométrée").toHaveLength(1);
    expect(t[0].etape_code).toBe("reception");
    expect(t[0].fin).toBeNull();

    // Le réglage a un effet visible : le projet quitte la file d'attente.
    const { data: relu } = await sb.from("projets").select("status").eq("id", projet.id).single();
    expect(relu!.status).toBe("en_cours");

    // Idempotent : rescanner ne doit pas empiler les chronos.
    await sb.rpc("demarrer_etape", { p_projet: projet.id });
    expect(await lignes(projet.id)).toHaveLength(1);
  });

  it("`avancer_etape` chronomètre seule : plus aucun écran à ne pas oublier", async () => {
    const projet = await creerProjet("Chrono — chaînage", 2);
    await sb.rpc("demarrer_etape", { p_projet: projet.id });

    // Aucun appel à `pointer_etape` ici : c'était précisément le maillon qu'un écran pouvait sauter.
    const { data: res } = await sb.rpc("avancer_etape", { p_projet_id: projet.id });
    expect(res.etape_faite).toBe("reception");
    expect(res.etape).toBe("preparation");

    const t = await lignes(projet.id);
    expect(t).toHaveLength(2);
    expect(t[0].etape_code).toBe("reception");
    expect(t[0].fin, "l'étape validée n'a pas été clôturée").not.toBeNull();
    expect(t[0].minutes).not.toBeNull();
    expect(t[1].etape_code).toBe("preparation");
    expect(t[1].fin).toBeNull();
  });

  it("la dernière étape est refermée, pas laissée ouverte pour toujours", async () => {
    const projet = await creerProjet("Chrono — dernière étape", 1.5);
    await sb.rpc("demarrer_etape", { p_projet: projet.id });
    await sb.rpc("avancer_etape", { p_projet_id: projet.id }); // reception
    await sb.rpc("avancer_etape", { p_projet_id: projet.id }); // preparation
    const { data: fin } = await sb.rpc("avancer_etape", { p_projet_id: projet.id }); // poudrage = dernière
    expect(fin.done).toBe(true);

    const t = await lignes(projet.id);
    expect(t.every((l) => l.fin !== null), "un chrono est resté ouvert après la dernière étape").toBe(true);
  });

  it("un bon de livraison signé referme le chrono du projet qu'il clôt", async () => {
    const items = [ligneM2({ surface: 4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const envoye = await finaliserDevis(sb, devis.id);
    await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Chrono BL", p_signature: {}, p_ip: null });

    const { data: projet } = await sb.from("projets").select("*").eq("devis_id", devis.id).single();
    await sb.rpc("demarrer_etape", { p_projet: projet!.id });
    expect((await lignes(projet!.id)).some((l) => l.fin === null)).toBe(true);

    const { data: numero } = await sb.rpc("next_numero", { p_type: "bl" });
    const { data: bl } = await sb
      .from("bons_livraison")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, projet_id: projet!.id, numero, status: "emis", lignes: items })
      .select("*")
      .single();
    const { data: res } = await anon.rpc("signer_bl", { p_token: bl!.public_token, p_nom: "Client pressé", p_signature: {}, p_ip: null });
    expect(res.ok).toBe(true);

    const t = await lignes(projet!.id);
    expect(t.every((l) => l.fin !== null), "le chrono tournait encore après la livraison").toBe(true);
    const { data: relu } = await sb.from("projets").select("etapes, status").eq("id", projet!.id).single();
    expect(relu!.status).toBe("livre");
    expect((relu!.etapes as Etape[]).every((e) => e.done_at != null)).toBe(true);
  });

  it("la vue de coût compte le chrono en cours : les deux cartes de la fiche disent la même chose", async () => {
    const projet = await creerProjet("Chrono — cohérence des cartes", 2);
    // Chrono ouvert il y a deux heures, comme une ligne « contrôle » oubliée depuis la veille.
    const { error } = await sb.from("temps_etapes").insert({
      atelier_id: ctx.seed.atelierId, projet_id: projet.id, etape_code: "reception",
      debut: new Date(Date.now() - 2 * 3600_000).toISOString(),
    });
    expect(error).toBeNull();

    const { data: vue } = await sb
      .from("projet_temps_cout")
      .select("minutes_totales, cout_main_oeuvre")
      .eq("projet_id", projet.id)
      .maybeSingle();
    expect(vue, "aucune ligne de coût pour un projet dont le chrono tourne").not.toBeNull();
    expect(nb(vue!.minutes_totales)).toBeGreaterThanOrEqual(119);
    expect(nb(vue!.cout_main_oeuvre), "un chrono en cours coûtait 0 €").toBeGreaterThan(0);
  });
});

describe("B2 — un temps relevé pour un lot, réparti au prorata des dimensions", () => {
  it("60 minutes sur 3 m² et 1 m² donnent 45 et 15", async () => {
    const grand = await creerProjet("Sablage lot — 3 m²", 3);
    const petit = await creerProjet("Sablage lot — 1 m²", 1);

    const { data: groupe, error } = await sb.rpc("demarrer_pointage_lot", {
      p_projets: [grand.id, petit.id],
      p_etape: "preparation",
    });
    expect(error).toBeNull();
    expect(groupe).toBeTruthy();

    const { data: res, error: errStop } = await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 60 });
    expect(errStop).toBeNull();
    expect(res.minutes_lot).toBe(60);
    expect(res.prorata).toBe(true);

    const parProjet = new Map<string, { minutes: number; part_pct: number }>(
      (res.projets as { projet_id: string; minutes: number; part_pct: string }[]).map((p) => [
        p.projet_id, { minutes: p.minutes, part_pct: nb(p.part_pct) },
      ]),
    );
    expect(parProjet.get(grand.id)!.minutes).toBe(45);
    expect(parProjet.get(petit.id)!.minutes).toBe(15);
    // La répartition doit être lisible : l'atelier doit comprendre pourquoi il porte 45 min sur 60.
    expect(parProjet.get(grand.id)!.part_pct).toBe(75);
    expect(parProjet.get(petit.id)!.part_pct).toBe(25);

    const ligneGrand = (await lignes(grand.id)).find((l) => l.groupe_id === groupe)!;
    expect(ligneGrand.minutes).toBe(45);
    expect(ligneGrand.minutes_groupe).toBe(60);
    expect(nb(ligneGrand.part_pct)).toBe(75);
    expect(ligneGrand.fin).not.toBeNull();
  });

  it("le temps réparti alimente le prix de revient comme un temps normal", async () => {
    const a = await creerProjet("Revient lot — 6 m²", 6);
    const b = await creerProjet("Revient lot — 2 m²", 2);
    const { data: groupe } = await sb.rpc("demarrer_pointage_lot", { p_projets: [a.id, b.id], p_etape: "preparation" });
    await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 120 });

    const { data: vueA } = await sb.from("projet_temps_cout").select("*").eq("projet_id", a.id).single();
    const { data: vueB } = await sb.from("projet_temps_cout").select("*").eq("projet_id", b.id).single();
    expect(nb(vueA!.minutes_totales)).toBe(90);
    expect(nb(vueB!.minutes_totales)).toBe(30);
    // Taux horaire de l'atelier de test : 42 €/h.
    expect(nb(vueA!.cout_main_oeuvre)).toBe(63);
    expect(nb(vueB!.cout_main_oeuvre)).toBe(21);

    const { data: revient } = await sb.from("projet_revient").select("cout_main_oeuvre").eq("projet_id", a.id).single();
    expect(nb(revient!.cout_main_oeuvre), "le temps partagé n'est pas remonté au prix de revient").toBe(63);
  });

  it("un projet sans surface renseignée bascule le lot à parts égales — jamais une division par zéro", async () => {
    const mesure = await creerProjet("Lot mixte — 5 m²", 5);
    const inconnu = await creerProjet("Lot mixte — surface inconnue", null);
    const { data: groupe } = await sb.rpc("demarrer_pointage_lot", { p_projets: [mesure.id, inconnu.id], p_etape: "preparation" });
    const { data: res } = await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 60 });

    expect(res.prorata).toBe(false);
    const minutes = (res.projets as { minutes: number }[]).map((p) => p.minutes);
    expect(minutes).toEqual([30, 30]);
  });

  it("la somme des parts est exactement le temps relevé, même quand ça ne tombe pas rond", async () => {
    const trois = await Promise.all([
      creerProjet("Lot arrondi A", 1),
      creerProjet("Lot arrondi B", 1),
      creerProjet("Lot arrondi C", 1),
    ]);
    const { data: groupe } = await sb.rpc("demarrer_pointage_lot", { p_projets: trois.map((p) => p.id), p_etape: "preparation" });
    const { data: res } = await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 100 });

    const minutes = (res.projets as { minutes: number }[]).map((p) => p.minutes);
    expect(minutes.reduce((s, m) => s + m, 0), "une minute s'est perdue dans l'arrondi").toBe(100);
    expect(minutes.sort()).toEqual([33, 33, 34]);
  });

  it("un lot d'un seul projet n'est pas un lot", async () => {
    const seul = await creerProjet("Lot d'un seul", 2);
    const { error } = await sb.rpc("demarrer_pointage_lot", { p_projets: [seul.id], p_etape: "preparation" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/LOT_INSUFFISANT/);
  });

  it("un lot déjà arrêté ne se réarrête pas — le temps ne se compte pas deux fois", async () => {
    const a = await creerProjet("Double arrêt A", 2);
    const b = await creerProjet("Double arrêt B", 2);
    const { data: groupe } = await sb.rpc("demarrer_pointage_lot", { p_projets: [a.id, b.id], p_etape: "preparation" });
    await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 40 });
    const { error } = await sb.rpc("arreter_pointage_lot", { p_groupe: groupe, p_minutes: 40 });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/LOT_POINTAGE_INTROUVABLE/);

    const total = (await lignes(a.id)).reduce((s, l) => s + (l.minutes ?? 0), 0);
    expect(total).toBe(20);
  });

  it("un lot n'embarque pas les projets d'un autre atelier", async () => {
    const mien = await creerProjet("Lot cloisonné", 2);
    const { error } = await sb.rpc("demarrer_pointage_lot", {
      p_projets: [mien.id, "00000000-0000-0000-0000-000000000000"],
      p_etape: "preparation",
    });
    expect(error, "un projet étranger a été accepté dans le lot").not.toBeNull();
  });

  it("un visiteur anonyme ne peut ni démarrer ni arrêter un chronométrage", async () => {
    const { error: e1 } = await anon.rpc("demarrer_pointage_lot", { p_projets: [], p_etape: "preparation" });
    const { error: e2 } = await anon.rpc("arreter_pointage_lot", { p_groupe: "00000000-0000-0000-0000-000000000000" });
    const { error: e3 } = await anon.rpc("demarrer_etape", { p_projet: "00000000-0000-0000-0000-000000000000" });
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
    expect(e3).not.toBeNull();
  });
});
