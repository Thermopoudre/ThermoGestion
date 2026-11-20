import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { natureOperationDeduite } from "@/lib/nature-operation";
import { calcTotaux } from "@/lib/utils";
import type { DevisItem, Prestation } from "@/lib/types";
import { clientConnecte, contexte } from "./helpers/contexte";

/**
 * Catégorie de l'opération — mention obligatoire sur toute facture depuis le 01/09/2026.
 *
 * La règle est en base (trigger `a_nature_operation` + fonction `nature_operation_deduite`) et
 * seulement doublée à l'écran : une facture créée par l'import ou par la reprise d'un devis ne
 * passe jamais par l'éditeur React, et doit porter la bonne mention quand même. Ces tests
 * vérifient les deux, et surtout qu'elles disent la même chose.
 */

const ctx = contexte();
let sb: SupabaseClient;
let prestations: Prestation[];

function ligne(prestationId: string | null, pu: number, meta?: Record<string, unknown>): DevisItem {
  return {
    type: prestationId ? "prestation" : "libre",
    libelle: "Ligne de test",
    qte: 1,
    unite: "piece",
    pu_ht: pu,
    tva: 20,
    total_ht: pu,
    meta: { ...(prestationId ? { prestation_id: prestationId } : {}), ...(meta ?? {}) },
  };
}

/** Crée un brouillon de facture et rend la catégorie que la base a retenue. */
async function natureEnBase(items: DevisItem[], forcee?: { valeur: string }): Promise<string> {
  const { data, error } = await sb
    .from("factures")
    .insert({
      atelier_id: ctx.seed.atelierId,
      client_id: ctx.seed.clientSimpleId,
      type: "libre",
      items,
      ...calcTotaux(items, null),
      ...(forcee ? { nature_operation: forcee.valeur, nature_operation_forcee: true } : {}),
    })
    .select("nature_operation, nature_operation_forcee")
    .single();
  if (error) throw new Error(`création de la facture de test : ${error.message}`);
  return data!.nature_operation as string;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const { data } = await sb.from("prestations").select("*");
  prestations = (data as Prestation[]) ?? [];
});

describe("catégorie de l'opération déduite des lignes", () => {
  it("le catalogue de test contient bien un bien et des services", () => {
    const parId = new Map(prestations.map((p) => [p.id, p.nature]));
    expect(parId.get(ctx.seed.prestationTpmsId)).toBe("biens");
    expect(parId.get(ctx.seed.prestationSablageId)).toBe("services");
  });

  it("une facture de prestations est une prestation de services", async () => {
    const items = [ligne(ctx.seed.prestationSablageId, 9), ligne(ctx.seed.prestationDevoilageId, 25)];
    expect(natureOperationDeduite(items, prestations)).toBe("services");
    expect(await natureEnBase(items)).toBe("services");
  });

  it("une facture de valves revendues est une livraison de biens", async () => {
    const items = [ligne(ctx.seed.prestationTpmsId, 45)];
    expect(natureOperationDeduite(items, prestations)).toBe("biens");
    expect(await natureEnBase(items)).toBe("biens");
  });

  it("une facture qui mélange les deux est mixte", async () => {
    const items = [ligne(ctx.seed.prestationSablageId, 9), ligne(ctx.seed.prestationTpmsId, 45)];
    expect(natureOperationDeduite(items, prestations)).toBe("mixte");
    expect(await natureEnBase(items)).toBe("mixte");
  });

  it("une ligne libre, sans prestation au catalogue, compte comme un service", async () => {
    const items = [ligne(null, 120)];
    expect(natureOperationDeduite(items, prestations)).toBe("services");
    expect(await natureEnBase(items)).toBe("services");
  });

  it("une correction posée sur la ligne l'emporte sur le catalogue", async () => {
    // Une valve refacturée dans un forfait de main-d'œuvre : l'atelier requalifie la ligne.
    const items = [ligne(ctx.seed.prestationTpmsId, 45, { nature: "services" })];
    expect(natureOperationDeduite(items, prestations)).toBe("services");
    expect(await natureEnBase(items)).toBe("services");
  });

  it("le forfait minimum et la déduction d'acompte ne font pas basculer la catégorie", async () => {
    // Sans exclusion, ces deux lignes — qui ne portent aucune prestation — feraient passer une
    // facture de biens pour une facture mixte, alors qu'elles ne vendent rien.
    const items = [
      ligne(ctx.seed.prestationTpmsId, 45),
      ligne(null, 12, { forfait_minimum: true }),
      { ...ligne(null, -20, { deduction_acompte: true }), pu_ht: -20, total_ht: -20 },
    ];
    expect(natureOperationDeduite(items, prestations)).toBe("biens");
    expect(await natureEnBase(items)).toBe("biens");
  });

  it("une facture sans ligne reste une prestation de services", async () => {
    expect(natureOperationDeduite([], prestations)).toBe("services");
    expect(await natureEnBase([])).toBe("services");
  });
});

describe("correction assumée par l'atelier", () => {
  it("la base respecte la correction et ne la réécrit pas", async () => {
    const items = [ligne(ctx.seed.prestationSablageId, 9)];
    // Les lignes disent « services », l'atelier impose « mixte ».
    expect(await natureEnBase(items, { valeur: "mixte" })).toBe("mixte");
  });

  it("sans correction, la base écrase la valeur envoyée par le client", async () => {
    const items = [ligne(ctx.seed.prestationSablageId, 9)];
    const { data, error } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId,
        client_id: ctx.seed.clientSimpleId,
        type: "libre",
        items,
        ...calcTotaux(items, null),
        // Valeur fausse, envoyée sans lever le drapeau de correction : c'est exactement le cas
        // d'un appel direct à l'API qui contournerait l'éditeur.
        nature_operation: "biens",
      })
      .select("nature_operation")
      .single();
    if (error) throw new Error(error.message);
    expect(data!.nature_operation).toBe("services");
  });
});

describe("une facture émise n'est jamais requalifiée", () => {
  it("le gel du document l'emporte, même si le catalogue change ensuite", async () => {
    const items = [ligne(ctx.seed.prestationSablageId, 9)];
    const { data: facture, error } = await sb
      .from("factures")
      .insert({
        atelier_id: ctx.seed.atelierId,
        client_id: ctx.seed.clientSimpleId,
        type: "libre",
        items,
        ...calcTotaux(items, null),
      })
      .select("id, nature_operation")
      .single();
    if (error) throw new Error(error.message);
    expect(facture!.nature_operation).toBe("services");

    const { error: errEmission } = await sb
      .from("factures")
      .update({ status: "emise", emise_at: new Date().toISOString() })
      .eq("id", facture!.id);
    expect(errEmission).toBeNull();

    // Tenter de requalifier une facture émise doit être refusé par le gel, pas silencieusement
    // accepté puis recalculé : `nature_operation` fait partie des colonnes verrouillées.
    const { error: errRequalif } = await sb
      .from("factures")
      .update({ nature_operation: "biens", nature_operation_forcee: true })
      .eq("id", facture!.id);
    expect(errRequalif?.message ?? "").toContain("DOCUMENT_FIGE");

    const { data: relue } = await sb.from("factures").select("nature_operation").eq("id", facture!.id).single();
    expect(relue!.nature_operation).toBe("services");
  });
});
