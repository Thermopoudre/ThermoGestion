import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { qteConseillee } from "@/lib/utils";

/**
 * Commande de poudre chez le fournisseur.
 *
 * Trois invariants tiennent tout le reste : un seul panier ouvert à la fois (sinon deux commandes
 * partielles, donc deux ports de livraison payés), un numéro de bon de commande attribué
 * seulement à l'envoi (un panier abandonné ne doit pas trouer la série), et une réception qui
 * crée un lot — donc de la traçabilité — plutôt qu'un simple « +N kg ».
 */

let sb: SupabaseClient;
let atelierId: string;
let poudreId: string;

async function viderPanier() {
  const { data } = await sb.from("commandes_poudre").select("id").eq("status", "panier").maybeSingle();
  if (data) await sb.from("commandes_poudre").delete().eq("id", data.id);
}

beforeAll(async () => {
  sb = clientConnecte();
  atelierId = contexte().seed.atelierId;
  // Poudre dédiée : la réception incrémente un stock, et ce fichier fausserait les tests de
  // lots s'il touchait la poudre du jeu de données partagé.
  const { data, error } = await sb
    .from("poudres")
    .insert({ atelier_id: atelierId, reference: "CMD-TEST-9016", marque: "Iba Kymia", ral: "9016", stock_kg: 0, seuil_alerte_kg: 10 })
    .select("id")
    .single();
  if (error) throw new Error(`poudre de test : ${error.message}`);
  poudreId = data.id;
  // Le prix d'achat vit dans `poudre_couts` : table à part, fermée au rôle atelier.
  const { error: errPrix } = await sb
    .from("poudre_couts")
    .upsert({ poudre_id: poudreId, atelier_id: atelierId, prix_kg: 12.5 });
  if (errPrix) throw new Error(`prix de la poudre de test : ${errPrix.message}`);
  await viderPanier();
});

describe("quantité conseillée au réapprovisionnement", () => {
  it("vise le double du seuil et arrondit au sac de 5 kg", () => {
    // Seuil 20 kg, stock 6 kg → il faut 34 kg pour atteindre 40, arrondis à 35.
    expect(qteConseillee({ seuil_alerte_kg: 20 }, 6)).toBe(35);
  });

  it("commande quand même de quoi travailler pour une teinte déjà au-dessus du double du seuil", () => {
    expect(qteConseillee({ seuil_alerte_kg: 10 }, 100)).toBe(5);
  });

  it("ne renvoie jamais zéro pour une poudre sans seuil défini", () => {
    expect(qteConseillee({ seuil_alerte_kg: null }, 0)).toBeGreaterThan(0);
  });
});

describe("panier de réapprovisionnement", () => {
  it("n'ouvre qu'un seul panier, même appelé deux fois", async () => {
    const [a, b] = await Promise.all([sb.rpc("panier_poudre"), sb.rpc("panier_poudre")]);
    expect(a.error).toBeNull();
    expect(a.data).toBe(b.data);
    const { data } = await sb.from("commandes_poudre").select("id").eq("status", "panier");
    expect(data).toHaveLength(1);
  });

  it("additionne au lieu de créer un doublon quand la même teinte est ajoutée deux fois", async () => {
    await sb.rpc("ajouter_au_panier_poudre", { p_poudre_id: poudreId, p_quantite_kg: 10 });
    await sb.rpc("ajouter_au_panier_poudre", { p_poudre_id: poudreId, p_quantite_kg: 15 });
    const { data } = await sb.from("commande_poudre_lignes").select("quantite_kg").eq("poudre_id", poudreId);
    expect(data).toHaveLength(1);
    expect(nb(data![0].quantite_kg)).toBe(25);
  });

  it("refuse une quantité nulle ou négative", async () => {
    const { error } = await sb.rpc("ajouter_au_panier_poudre", { p_poudre_id: poudreId, p_quantite_kg: 0 });
    expect(error?.message).toContain("quantite invalide");
  });

  it("reprend la référence et le prix au kilo de la fiche poudre", async () => {
    const { data: ligne } = await sb.from("commande_poudre_lignes").select("reference, prix_kg").eq("poudre_id", poudreId).maybeSingle();
    const { data: poudre } = await sb.from("poudres").select("reference, poudre_couts(prix_kg)").eq("id", poudreId).maybeSingle();
    const cout = poudre!.poudre_couts as unknown as { prix_kg: number } | null;
    expect(ligne!.reference).toBe(poudre!.reference);
    expect(nb(ligne!.prix_kg)).toBe(nb(cout?.prix_kg));
  });
});

describe("envoi du bon de commande", () => {
  let commandeId: string;
  let numero: string;

  it("refuse une adresse de fournisseur qui n'en est pas une", async () => {
    const { data: panier } = await sb.rpc("panier_poudre");
    commandeId = panier as string;
    const { error } = await sb.rpc("envoyer_commande_poudre", { p_commande: commandeId, p_email_fournisseur: "commandes" });
    expect(error?.message).toContain("ADRESSE_FOURNISSEUR_INVALIDE");
  });

  it("numérote le bon de commande et le met en file d'envoi", async () => {
    const { data, error } = await sb.rpc("envoyer_commande_poudre", {
      p_commande: commandeId,
      p_email_fournisseur: "commandes@exemple-test.fr",
    });
    expect(error).toBeNull();
    numero = data as string;
    expect(numero).toMatch(/^BC-\d{4}-\d{4}$/);

    const { data: notif } = await sb
      .from("notifications")
      .select("template, destinataire_email, payload")
      .eq("template", "commande_poudre")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(notif?.destinataire_email).toBe("commandes@exemple-test.fr");
    const payload = notif?.payload as { numero: string; lignes: { quantite_kg: number }[] };
    expect(payload.numero).toBe(numero);
    expect(payload.lignes.length).toBeGreaterThan(0);
  });

  it("refuse d'envoyer deux fois la même commande", async () => {
    const { error } = await sb.rpc("envoyer_commande_poudre", {
      p_commande: commandeId,
      p_email_fournisseur: "commandes@exemple-test.fr",
    });
    expect(error?.message).toContain("COMMANDE_DEJA_ENVOYEE");
  });

  it("libère le panier : la commande suivante repart d'une commande vide", async () => {
    const { data: nouveau } = await sb.rpc("panier_poudre");
    expect(nouveau).not.toBe(commandeId);
    const { data: lignes } = await sb.from("commande_poudre_lignes").select("id").eq("commande_id", nouveau as string);
    expect(lignes).toHaveLength(0);
  });

  it("refuse d'envoyer un panier vide, qui ferait un bon de commande sans article", async () => {
    const { data: vide } = await sb.rpc("panier_poudre");
    const { error } = await sb.rpc("envoyer_commande_poudre", {
      p_commande: vide as string,
      p_email_fournisseur: "commandes@exemple-test.fr",
    });
    expect(error?.message).toContain("PANIER_VIDE");
  });

  it("réceptionne en créant un lot tracé et en augmentant le stock d'autant", async () => {
    const { data: avant } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).maybeSingle();
    const { data: lignes } = await sb.from("commande_poudre_lignes").select("id, quantite_kg").eq("commande_id", commandeId);

    const { data: recues, error } = await sb.rpc("receptionner_commande_poudre", {
      p_commande: commandeId,
      p_lignes: lignes!.map((l) => ({ ligne_id: l.id, quantite_kg: nb(l.quantite_kg) })),
    });
    expect(error).toBeNull();
    expect(recues).toBe(lignes!.length);

    const { data: apres } = await sb.from("poudres").select("stock_kg").eq("id", poudreId).maybeSingle();
    const attendu = nb(avant!.stock_kg) + lignes!.reduce((s, l) => s + nb(l.quantite_kg), 0);
    expect(nb(apres!.stock_kg)).toBeCloseTo(attendu, 3);

    // La traçabilité, c'est le lot : sans lui, une réclamation fabricant n'a rien à citer.
    const { data: lot } = await sb
      .from("poudre_lots")
      .select("numero, fournisseur, quantite_kg")
      .eq("poudre_id", poudreId)
      .like("numero", `${numero}%`)
      .maybeSingle();
    expect(lot).not.toBeNull();
    expect(lot!.fournisseur).toBe("Thermopoudre");

    const { data: cmd } = await sb.from("commandes_poudre").select("status, recue_at").eq("id", commandeId).maybeSingle();
    expect(cmd!.status).toBe("recue");
    expect(cmd!.recue_at).not.toBeNull();
  });

  it("refuse de réceptionner deux fois, ce qui doublerait le stock", async () => {
    const { error } = await sb.rpc("receptionner_commande_poudre", { p_commande: commandeId, p_lignes: [] });
    expect(error?.message).toContain("COMMANDE_NON_ENVOYEE");
  });
});

describe("cloisonnement", () => {
  it("ne laisse pas commander une poudre d'un autre atelier", async () => {
    const { error } = await sb.rpc("ajouter_au_panier_poudre", {
      p_poudre_id: "00000000-0000-4000-8000-000000000000",
      p_quantite_kg: 10,
    });
    expect(error?.message).toContain("poudre introuvable");
  });

  it("attache toutes les lignes à l'atelier de l'utilisateur", async () => {
    const { data } = await sb.from("commande_poudre_lignes").select("atelier_id");
    expect((data ?? []).every((l) => l.atelier_id === atelierId)).toBe(true);
  });
});
