import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { estRefus } from "./helpers/refus";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";

/**
 * Lot A1 — reprendre la numérotation d'un atelier qui migre.
 *
 * Ce que ce fichier prouve, et pourquoi ça compte : un atelier qui en est à FA-2026-0347 doit
 * pouvoir le dire au logiciel AVANT sa première facture. Sinon l'exercice porte deux séries pour
 * la même année, et le fichier des écritures est refusé par le cabinet.
 *
 * La règle inverse compte autant : dès qu'un document de ce type est parti, le compteur ne se
 * déplace plus. Un compteur qu'on recule fabrique un doublon, un compteur qu'on avance fabrique un
 * trou. Les deux sont des anomalies qu'un contrôle relève.
 *
 * **Atelier neuf, et non celui du semis** : le verrou porte sur l'histoire de l'atelier, et
 * l'atelier partagé accumule devis et factures au fil des autres fichiers. Un test qui s'y
 * exécuterait vaudrait vrai ou faux selon le fichier qui l'a précédé.
 */

const TYPES_ATTENDUS = ["devis", "facture", "avoir", "bl", "projet", "jantes", "fournee"];

/** Les préfixes par défaut de `_next_numero()`, recopiés à la main : s'ils divergent, ce test tombe. */
const PREFIXES_DEFAUT: Record<string, string> = {
  // « F », pas « FO » : c'est le préfixe que les fournées portent depuis toujours
  // (F-2026-0044…) — migration 55, voir tests/coherence-numerotation-fournee.test.ts.
  devis: "DV", facture: "FA", avoir: "AV", bl: "BL", projet: "PR", jantes: "JJ", fournee: "F",
};

type Ligne = {
  type: string; libelle: string; prefixe: string; prefixe_defaut: string;
  prochain: number; annee: number; verrouille: boolean; apercu: string;
};

let jetable: AtelierJetable;
let sb: SupabaseClient;
let bureau: SupabaseClient;
const annee = new Date().getFullYear();

async function lire(client: SupabaseClient = sb): Promise<Ligne[]> {
  const { data, error } = await client.rpc("ma_numerotation");
  expect(error, `ma_numerotation : ${error?.message}`).toBeNull();
  return (data ?? []) as Ligne[];
}

async function ligne(type: string, client: SupabaseClient = sb): Promise<Ligne> {
  const l = (await lire(client)).find((x) => x.type === type);
  expect(l, `type ${type} absent de ma_numerotation()`).toBeDefined();
  return l!;
}

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lotA-num");
  sb = jetable.sb;
  bureau = await jetable.inviter("bureau");
}, 120_000);

afterAll(async () => {
  if (jetable) await jetable.fermer();
});

describe("ce que l'écran a le droit de lire", () => {
  it("ma_numerotation() rend les sept types réglables, avec les préfixes de _next_numero()", async () => {
    const lignes = await lire();
    expect(lignes.map((l) => l.type)).toEqual(TYPES_ATTENDUS);
    for (const l of lignes) {
      expect(l.prefixe_defaut, `préfixe par défaut de ${l.type}`).toBe(PREFIXES_DEFAUT[l.type]);
      expect(l.annee).toBe(annee);
      expect(l.libelle.length).toBeGreaterThan(0);
      // Atelier neuf : aucun document, aucun compteur, donc tout est libre et tout part de 1.
      expect(l.verrouille, `${l.type} devrait être libre dans un atelier neuf`).toBe(false);
      expect(l.prochain).toBe(1);
      expect(l.apercu).toBe(`${PREFIXES_DEFAUT[l.type]}-${annee}-0001`);
    }
  });

  it("ni ma_numerotation() ni poser_numerotation() ne répondent à un visiteur anonyme", async () => {
    const anon = clientAnonyme(contexte());
    const lecture = await anon.rpc("ma_numerotation");
    expect(estRefus(lecture.error), `ma_numerotation ouverte à anon : ${JSON.stringify(lecture.error)}`).toBe(true);
    const ecriture = await anon.rpc("poser_numerotation", { p_type: "facture", p_prefixe: "XX", p_prochain: 9 });
    expect(estRefus(ecriture.error), `poser_numerotation ouverte à anon : ${JSON.stringify(ecriture.error)}`).toBe(true);
  });

  it("l'aide interne du verrou n'est exposée à personne : elle prend un atelier en paramètre", async () => {
    for (const client of [clientAnonyme(contexte()), sb, clientConnecte()]) {
      const { error } = await client.rpc("_numerotation_emise", {
        p_atelier: "00000000-0000-0000-0000-000000000000", p_type: "facture", p_annee: annee,
      });
      expect(estRefus(error), `_numerotation_emise appelable : ${JSON.stringify(error)}`).toBe(true);
    }
  });
});

describe("poser sa numérotation", () => {
  it("le numéro délivré ensuite a exactement la forme annoncée par l'aperçu", async () => {
    const { data: apercu, error } = await sb.rpc("poser_numerotation", {
      p_type: "facture", p_prefixe: "fa", p_prochain: 348,
    });
    expect(error, `poser_numerotation : ${error?.message}`).toBeNull();
    // Le préfixe est normalisé en majuscules par la base : l'atelier tape « fa », il obtient FA.
    expect(apercu).toBe(`FA-${annee}-0348`);

    // L'état après coup, et non le code de retour : c'est le numéro réellement délivré qui compte.
    const { data: numero } = await sb.rpc("next_numero", { p_type: "facture" });
    expect(numero).toBe(`FA-${annee}-0348`);

    const apres = await ligne("facture");
    expect(apres.prochain).toBe(349);
    expect(apres.apercu).toBe(`FA-${annee}-0349`);
  });

  it("un préfixe personnalisé est repris tel quel par le distributeur de numéros", async () => {
    const { error } = await sb.rpc("poser_numerotation", { p_type: "devis", p_prefixe: "DEV", p_prochain: 12 });
    expect(error).toBeNull();
    const { data: numero } = await sb.rpc("next_numero", { p_type: "devis" });
    expect(numero).toBe(`DEV-${annee}-0012`);
  });

  it("le préfixe est enregistré là où _next_numero() va le lire, et nulle part ailleurs", async () => {
    const { data } = await sb.from("ateliers").select("settings").eq("id", jetable.atelierId).single();
    const num = (data as { settings: Record<string, unknown> }).settings.numerotation as Record<string, string>;
    expect(num.facture).toBe("FA");
    expect(num.devis).toBe("DEV");
  });
});

describe("ce que la base refuse, et ce qu'elle laisse en place après le refus", () => {
  it("un préfixe accentué, espacé ou tiré est refusé — le tiret sépare, il ne s'écrit pas", async () => {
    const avant = await ligne("bl");
    for (const mauvais of ["B-L", "BL 2", "BÉ", "", "TROPLONG7", "b/l"]) {
      const { error } = await sb.rpc("poser_numerotation", { p_type: "bl", p_prefixe: mauvais, p_prochain: 5 });
      expect(error, `préfixe « ${mauvais} » accepté`).not.toBeNull();
    }
    const apres = await ligne("bl");
    expect(apres.prefixe).toBe(avant.prefixe);
    expect(apres.prochain).toBe(avant.prochain);
  });

  it("un rang hors bornes est refusé, et le compteur ne bouge pas", async () => {
    const avant = await ligne("projet");
    for (const rang of [0, -3, 1_000_000]) {
      const { error } = await sb.rpc("poser_numerotation", { p_type: "projet", p_prefixe: "PR", p_prochain: rang });
      expect(error, `rang ${rang} accepté`).not.toBeNull();
    }
    expect((await ligne("projet")).prochain).toBe(avant.prochain);
  });

  it("un type de document inconnu est refusé plutôt que créé en silence", async () => {
    const { error } = await sb.rpc("poser_numerotation", { p_type: "bon_de_camion", p_prefixe: "BC", p_prochain: 1 });
    expect(error).not.toBeNull();
    expect((await lire()).map((l) => l.type)).toEqual(TYPES_ATTENDUS);
  });

  it("le bureau ne pose pas la numérotation : elle engage la comptabilité de l'entreprise", async () => {
    const avant = await ligne("avoir");
    const { error } = await bureau.rpc("poser_numerotation", { p_type: "avoir", p_prefixe: "AVO", p_prochain: 77 });
    expect(error, "un compte bureau a pu poser la numérotation").not.toBeNull();

    // L'état après coup, relu par le responsable : un refus qui aurait quand même écrit serait
    // pire qu'une absence de refus, parce qu'il passerait inaperçu.
    const apres = await ligne("avoir");
    expect(apres.prefixe).toBe(avant.prefixe);
    expect(apres.prochain).toBe(avant.prochain);
  });

  it("le bureau lit la numérotation, en revanche : l'écran de réglages doit pouvoir l'afficher", async () => {
    const lignes = await lire(bureau);
    expect(lignes.map((l) => l.type)).toEqual(TYPES_ATTENDUS);
  });
});

describe("le verrou : on reprend avant, jamais au milieu", () => {
  it("dès qu'un document du type est parti dans l'année, le compteur ne se déplace plus", async () => {
    // Une fournée numérotée par la base : c'est le geste qui ouvre la série.
    const { data: numero, error: errNum } = await sb.rpc("next_numero", { p_type: "fournee" });
    expect(errNum).toBeNull();
    const { data: fournee, error: errF } = await sb
      .from("fournees")
      .insert({ atelier_id: jetable.atelierId, numero, statut: "planifiee", date_prevue: "2026-09-01" })
      .select("id")
      .single();
    expect(errF, `création de la fournée témoin : ${errF?.message}`).toBeNull();

    const verrouillee = await ligne("fournee");
    expect(verrouillee.verrouille).toBe(true);

    const { error } = await sb.rpc("poser_numerotation", { p_type: "fournee", p_prefixe: "FOU", p_prochain: 500 });
    expect(error, "la numérotation a pu être déplacée alors qu'un document était parti").not.toBeNull();
    expect(String(error?.message)).toMatch(/NUMEROTATION_DEJA_UTILISEE/);

    // Rien n'a bougé : ni le préfixe, ni le compteur.
    const apres = await ligne("fournee");
    expect(apres.prefixe).toBe(verrouillee.prefixe);
    expect(apres.prochain).toBe(verrouillee.prochain);

    // Le prochain numéro reste dans la série ouverte, sans trou.
    const { data: suivant } = await sb.rpc("next_numero", { p_type: "fournee" });
    expect(suivant).toBe(`F-${annee}-0002`);

    await sb.from("fournees").delete().eq("id", (fournee as { id: string }).id);
  });

  it("le verrou est par type : ouvrir la série des fournées ne ferme pas celle des jantes", async () => {
    const jantes = await ligne("jantes");
    expect(jantes.verrouille).toBe(false);
    const { error } = await sb.rpc("poser_numerotation", { p_type: "jantes", p_prefixe: "JJ", p_prochain: 41 });
    expect(error).toBeNull();
    const { data: numero } = await sb.rpc("next_numero", { p_type: "jantes" });
    expect(numero).toBe(`JJ-${annee}-0041`);
  });
});
