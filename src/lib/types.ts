import type { TonBadge } from "@/lib/tons";

export type Atelier = {
  id: string;
  nom: string;
  siret: string | null;
  tva_intra: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string;
  telephone: string | null;
  email: string | null;
  logo_url: string | null;
  couleur: string | null;
  assujetti_tva: boolean;
  stripe_account_id: string | null;
  settings: Record<string, unknown>;
  // Identité légale — mentions obligatoires de facture (art. L441-9 code de commerce,
  // art. 242 nonies A annexe II CGI) et socle de la facturation électronique.
  siren: string | null;
  forme_juridique: string | null;
  capital_social: number | null;
  rcs_ville: string | null;
  rm_numero: string | null;
  code_ape: string | null;
  adresse_complement: string | null;
  latitude: number | null;
  longitude: number | null;
  adresse_verifiee: boolean;
  /**
   * IBAN et BIC ne sont plus des colonnes de `ateliers` : ils vivent dans `ateliers_bancaire`,
   * dont la policy ne s'ouvre qu'au responsable. On les garde dans ce type parce que les
   * documents (PDF de facture, XML Factur-X, page publique) attendent un atelier complet — c'est
   * le code serveur qui les rapporte, jamais le navigateur d'un opérateur.
   */
  iban: string | null;
  bic: string | null;
  assurance_nom: string | null;
  assurance_contrat: string | null;
  assurance_zone: string | null;
  delai_paiement_jours: number;
  penalites_taux: number;
  escompte_texte: string | null;
  tva_sur_debits: boolean;
  /** Fiche Google de l'atelier — sans elle, la demande d'avis J+2 ne part pas. */
  avis_google_url: string | null;
  /**
   * Durée de validité appliquée aux nouveaux devis. `null` = 30 jours, le défaut du produit.
   * Jusqu'à la migration 45, les 30 jours venaient du `default` de `devis.validite_jours` et
   * n'étaient saisissables nulle part : l'atelier imprimait « valable 30 jours » sans jamais
   * l'avoir décidé.
   */
  devis_validite_jours: number | null;
  /** Atelier vitrine, consultable publiquement et verrouillé en écriture côté base. */
  demo: boolean;
  /**
   * Médiateur de la consommation (lot C, C6) — mention obligatoire sur les documents adressés à un
   * client particulier (art. L616-1 du code de la consommation). Vides par défaut.
   */
  mediateur_nom: string | null;
  mediateur_adresse: string | null;
  /**
   * Conditions générales de vente par défaut (migration 76). Vide par défaut — aucun modèle n'est
   * fourni. Le texte réellement figé sur un document part de `devis.cgv_texte` / `factures.cgv_texte`,
   * jamais recalculé depuis ce champ une fois le document envoyé/émis.
   */
  cgv: string | null;
};

export type CommandePoudre = {
  id: string;
  atelier_id: string;
  numero: string | null;
  status: "panier" | "envoyee" | "recue" | "annulee";
  fournisseur: string;
  fournisseur_email: string | null;
  note: string | null;
  envoyee_at: string | null;
  recue_at: string | null;
  created_at: string;
};

export type CommandePoudreLigne = {
  id: string;
  commande_id: string;
  atelier_id: string;
  poudre_id: string | null;
  reference: string;
  designation: string | null;
  tp_product_id: number | null;
  quantite_kg: number;
  prix_kg: number | null;
  recue_kg: number | null;
  lot_numero: string | null;
  dlu: string | null;
};

export type AtelierConformite = {
  atelier_id: string;
  siren_ok: boolean;
  adresse_ok: boolean;
  tva_ok: boolean;
  forme_ok: boolean;
  immatriculation_ok: boolean;
};

export type Client = {
  id: string;
  atelier_id: string;
  type: "particulier" | "pro";
  nom: string;
  contact: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  /** Code pays de l'adresse de facturation (BT-40) : obligatoire dans le XML au profil EN16931. */
  pays: string;
  siret: string | null;
  /** Numéro de TVA intracommunautaire du client (BT-48), quand il est assujetti. */
  tva_intra: string | null;
  notes: string | null;
  archive: boolean;
  created_at: string;
  // Le SIREN du client devient une mention obligatoire avec la facturation électronique.
  siren: string | null;
  adresse_livraison: string | null;
  code_postal_livraison: string | null;
  ville_livraison: string | null;
  // Tarifs négociés : le B2B récurrent ne se chiffre pas au coup par coup.
  grille_id: string | null;
  remise_pct: number | null;
  facturation_mensuelle: boolean;
  delai_paiement_jours: number | null;
  /**
   * Faux = ce client n'est jamais relancé automatiquement, quels que soient les réglages de ses
   * devis et de ses factures. C'est l'interrupteur qu'on cherche quand un donneur d'ordre appelle
   * pour dire qu'il en a assez d'être relancé par une machine.
   */
  relances_actives: boolean;
  /**
   * Surcharge facultative des conditions générales de vente de l'atelier (migration 76). Quand
   * elle est renseignée, elle REMPLACE entièrement `ateliers.cgv` sur les devis et factures de ce
   * client — les deux textes ne se concatènent jamais.
   */
  cgv: string | null;
};

export type DevisItem = {
  type: "prestation" | "m2" | "libre";
  libelle: string;
  qte: number;
  unite: string;
  pu_ht: number;
  tva: number;
  total_ht: number;
  meta?: Record<string, unknown>;
  /**
   * Ligne « en option » (lot C, C5) : non comptée dans les totaux du devis tant que le client ne
   * l'a pas retenue à la signature. `option_id` l'identifie de façon stable (indépendante du
   * libellé, modifiable) pour que `signer_devis` sache laquelle a été cochée.
   */
  optionnel?: boolean;
  option_id?: string;
  /** Posé par `signer_devis` sur une option retenue : trace qu'elle a été choisie, pas subie. */
  optionnel_accepte?: boolean;
};

export type Devis = {
  id: string;
  atelier_id: string;
  client_id: string;
  numero: string | null;
  status: "brouillon" | "envoye" | "signe" | "refuse" | "expire" | "remplace";
  items: DevisItem[];
  remise: { type: "pct" | "montant"; valeur: number } | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  notes: string | null;
  validite_jours: number;
  public_token: string;
  envoye_at: string | null;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  /** Rang dans la chaîne des versions : 1 pour un devis d'origine, 2 pour sa première correction. */
  version: number;
  /** Version précédente du même devis. Liste chaînée : `parent_id` désigne le prédécesseur direct. */
  parent_id: string | null;
  /**
   * Pilotage des relances automatiques. Ces trois colonnes existaient depuis l'origine, écrites
   * par le cron de 7 h — mais elles n'étaient déclarées nulle part côté application, et donc
   * affichées nulle part. C'est ce qui rendait une relance envoyée au nom de l'atelier
   * indébrayable depuis l'atelier.
   */
  relance_count: number;
  relances_actives: boolean;
  derniere_relance_at: string | null;
  /** Acompte à la commande (lot C, C1) : % du total TTC demandé à la signature. NULL = pas d'acompte. */
  acompte_pct: number | null;
  /** Vrai si le client a signé hors établissement (lot C, C6) — fait courir la rétractation de 14 jours pour un particulier. */
  signature_hors_etablissement: boolean;
  /**
   * Conditions générales de vente figées au premier passage en « envoyé » (migration 76,
   * `trg_figer_cgv`). NULL sur un brouillon : l'écran et le PDF affichent alors les conditions en
   * vigueur (`clients.cgv ?? ateliers.cgv`), calculées à la volée — jamais depuis cette colonne.
   */
  cgv_texte: string | null;
  clients?: { nom: string; email: string | null; relances_actives?: boolean; type?: "particulier" | "pro" };
};

export type Etape = {
  code: string;
  libelle: string;
  done_at?: string | null;
  user_id?: string | null;
};

export type Projet = {
  id: string;
  atelier_id: string;
  client_id: string;
  devis_id: string | null;
  numero: string | null;
  nom: string;
  status: "en_attente" | "en_cours" | "pret" | "livre" | "annule";
  etapes: Etape[];
  etape_courante: string | null;
  surface_m2: number | null;
  poudre_id: string | null;
  couches: number;
  poudre_conso_kg: number | null;
  date_reception: string | null;
  date_promise: string | null;
  date_livraison: string | null;
  public_token: string;
  qr_token: string;
  notes: string | null;
  teinte_origine: string | null;
  /**
   * Amélioration n°9 (07/09/2026) — 'jante' | 'autre' | null (inconnu : on affiche tout, c'est le
   * comportement historique). Posée par `trg_devis_signe()` à la création, jamais par le front —
   * voir migration 69. Sert à ne montrer les champs propres aux jantes (teinte d'origine
   * constructeur…) que sur les projets qui en ont réellement besoin.
   */
  type_piece: "jante" | "autre" | null;
  created_at: string;
  clients?: { nom: string };
  poudres?: { reference: string; ral: string | null } | null;
};

export type Poudre = {
  id: string;
  atelier_id: string;
  marque: string | null;
  reference: string;
  ral: string | null;
  finition: string | null;
  type: string | null;
  /**
   * Le prix d'achat n'est plus une colonne de `poudres` : il vit dans `poudre_couts`, fermée au
   * rôle atelier. On l'embarque à la demande (`select("*, poudre_couts(prix_kg)")`) — un rôle qui
   * n'y a pas droit reçoit simplement `null`, sans erreur ni écran cassé.
   */
  poudre_couts?: { prix_kg: number | null } | null;
  rendement_m2_kg: number | null;
  stock_kg: number;
  seuil_alerte_kg: number | null;
  temp_cuisson: number | null;
  duree_cuisson_min: number | null;
  tp_product_id: number | null;
  actif: boolean;
};

export type Prestation = {
  id: string;
  atelier_id: string;
  code: string | null;
  nom: string;
  description: string | null;
  unite: "piece" | "m2" | "ml" | "kg" | "heure" | "forfait";
  prix_unitaire_ht: number;
  tva_rate: number;
  categorie: string | null;
  /**
   * Livraison de biens ou prestation de services. Alimente la catégorie de l'opération de la
   * facture, mention obligatoire depuis le 01/09/2026 — cf. `src/lib/nature-operation.ts`.
   */
  nature: "biens" | "services";
  actif: boolean;
  ordre: number;
  /** Prix dégressif par quantité (lot C, C5) : [{a_partir_de, prix}]. Vide = prix catalogue fixe. */
  paliers_quantite?: PalierQuantite[] | null;
};

/** Palier de prix dégressif : à partir de cette quantité, ce prix unitaire HT s'applique. */
export type PalierQuantite = { a_partir_de: number; prix: number };

export type Facture = {
  id: string;
  atelier_id: string;
  client_id: string;
  projet_id: string | null;
  devis_id: string | null;
  numero: string | null;
  type: "acompte" | "solde" | "libre" | "avoir";
  facture_liee_id: string | null;
  status: "brouillon" | "emise" | "payee" | "annulee";
  items: DevisItem[];
  remise: { type: "pct" | "montant"; valeur: number } | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  due_date: string | null;
  public_token: string;
  stripe_payment_link: string | null;
  emise_at: string | null;
  relance_count: number;
  relances_actives: boolean;
  /** Écrite par le cron de 7 h. Elle sert à dire à l'atelier quand partira la prochaine. */
  derniere_relance_at: string | null;
  created_at: string;
  // Mention obligatoire e-facture : livraison de biens / prestation de services / mixte.
  nature_operation: "biens" | "services" | "mixte";
  /** Motif d'annulation, obligatoire. Le numéro, lui, reste consommé : la séquence ne se réutilise jamais. */
  motif_annulation: string | null;
  annulee_at: string | null;
  /**
   * `application` = pièce émise par Thermogestion ; `reprise` = facture antérieure importée à
   * l'installation (migration 48, RPC `importer_facture_anterieure`). Absente du type jusqu'à la
   * migration 76, qui en a le premier besoin côté écran (une reprise ne porte jamais de
   * `cgv_texte` : elle vient de l'ancien logiciel de l'atelier).
   */
  origine: "application" | "reprise";
  /**
   * Conditions générales de vente figées au premier passage en « émise »/« payée »/« annulée »
   * (migration 76, `trg_figer_cgv`). NULL sur un brouillon, et toujours NULL sur une facture
   * reprise (`origine = 'reprise'`) : elle a été émise par l'ancien logiciel de l'atelier.
   */
  cgv_texte: string | null;
  clients?: { nom: string; email: string | null };
};

export type Paiement = {
  id: string;
  facture_id: string;
  montant: number;
  moyen: "stripe" | "virement" | "cb" | "especes" | "cheque";
  stripe_payment_intent_id: string | null;
  paye_at: string;
  note: string | null;
};

// ── Lot 1 ────────────────────────────────────────────────────────────────────

export type Reception = {
  id: string;
  atelier_id: string;
  projet_id: string | null;
  client_id: string;
  numero: string | null;
  nb_pieces: number;
  designation: string | null;
  /** Première cause de litige du métier : l'état constaté à l'entrée, photos à l'appui. */
  etat_constate: "bon" | "rayures" | "chocs" | "corrosion" | "ancien_revetement" | "autre";
  reserves: string | null;
  recu_par: string | null;
  depose_par: string | null;
  public_token: string;
  signature: Record<string, unknown> | null;
  signed_at: string | null;
  created_at: string;
  clients?: { nom: string };
};

export type LigneBL = {
  libelle: string;
  qte: number;
  unite: string;
  pu_ht: number;
  tva: number;
  total_ht: number;
  /** Même rôle que sur `DevisItem` : c'est `meta.forfait_minimum` — et lui seul — qui tient la
   *  ligne de plancher hors de l'assiette de remise. Le perdre en recopiant le devis remise le
   *  forfait minimum et fait mentir le total du bon de livraison. */
  meta?: Record<string, unknown>;
};

/** Remise contractuelle d'un document commercial : pourcentage ou montant fixe, jamais les deux. */
export type Remise = { type: "pct" | "montant"; valeur: number } | null;

export type BonLivraison = {
  id: string;
  atelier_id: string;
  client_id: string;
  projet_id: string | null;
  numero: string | null;
  status: "brouillon" | "emis" | "livre" | "facture";
  lignes: LigneBL[];
  /** Remise contractuelle reprise du devis : sans elle, le BL affiche un total que la facture dément. */
  remise: Remise;
  nb_colis: number | null;
  poids_kg: number | null;
  note: string | null;
  livre_at: string | null;
  recu_par: string | null;
  signature: Record<string, unknown> | null;
  signed_at: string | null;
  facture_id: string | null;
  public_token: string;
  created_at: string;
  clients?: { nom: string };
};

export type TarifMl = {
  id: string;
  atelier_id: string;
  famille: string;
  description: string | null;
  prix_ml: number;
  /** Périmètre développé du profilé : permet de convertir les ml en m² pour la conso de poudre. */
  perimetre_developpe_m: number | null;
  actif: boolean;
  ordre: number;
};

export type PieceType = {
  id: string;
  atelier_id: string;
  nom: string;
  categorie: string | null;
  surface_m2: number | null;
  longueur_ml: number | null;
  temps_minutes: number | null;
  prix_ht: number | null;
  note: string | null;
  actif: boolean;
  ordre: number;
  // Pour les pièces chiffrées au ml (profilés) : convertit la longueur en surface développée,
  // sur le même principe que `TarifMl.perimetre_developpe_m` mais en mm (saisie plus naturelle
  // pour une section de profilé qu'un périmètre en mètres).
  perimetre_mm: number | null;
  // Multiplicateur appliqué au temps/prix de base de la pièce (découpe, finition difficile…),
  // distinct des coefficients de grille qui portent sur la catégorie de finition, pas la pièce.
  coef_complexite: number | null;
};

export type TempsEtape = {
  id: string;
  atelier_id: string;
  projet_id: string;
  etape_code: string;
  debut: string;
  fin: string | null;
  minutes: number | null;
  user_id: string | null;
  /** Chronométrage partagé : plusieurs projets sur un même poste, arrêtés d'un coup. */
  groupe_id?: string | null;
  /** Temps global relevé pour le lot, avant répartition. */
  minutes_groupe?: number | null;
  /** Part du temps du lot imputée à ce projet, en %. */
  part_pct?: number | null;
};

export const ETAT_RECEPTION: Record<string, string> = {
  bon: "Bon état",
  rayures: "Rayures",
  chocs: "Chocs / déformations",
  corrosion: "Corrosion",
  ancien_revetement: "Ancien revêtement à retirer",
  autre: "Autre (voir réserves)",
};

export const STATUS_BL: Record<string, { label: string; ton: TonBadge }> = {
  brouillon: { label: "Brouillon", ton: "neutral" },
  emis: { label: "Émis", ton: "info" },
  livre: { label: "Livré", ton: "success" },
  // « Facturé » clôt le cycle : neutre, comme « Brouillon », mais lisible — la paire
  // `bg-gray-200 text-gray-500` qu'il portait tombait à 3,90:1.
  facture: { label: "Facturé", ton: "neutral" },
};

// ── Amélioration n°1 (07/09/2026) : réception de factures fournisseurs ───────

/** Miroir exact du `check` de `factures_recues.statut` (migration 66). */
export type StatutFactureRecue = "a_traiter" | "traitee" | "refusee";

export const STATUT_FACTURE_RECUE: Record<StatutFactureRecue, { label: string; ton: TonBadge }> = {
  a_traiter: { label: "À traiter", ton: "warning" },
  traitee: { label: "Traitée", ton: "success" },
  refusee: { label: "Refusée", ton: "danger" },
};

/** Miroir exact du `check` de `factures_recues.provenance`. */
export type ProvenanceFactureRecue = "depot_manuel" | "plateforme_agreee";

export const PROVENANCE_FACTURE_RECUE: Record<ProvenanceFactureRecue, string> = {
  depot_manuel: "Dépôt manuel",
  // N'existe encore nulle part en pratique : le partenaire n'est pas choisi (cf. cadrage du
  // 07/09/2026). Le libellé est prêt pour le jour où une ligne portera cette valeur.
  plateforme_agreee: "Plateforme agréée",
};

/** Miroir exact du `check` de `factures_recues.format_source`. */
export type FormatSourceFactureRecue = "factur-x" | "ubl" | "cii" | "pdf_simple";

export const FORMAT_SOURCE_FACTURE_RECUE: Record<FormatSourceFactureRecue, string> = {
  "factur-x": "Factur-X",
  ubl: "UBL",
  cii: "CII",
  pdf_simple: "PDF simple",
};

export type FactureRecue = {
  id: string;
  atelier_id: string;
  provenance: ProvenanceFactureRecue;
  format_source: FormatSourceFactureRecue;
  statut: StatutFactureRecue;
  motif_refus: string | null;
  fournisseur_nom: string | null;
  fournisseur_siren: string | null;
  fournisseur_tva: string | null;
  numero: string | null;
  date_emission: string | null;
  date_echeance: string | null;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  devise: string;
  xml_brut: string | null;
  storage_path_pdf: string | null;
  nom_fichier_origine: string | null;
  taille_octets: number | null;
  created_at: string;
  updated_at: string;
};

// ── Lot 1 : socle métier ─────────────────────────────────────────────────────
// `Reception`, `PieceType`, `BonLivraison`, `TarifMl` et `TempsEtape` sont déclarés plus haut :
// ces tables préexistaient. Seuls les types réellement nouveaux figurent ici.

export type ClientTarif = {
  id: string;
  atelier_id: string;
  client_id: string;
  prestation_id: string | null;
  prix_ht: number;
};

export type PoudreLot = {
  id: string;
  atelier_id: string;
  poudre_id: string;
  numero: string;
  fournisseur: string | null;
  quantite_kg: number;
  restant_kg: number;
  /** Voir `Poudre.poudre_couts` : le prix d'achat du lot vit dans `poudre_lot_couts`. */
  poudre_lot_couts?: { prix_kg: number | null } | null;
  dlu: string | null;
  recu_le: string;
  poudres?: { reference: string; ral: string | null };
};

export type Grille = {
  id: string;
  atelier_id: string;
  nom: string;
  forfait_minimum: number;
  is_default: boolean;
  actif: boolean;
};

export type GrillePalier = {
  id: string;
  grille_id: string;
  atelier_id: string;
  surface_min: number;
  surface_max: number | null;
  prix_m2: number;
};

export type GrilleCoef = {
  id: string;
  grille_id: string;
  atelier_id: string;
  // `jante_dessin` et `jante_finition` complètent les trois catégories historiques : les
  // coefficients d'une jante vivent dans la même table que ceux du m², pour qu'un garage sous
  // contrat hérite de sa grille dédiée sur les deux métiers sans réglage supplémentaire.
  categorie: "finition" | "complexite" | "couche" | "jante_dessin" | "jante_finition";
  code: string;
  libelle: string;
  coef: number;
};

// ── Jantes (migration 27) ────────────────────────────────────────────────────

export type PositionJante = "avg" | "avd" | "arg" | "ard" | "secours";
export type StatutJante = "a_faire" | "en_cours" | "prete" | "retouche" | "rebut";
export type StatutJeuJantes = "recu" | "en_cours" | "pret" | "livre" | "annule";
export type OperationJante =
  | "devoilage" | "redressage" | "soudure"
  | "depose_pneu" | "repose_pneu" | "equilibrage" | "valve_tpms" | "diamantage";

/**
 * Véhicule d'un client. Il existe pour une seule raison, mais la bonne : la teinte d'origine
 * constructeur se retient par voiture, pas par dossier. Le garage qui revient avec la même Golf
 * ne doit pas rechercher « la teinte d'origine de la Golf 8 GTI » une seconde fois.
 */
export type Vehicule = {
  id: string;
  atelier_id: string;
  client_id: string | null;
  marque: string;
  modele: string | null;
  annee: number | null;
  /** Normalisée en base (majuscules, sans séparateur) : « AB-123-CD » et « ab 123 cd » sont la même voiture. */
  immatriculation: string | null;
  teinte_origine: string | null;
  /** Code constructeur de la teinte (« C3Z », « LY7W ») — c'est lui que le garage épelle au téléphone. */
  teinte_reference: string | null;
  poudre_id: string | null;
  /** Fiche du catalogue Thermopoudre retenue pour cette teinte (cf. lot 3). */
  tp_product_id: number | null;
  note: string | null;
  created_at: string;
  clients?: { nom: string } | null;
  poudres?: { reference: string; ral: string | null } | null;
};

/** Palier de prix au pouce. Même convention de lecture que `GrillePalier` : borne haute exclue. */
export type JantePalier = {
  id: string;
  atelier_id: string;
  grille_id: string;
  diametre_min: number;
  diametre_max: number | null;
  prix_jante_ht: number;
};

export type JeuJantes = {
  id: string;
  atelier_id: string;
  client_id: string;
  vehicule_id: string | null;
  devis_id: string | null;
  projet_id: string | null;
  numero: string | null;
  nb_jantes: number;
  diametre_pouces: number;
  largeur_pouces: number | null;
  dessin: string;
  finition: string;
  /** Teinte retenue pour ce jeu : elle peut différer de la teinte d'origine du véhicule. */
  teinte: string | null;
  poudre_id: string | null;
  pneus_montes: boolean;
  tpms: boolean;
  statut: StatutJeuJantes;
  date_promise: string | null;
  note: string | null;
  reserves: string | null;
  depose_par: string | null;
  public_token: string;
  signature: Record<string, unknown> | null;
  signed_at: string | null;
  created_at: string;
  clients?: { nom: string } | null;
  vehicules?: Vehicule | null;
  jantes?: Jante[];
};

export type Jante = {
  id: string;
  atelier_id: string;
  jeu_id: string;
  position: PositionJante;
  /** États cumulables : une jante peut être rayée ET voilée. */
  etat_constate: string[];
  voile_mm: number | null;
  operations: OperationJante[];
  statut: StatutJante;
  reserves: string | null;
  created_at: string;
};

// ── Qualité (Qualicoat / Qualisteelcoat / Qualimarine) — migration 21 ────────

export type ControleType = "epaisseur" | "brillance" | "adherence" | "buchholz" | "polymerisation" | "aspect";

export type Controle = {
  id: string;
  atelier_id: string;
  projet_id: string | null;
  fournee_id: string | null;
  type: ControleType;
  // Forme selon `type` : voir les types `Valeurs*` dans lib/qualite.ts.
  valeurs: Record<string, number | string | boolean | null>;
  conforme: boolean | null;
  commentaire: string | null;
  photo_url: string | null;
  instrument_id: string | null;
  operateur_id: string | null;
  mesure_at: string;
  created_at: string;
  // Référentiel appliqué au moment de la mesure. `seuils` est une copie figée posée par la base :
  // modifier ou supprimer le référentiel ne réévalue jamais un contrôle déjà enregistré.
  referentiel_id: string | null;
  referentiel_nom: string | null;
  seuils: Record<string, number | null> | null;
  projets?: { numero: string | null; nom: string } | null;
  fournees?: { numero: string | null } | null;
  instruments?: { nom: string } | null;
  users?: { nom: string | null } | null;
};

/**
 * Barème de contrôle d'un atelier. Les seuils étaient codés en dur sur la classe 1 Qualicoat :
 * un atelier agréé sur un autre référentiel voyait des verdicts qui n'étaient pas les siens.
 */
export type ReferentielQualite = {
  id: string;
  atelier_id: string;
  nom: string;
  label: string | null;
  epaisseur_mini_um: number;
  epaisseur_maxi_um: number | null;
  brillance_tolerance_ub: number;
  adherence_classe_max: number;
  buchholz_min: number;
  /** Contrôles réellement pratiqués sous ce référentiel. Un type absent est refusé à la saisie. */
  types_controle: ControleType[];
  note: string | null;
  par_defaut: boolean;
  actif: boolean;
  created_at: string;
};

export type ControleBain = {
  id: string;
  atelier_id: string;
  bain: string;
  ph: number | null;
  conductivite: number | null;
  temperature: number | null;
  titrage: number | null;
  conforme: boolean | null;
  action: string | null;
  renouvele: boolean;
  operateur_id: string | null;
  mesure_at: string;
  created_at: string;
};

export type Instrument = {
  id: string;
  atelier_id: string;
  nom: string;
  type: string | null;
  numero_serie: string | null;
  dernier_etalonnage: string | null;
  periodicite_mois: number;
  actif: boolean;
  created_at: string;
};

export type NonConformite = {
  id: string;
  atelier_id: string;
  projet_id: string | null;
  fournee_id: string | null;
  defaut: string;
  surface_m2: number | null;
  cause: string | null;
  action_corrective: string | null;
  cout_estime: number | null;
  retouche: boolean;
  rebut: boolean;
  detectee_at: string;
  created_at: string;
  projets?: { numero: string | null; nom: string } | null;
  fournees?: { numero: string | null } | null;
};

// `ateliers.label_qualite` (migration 21) a été retiré en migration 22 : il s'affichait sur
// l'écran Qualité et sur le registre PDF sans qu'aucun écran ne permette jamais de le renseigner.
// Le label vient désormais de la table `certifications`, avec sa date d'échéance.

// ── Fournées (planning du four, migration 21) ────────────────────────────────
// Le regroupement en fournée obéit à deux règles métier : la teinte (poudre_id — enchaîner
// la même poudre évite un nettoyage de cabine) et le cycle de cuisson (temp_cuisson /
// duree_cuisson_min de la poudre — deux poudres à cycles différents ne peuvent pas cuire
// ensemble). Cf. src/lib/fournees.ts pour les règles de compatibilité et de suggestion.

export type FourneeStatut = "planifiee" | "en_cours" | "terminee" | "annulee";

export type Fournee = {
  id: string;
  atelier_id: string;
  numero: string | null;
  date_prevue: string | null;
  statut: FourneeStatut;
  poudre_id: string | null;
  temp_consigne: number | null;
  duree_min: number | null;
  temp_relevee: number | null;
  conso_kwh: number | null;
  operateur_id: string | null;
  demarree_at: string | null;
  terminee_at: string | null;
  note: string | null;
  created_at: string;
  poudres?: { reference: string; ral: string | null } | null;
  // Amélioration n°2 (07/09/2026, migration 71) : dérogation au blocage de capacité du four.
  // Posées par `trg_fournee_capacite`, jamais réglées directement par l'écran — voir
  // src/lib/fournees.ts (`blocageLancement`) pour le contrôle côté affichage, qui n'est qu'un
  // reflet de ce que la base refuse ou accepte réellement.
  derogation_capacite: boolean;
  derogation_par: string | null;
  derogation_le: string | null;
  derogation_ecart_m2: number | null;
};

export type FourneeProjet = {
  id: string;
  atelier_id: string;
  fournee_id: string;
  projet_id: string;
  surface_m2: number | null;
  position: number | null;
};

// Poudre allégée : seuls les champs nécessaires au regroupement teinte/cycle et à l'affichage.
export type PoudreCycle = { reference: string; ral: string | null; temp_cuisson: number | null; duree_cuisson_min: number | null };

// Projet candidat à une fournée (prêt à cuire) ou déjà composé dans une fournée.
export type ProjetPretFournee = {
  id: string;
  numero: string | null;
  nom: string;
  surface_m2: number | null;
  poudre_id: string | null;
  etape_courante: string | null;
  date_promise: string | null;
  clients?: { nom: string } | null;
  poudres?: PoudreCycle | null;
};

export type ProjetRevient = {
  projet_id: string;
  atelier_id: string;
  cout_poudre: number;
  cout_main_oeuvre: number;
  cout_energie: number;
  revient_total: number;
  /** Coût de non-qualité imputé à ce projet (lot C, C7) : NC directes + part de fournée au prorata de surface. */
  cout_non_qualite: number;
};

/**
 * Taux horaire propre à un membre de l'équipe (lot C, C2). Cloisonnée comme `AtelierCouts` :
 * lecture responsable/bureau, écriture responsable seul.
 */
export type UserCouts = {
  user_id: string;
  atelier_id: string;
  taux_horaire: number | null;
};

export type ProjetTempsCout = {
  projet_id: string;
  atelier_id: string;
  minutes_totales: number;
  cout_main_oeuvre: number;
};

/**
 * Paramètres du four ajoutés à `ateliers` en migration 21 (four_capacite_m2, four_longueur_m,
 * four_conso_kwh, prix_kwh, taux_horaire, frais_generaux_pct). Le type `Atelier` historique
 * n'est pas modifié : on combine `Atelier & AtelierFour` là où ces colonnes sont lues/écrites.
 */
export type AtelierFour = {
  four_capacite_m2: number | null;
  four_longueur_m: number | null;
  four_conso_kwh: number | null;
  /**
   * Le prix du kWh reste sur `ateliers` : c'est un tarif d'énergie, il sert à dire à l'opérateur
   * ce que coûte une fournée à moitié vide. Il ne dit rien d'une marge.
   */
  prix_kwh: number | null;
};

/**
 * Taux horaire et frais généraux — sortis de `ateliers` dans `ateliers_couts`, table dont la
 * policy s'ouvre au responsable et au bureau seulement. C'est la base du prix de revient : les
 * laisser sur `ateliers` revenait à donner le coût de revient de l'atelier à tout opérateur qui
 * ouvrait la console de son navigateur.
 */
export type AtelierCouts = {
  atelier_id: string;
  taux_horaire: number | null;
  frais_generaux_pct: number;
};

/** Coordonnées bancaires — `ateliers_bancaire`, responsable uniquement. */
export type AtelierBancaire = {
  atelier_id: string;
  iban: string | null;
  bic: string | null;
};

// ── Lot 2 (migration 22) ─────────────────────────────────────────────────────

/**
 * Réglages ajoutés à `ateliers` en migration 22. Même convention que `AtelierFour` :
 * on combine `Atelier & AtelierLot2` là où ces colonnes sont lues ou écrites.
 */
export type AtelierLot2 = {
  garantie_mois: number;
  four_cycles_jour: number;
  four_remplissage_moyen_pct: number;
};

export type Certification = {
  id: string;
  atelier_id: string;
  label: string;
  organisme: string | null;
  numero: string | null;
  obtenue_le: string | null;
  expire_le: string | null;
  document_url: string | null;
  note: string | null;
  actif: boolean;
  created_at: string;
};

export type ClientRentabilite = {
  client_id: string;
  atelier_id: string;
  nom: string;
  projets: number;
  surface_m2: number;
  surface_moyenne_m2: number | null;
  delai_moyen_jours: number | null;
  cout_poudre: number;
  cout_main_oeuvre: number;
  cout_energie: number;
  retouches: number;
  rebuts: number;
  cout_non_qualite: number;
  revient_total: number;
  facture_ht: number;
  marge_eur: number;
  marge_pct: number | null;
  /**
   * Ce qui attend une facture (migration 23). Sans ces colonnes, un chantier livré non facturé
   * ressemblait à une perte sèche : `marge_eur` est exact, mais illisible tant qu'on ne sait pas
   * si le rouge vient d'une facture en retard ou d'un prix de vente trop bas.
   */
  /** Montant HT des bons de livraison livrés et pas encore facturés — trésorerie en attente. */
  reste_a_facturer: number;
  bl_a_facturer: number;
  /** Projets non annulés dont aucune facture de solde ou libre n'est encore partie. */
  projets_non_factures: number;
  /** Prix de revient déjà engagé sur ces projets-là : la part de la marge négative qui s'explique. */
  revient_non_facture: number;
  /** Vrai seulement si tout est facturé et que le facturé reste sous le revient. */
  perte_reelle: boolean;
};

export type PoudreRendement = {
  poudre_id: string;
  atelier_id: string;
  reference: string;
  ral: string | null;
  rendement_theorique_m2_kg: number | null;
  projets: number;
  surface_m2: number;
  theorique_kg: number;
  pesees: number;
  ecart_pesees_kg: number;
  reel_kg: number;
  perte_kg: number;
  taux_perte_pct: number | null;
  rendement_reel_m2_kg: number | null;
  valeur_perte_eur: number;
};

export const STATUS_FOURNEE: Record<FourneeStatut, { label: string; ton: TonBadge }> = {
  planifiee: { label: "Planifiée", ton: "neutral" },
  // « En cuisson » reste en `warning` (ambre) et non en `info` : c'est le seul statut du produit
  // qui signale un four allumé, donc quelque chose devant quoi on ne part pas déjeuner.
  en_cours: { label: "En cuisson", ton: "warning" },
  terminee: { label: "Terminée", ton: "success" },
  annulee: { label: "Annulée", ton: "danger" },
};
