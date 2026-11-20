import { describe, expect, it } from "vitest";
import { ligneJeuJantes, lignesJantesOuvrables, prefillJanteDepuisDevis } from "@/lib/jantes";
import type { DevisItem, GrilleCoef, JantePalier } from "@/lib/types";

/**
 * Amélioration n°8 (07/09/2026) — préchargement de la fiche jante depuis le devis.
 *
 * Ces tests portent sur les deux fonctions pures qui font tout le travail : repérer, dans un
 * devis, les lignes de jantes encore sans dossier physique (`lignesJantesOuvrables`), puis
 * traduire une telle ligne en valeurs de préremplissage pour `/jantes/new`
 * (`prefillJanteDepuisDevis`). Aucun accès réseau ni base ici — la logique métier se vérifie
 * sans compte de test, ce que la cohabitation de plusieurs agents sur le même compte partagé rend
 * précieux.
 */

const GRILLE = "g-standard";
const paliers: JantePalier[] = [
  { id: "p1", atelier_id: "a", grille_id: GRILLE, diametre_min: 0, diametre_max: null, prix_jante_ht: 100 },
];
const coefs: GrilleCoef[] = [];

function ligneDevisJante(overrides: Partial<Parameters<typeof ligneJeuJantes>[0]> = {}): DevisItem {
  return ligneJeuJantes({
    nbJantes: 4, diametre: 19, dessin: "multibranches", finition: "diamantee",
    teinte: "Frozen Grey", teinteReference: "C3Z",
    vehiculeId: "veh-1",
    grilleId: GRILLE, paliers, coefs,
    ...overrides,
  });
}

describe("lignesJantesOuvrables — repérer les jeux d'un devis encore sans dossier", () => {
  it("ignore une ligne qui n'est pas une ligne de jantes", () => {
    const items: DevisItem[] = [{ type: "libre", libelle: "Portail", qte: 1, unite: "piece", pu_ht: 300, tva: 20, total_ht: 300 }];
    expect(lignesJantesOuvrables({ id: "d1", numero: "DV-1", items })).toHaveLength(0);
  });

  it("propose une ligne de jantes qui n'a encore aucun jeu ouvert", () => {
    const items = [ligneDevisJante()];
    const lignes = lignesJantesOuvrables({ id: "d1", numero: "DV-2026-0031", items });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      devisId: "d1", devisNumero: "DV-2026-0031", itemIndex: 0,
      qte: 4, meta: expect.objectContaining({ teinte: "Frozen Grey", teinte_reference: "C3Z" }),
    });
  });

  it("n'écarte pas une ligne dont le jeu associé a été supprimé (`jeu_jantes_id` redevenu vide)", () => {
    // Filet de sécurité : seule une valeur réellement posée doit fermer la porte à la reprise.
    const items = [ligneDevisJante({ jeuId: null })];
    expect(items[0].meta?.jeu_jantes_id).toBeNull();
    expect(lignesJantesOuvrables({ id: "d1", numero: "DV-1", items })).toHaveLength(1);
  });

  it("exclut une ligne déjà rattachée à un jeu, pour ne jamais ouvrir un second dossier pour la même jante", () => {
    // `jeux_jantes.devis_id` n'a pas de contrainte d'unicité en base : c'est ici, côté
    // application, que le doublon est empêché.
    const items = [ligneDevisJante({ jeuId: "jeu-existant-1" })];
    expect(lignesJantesOuvrables({ id: "d1", numero: "DV-1", items })).toHaveLength(0);
  });

  it("garde l'index d'origine sur un devis mixte (jantes + prestation + jantes)", () => {
    const items: DevisItem[] = [
      ligneDevisJante({ vehiculeId: "veh-1" }),
      { type: "prestation", libelle: "Dévoilage", qte: 1, unite: "piece", pu_ht: 25, tva: 20, total_ht: 25, meta: { jante: true, operation_jante: "devoilage" } },
      ligneDevisJante({ vehiculeId: "veh-2", teinte: "Noir mat", teinteReference: null }),
    ];
    const lignes = lignesJantesOuvrables({ id: "d1", numero: "DV-1", items });
    // La ligne d'opération mécanique (meta.jante === true mais pas un jeu) n'est pas un jeu à ouvrir :
    // seule `ligneJeuJantes` pose `meta.diametre_pouces`/`dessin`/`finition`, jamais `lignesOperationsJantes`.
    expect(lignes.map((l) => l.itemIndex)).toEqual([0, 2]);
    expect(lignes[1].meta.vehicule_id).toBe("veh-2");
  });

  it("rend un tableau vide sur un devis sans lignes (`items` null ou absent)", () => {
    expect(lignesJantesOuvrables({ id: "d1", numero: null, items: null })).toEqual([]);
    expect(lignesJantesOuvrables({ id: "d1", numero: null, items: undefined })).toEqual([]);
  });
});

describe("prefillJanteDepuisDevis — ce qui a le même sens des deux côtés, et rien de plus", () => {
  it("reprend nombre, diamètre, dessin, finition et teinte demandée", () => {
    const ligne = lignesJantesOuvrables({ id: "d1", numero: "DV-1", items: [ligneDevisJante()] })[0];
    const champs = prefillJanteDepuisDevis(ligne);
    expect(champs).toMatchObject({
      nbJantes: 4, diametrePouces: 19, dessin: "multibranches", finition: "diamantee",
      teinte: "Frozen Grey", teinteReference: "C3Z", vehiculeId: "veh-1",
    });
  });

  it("borne le nombre de jantes entre 1 et 5, comme la contrainte de `jeux_jantes`", () => {
    expect(prefillJanteDepuisDevis({ qte: 0, meta: {} }).nbJantes).toBe(1);
    expect(prefillJanteDepuisDevis({ qte: 8, meta: {} }).nbJantes).toBe(5);
  });

  it("borne le diamètre entre 12 et 26 pouces plutôt que de reprendre une saisie de devis aberrante", () => {
    expect(prefillJanteDepuisDevis({ qte: 4, meta: { diametre_pouces: 5 } }).diametrePouces).toBe(12);
    expect(prefillJanteDepuisDevis({ qte: 4, meta: { diametre_pouces: 30 } }).diametrePouces).toBe(26);
  });

  it("rend `null` sur un diamètre absent ou nul plutôt qu'un faux zéro", () => {
    expect(prefillJanteDepuisDevis({ qte: 4, meta: {} }).diametrePouces).toBeNull();
    expect(prefillJanteDepuisDevis({ qte: 4, meta: { diametre_pouces: 0 } }).diametrePouces).toBeNull();
  });

  it("ne reprend jamais le prix, la grille ou la surface — recalculés au barème du jour", () => {
    const ligne = lignesJantesOuvrables({ id: "d1", numero: "DV-1", items: [ligneDevisJante()] })[0];
    const champs = prefillJanteDepuisDevis(ligne);
    expect(champs).not.toHaveProperty("puHt");
    expect(champs).not.toHaveProperty("surfaceM2");
    expect(champs).not.toHaveProperty("grilleId");
  });

  it("ignore une chaîne vide comme si le champ n'était pas renseigné", () => {
    const champs = prefillJanteDepuisDevis({ qte: 4, meta: { dessin: "", finition: "   ", teinte: "", teinte_reference: "" } });
    expect(champs.dessin).toBeNull();
    expect(champs.finition).toBeNull();
    expect(champs.teinte).toBeNull();
    expect(champs.teinteReference).toBeNull();
  });

  it("ne renvoie pas de véhicule quand le devis n'en connaît aucun (saisie libre sans fiche jantes d'origine)", () => {
    const champs = prefillJanteDepuisDevis({ qte: 4, meta: { diametre_pouces: 18 } });
    expect(champs.vehiculeId).toBeNull();
  });
});
