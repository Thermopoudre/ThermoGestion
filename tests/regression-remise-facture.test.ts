import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux } from "@/lib/utils";
import type { DevisItem } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, creerFactureDepuisDevis, finaliserDevis, ligneM2, lignePrestation } from "./helpers/devis";

/**
 * Non-régression du bug B1 : la remise contractuelle du client disparaissait de la facture à la
 * première réouverture (136,86 € repassaient silencieusement à 155,52 €, soit le tarif plein).
 * C'est le test le plus important de la suite : il rejoue le cycle complet
 * devis remisé → facture → relecture → réenregistrement, et vérifie que le total ne bouge jamais.
 */
const ctx = contexte();
let sb: SupabaseClient;
let items: DevisItem[];

const REMISE = { type: "pct" as const, valeur: 12 };
const SOUS_TOTAL_HT = 129.6;
const TOTAL_TTC_REMISE = 136.86;
const TOTAL_TTC_SANS_REMISE = 155.52;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  const { paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId);
  items = [
    // Grille dédiée du client : 5,4 m² à 20 €/m² = 108,00 €.
    ligneM2({ surface: 5.4, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs }),
    // Sablage au tarif négocié : 3 × 7,20 € = 21,60 €.
    lignePrestation({ prestationId: ctx.seed.prestationSablageId, nom: "Sablage", unite: "piece", qte: 3, pu: 7.2, negocie: true }),
  ];
});

describe("la remise contractuelle survit au passage en facture", () => {
  it("part bien du cas de la recette : 129,60 € HT remisés à 12 %", () => {
    expect(items.reduce((s, i) => s + i.total_ht, 0)).toBe(SOUS_TOTAL_HT);
    expect(calcTotaux(items, REMISE).total_ttc).toBe(TOTAL_TTC_REMISE);
    // Le chiffre que produisait le bug : si la remise se perd, c'est celui-là qui sort.
    expect(calcTotaux(items, null).total_ttc).toBe(TOTAL_TTC_SANS_REMISE);
  });

  it("le devis, la facture et leurs relectures affichent tous 136,86 € TTC", async () => {
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items, remise: REMISE });
    expect(nb(devis.total_ttc)).toBe(TOTAL_TTC_REMISE);

    await finaliserDevis(sb, devis.id);
    const { data: devisSigne } = await sb
      .from("devis")
      .update({ status: "signe", signed_at: new Date().toISOString(), signed_by: "Recette automatisée" })
      .eq("id", devis.id)
      .select("*")
      .single();

    const facture = await creerFactureDepuisDevis(sb, devisSigne!);
    expect(nb(facture.total_ttc)).toBe(TOTAL_TTC_REMISE);

    // 1. Réouverture de la facture : la remise doit être présente en base, sinon l'éditeur
    //    recalcule les totaux à partir des seules lignes et repasse au tarif plein.
    const { data: relue } = await sb.from("factures").select("*").eq("id", facture.id).single();
    expect(relue!.remise).toEqual(REMISE);
    const recalcul = calcTotaux(relue!.items as DevisItem[], relue!.remise);
    expect(recalcul.total_ttc).toBe(TOTAL_TTC_REMISE);
    expect(recalcul.total_ht).toBe(nb(relue!.total_ht));
    expect(recalcul.total_tva).toBe(nb(relue!.total_tva));

    // 2. Enregistrement de la facture rouverte, tel que le fait FactureEditor.save().
    const { error: errSave } = await sb
      .from("factures")
      .update({ items: relue!.items, remise: relue!.remise, ...recalcul })
      .eq("id", facture.id);
    expect(errSave).toBeNull();

    // 3. Deuxième relecture : c'est ici que 155,52 € apparaissaient.
    const { data: relue2 } = await sb.from("factures").select("*").eq("id", facture.id).single();
    expect(nb(relue2!.total_ttc)).toBe(TOTAL_TTC_REMISE);
    expect(nb(relue2!.total_ttc)).not.toBe(TOTAL_TTC_SANS_REMISE);
    expect(relue2!.remise).toEqual(REMISE);

    // 4. Ce que voit le client sur la facture publique — une fois la facture émise. Depuis
    //    l'audit du 21/08, `facture_public` refuse les brouillons : le jeton public existe dès
    //    la création de la ligne, et servir un brouillon revenait à laisser payer un document
    //    dont les montants bougent encore. La facture qu'un client ouvre est une facture émise.
    const { error: errEmission } = await sb.from("factures").update({ status: "emise" }).eq("id", facture.id);
    expect(errEmission).toBeNull();

    const anon = clientAnonyme(ctx);
    const { data: publique, error: errPub } = await anon.rpc("facture_public", { p_token: relue2!.public_token });
    expect(errPub).toBeNull();
    expect(publique.remise).toEqual(REMISE);
    expect(nb(publique.total_ttc)).toBe(TOTAL_TTC_REMISE);
  });

  it("l'invariant totaux = calcTotaux(lignes, remise) tient sur tous les devis et factures de l'atelier", async () => {
    const [{ data: devis }, { data: factures }] = await Promise.all([
      sb.from("devis").select("numero, items, remise, total_ht, total_tva, total_ttc"),
      sb.from("factures").select("numero, items, remise, total_ht, total_tva, total_ttc"),
    ]);
    for (const doc of [...(devis ?? []), ...(factures ?? [])]) {
      const attendu = calcTotaux(doc.items as DevisItem[], doc.remise);
      expect({ doc: doc.numero, ...attendu }).toEqual({
        doc: doc.numero,
        total_ht: nb(doc.total_ht),
        total_tva: nb(doc.total_tva),
        total_ttc: nb(doc.total_ttc),
      });
    }
  });
});
