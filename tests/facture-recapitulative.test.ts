import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem } from "@/lib/types";
import { calcTotaux, round2 } from "@/lib/utils";
import { clientConnecte, contexte, nb } from "./helpers/contexte";

/**
 * Facture mensuelle récapitulative — le standard absolu chez les menuisiers alu, et le seul
 * document du produit qui agrège plusieurs bons de livraison.
 *
 * Ce fichier existe à cause de la **quatrième** disparition de remise du projet : la RPC
 * `facture_recapitulative` aplatissait les lignes des bons sans jamais ouvrir leur colonne
 * `remise`. Un client contractualisé à −12 % dont on regroupait les livraisons du mois était
 * facturé plein tarif, et le Factur-X derrière portait le total plein. Aucun test ne le voyait :
 * la suite couvrait la chaîne devis → facture, jamais la chaîne bons → facture.
 */
const ctx = contexte();
let sb: SupabaseClient;
/** Client dédié à ce fichier : la récapitulative ramasse *tous* les bons livrés d'un client sur
 *  la période, un client partagé rendrait les totaux dépendants de l'ordre des fichiers. */
let clientId: string;

const LIGNES: DevisItem[] = [
  { type: "libre", libelle: "Laquage portail", qte: 1, unite: "piece", pu_ht: 400, tva: 20, total_ht: 400 },
  { type: "libre", libelle: "Masquage", qte: 2, unite: "piece", pu_ht: 50, tva: 20, total_ht: 100 },
];

/** Bon de livraison livré, prêt à être ramassé par la récapitulative. */
async function creerBLLivre(remise: { type: "pct" | "montant"; valeur: number } | null, lignes: DevisItem[] = LIGNES) {
  const { data: numero } = await sb.rpc("next_numero", { p_type: "bl" });
  const { data, error } = await sb
    .from("bons_livraison")
    .insert({
      atelier_id: ctx.seed.atelierId,
      client_id: clientId,
      numero,
      status: "livre",
      lignes,
      remise,
      livre_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  expect(error).toBeNull();
  return data!;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const { data, error } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Menuiserie Récap", delai_paiement_jours: 45 })
    .select("id")
    .single();
  expect(error).toBeNull();
  clientId = data!.id;
});

describe("facture mensuelle récapitulative", () => {
  it("reporte la remise de chaque bon de livraison au lieu de la perdre", async () => {
    const bl = await creerBLLivre({ type: "pct", valeur: 12 });
    const jour = new Date().toISOString().slice(0, 10);

    const { data: factureId, error } = await sb.rpc("facture_recapitulative", {
      p_client: clientId,
      p_debut: jour,
      p_fin: jour,
    });
    expect(error).toBeNull();

    const { data: facture } = await sb.from("factures").select("*").eq("id", factureId as string).single();
    expect(facture!.recapitulative).toBe(true);

    // 500 € HT remisés de 12 % = 440 € HT. Le total doit tomber juste au centime, exactement
    // comme le calculerait `calcTotaux` sur le devis d'origine.
    const attendu = calcTotaux(LIGNES, { type: "pct", valeur: 12 });
    expect(nb(facture!.total_ht)).toBe(attendu.total_ht);
    expect(nb(facture!.total_ttc)).toBe(attendu.total_ttc);
    expect(nb(facture!.total_ht)).toBe(440);

    // La remise est une ligne explicite, rattachée à son bon : sur une récapitulative, le client
    // doit pouvoir rapprocher chaque montant du bon d'origine.
    const items = facture!.items as DevisItem[];
    const ligneRemise = items.find((i) => i.libelle.includes("Remise"));
    expect(ligneRemise).toBeDefined();
    expect(ligneRemise!.libelle).toContain(bl.numero);
    expect(nb(ligneRemise!.total_ht)).toBe(-60);

    // Et le bon est bien consommé : sans ce marquage, la période suivante le refacturerait.
    const { data: blRelu } = await sb.from("bons_livraison").select("status, facture_id").eq("id", bl.id).single();
    expect(blRelu!.status).toBe("facture");
    expect(blRelu!.facture_id).toBe(factureId);
  });

  it("laisse le forfait minimum hors de l'assiette de remise", async () => {
    const lignes: DevisItem[] = [
      { type: "m2", libelle: "Laquage", qte: 1, unite: "m2", pu_ht: 13.5, tva: 20, total_ht: 13.5 },
      { type: "libre", libelle: "Forfait minimum", qte: 1, unite: "forfait", pu_ht: 13.12, tva: 20, total_ht: 13.12, meta: { forfait_minimum: true } },
    ];
    await creerBLLivre({ type: "pct", valeur: 12 }, lignes);
    const jour = new Date().toISOString().slice(0, 10);

    const { data: factureId, error } = await sb.rpc("facture_recapitulative", {
      p_client: clientId,
      p_debut: jour,
      p_fin: jour,
    });
    expect(error).toBeNull();

    const { data: facture } = await sb.from("factures").select("*").eq("id", factureId as string).single();
    const items = facture!.items as DevisItem[];

    // Le plancher est recopié avec son `meta` : c'est lui, et lui seul, qui le tient hors remise.
    const plancher = items.find((i) => i.meta?.forfait_minimum === true);
    expect(plancher).toBeDefined();

    // Remise calculée sur 13,50 € seulement, pas sur 26,62 €.
    const ligneRemise = items.find((i) => i.libelle.includes("Remise"));
    expect(nb(ligneRemise!.total_ht)).toBe(round2(-13.5 * 0.12));
    expect(nb(facture!.total_ht)).toBe(round2(13.5 - 1.62 + 13.12));
  });

  it("ne fabrique aucune ligne de remise quand le bon n'en porte pas", async () => {
    await creerBLLivre(null);
    const jour = new Date().toISOString().slice(0, 10);

    const { data: factureId } = await sb.rpc("facture_recapitulative", {
      p_client: clientId,
      p_debut: jour,
      p_fin: jour,
    });
    const { data: facture } = await sb.from("factures").select("*").eq("id", factureId as string).single();
    const items = facture!.items as DevisItem[];
    expect(items.some((i) => i.libelle.includes("Remise"))).toBe(false);
    expect(nb(facture!.total_ht)).toBe(500);
  });

  it("refuse de facturer une période sans bon de livraison à ramasser", async () => {
    const { error } = await sb.rpc("facture_recapitulative", {
      p_client: clientId,
      p_debut: "2020-01-01",
      p_fin: "2020-01-31",
    });
    expect(error).not.toBeNull();
  });
});
