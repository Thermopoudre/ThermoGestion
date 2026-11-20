import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux, estForfaitMinimum } from "@/lib/utils";
import { appliquerForfaitMinimum, coucheParDefaut, couchesDisponibles, prixM2, prixPieceType } from "@/lib/calculs";
import type { DevisItem, GrilleCoef, GrillePalier, PieceType } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneLibre, ligneM2, lignePieceTypeGrille, lignePrestation } from "./helpers/devis";

/**
 * Deux réglages étaient enregistrés en base, affichés dans les Réglages, et sans aucun effet sur
 * le chiffrage : le forfait minimum de la grille et le coefficient « nombre de couches ». Un
 * réglage qui ne fait rien est pire qu'un réglage absent — l'atelier croit l'avoir configuré.
 * Ces tests fixent la règle métier retenue avant l'implémentation.
 */
const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
let grilleId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  grilleId = ctx.seed.grilleStandardId;
  ({ paliers, coefs } = await chargerGrille(sb, grilleId));
});

describe("coefficient « nombre de couches »", () => {
  it("multiplie le prix au m² au même titre que la finition et la complexité", () => {
    // Palier 3–10 m² à 24 € × structuré 1,15 × moyenne 1,2 = 33,12 € (référence des tests existants).
    const uneCouche = prixM2({ surface: 4.2, finition: "structure", complexite: "moyenne", couche: "1", grilleId, paliers, coefs });
    const deuxCouches = prixM2({ surface: 4.2, finition: "structure", complexite: "moyenne", couche: "2", grilleId, paliers, coefs });
    expect(uneCouche).toBe(33.12);
    // 24 × 1,15 × 1,2 × 1,6 = 52,99 € : la seconde couche multiplie, elle ne s'ajoute pas.
    expect(deuxCouches).toBe(52.99);
  });

  it("reste neutre quand la couche n'est pas renseignée ou que la grille n'en déclare pas", () => {
    const sansCouche = prixM2({ surface: 4.2, finition: "structure", complexite: "moyenne", grilleId, paliers, coefs });
    const codeInconnu = prixM2({ surface: 4.2, finition: "structure", complexite: "moyenne", couche: "7", grilleId, paliers, coefs });
    expect(sansCouche).toBe(33.12);
    expect(codeInconnu).toBe(33.12);
  });

  it("n'affecte pas une grille qui ne déclare aucune couche", async () => {
    const contrat = await chargerGrille(sb, ctx.seed.grilleContratId);
    const prix = (couche: string | null) =>
      prixM2({ surface: 5.4, finition: "mat", complexite: "simple", couche, grilleId: ctx.seed.grilleContratId, ...contrat });
    expect(prix(null)).toBe(20);
    expect(prix("2")).toBe(20);
    expect(couchesDisponibles(contrat.coefs, ctx.seed.grilleContratId)).toHaveLength(0);
    expect(coucheParDefaut(contrat.coefs, ctx.seed.grilleContratId)).toBeNull();
  });

  it("propose par défaut la couche la moins majorante", () => {
    expect(couchesDisponibles(coefs, grilleId).map((c) => c.code)).toEqual(["1", "2"]);
    expect(coucheParDefaut(coefs, grilleId)).toBe("1");
  });

  it("porte le choix jusque dans le total du devis enregistré", async () => {
    const items = [ligneM2({ surface: 4.2, finition: "structure", complexite: "moyenne", couche: "2", grilleId, paliers, coefs })];
    expect(items[0].total_ht).toBe(222.56); // 4,2 × 52,99
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    const { data: relu } = await sb.from("devis").select("items, total_ht").eq("id", devis.id).single();
    expect(nb(relu!.total_ht)).toBe(222.56);
    expect((relu!.items as DevisItem[])[0].meta!.couche).toBe("2");
    await sb.from("devis").delete().eq("id", devis.id);
  });
});

describe("coefficient de complexité d'une pièce type", () => {
  it("majore le prix déduit de la grille au m²", async () => {
    const { data } = await sb.from("pieces_types").select("*").eq("id", ctx.seed.pieceTypePortailId).single();
    const piece = data as PieceType;
    // 4,2 m² → palier 3–10 à 24 €, mat et simple = 24 €, majoré du coefficient 1,3 = 31,20 €.
    expect(prixPieceType(piece, 24)).toBe(31.2);
    const ligne = lignePieceTypeGrille({ piece, grilleId, paliers, coefs, couche: "1" });
    expect(ligne.pu_ht).toBe(31.2);
    expect(ligne.total_ht).toBe(131.04);
  });

  it("vaut 1 quand il n'est pas renseigné : une pièce type sans coefficient garde son prix", async () => {
    const { data } = await sb.from("pieces_types").select("*").eq("id", ctx.seed.pieceTypeId).single();
    const jante = data as PieceType;
    expect(prixPieceType(jante, 55)).toBe(55);
    expect(prixPieceType({ ...jante, coef_complexite: null }, 55)).toBe(55);
    // Un coefficient absurde (0 ou négatif) ne doit jamais annuler un prix.
    expect(prixPieceType({ ...jante, coef_complexite: 0 }, 55)).toBe(55);
  });
});

describe("forfait minimum de facturation", () => {
  const forfait = 50;

  function chiffrer(items: DevisItem[], remise: { type: "pct" | "montant"; valeur: number } | null = null) {
    const applique = appliquerForfaitMinimum({ items, remise, forfaitMinimum: forfait });
    return { ...applique, totaux: calcTotaux(applique.items, remise) };
  }

  it("relève une petite pièce au plancher, avec une ligne explicite", () => {
    // 0,3 m² × 45 € (palier 0–1) = 13,50 € : sans plancher, l'atelier facture 13,50 €.
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    expect(petite.total_ht).toBe(13.5);

    const { items, complement, totaux } = chiffrer([petite]);
    expect(complement).toBe(36.5);
    expect(totaux.total_ht).toBe(50);
    expect(totaux.total_ttc).toBe(60);

    const ligne = items[items.length - 1];
    expect(estForfaitMinimum(ligne)).toBe(true);
    expect(ligne.libelle).toBe("Forfait minimum");
    expect(ligne.total_ht).toBe(36.5);
    // Le complément suit la TVA du laquage : c'est la même opération, relevée.
    expect(ligne.tva).toBe(20);
  });

  it("s'applique APRÈS la remise, sinon le plancher n'en est pas un", () => {
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    const { complement, totaux } = chiffrer([petite], { type: "pct", valeur: 12 });
    // 13,50 − 12 % = 11,88 € ; le complément comble jusqu'à 50 €, il n'est pas remisé à son tour.
    expect(complement).toBe(38.12);
    expect(totaux.total_ht).toBe(50);
  });

  it("ne se déclenche pas au-dessus du plancher", () => {
    const ligne = ligneM2({ surface: 4.2, finition: "structure", complexite: "moyenne", couche: "1", grilleId, paliers, coefs });
    const { items, complement, totaux } = chiffrer([ligne]);
    expect(complement).toBe(0);
    expect(items).toHaveLength(1);
    expect(totaux.total_ht).toBe(139.1);
  });

  it("ne relève pas un devis sans aucune ligne au m²", () => {
    const prestation = lignePrestation({ prestationId: ctx.seed.prestationSablageId, nom: "Sablage", unite: "piece", qte: 1, pu: 20, negocie: false });
    const libre = ligneLibre({ libelle: "Retouche", qte: 1, pu: 12 });
    const { items, complement, totaux } = chiffrer([prestation, libre]);
    expect(complement).toBe(0);
    expect(items).toHaveLength(2);
    expect(totaux.total_ht).toBe(32);
  });

  it("est recalculé et non empilé quand le devis est repris", () => {
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    const premier = chiffrer([petite]);
    // L'atelier ajoute une ligne : le complément d'hier ne doit ni rester tel quel ni se dédoubler.
    const second = chiffrer([...premier.items, ligneLibre({ libelle: "Masquage", qte: 1, pu: 20 })]);
    expect(second.items.filter(estForfaitMinimum)).toHaveLength(1);
    expect(second.complement).toBe(16.5);
    expect(second.totaux.total_ht).toBe(50);

    // Une fois le devis étoffé au-delà du plancher, la ligne disparaît d'elle-même.
    const troisieme = chiffrer([...second.items, ligneLibre({ libelle: "Sablage", qte: 1, pu: 100 })]);
    expect(troisieme.items.filter(estForfaitMinimum)).toHaveLength(0);
    expect(troisieme.totaux.total_ht).toBe(133.5);
  });

  it("reste hors de l'assiette de remise dans calcTotaux", () => {
    const items = chiffrer([ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs })], { type: "pct", valeur: 50 }).items;
    // Remise de 50 % : 13,50 → 6,75, complément 43,25. Le total reste exactement au plancher.
    expect(calcTotaux(items, { type: "pct", valeur: 50 }).total_ht).toBe(50);
  });

  it("est enregistré en base et relu tel quel", async () => {
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", couche: "1", grilleId, paliers, coefs });
    // Le client simple n'a pas de grille négociée : c'est la grille par défaut, à 50 € de plancher.
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items: [petite] });
    const { data: relu } = await sb.from("devis").select("items, total_ht, total_ttc").eq("id", devis.id).single();
    const lignes = relu!.items as DevisItem[];
    expect(lignes).toHaveLength(2);
    expect(estForfaitMinimum(lignes[1])).toBe(true);
    expect(nb(relu!.total_ht)).toBe(50);
    expect(nb(relu!.total_ttc)).toBe(60);
    await sb.from("devis").delete().eq("id", devis.id);
  });

  it("ne s'applique pas à une grille dont le plancher est à zéro", async () => {
    const contrat = await chargerGrille(sb, ctx.seed.grilleContratId);
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, ...contrat });
    // Le client sous contrat porte la grille « menuisier », forfait minimum à 0.
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items: [petite] });
    const { data: relu } = await sb.from("devis").select("items, total_ht").eq("id", devis.id).single();
    expect(relu!.items).toHaveLength(1);
    expect(nb(relu!.total_ht)).toBe(6); // 0,3 × 20 €
    await sb.from("devis").delete().eq("id", devis.id);
  });
});

describe("un devis déjà signé n'est pas rechiffré par les nouvelles règles", () => {
  it("garde ses lignes, son total et refuse toute correction a posteriori", async () => {
    // Devis tel qu'un atelier a pu en signer un AVANT la mise en place du plancher : 13,50 €,
    // sans ligne de forfait minimum. On l'insère directement, sans passer par `creerDevis`.
    const petite = ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", grilleId, paliers, coefs });
    const totauxAncien = calcTotaux([petite], null);
    const { data: ancien, error: errInsert } = await sb
      .from("devis")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, items: [petite], remise: null, ...totauxAncien })
      .select("*")
      .single();
    expect(errInsert).toBeNull();
    expect(nb(ancien!.total_ht)).toBe(13.5);

    const envoye = await finaliserDevis(sb, ancien!.id);
    const anon = clientAnonyme(ctx);
    const { data: signe } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Client d'avant", p_signature: {}, p_ip: null,
    });
    expect(signe).toBe(true);

    // Rejouer le chiffrage aujourd'hui donnerait 50 € : le devis signé, lui, reste à 13,50 €.
    expect(appliquerForfaitMinimum({ items: [petite], remise: null, forfaitMinimum: 50 }).complement).toBe(36.5);

    const { data: relu } = await sb.from("devis").select("*").eq("id", ancien!.id).single();
    expect(relu!.status).toBe("signe");
    expect(relu!.items).toHaveLength(1);
    expect(nb(relu!.total_ht)).toBe(13.5);
    expect(nb(relu!.total_ttc)).toBe(16.2);

    // Et la base refuse qu'on « régularise » un document signé.
    const rechiffre = appliquerForfaitMinimum({ items: [petite], remise: null, forfaitMinimum: 50 });
    const { error } = await sb
      .from("devis")
      .update({ items: rechiffre.items, ...calcTotaux(rechiffre.items, null) })
      .eq("id", ancien!.id);
    expect(error).not.toBeNull();

    const { data: apres } = await sb.from("devis").select("total_ht, items").eq("id", ancien!.id).single();
    expect(nb(apres!.total_ht)).toBe(13.5);
    expect(apres!.items).toHaveLength(1);
  });
});
