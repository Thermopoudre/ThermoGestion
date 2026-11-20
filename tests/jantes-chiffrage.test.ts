import { describe, expect, it } from "vitest";
import {
  CODES_PRESTATION_JANTE,
  libelleJeu,
  lignesOperationsJantes,
  ligneJeuJantes,
  positionsParDefaut,
  prixJante,
  statutJeuDepuisJantes,
  surfaceJante,
} from "@/lib/jantes";
import { appliquerForfaitMinimum } from "@/lib/calculs";
import { calcTotaux, montantRemise, qteFr, sousTotalRemisable } from "@/lib/utils";
import type { ClientTarif, GrilleCoef, JantePalier, Prestation } from "@/lib/types";

const GRILLE = "g-standard";
const AUTRE_GRILLE = "g-contrat";

const paliers: JantePalier[] = [
  { id: "p1", atelier_id: "a", grille_id: GRILLE, diametre_min: 0, diametre_max: 17, prix_jante_ht: 70 },
  { id: "p2", atelier_id: "a", grille_id: GRILLE, diametre_min: 17, diametre_max: 19, prix_jante_ht: 85 },
  { id: "p3", atelier_id: "a", grille_id: GRILLE, diametre_min: 19, diametre_max: 21, prix_jante_ht: 100 },
  { id: "p4", atelier_id: "a", grille_id: GRILLE, diametre_min: 21, diametre_max: null, prix_jante_ht: 130 },
  // Grille dédiée d'un garage sous contrat : même barème, prix négocié.
  { id: "p5", atelier_id: "a", grille_id: AUTRE_GRILLE, diametre_min: 0, diametre_max: null, prix_jante_ht: 75 },
];

const coefs: GrilleCoef[] = [
  { id: "c1", grille_id: GRILLE, atelier_id: "a", categorie: "jante_dessin", code: "pleine", libelle: "Pleine / 5 branches", coef: 1 },
  { id: "c2", grille_id: GRILLE, atelier_id: "a", categorie: "jante_dessin", code: "standard", libelle: "Standard", coef: 1.15 },
  { id: "c3", grille_id: GRILLE, atelier_id: "a", categorie: "jante_dessin", code: "multibranches", libelle: "Multibranches fines", coef: 1.4 },
  { id: "c4", grille_id: GRILLE, atelier_id: "a", categorie: "jante_finition", code: "unie", libelle: "Teinte unie", coef: 1 },
  { id: "c5", grille_id: GRILLE, atelier_id: "a", categorie: "jante_finition", code: "diamantee", libelle: "Diamantée", coef: 1.6 },
  { id: "c6", grille_id: GRILLE, atelier_id: "a", categorie: "jante_finition", code: "bicolore", libelle: "Bicolore", coef: 1.35 },
  // Coefficients au m² de la même grille : ils ne doivent jamais entrer dans le prix d'une jante.
  { id: "c7", grille_id: GRILLE, atelier_id: "a", categorie: "finition", code: "unie", libelle: "Mat", coef: 9 },
  { id: "c8", grille_id: GRILLE, atelier_id: "a", categorie: "complexite", code: "standard", libelle: "Simple", coef: 9 },
];

describe("prixJante — palier au pouce × dessin × finition", () => {
  it("lit le palier borne basse incluse, borne haute exclue", () => {
    // 19 pouces pile tombe dans 19–21, pas dans 17–19 : même convention que les paliers au m².
    expect(prixJante({ diametre: 19, dessin: "pleine", finition: "unie", grilleId: GRILLE, paliers, coefs })).toBe(100);
    expect(prixJante({ diametre: 18.9, dessin: "pleine", finition: "unie", grilleId: GRILLE, paliers, coefs })).toBe(85);
  });

  it("sert la dernière tranche quand `diametre_max` est nul", () => {
    expect(prixJante({ diametre: 23, dessin: "pleine", finition: "unie", grilleId: GRILLE, paliers, coefs })).toBe(130);
  });

  it("multiplie le dessin et la finition entre eux", () => {
    // 100 × 1,4 (multibranches) × 1,6 (diamantée) = 224
    expect(prixJante({ diametre: 19, dessin: "multibranches", finition: "diamantee", grilleId: GRILLE, paliers, coefs })).toBe(224);
  });

  it("ne confond jamais un coefficient de jante avec un coefficient au m²", () => {
    // `unie` et `standard` existent dans les deux familles de coefficients, avec des valeurs
    // volontairement absurdes côté m² : si la catégorie n'était pas filtrée, le prix exploserait.
    expect(prixJante({ diametre: 19, dessin: "standard", finition: "unie", grilleId: GRILLE, paliers, coefs })).toBe(115);
  });

  it("vaut 1 sur un code de coefficient absent plutôt que de faire tomber le prix à zéro", () => {
    expect(prixJante({ diametre: 19, dessin: "inconnu", finition: "inexistante", grilleId: GRILLE, paliers, coefs })).toBe(100);
  });

  it("applique la grille dédiée du client quand elle en a une", () => {
    expect(prixJante({ diametre: 19, dessin: "pleine", finition: "unie", grilleId: AUTRE_GRILLE, paliers, coefs })).toBe(75);
  });

  it("rend 0 sans barème plutôt qu'un prix inventé", () => {
    expect(prixJante({ diametre: 19, dessin: "pleine", finition: "unie", grilleId: "g-vide", paliers, coefs })).toBe(0);
  });
});

describe("surfaceJante", () => {
  it("suit les valeurs déjà retenues par la bibliothèque de pièces types", () => {
    // La bibliothèque livrée avec le produit pose 17" = 0,9 m² et 19" = 1,1 m² : le module
    // jantes ne doit pas annoncer une autre surface pour la même jante.
    expect(surfaceJante(17)).toBe(0.9);
    expect(surfaceJante(19)).toBe(1.1);
    expect(surfaceJante(15)).toBe(0.7);
  });

  it("ne descend jamais sous un plancher, même sur une saisie aberrante", () => {
    expect(surfaceJante(0)).toBe(0.3);
    expect(surfaceJante(-5)).toBe(0.3);
  });
});

describe("ligneJeuJantes — la ligne de devis", () => {
  const ligne = ligneJeuJantes({
    nbJantes: 4,
    diametre: 19,
    dessin: "multibranches",
    finition: "diamantee",
    teinte: "Frozen Grey",
    teinteReference: "C3Z",
    vehicule: { marque: "BMW", modele: "Série 3", annee: 2021 },
    grilleId: GRILLE,
    paliers,
    coefs,
  });

  it("porte la quantité en jantes et le prix unitaire à la jante", () => {
    expect(ligne.qte).toBe(4);
    expect(ligne.pu_ht).toBe(224);
    expect(ligne.total_ht).toBe(896);
  });

  it("se compte en jantes sur les documents, pas en pièces", () => {
    // Un concessionnaire lit « 4 jantes » et recalcule son devis ; « 4 pièces » l'oblige à
    // deviner de quoi on parle sur une facture qui porte aussi des prestations à la pièce.
    expect(ligne.unite).toBe("jante");
    expect(qteFr(ligne.qte, ligne.unite)).toBe("4 jantes");
    expect(qteFr(1, "jante")).toBe("1 jante");
  });

  it("se déclare ligne de jantes dans son `meta`, jamais par son libellé", () => {
    // Le libellé est modifiable par l'atelier : le reconnaître dessus ferait perdre la marque
    // dès la première retouche de texte, exactement comme le forfait minimum.
    expect(ligne.meta?.jante).toBe(true);
    expect(ligne.type).toBe("libre");
  });

  it("porte la surface d'UNE jante, celle que le projet multipliera par la quantité", () => {
    // `trg_devis_signe` calcule `meta.surface_m2 × qte`. Porter la surface du jeu entier
    // quadruplerait la surface du projet, donc la poudre, l'énergie et la charge du four.
    expect(ligne.meta?.surface_m2).toBe(1.1);
    expect(Number(ligne.meta?.surface_m2) * ligne.qte).toBeCloseTo(4.4, 5);
  });

  it("nomme le jeu comme le garage le nomme, pas comme un numéro de projet", () => {
    expect(ligne.libelle).toBe(
      "Jeu de 4 jantes 19″ — BMW Série 3 (2021) — teinte d'origine Frozen Grey (C3Z) — diamantée",
    );
  });
});

describe("libelleJeu", () => {
  it("dit « Jante » au singulier pour une jante isolée après un choc de trottoir", () => {
    expect(libelleJeu({ nbJantes: 1, diametre: 18, finition: "unie", teinte: "Noir brillant" }))
      .toBe("Jante 18″ — teinte Noir brillant");
  });

  it("annonce la roue de secours quand le jeu est de cinq", () => {
    expect(libelleJeu({ nbJantes: 5, diametre: 17, finition: "unie" }))
      .toBe("Jeu de 5 jantes 17″ (dont roue de secours)");
  });

  it("écrit « teinte d'origine » seulement quand la teinte vient du véhicule", () => {
    const origine = libelleJeu({ nbJantes: 4, diametre: 19, finition: "unie", teinte: "Frozen Grey", teinteOrigine: true });
    const libre = libelleJeu({ nbJantes: 4, diametre: 19, finition: "unie", teinte: "Noir mat", teinteOrigine: false });
    expect(origine).toContain("teinte d'origine Frozen Grey");
    expect(libre).toContain("teinte Noir mat");
    expect(libre).not.toContain("origine");
  });

  it("n'accole jamais la référence constructeur à une teinte qui n'est pas celle d'origine", () => {
    // Trouvé à l'écran sur la démonstration : une Golf livrée en Gris Argent (LY7W) repeinte en
    // noir mat affichait « teinte Noir mat (LY7W) » — le code d'une autre teinte, sur le devis
    // d'un client. Le garde-fou est dans la fonction, pas dans l'appelant : trois écrans
    // construisent ce libellé.
    expect(libelleJeu({ nbJantes: 4, diametre: 18, finition: "unie", teinte: "Noir mat", teinteReference: "LY7W", teinteOrigine: false }))
      .toBe("Jeu de 4 jantes 18″ — teinte Noir mat");
    expect(libelleJeu({ nbJantes: 4, diametre: 18, finition: "unie", teinte: "Gris Argent", teinteReference: "LY7W", teinteOrigine: true }))
      .toBe("Jeu de 4 jantes 18″ — teinte d'origine Gris Argent (LY7W)");
  });

  it("retire de la finition l'explication du réglage", () => {
    // Trouvé à l'écran : le titre du dossier annonçait « diamantée (usinage cnc de la face) ».
    // La parenthèse aide l'atelier à choisir dans une liste de réglages ; sur un devis, elle
    // encombre. Vaut aussi pour le libellé propre à l'atelier.
    expect(libelleJeu({ nbJantes: 4, diametre: 19, finition: "diamantee" })).toBe("Jeu de 4 jantes 19″ — diamantée");
    expect(libelleJeu({
      nbJantes: 4, diametre: 19, finition: "diamantee",
      finitionsLibelles: { diamantee: "Diamantée (usinage CNC de la face)" },
    })).toBe("Jeu de 4 jantes 19″ — diamantée");
  });

  it("affiche le demi-pouce sans zéro inutile", () => {
    expect(libelleJeu({ nbJantes: 4, diametre: 18.5, finition: "unie" })).toContain("18,5″");
    expect(libelleJeu({ nbJantes: 4, diametre: 19.0, finition: "unie" })).toContain("19″");
  });
});

describe("lignesOperationsJantes — les opérations mécaniques", () => {
  const prestations: Prestation[] = [
    { id: "pr1", atelier_id: "a", code: CODES_PRESTATION_JANTE.devoilage, nom: "Dévoilage", description: null, unite: "piece", prix_unitaire_ht: 25, tva_rate: 20, categorie: "jantes", nature: "services", actif: true, ordre: 1 },
    // La valve TPMS est une pièce revendue, pas un travail : c'est une livraison de biens.
    { id: "pr2", atelier_id: "a", code: CODES_PRESTATION_JANTE.valve_tpms, nom: "Valve TPMS", description: null, unite: "piece", prix_unitaire_ht: 45, tva_rate: 20, categorie: "jantes", nature: "biens", actif: true, ordre: 2 },
  ];
  const tarifs: ClientTarif[] = [{ id: "t1", atelier_id: "a", client_id: "cli-garage", prestation_id: "pr1", prix_ht: 20 }];

  it("compte une ligne par opération, quantifiée au nombre de jantes concernées", () => {
    // Une seule jante voilée sur quatre : le garage doit lire « 1 », pas « 4 ».
    const lignes = lignesOperationsJantes({ operations: { devoilage: 1 }, prestations, clientId: null, clientTarifs: [] });
    expect(lignes).toHaveLength(1);
    expect(lignes[0].qte).toBe(1);
    expect(lignes[0].total_ht).toBe(25);
  });

  it("applique le tarif négocié du garage", () => {
    const lignes = lignesOperationsJantes({ operations: { devoilage: 4 }, prestations, clientId: "cli-garage", clientTarifs: tarifs });
    expect(lignes[0].pu_ht).toBe(20);
    expect(lignes[0].total_ht).toBe(80);
  });

  it("ignore une opération dont la prestation n'est pas déclarée, sans la facturer à zéro", () => {
    // Facturer 0 € une opération réellement faite est pire que ne pas la proposer : l'atelier
    // croirait l'avoir vendue.
    const lignes = lignesOperationsJantes({ operations: { soudure: 2 }, prestations, clientId: null, clientTarifs: [] });
    expect(lignes).toHaveLength(0);
  });

  it("ne pose aucune ligne pour une opération à zéro jante", () => {
    const lignes = lignesOperationsJantes({ operations: { devoilage: 0, valve_tpms: 4 }, prestations, clientId: null, clientTarifs: [] });
    expect(lignes.map((l) => l.meta?.operation_jante)).toEqual(["valve_tpms"]);
  });

  it("marque chaque ligne comme opération de jante, pour la retrouver plus tard", () => {
    const lignes = lignesOperationsJantes({ operations: { valve_tpms: 4 }, prestations, clientId: null, clientTarifs: [] });
    expect(lignes[0].meta?.jante).toBe(true);
    expect(lignes[0].meta?.operation_jante).toBe("valve_tpms");
  });
});

describe("Cohérence avec le moteur de totaux existant", () => {
  const jeu = ligneJeuJantes({ nbJantes: 4, diametre: 19, dessin: "pleine", finition: "unie", grilleId: GRILLE, paliers, coefs });

  it("la remise contractuelle porte bien sur le jeu de jantes", () => {
    // Cinquième vérification de la même famille de bug : une remise qui saute entre deux
    // documents. Une ligne de jantes est une ligne remisable ordinaire.
    const items = [jeu];
    expect(sousTotalRemisable(items)).toBe(400);
    expect(montantRemise(items, { type: "pct", valeur: 12 })).toBe(48);
    expect(calcTotaux(items, { type: "pct", valeur: 12 }).total_ht).toBe(352);
  });

  it("le forfait minimum au m² ne relève pas un devis de jantes", () => {
    // Décision documentée : le plancher est un réglage de la grille au m². Une jante isolée à
    // 100 € n'a pas à être relevée à un minimum calibré sur des portails, et le jeu de 4 est de
    // toute façon très au-dessus. Le comportement est le même que pour une prestation seule.
    const { items, complement } = appliquerForfaitMinimum({ items: [jeu], remise: null, forfaitMinimum: 5000 });
    expect(complement).toBe(0);
    expect(items).toHaveLength(1);
  });

  it("un devis mixte jantes + m² déclenche le plancher sur son total, jantes comprises", () => {
    const ligneM2 = { type: "m2" as const, libelle: "Portail", qte: 1, unite: "m2", pu_ht: 30, tva: 20, total_ht: 30, meta: { surface: 1 } };
    const { complement } = appliquerForfaitMinimum({ items: [jeu, ligneM2], remise: null, forfaitMinimum: 500 });
    expect(complement).toBe(70);
  });
});

describe("positionsParDefaut", () => {
  it("propose les quatre roues dans l'ordre où le garage les pose", () => {
    expect(positionsParDefaut(4)).toEqual(["avg", "avd", "arg", "ard"]);
  });
  it("ajoute la roue de secours en cinquième", () => {
    expect(positionsParDefaut(5)).toEqual(["avg", "avd", "arg", "ard", "secours"]);
  });
  it("n'invente pas de position au-delà de cinq", () => {
    expect(positionsParDefaut(9)).toHaveLength(5);
  });
});

describe("statutJeuDepuisJantes — le jeu ne peut pas être prêt avant sa dernière jante", () => {
  it("reste « reçu » tant que rien n'a démarré", () => {
    expect(statutJeuDepuisJantes(["a_faire", "a_faire", "a_faire", "a_faire"])).toBe("recu");
  });
  it("passe « en cours » dès qu'une jante bouge", () => {
    expect(statutJeuDepuisJantes(["en_cours", "a_faire", "a_faire", "a_faire"])).toBe("en_cours");
  });
  it("n'est pas prêt quand trois jantes le sont et qu'une est en retouche", () => {
    // C'est le cas qui fait perdre confiance dans un tableau de bord : la liste annonce « prêt »,
    // le client vient chercher, et il manque une jante.
    expect(statutJeuDepuisJantes(["prete", "prete", "prete", "retouche"])).toBe("en_cours");
  });
  it("est prêt quand toutes les jantes sont prêtes", () => {
    expect(statutJeuDepuisJantes(["prete", "prete", "prete", "prete"])).toBe("pret");
  });
  it("compte une jante mise au rebut comme traitée : elle ne reviendra pas", () => {
    expect(statutJeuDepuisJantes(["prete", "prete", "prete", "rebut"])).toBe("pret");
  });
  it("rend « reçu » sur un jeu encore vide", () => {
    expect(statutJeuDepuisJantes([])).toBe("recu");
  });
});
