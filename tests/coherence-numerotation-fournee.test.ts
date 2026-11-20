import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";

/**
 * Recette navigateur, vague 1, défaut n°1 — la numérotation des fournées était incohérente sur
 * `/reglages` : « Série ouverte » (des fournées 2026 existent) ET « Le prochain sera FO-2026-0001 »
 * pour un atelier qui en est réellement à F-2026-0045.
 *
 * Deux causes, lues en base sur les deux ateliers réels avant correctif :
 *
 * 1. Préfixe par défaut divergent de l'historique. `_next_numero()` comme `ma_numerotation()`
 *    rendaient `FO` pour `fournee` (absence de branche dédiée dans `_next_numero`, VALUES
 *    `('fournee', 'Fournées', 'FO', 7)` dans `ma_numerotation`) — alors que l'atelier « Atelier Démo
 *    Thermolaquage » numérote ses fournées `F-2026-0044`, `F-2026-0045` depuis toujours. Les deux
 *    fonctions étaient d'accord entre elles, mais pas avec l'historique réel.
 *
 * 2. `compteurs` n'avait AUCUNE ligne `doc_type = 'fournee'`, pour aucun des deux ateliers réels
 *    (vérifié par lecture directe). `ma_numerotation()` lisait donc `coalesce(valeur, 0) + 1` sur
 *    une ligne absente et répondait 1, alors que 45 fournées existaient déjà.
 *
 * La migration 55 corrige les deux : préfixe par défaut `F`, et amorçage du compteur au maximum
 * déjà émis dans la série annuelle de l'atelier plutôt qu'à 1 quand `compteurs` n'a pas encore de
 * ligne. Ce fichier le prouve sur un atelier JETABLE — jamais sur les deux ateliers réels, que
 * `supprimer_atelier_test()` refuse de toute façon de toucher.
 */

let jetable: AtelierJetable;
let sb: SupabaseClient;
const annee = new Date().getFullYear();

type Ligne = {
  type: string; libelle: string; prefixe: string; prefixe_defaut: string;
  prochain: number; annee: number; verrouille: boolean; apercu: string;
};

async function ligneFournee(): Promise<Ligne> {
  const { data, error } = await sb.rpc("ma_numerotation");
  expect(error, `ma_numerotation : ${error?.message}`).toBeNull();
  const l = ((data ?? []) as Ligne[]).find((x) => x.type === "fournee");
  expect(l, "type fournee absent de ma_numerotation()").toBeDefined();
  return l!;
}

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lotA-fournee-amorcage");
  sb = jetable.sb;
}, 120_000);

afterAll(async () => {
  // La suppression de l'atelier jetable emporte ses fournées en cascade : rien à nettoyer à la main.
  if (jetable) await jetable.fermer();
});

describe("amorçage du compteur de fournées sur un historique jamais suivi par `compteurs`", () => {
  it("un atelier neuf, sans fournée, part bien de 1 avec le préfixe F (et non FO)", async () => {
    const avant = await ligneFournee();
    expect(avant.prefixe_defaut).toBe("F");
    expect(avant.prefixe).toBe("F");
    expect(avant.verrouille).toBe(false);
    expect(avant.prochain).toBe(1);
    expect(avant.apercu).toBe(`F-${annee}-0001`);
  });

  it("trois fournées F-AAAA-0001..3 posées à la main (comme un historique jamais passé par `compteurs`) : ma_numerotation() annonce F-AAAA-0004", async () => {
    // Poser directement en base, sans passer par next_numero() : c'est exactement la situation des
    // deux ateliers réels, dont les fournées existantes n'ont jamais fait avancer `compteurs`.
    const numeros = [1, 2, 3].map((n) => `F-${annee}-${String(n).padStart(4, "0")}`);
    for (const numero of numeros) {
      const { error } = await sb
        .from("fournees")
        .insert({ atelier_id: jetable.atelierId, numero, statut: "planifiee", date_prevue: "2026-09-01" });
      expect(error, `insertion de la fournée témoin ${numero} : ${error?.message}`).toBeNull();
    }

    const apres = await ligneFournee();
    // Le type est désormais verrouillé : des fournées 2026 existent, la série ne se déplace plus.
    expect(apres.verrouille).toBe(true);
    // Et surtout : PAS de retour à 1. Le prochain numéro prolonge la série existante.
    expect(apres.prefixe).toBe("F");
    expect(apres.prochain).toBe(4);
    expect(apres.apercu).toBe(`F-${annee}-0004`);
  });

  it("next_numero('fournee') produit exactement ce que l'aperçu annonçait, puis continue sans trou", async () => {
    const { data: premier, error } = await sb.rpc("next_numero", { p_type: "fournee" });
    expect(error, `next_numero : ${error?.message}`).toBeNull();
    expect(premier).toBe(`F-${annee}-0004`);

    // Un compteur `compteurs` existe désormais (posé par l'appel ci-dessus) : la suite est la
    // simple incrémentation habituelle, sans repasser par le maximum lu sur `fournees`.
    const { data: second } = await sb.rpc("next_numero", { p_type: "fournee" });
    expect(second).toBe(`F-${annee}-0005`);

    const apres = await ligneFournee();
    expect(apres.prochain).toBe(6);
    expect(apres.apercu).toBe(`F-${annee}-0006`);
  });
});
