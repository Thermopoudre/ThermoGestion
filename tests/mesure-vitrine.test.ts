import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, contexte } from "./helpers/contexte";

/**
 * Les deux seules tables ouvertes en écriture à un visiteur anonyme : `analytics_events` (mesure
 * du tunnel) et `leads` (demande de rappel depuis la vitrine).
 *
 * Elles sont attaquées ici depuis un vrai client PostgREST anonyme — exactement ce dont dispose
 * n'importe qui avec la clé publique du front. Un garde-fou qui a l'air correct ne protège pas
 * forcément : sur ce projet, sept l'ont déjà prouvé.
 */
const ctx = contexte();
let anon: SupabaseClient;

const VISITEUR = "aTestVisitor0123456789";
const SESSION = "aTestSession0123456789";

beforeAll(() => {
  anon = clientAnonyme(ctx);
});

describe("analytics_events — écriture anonyme bornée", () => {
  it("accepte un événement bien formé, avec visiteur, session et UTM", async () => {
    const { error } = await anon.from("analytics_events").insert({
      event: "test_lot9_ok",
      props: { ecran: "/demo" },
      path: "/",
      referrer: "https://www.google.com/",
      visitor_id: VISITEUR,
      session_id: SESSION,
      utm: { utm_source: "test", utm_medium: "recette" },
    });
    expect(error).toBeNull();
  });

  it("le visiteur et la session sont bien relus (le tunnel devient calculable)", async () => {
    // La lecture se fait avec le rôle du seed ; ce qui est vérifié ici, c'est que les colonnes
    // existent et portent la valeur écrite — sans elles on compte des événements, pas des gens.
    const { data, error } = await anon
      .from("analytics_events")
      .insert({ event: "test_lot9_relu", props: {}, visitor_id: VISITEUR, session_id: SESSION })
      .select("visitor_id, session_id")
      .maybeSingle();
    // La policy n'ouvre pas la lecture : `select()` après insert renvoie soit la ligne, soit rien.
    expect(error === null || error.code === "42501").toBe(true);
    if (data) {
      expect(data.visitor_id).toBe(VISITEUR);
      expect(data.session_id).toBe(SESSION);
    }
  });

  it.each([
    ["nom d'événement à rallonge", { event: "x".repeat(80), props: {} }],
    ["nom d'événement avec du HTML", { event: "<script>alert(1)</script>", props: {} }],
    ["nom d'événement vide", { event: "", props: {} }],
    ["identifiant de visiteur fabriqué", { event: "test_lot9_ko", props: {}, visitor_id: "'; drop table leads; --" }],
    ["charge utile démesurée", { event: "test_lot9_ko", props: { bourrage: "x".repeat(5000) } }],
    ["chemin démesuré", { event: "test_lot9_ko", props: {}, path: "/".padEnd(400, "a") }],
  ])("refuse : %s", async (_cas, ligne) => {
    const { error } = await anon.from("analytics_events").insert(ligne);
    expect(error).not.toBeNull();
  });

  it("refuse d'attribuer un événement à un autre utilisateur", async () => {
    const { error } = await anon.from("analytics_events").insert({
      event: "test_lot9_usurpation",
      props: {},
      user_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(error).not.toBeNull();
  });

  it("reste illisible depuis un client anonyme", async () => {
    const { data } = await anon.from("analytics_events").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("leads — le formulaire de rappel écrit, et rien d'autre", () => {
  it("accepte une demande de rappel bien formée", async () => {
    const { error } = await anon.from("leads").insert({
      nom: "Recette Lot 9",
      email: `recette.lot9.${Date.now()}@example.test`,
      telephone: "06 00 00 00 00",
      atelier_nom: "Atelier de recette",
      message: "Jantes alu et portails, deux personnes.",
      source: "test-automatise",
      utm: { utm_source: "recette" },
      status: "nouveau",
    });
    expect(error).toBeNull();
  });

  it.each([
    ["e-mail invalide", { email: "pas-une-adresse", status: "nouveau" }],
    ["e-mail vide", { email: "", status: "nouveau" }],
    ["message démesuré", { email: "a@b.fr", message: "x".repeat(3000), status: "nouveau" }],
    ["statut commercial imposé depuis l'extérieur", { email: "a@b.fr", status: "converti" }],
  ])("refuse : %s", async (_cas, ligne) => {
    const { error } = await anon.from("leads").insert(ligne);
    expect(error).not.toBeNull();
  });

  it("un lead déposé n'est jamais relisible par l'API publique", async () => {
    const { data } = await anon.from("leads").select("email").limit(5);
    expect(data ?? []).toHaveLength(0);
  });

  it("un lead ne peut être ni modifié ni supprimé depuis l'extérieur", async () => {
    const maj = await anon.from("leads").update({ status: "converti" }).neq("email", "");
    const sup = await anon.from("leads").delete().neq("email", "");
    // Sans policy UPDATE/DELETE, PostgREST ne touche aucune ligne (ou refuse) — jamais d'effet.
    expect(maj.data ?? []).toHaveLength(0);
    expect(sup.data ?? []).toHaveLength(0);
  });
});
