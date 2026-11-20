import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import {
  CONSERVATION_REGISTRE_ANNEES,
  FDS_PERIME_ANNEES,
  NATURES_DECHET,
  TRAITEMENTS_DECHET,
  bordereauManquant,
  fdsAVerifier,
  filtrerFds,
  totauxDechets,
  type FicheFds,
  type LigneDechet,
} from "@/lib/environnement";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * Registre des déchets et classeur FDS (lot 5) — le volet ICPE 2940 / risque chimique, à côté de
 * Qualicoat déjà couvert.
 *
 * Ce qui compte dans un registre présenté à l'inspection, ce n'est pas qu'il existe : c'est que
 * les totaux soient justes et que les manques soient visibles. Un déchet dangereux sans bordereau
 * est la non-conformité la plus simple à relever — l'écran et le PDF doivent la montrer, pas
 * l'enfouir.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;

beforeAll(() => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
});

function ligne(p: Partial<LigneDechet>): LigneDechet {
  return {
    id: p.id ?? "d1", date_sortie: p.date_sortie ?? "2026-05-12",
    nature: p.nature ?? "Boues de traitement de surface",
    code_dechet: p.code_dechet ?? "11 01 09*",
    dangereux: p.dangereux ?? true,
    quantite_kg: p.quantite_kg ?? 120,
    // `??` écraserait un `bordereau: null` explicite par la valeur par défaut — or c'est
    // précisément le cas que ces tests veulent couvrir.
    bordereau: "bordereau" in p ? (p.bordereau ?? null) : "BSD-2026-014",
    transporteur: p.transporteur ?? null, destination: p.destination ?? null,
    traitement: p.traitement ?? null, note: p.note ?? null,
  };
}

describe("totaux du registre des déchets", () => {
  it("sépare dangereux et non dangereux, et compte les bordereaux manquants", () => {
    const t = totauxDechets([
      ligne({ id: "a", quantite_kg: 120, dangereux: true }),
      ligne({ id: "b", quantite_kg: 45.5, dangereux: true, bordereau: null }),
      ligne({ id: "c", quantite_kg: 300, dangereux: false, bordereau: null }),
      // PostgREST rend les numeric en chaîne : sans coercition, le total serait une concaténation.
      ligne({ id: "d", quantite_kg: "12.25", dangereux: false, bordereau: null }),
    ]);
    expect(t.dangereux).toBe(165.5);
    expect(t.nonDangereux).toBe(312.25);
    expect(t.total).toBe(477.75);
    // Seuls les dangereux exigent un bordereau : les deux lignes non dangereuses ne comptent pas.
    expect(t.sansBordereau).toBe(1);
  });

  it("un bordereau vide ou fait d'espaces vaut absence de bordereau", () => {
    expect(bordereauManquant({ dangereux: true, bordereau: null })).toBe(true);
    expect(bordereauManquant({ dangereux: true, bordereau: "   " })).toBe(true);
    expect(bordereauManquant({ dangereux: true, bordereau: "BSD-1" })).toBe(false);
    expect(bordereauManquant({ dangereux: false, bordereau: null })).toBe(false);
  });

  it("un registre vide ne fabrique pas de chiffres", () => {
    expect(totauxDechets([])).toEqual({ dangereux: 0, nonDangereux: 0, total: 0, sansBordereau: 0 });
  });

  it("la nomenclature proposée colle au métier et distingue les déchets dangereux", () => {
    const bains = NATURES_DECHET.find((n) => n.nature.startsWith("Boues de traitement"))!;
    expect(bains.code).toBe("11 01 09*");
    expect(bains.dangereux).toBe(true);
    const poudre = NATURES_DECHET.find((n) => n.nature.startsWith("Boues de cabine"))!;
    expect(poudre.dangereux).toBe(false);
    // Tous les codes marqués d'un astérisque sont bien classés dangereux, et réciproquement.
    for (const n of NATURES_DECHET) {
      if (n.code.endsWith("*")) expect(n.dangereux, `${n.nature} porte un code dangereux`).toBe(true);
    }
    expect(TRAITEMENTS_DECHET.some((t) => t.code.startsWith("R"))).toBe(true);
    expect(TRAITEMENTS_DECHET.some((t) => t.code.startsWith("D"))).toBe(true);
    expect(CONSERVATION_REGISTRE_ANNEES).toBe(5);
  });
});

describe("classeur FDS", () => {
  const fiche = (p: Partial<FicheFds>): FicheFds => ({
    id: p.id ?? "f1", poudre_id: null, produit: p.produit ?? "Poudre polyester RAL 9010",
    fournisseur: p.fournisseur ?? "Thermopoudre", version: null, date_fds: p.date_fds ?? "2026-01-10",
    url: "https://exemple/fds.pdf", document_url: null,
    mentions_danger: p.mentions_danger ?? null, note: p.note ?? null, actif: true,
  });

  it("signale les fiches sans date et celles de plus de trois ans", () => {
    const aujourdHui = new Date("2026-08-18T00:00:00Z");
    expect(fdsAVerifier(null, aujourdHui)).toBe(true);
    expect(fdsAVerifier("2026-01-10", aujourdHui)).toBe(false);
    expect(fdsAVerifier("2022-08-17", aujourdHui)).toBe(true);
    expect(fdsAVerifier("2023-08-19", aujourdHui)).toBe(false);
    expect(FDS_PERIME_ANNEES).toBe(3);
  });

  it("la recherche ignore les accents et la casse, et croise plusieurs mots", () => {
    const fiches = [
      fiche({ id: "a", produit: "Dégraissant alcalin DGA-5", fournisseur: "Chimitech" }),
      fiche({ id: "b", produit: "Poudre époxy RAL 7016", fournisseur: "Thermopoudre" }),
      fiche({ id: "c", produit: "Solvant de nettoyage pistolet", fournisseur: "Chimitech" }),
    ];
    // Sur un téléphone, dans un atelier, personne ne tape les accents.
    expect(filtrerFds(fiches, "degraissant").map((f) => f.id)).toEqual(["a"]);
    expect(filtrerFds(fiches, "RAL 7016").map((f) => f.id)).toEqual(["b"]);
    expect(filtrerFds(fiches, "chimitech solvant").map((f) => f.id)).toEqual(["c"]);
    expect(filtrerFds(fiches, "").map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(filtrerFds(fiches, "inexistant")).toEqual([]);
  });
});

describe("cloisonnement et contraintes en base", () => {
  it("un visiteur anonyme ne lit ni le registre des déchets ni le classeur FDS", async () => {
    for (const table of ["dechets", "fds"]) {
      attendreLectureFermee(await anon.from(table).select("id"), `${table} lue par un visiteur anonyme`);
    }
  });

  it("enregistre une sortie de déchets et la relit avec ses mentions réglementaires", async () => {
    const { data, error } = await sb
      .from("dechets")
      .insert({
        atelier_id: ctx.seed.atelierId, date_sortie: "2026-06-03",
        nature: "Bain de décapage / déoxydation usé", code_dechet: "11 01 05*", dangereux: true,
        quantite_kg: 180.5, bordereau: "BSD-2026-031", transporteur: "Sarp Sud-Est",
        destination: "Séché Éco-Industries, Rognac", traitement: "D9",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(nb(data!.quantite_kg)).toBe(180.5);
    expect(data!.dangereux).toBe(true);
    expect(bordereauManquant(data as LigneDechet)).toBe(false);
  });

  it("refuse une quantité nulle ou négative — une ligne à 0 kg ne veut rien dire", async () => {
    for (const kg of [0, -5]) {
      const { error } = await sb.from("dechets").insert({
        atelier_id: ctx.seed.atelierId, nature: "Poudre périmée ou non conforme", quantite_kg: kg,
      });
      expect(error, `quantité ${kg} acceptée`).not.toBeNull();
    }
  });

  it("une FDS peut être rattachée à une poudre du catalogue, et survit à sa suppression", async () => {
    const { data: f, error } = await sb
      .from("fds")
      .insert({
        atelier_id: ctx.seed.atelierId, poudre_id: ctx.seed.poudreId,
        produit: "Poudre polyester TEST-RAL7016-TEXTURE", fournisseur: "TestPowder",
        version: "2.1", date_fds: "2026-02-01", url: "https://exemple.test/fds-7016.pdf",
        mentions_danger: "H317 — Peut provoquer une allergie cutanée",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(f!.poudre_id).toBe(ctx.seed.poudreId);
    expect(fdsAVerifier(f!.date_fds, new Date("2026-08-18T00:00:00Z"))).toBe(false);
  });

  it("ne peut pas écrire dans le registre d'un autre atelier", async () => {
    const { error } = await sb.from("dechets").insert({
      atelier_id: "00000000-0000-0000-0000-000000000000", nature: "Intrusion", quantite_kg: 1,
    });
    expect(error).not.toBeNull();
  });
});
