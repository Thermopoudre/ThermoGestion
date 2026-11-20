import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem } from "@/lib/types";
import { calcTotaux, round2 } from "@/lib/utils";
import { lignesFacturables, lignesOptionnelles, prixNegocie, prixPalierQuantite } from "@/lib/calculs";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { creerDevis, finaliserDevis } from "./helpers/devis";

/**
 * Lot C, C5 — devis à options et prix par palier de quantité.
 *
 * Deux mécaniques distinctes, chacune testée de bout en bout jusqu'à `signer_devis` (migration 56) :
 *  - une ligne `optionnel: true` n'entre dans le total que si son `option_id` figure dans
 *    `p_options_acceptees` à la signature ; une option écartée disparaît des lignes signées, une
 *    option retenue y reste marquée `optionnel_accepte: true` (traçabilité) mais compte désormais ;
 *  - `prestations.paliers_quantite` fait varier le prix unitaire retenu par `prixPalierQuantite`,
 *    utilisé à la fois par l'éditeur (`prixNegocie`) et directement dans un devis.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let clientId: string;
let prestationPalierId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { data: client, error: errClient } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Serrurerie Lot C5" })
    .select("id")
    .single();
  if (errClient) throw new Error(`client C5 : ${errClient.message}`);
  clientId = client!.id as string;

  const { data: presta, error: errPresta } = await sb
    .from("prestations")
    .insert({
      atelier_id: ctx.seed.atelierId, code: "C5-PALIER", nom: "Pose de crochets", unite: "piece",
      prix_unitaire_ht: 10, tva_rate: 20, ordre: 9, actif: true,
      paliers_quantite: [{ a_partir_de: 20, prix: 8 }, { a_partir_de: 50, prix: 6.5 }],
    })
    .select("id")
    .single();
  if (errPresta) throw new Error(`prestation à paliers C5 : ${errPresta.message}`);
  prestationPalierId = presta!.id as string;
});

describe("C5 — prix par palier de quantité, câblé de bout en bout", () => {
  it("prixNegocie retombe sur le palier quand le client n'a pas de tarif spécifique", async () => {
    const { data: presta } = await sb.from("prestations").select("*").eq("id", prestationPalierId).single();
    expect(prixNegocie(presta!, clientId, [], 5).pu).toBe(10); // sous le premier seuil
    expect(prixNegocie(presta!, clientId, [], 20).pu).toBe(8);
    expect(prixNegocie(presta!, clientId, [], 50).pu).toBe(6.5);
  });

  it("un tarif négocié du client prime toujours sur le palier", async () => {
    const { error } = await sb.from("client_tarifs").insert({ atelier_id: ctx.seed.atelierId, client_id: clientId, prestation_id: prestationPalierId, prix_ht: 5 });
    expect(error).toBeNull();
    const [{ data: presta }, { data: tarifs }] = await Promise.all([
      sb.from("prestations").select("*").eq("id", prestationPalierId).single(),
      sb.from("client_tarifs").select("*").eq("client_id", clientId),
    ]);
    const res = prixNegocie(presta!, clientId, tarifs!, 50); // 50 pièces ferait 6,5 € sans le tarif
    expect(res.pu).toBe(5);
    expect(res.negocie).toBe(true);
  });

  it("une ligne de devis au palier calcule le bon total", () => {
    const qte = 25;
    const pu = prixPalierQuantite({ paliers_quantite: [{ a_partir_de: 20, prix: 8 }] } as unknown as Parameters<typeof prixPalierQuantite>[0], qte);
    expect(pu).toBe(8);
    expect(round2(qte * pu)).toBe(200);
  });
});

describe("C5 — devis à options, fixé par la signature", () => {
  async function creerDevisAvecOption() {
    const items: DevisItem[] = [
      { type: "libre", libelle: "Prestation ferme", qte: 1, unite: "forfait", pu_ht: 300, tva: 20, total_ht: 300 },
      { type: "libre", libelle: "Option peinture antirouille", qte: 1, unite: "forfait", pu_ht: 120, tva: 20, total_ht: 120, optionnel: true, option_id: "opt-antirouille" },
    ];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId, items });
    return finaliserDevis(sb, devis.id);
  }

  it("avant signature, l'option est visible mais hors du total facturable", () => {
    const items: DevisItem[] = [
      { type: "libre", libelle: "Ferme", qte: 1, unite: "forfait", pu_ht: 300, tva: 20, total_ht: 300 },
      { type: "libre", libelle: "Option", qte: 1, unite: "forfait", pu_ht: 120, tva: 20, total_ht: 120, optionnel: true, option_id: "o1" },
    ];
    expect(calcTotaux(lignesFacturables(items), null).total_ht).toBe(300);
    expect(lignesOptionnelles(items).map((l) => l.libelle)).toEqual(["Option"]);
  });

  it("une option écartée à la signature disparaît purement et simplement du devis signé", async () => {
    const envoye = await creerDevisAvecOption();
    const { error } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Client C5 sans option", p_signature: {}, p_ip: null,
      p_options_acceptees: [], // aucune option retenue
    });
    expect(error).toBeNull();

    const { data: signe } = await sb.from("devis").select("*").eq("id", envoye.id).single();
    const items = signe!.items as DevisItem[];
    expect(items.some((it) => it.option_id === "opt-antirouille"), "l'option écartée est restée dans le devis signé").toBe(false);
    expect(nb(signe!.total_ttc)).toBeCloseTo(300 * 1.2, 2);
  });

  it("une option retenue compte dans le total ET reste tracée comme option acceptée", async () => {
    const envoye = await creerDevisAvecOption();
    const { error } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Client C5 avec option", p_signature: {}, p_ip: null,
      p_options_acceptees: ["opt-antirouille"],
    });
    expect(error).toBeNull();

    const { data: signe } = await sb.from("devis").select("*").eq("id", envoye.id).single();
    const items = signe!.items as DevisItem[];
    const ligneOption = items.find((it) => it.option_id === "opt-antirouille");
    expect(ligneOption, "l'option retenue a disparu du devis signé").toBeDefined();
    expect(ligneOption!.optionnel).toBe(true); // traçabilité : « option retenue » reste lisible sur le PDF
    expect(ligneOption!.optionnel_accepte).toBe(true);

    // 300 (ferme) + 120 (option retenue) = 420 € HT, 504 € TTC.
    expect(nb(signe!.total_ht)).toBeCloseTo(420, 2);
    expect(nb(signe!.total_ttc)).toBeCloseTo(504, 2);

    // Et côté écran/PDF, la même ligne reste facturable puisqu'elle porte `optionnel_accepte`.
    expect(lignesFacturables(items).some((it) => it.option_id === "opt-antirouille")).toBe(true);
  });

  it("un devis signé ne recalcule plus rien après coup — signer deux fois échoue proprement", async () => {
    const envoye = await creerDevisAvecOption();
    const premiere = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "A", p_signature: {}, p_ip: null, p_options_acceptees: [] });
    expect(premiere.error).toBeNull();
    expect(premiere.data).toBe(true);

    // Le devis n'est plus "envoye" : la RPC ne trouve plus de ligne à signer et rend `false`,
    // elle ne lève pas d'exception — comportement inchangé par ce chantier.
    const seconde = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "B", p_signature: {}, p_ip: null, p_options_acceptees: ["opt-antirouille"] });
    expect(seconde.error).toBeNull();
    expect(seconde.data).toBe(false);

    const { data: signe } = await sb.from("devis").select("signed_by, total_ht").eq("id", envoye.id).single();
    expect(signe!.signed_by).toBe("A"); // la seconde tentative n'a rien changé
  });
});
