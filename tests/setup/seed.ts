import type { SupabaseClient } from "@supabase/supabase-js";
import type { Seed } from "../helpers/contexte";

/** Fait échouer bruyamment la moindre écriture de semis : un seed muet donnerait des tests faux. */
async function inserer<T extends Record<string, unknown>>(sb: SupabaseClient, table: string, ligne: T): Promise<string> {
  const { data, error } = await sb.from(table).insert(ligne).select("id").single();
  if (error) throw new Error(`seed ${table} : ${error.message}`);
  return (data as { id: string }).id;
}

async function insererPlusieurs(sb: SupabaseClient, table: string, lignes: Record<string, unknown>[]) {
  const { error } = await sb.from(table).insert(lignes);
  if (error) throw new Error(`seed ${table} : ${error.message}`);
}

/**
 * Jeu de données minimal mais réaliste : la grille à paliers et coefficients de la recette,
 * un client sous contrat (grille dédiée, remise 12 %, paiement à 45 jours, tarif négocié) et un
 * client sans condition particulière, qui sert de témoin.
 *
 * Ni l'atelier ni les clients n'ont d'adresse e-mail : les triggers de notification ne posent
 * alors rien en file, et le cron d'envoi ne peut pas expédier de courriel à un destinataire fictif.
 */
export async function semer(sb: SupabaseClient, atelierId: string): Promise<Seed> {
  const { error: errAtelier } = await sb
    .from("ateliers")
    .update({
      siren: "900123456",
      siret: "90012345600018",
      forme_juridique: "SARL",
      capital_social: "10000",
      rcs_ville: "Toulon",
      tva_intra: "FR12900123456",
      code_ape: "2561Z",
      adresse: "12 quai du Port",
      code_postal: "83150",
      ville: "Bandol",
      telephone: "0400000000",
      assujetti_tva: true,
      delai_paiement_jours: 30,
      penalites_taux: 10,
      escompte_texte: "Aucun escompte pour paiement anticipé.",
      assurance_nom: "AXA",
      assurance_contrat: "RC-TEST-001",
      assurance_zone: "France métropolitaine",
      four_capacite_m2: 9,
      four_conso_kwh: 18,
      prix_kwh: 0.19,
    })
    .eq("id", atelierId);
  if (errAtelier) throw new Error(`seed ateliers : ${errAtelier.message}`);

  // Coordonnées bancaires et paramètres de coût vivent dans deux tables satellites depuis le
  // chantier « rôles » : un privilège de colonne ne sait pas distinguer owner, bureau et atelier,
  // qui partagent le rôle Postgres `authenticated`. Seule la RLS le sait, et elle filtre des
  // lignes — donc la donnée sensible a sa propre ligne, dans sa propre table.
  const { error: errBanque } = await sb
    .from("ateliers_bancaire")
    .upsert({ atelier_id: atelierId, iban: "FR7630001007941234567890185", bic: "BDFEFRPPXXX" });
  if (errBanque) throw new Error(`seed ateliers_bancaire : ${errBanque.message}`);

  const { error: errCouts } = await sb
    .from("ateliers_couts")
    .upsert({ atelier_id: atelierId, taux_horaire: 42, frais_generaux_pct: 12 });
  if (errCouts) throw new Error(`seed ateliers_couts : ${errCouts.message}`);

  const grilleStandardId = await inserer(sb, "grilles_tarifaires", {
    atelier_id: atelierId, nom: "Grille standard m2", forfait_minimum: 50, is_default: true, actif: true,
  });
  const grilleContratId = await inserer(sb, "grilles_tarifaires", {
    atelier_id: atelierId, nom: "Grille contrat menuisier", forfait_minimum: 0, is_default: false, actif: true,
  });

  await insererPlusieurs(sb, "grille_paliers", [
    { atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 0, surface_max: 1, prix_m2: 45 },
    { atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 1, surface_max: 3, prix_m2: 32 },
    { atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 3, surface_max: 10, prix_m2: 24 },
    { atelier_id: atelierId, grille_id: grilleStandardId, surface_min: 10, surface_max: null, prix_m2: 18 },
    { atelier_id: atelierId, grille_id: grilleContratId, surface_min: 0, surface_max: null, prix_m2: 20 },
  ]);

  await insererPlusieurs(sb, "grille_coefs", [
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "finition", code: "mat", libelle: "Mat", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "finition", code: "brillant", libelle: "Brillant", coef: 1.05 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "finition", code: "structure", libelle: "Structuré", coef: 1.15 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "complexite", code: "simple", libelle: "Simple", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "complexite", code: "moyenne", libelle: "Moyenne", coef: 1.2 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "complexite", code: "complexe", libelle: "Complexe", coef: 1.45 },
    // Nombre de couches : une seconde couche, c'est un second passage en cabine et une seconde
    // cuisson. La grille contrat n'en déclare pas — le coefficient doit y rester neutre.
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "couche", code: "1", libelle: "1 couche", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "couche", code: "2", libelle: "2 couches", coef: 1.6 },
    { atelier_id: atelierId, grille_id: grilleContratId, categorie: "finition", code: "mat", libelle: "Mat", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleContratId, categorie: "complexite", code: "simple", libelle: "Simple", coef: 1 },
    // Jantes : dessin et finition vivent dans la même table de coefficients que le m². Les codes
    // `mat` / `simple` du m² ne doivent jamais être lus par le chiffrage jante, et inversement.
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "jante_dessin", code: "pleine", libelle: "Pleine", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "jante_dessin", code: "multibranches", libelle: "Multibranches", coef: 1.4 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "jante_finition", code: "unie", libelle: "Teinte unie", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleStandardId, categorie: "jante_finition", code: "diamantee", libelle: "Diamantée", coef: 1.6 },
    { atelier_id: atelierId, grille_id: grilleContratId, categorie: "jante_dessin", code: "pleine", libelle: "Pleine", coef: 1 },
    { atelier_id: atelierId, grille_id: grilleContratId, categorie: "jante_finition", code: "unie", libelle: "Teinte unie", coef: 1 },
  ]);

  // Barème au pouce : la grille contrat du garage est volontairement moins chère et sans tranche,
  // pour prouver qu'un client sous contrat hérite de son propre prix à la jante.
  await insererPlusieurs(sb, "jante_paliers", [
    { atelier_id: atelierId, grille_id: grilleStandardId, diametre_min: 0, diametre_max: 17, prix_jante_ht: 70 },
    { atelier_id: atelierId, grille_id: grilleStandardId, diametre_min: 17, diametre_max: 19, prix_jante_ht: 85 },
    { atelier_id: atelierId, grille_id: grilleStandardId, diametre_min: 19, diametre_max: 21, prix_jante_ht: 100 },
    { atelier_id: atelierId, grille_id: grilleStandardId, diametre_min: 21, diametre_max: null, prix_jante_ht: 130 },
    { atelier_id: atelierId, grille_id: grilleContratId, diametre_min: 0, diametre_max: null, prix_jante_ht: 75 },
  ]);

  const clientRemiseId = await inserer(sb, "clients", {
    atelier_id: atelierId, type: "pro", nom: "Menuiserie Testale", contact: "Patrick Testard",
    siren: "812345678", siret: "81234567800025", email: null,
    adresse: "5 rue des Alizés", code_postal: "83140", ville: "Six-Fours-les-Plages",
    adresse_livraison: "ZA des Playes, lot 7", code_postal_livraison: "83500", ville_livraison: "La Seyne-sur-Mer",
    grille_id: grilleContratId, remise_pct: 12, facturation_mensuelle: true, delai_paiement_jours: 45,
  });
  const clientSimpleId = await inserer(sb, "clients", {
    atelier_id: atelierId, type: "particulier", nom: "Jean Testard", email: null,
    adresse: "1 impasse du Test", code_postal: "83000", ville: "Toulon",
  });

  const prestationSablageId = await inserer(sb, "prestations", {
    atelier_id: atelierId, code: "SAB", nom: "Sablage", unite: "piece", prix_unitaire_ht: 9, tva_rate: 20, ordre: 1, actif: true,
  });
  const prestationMlId = await inserer(sb, "prestations", {
    atelier_id: atelierId, code: "MARQ", nom: "Marquage traçabilité", unite: "ml", prix_unitaire_ht: 4.5, tva_rate: 20, ordre: 2, actif: true,
  });
  // Opérations mécaniques de jantes : reconnues par leur `code`, jamais par leur nom.
  const prestationDevoilageId = await inserer(sb, "prestations", {
    atelier_id: atelierId, code: "JT-DEVOILAGE", nom: "Dévoilage", unite: "piece", prix_unitaire_ht: 25, tva_rate: 20, categorie: "jantes", ordre: 3, actif: true,
  });
  const prestationTpmsId = await inserer(sb, "prestations", {
    // La valve est une pièce revendue, pas un travail : c'est la seule prestation du jeu de test
    // qui soit une livraison de biens, et c'est elle qui fait basculer une facture en « mixte ».
    atelier_id: atelierId, code: "JT-VALVE-TPMS", nom: "Valve TPMS", unite: "piece", prix_unitaire_ht: 45, tva_rate: 20, categorie: "jantes", nature: "biens", ordre: 4, actif: true,
  });
  await insererPlusieurs(sb, "client_tarifs", [
    { atelier_id: atelierId, client_id: clientRemiseId, prestation_id: prestationSablageId, prix_ht: 7.2 },
    { atelier_id: atelierId, client_id: clientRemiseId, prestation_id: prestationDevoilageId, prix_ht: 20 },
  ]);

  const tarifMlId = await inserer(sb, "tarifs_ml", {
    atelier_id: atelierId, famille: "Garde-corps", prix_ml: 28, perimetre_developpe_m: 0.35, ordre: 1, actif: true,
  });
  const pieceTypeId = await inserer(sb, "pieces_types", {
    atelier_id: atelierId, nom: 'Jante alu 17"', categorie: "auto", surface_m2: 0.9, prix_ht: 55,
    temps_minutes: 25, coef_complexite: 1, ordre: 1, actif: true,
  });
  // Pièce sans prix catalogue : elle se chiffre sur la grille au m², majorée de son coefficient
  // de complexité — c'est le cas où ce réglage a un effet visible.
  const pieceTypePortailId = await inserer(sb, "pieces_types", {
    atelier_id: atelierId, nom: "Portail 2 vantaux", categorie: "menuiserie", surface_m2: 4.2, prix_ht: null,
    temps_minutes: 90, coef_complexite: 1.3, ordre: 2, actif: true,
  });

  const poudreId = await inserer(sb, "poudres", {
    atelier_id: atelierId, marque: "TestPowder", reference: "TEST-RAL7016-TEXTURE", ral: "7016", finition: "texture",
    rendement_m2_kg: 8, stock_kg: 0, temp_cuisson: 200, duree_cuisson_min: 18, actif: true,
  });
  const { error: errPrix } = await sb
    .from("poudre_couts")
    .upsert({ poudre_id: poudreId, atelier_id: atelierId, prix_kg: 15.9 });
  if (errPrix) throw new Error(`seed poudre_couts : ${errPrix.message}`);

  return {
    atelierId, grilleStandardId, grilleContratId, clientRemiseId, clientSimpleId,
    prestationSablageId, prestationMlId, prestationDevoilageId, prestationTpmsId,
    tarifMlId, pieceTypeId, pieceTypePortailId, poudreId,
  };
}
