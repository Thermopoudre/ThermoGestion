/**
 * Reprise de données : ce qu'un atelier peut importer, et comment on lit son tableur.
 *
 * Le tableur d'un atelier ne ressemble jamais au nôtre. On ne lui demande donc pas de renommer
 * ses colonnes : les intitulés courants sont reconnus automatiquement (« Société », « Raison
 * sociale », « Client » → nom), et il corrige à la main ce que la reconnaissance a manqué.
 *
 * Une ligne refusée l'est toujours avec un motif en français : « ligne 14 rejetée » sans dire
 * pourquoi transforme un import raté en abandon.
 *
 * Depuis le lot A du cahier des charges v3, quatre modèles s'ajoutent aux trois d'origine, et ce
 * sont eux qui font la différence entre « un logiciel vide » et « mon atelier ». Deux d'entre eux
 * n'écrivent pas en direct : ils passent par une RPC réservée au responsable, parce que ce qu'ils
 * créent — une facture émise, un lot de stock — ne se crée pas par une simple insertion.
 */

import { nombreFr } from "@/lib/utils";

export type TypeChamp = "texte" | "nombre" | "email" | "choix" | "date";

export type Champ = {
  cle: string;
  libelle: string;
  type: TypeChamp;
  obligatoire?: boolean;
  choix?: string[];
  /** Intitulés reconnus sans intervention, en minuscules et sans accents. */
  alias: string[];
  aide?: string;
};

/** Référentiels dans lesquels une colonne de libellés se rapproche d'un identifiant. */
export type Referentiel = "clients" | "prestations" | "poudres";

/**
 * Rapprochement d'une colonne de texte sur une fiche existante.
 *
 * Le tableur de l'atelier porte « Menuiserie Martin », pas un UUID. Le rapprochement se fait sur
 * le libellé normalisé (casse, accents et ponctuation ignorés, comme `txt_normalise()` en base) —
 * et il refuse la ligne plutôt que de créer une seconde fiche du même nom.
 */
export type Rapprochement = {
  /** Champ du fichier qui porte le libellé. */
  champ: string;
  /** Clé de l'enregistrement qui recevra l'identifiant trouvé. */
  cible: string;
  referentiel: Referentiel;
  /** Ce que l'atelier lit quand rien ne correspond. Il doit dire quoi faire ensuite. */
  introuvable: (valeur: string) => string;
};

export type CleModele =
  | "clients" | "poudres" | "prestations"
  | "factures_ouvertes" | "lots_poudre" | "tarifs_negocies" | "grille_m2";

export type Modele = {
  cle: CleModele;
  libelle: string;
  /** Table relue pour repérer ce qui est déjà présent dans l'atelier. */
  table: string;
  description: string;
  /**
   * Colonnes qui font le doublon, côté fichier comme côté base. Plusieurs colonnes = clé
   * composée (un tarif négocié, c'est un couple client + prestation).
   */
  cleUnicite: string[];
  /** Champ affiché dans le rapport de rejet, pour que l'atelier retrouve sa ligne. */
  temoin: string;
  champs: Champ[];
  rapprochements?: Rapprochement[];
  /** Écriture ligne à ligne par une RPC, quand une insertion directe ne suffirait pas. */
  rpc?: { nom: string; parametres: (ligne: Record<string, unknown>) => Record<string, unknown> };
  /** Réservé au responsable de l'atelier. La base le refuse de toute façon : l'écran l'annonce. */
  proprietaire?: boolean;
  /** Ce que l'import va faire d'irréversible, dit avant l'aperçu. */
  avertissement?: string;
  /** La grille par défaut de l'atelier doit être injectée à l'écriture. */
  grilleDefaut?: boolean;
  /** Où l'atelier va voir le résultat. */
  voir: string;
  /**
   * L'onglet de `/reglages?onglet=…` que ce modèle concerne (voir `ONGLETS` dans
   * `reglages/page.tsx`), quand ce modèle configure quelque chose qui s'y règle. Le bandeau
   * « Réglages → » de l'écran d'import le suit ; sans lui, le lien reste `/reglages` nu et
   * atterrit sur le premier onglet (Atelier), qui n'a rien à voir avec le modèle affiché.
   */
  ongletReglages?: string;
};

export const MODELES: Modele[] = [
  {
    cle: "clients",
    libelle: "Clients",
    table: "clients",
    description: "Vos clients, avec leurs coordonnées de facturation.",
    cleUnicite: ["nom"],
    temoin: "nom",
    voir: "/clients",
    champs: [
      { cle: "nom", libelle: "Nom / raison sociale", type: "texte", obligatoire: true, alias: ["nom", "client", "societe", "raison sociale", "denomination", "entreprise", "nom du client"] },
      { cle: "type", libelle: "Type", type: "choix", choix: ["particulier", "pro"], alias: ["type", "categorie", "nature"], aide: "particulier ou pro — « pro » par défaut si un SIREN est présent" },
      { cle: "contact", libelle: "Contact", type: "texte", alias: ["contact", "interlocuteur", "responsable", "nom contact"] },
      { cle: "email", libelle: "Email", type: "email", alias: ["email", "e-mail", "mail", "courriel", "adresse email"] },
      { cle: "telephone", libelle: "Téléphone", type: "texte", alias: ["telephone", "tel", "portable", "mobile", "tel."] },
      { cle: "adresse", libelle: "Adresse", type: "texte", alias: ["adresse", "rue", "adresse 1", "adresse postale"] },
      { cle: "code_postal", libelle: "Code postal", type: "texte", alias: ["code postal", "cp", "code_postal", "zip"] },
      { cle: "ville", libelle: "Ville", type: "texte", alias: ["ville", "commune", "localite"] },
      { cle: "siren", libelle: "SIREN", type: "texte", alias: ["siren", "n siren", "numero siren"] },
      { cle: "siret", libelle: "SIRET", type: "texte", alias: ["siret", "n siret", "numero siret"] },
      { cle: "notes", libelle: "Notes", type: "texte", alias: ["notes", "note", "commentaire", "remarque", "observations"] },
    ],
  },
  {
    cle: "poudres",
    libelle: "Poudres",
    table: "poudres",
    description: "Vos références de poudre, avec leur cycle de cuisson et leur stock.",
    cleUnicite: ["reference"],
    temoin: "reference",
    voir: "/stock",
    champs: [
      { cle: "reference", libelle: "Référence", type: "texte", obligatoire: true, alias: ["reference", "ref", "designation", "libelle", "nom", "teinte", "produit"] },
      { cle: "marque", libelle: "Marque", type: "texte", alias: ["marque", "fabricant", "fournisseur"] },
      { cle: "ral", libelle: "RAL", type: "texte", alias: ["ral", "code ral", "couleur", "code couleur"] },
      { cle: "finition", libelle: "Finition", type: "choix", choix: ["mat", "satine", "brillant", "texture", "metallise"], alias: ["finition", "aspect", "brillance"] },
      { cle: "type", libelle: "Type", type: "choix", choix: ["polyester", "epoxy", "epoxy-polyester", "polyurethane"], alias: ["type", "nature", "resine", "chimie"] },
      { cle: "prix_kg", libelle: "Prix au kg (€ HT)", type: "nombre", alias: ["prix kg", "prix au kg", "prix", "prix unitaire", "prix_kg", "tarif kg"] },
      { cle: "rendement_m2_kg", libelle: "Rendement (m²/kg)", type: "nombre", alias: ["rendement", "rendement m2/kg", "m2 par kg", "couvrance"] },
      { cle: "stock_kg", libelle: "Stock (kg)", type: "nombre", alias: ["stock", "stock kg", "quantite", "qte", "quantite en stock"] },
      { cle: "seuil_alerte_kg", libelle: "Seuil d'alerte (kg)", type: "nombre", alias: ["seuil", "seuil alerte", "stock mini", "minimum", "seuil_alerte_kg"] },
      { cle: "temp_cuisson", libelle: "Température de cuisson (°C)", type: "nombre", alias: ["temperature", "temp cuisson", "temperature cuisson", "cuisson c"] },
      { cle: "duree_cuisson_min", libelle: "Durée de cuisson (min)", type: "nombre", alias: ["duree", "duree cuisson", "temps cuisson", "minutes"] },
    ],
  },
  {
    cle: "prestations",
    libelle: "Prestations",
    table: "prestations",
    ongletReglages: "prestations",
    description: "Votre catalogue de prestations à prix fixe (sablage, masquage, transport…).",
    cleUnicite: ["nom"],
    temoin: "nom",
    voir: "/reglages?onglet=prestations",
    champs: [
      { cle: "nom", libelle: "Nom", type: "texte", obligatoire: true, alias: ["nom", "prestation", "designation", "libelle", "intitule", "service"] },
      { cle: "code", libelle: "Code", type: "texte", alias: ["code", "ref", "reference"] },
      { cle: "description", libelle: "Description", type: "texte", alias: ["description", "detail", "commentaire"] },
      { cle: "unite", libelle: "Unité", type: "choix", choix: ["piece", "m2", "ml", "kg", "heure", "forfait"], alias: ["unite", "unit", "u"], aide: "piece, m2, ml, kg, heure ou forfait — « piece » par défaut" },
      { cle: "prix_unitaire_ht", libelle: "Prix unitaire HT", type: "nombre", obligatoire: true, alias: ["prix", "prix ht", "prix unitaire", "prix unitaire ht", "tarif", "pu ht", "pu"] },
      { cle: "tva_rate", libelle: "TVA (%)", type: "nombre", alias: ["tva", "taux tva", "tva %", "taux de tva"] },
    ],
  },

  // ── Lot A2 : l'encours ──────────────────────────────────────────────────────
  {
    cle: "factures_ouvertes",
    libelle: "Factures en cours",
    table: "factures",
    description:
      "Vos factures déjà émises et pas encore soldées. Elles arrivent avec leur numéro et leur date d'origine, et alimentent dès le premier jour votre reste dû, vos relances et votre courriel du matin.",
    cleUnicite: ["numero"],
    temoin: "numero",
    voir: "/factures",
    // La reprise d'encours n'a de sens qu'AVANT de poser la numérotation (voir l'avertissement
    // ci-dessous) : c'est cet onglet que l'atelier doit ouvrir avant d'importer cette liste.
    ongletReglages: "numerotation",
    proprietaire: true,
    avertissement:
      "Ces lignes deviennent des factures ÉMISES, donc figées : elles ne se modifient plus ensuite, elles s'annulent ou se corrigent par un avoir. Reprenez-les avant d'émettre votre première facture depuis Thermogestion — après, l'import se ferme. Elles n'entrent pas dans votre export comptable : votre ancien logiciel les a déjà comptabilisées.",
    rapprochements: [
      {
        champ: "client", cible: "client_id", referentiel: "clients",
        introuvable: (v) => `client « ${v} » introuvable — importez d'abord vos clients, ou corrigez l'orthographe`,
      },
    ],
    champs: [
      { cle: "numero", libelle: "Numéro de facture", type: "texte", obligatoire: true, alias: ["numero", "n facture", "numero facture", "no facture", "n", "reference", "piece"] },
      { cle: "client", libelle: "Client", type: "texte", obligatoire: true, alias: ["client", "nom", "societe", "raison sociale", "nom du client", "tiers"] },
      { cle: "emise_le", libelle: "Date d'émission", type: "date", obligatoire: true, alias: ["date", "date facture", "date d emission", "emise le", "date de facture", "date piece"] },
      { cle: "total_ht", libelle: "Montant HT", type: "nombre", obligatoire: true, alias: ["ht", "montant ht", "total ht", "base ht", "montant hors taxes"] },
      { cle: "total_tva", libelle: "Montant TVA", type: "nombre", alias: ["tva", "montant tva", "total tva", "taxe"], aide: "facultatif — déduit du TTC moins le HT s'il manque" },
      { cle: "total_ttc", libelle: "Montant TTC", type: "nombre", obligatoire: true, alias: ["ttc", "montant ttc", "total ttc", "total", "montant"] },
      { cle: "due_date", libelle: "Échéance", type: "date", alias: ["echeance", "date echeance", "date d echeance", "a payer avant", "date limite"], aide: "facultatif — calculée sur le délai de paiement du client s'il manque" },
      { cle: "regle", libelle: "Déjà réglé", type: "nombre", alias: ["regle", "deja regle", "montant regle", "acompte", "paye", "encaisse", "reglement"] },
    ],
    rpc: {
      nom: "importer_facture_anterieure",
      parametres: (l) => ({
        p_client_id: l.client_id,
        p_numero: l.numero,
        p_emise_le: l.emise_le,
        p_total_ht: l.total_ht,
        p_total_tva: l.total_tva ?? 0,
        p_total_ttc: l.total_ttc,
        p_due_date: l.due_date ?? null,
        p_regle: l.regle ?? 0,
      }),
    },
  },

  // ── Lot A3 : les lots de poudre ─────────────────────────────────────────────
  {
    cle: "lots_poudre",
    libelle: "Lots de poudre",
    table: "poudre_lots",
    description:
      "Vos lots de poudre déjà en stock, avec leur DLU et leur fournisseur. Sans eux, la traçabilité démarre vide, l'alerte de péremption ne se déclenche jamais et le FIFO consomme au hasard.",
    cleUnicite: ["numero"],
    temoin: "numero",
    voir: "/lots",
    avertissement:
      "Importez vos poudres AVANT vos lots : une référence inconnue est refusée, elle n'est pas créée au passage. Une fiche poudre née d'une ligne de lot n'aurait ni RAL, ni cycle de cuisson, ni rendement — elle casserait la cuisson et le calcul de revient sans le dire.",
    rapprochements: [
      {
        champ: "poudre", cible: "poudre_id", referentiel: "poudres",
        introuvable: (v) => `poudre « ${v} » introuvable — importez d'abord vos poudres, ou créez la référence dans Stock`,
      },
    ],
    champs: [
      { cle: "poudre", libelle: "Référence de poudre", type: "texte", obligatoire: true, alias: ["poudre", "reference", "ref", "teinte", "produit", "designation", "libelle"] },
      { cle: "numero", libelle: "Numéro de lot", type: "texte", obligatoire: true, alias: ["lot", "numero de lot", "n de lot", "n lot", "numero lot", "numero du lot", "no de lot", "batch", "no lot"] },
      { cle: "fournisseur", libelle: "Fournisseur", type: "texte", alias: ["fournisseur", "marque", "fabricant", "origine"] },
      { cle: "quantite_kg", libelle: "Quantité reçue (kg)", type: "nombre", obligatoire: true, alias: ["quantite", "qte", "quantite kg", "poids", "kg recus", "quantite recue"] },
      { cle: "restant_kg", libelle: "Reste en stock (kg)", type: "nombre", alias: ["reste", "restant", "restant kg", "stock", "stock restant", "solde"], aide: "facultatif — égal à la quantité reçue si le lot n'a pas été entamé" },
      { cle: "dlu", libelle: "DLU (date limite d'utilisation)", type: "date", alias: ["dlu", "peremption", "date de peremption", "date limite", "a utiliser avant", "expiration"] },
      { cle: "recu_le", libelle: "Date de réception", type: "date", alias: ["date", "date de reception", "recu le", "reception", "date entree"] },
      { cle: "prix_kg", libelle: "Prix d'achat au kg (€ HT)", type: "nombre", alias: ["prix", "prix kg", "prix au kg", "cout", "prix achat"] },
    ],
    rpc: {
      nom: "importer_lot_poudre",
      parametres: (l) => ({
        p_poudre_id: l.poudre_id,
        p_numero: l.numero,
        p_fournisseur: l.fournisseur ?? null,
        p_quantite_kg: l.quantite_kg,
        p_restant_kg: l.restant_kg ?? null,
        p_dlu: l.dlu ?? null,
        p_recu_le: l.recu_le ?? null,
        p_prix_kg: l.prix_kg ?? null,
      }),
    },
  },

  // ── Lot A4 : les prix négociés ──────────────────────────────────────────────
  {
    cle: "tarifs_negocies",
    libelle: "Tarifs négociés",
    table: "client_tarifs",
    description:
      "Le prix convenu avec un client sur une prestation précise. Il s'applique tout seul dès qu'on choisit ce client sur un devis, à la place du prix catalogue.",
    cleUnicite: ["client_id", "prestation_id"],
    temoin: "client",
    voir: "/clients",
    avertissement:
      "Importez vos clients et vos prestations avant vos tarifs : un tarif négocié se rattache à une fiche existante, il n'en crée aucune.",
    rapprochements: [
      {
        champ: "client", cible: "client_id", referentiel: "clients",
        introuvable: (v) => `client « ${v} » introuvable — importez d'abord vos clients`,
      },
      {
        champ: "prestation", cible: "prestation_id", referentiel: "prestations",
        introuvable: (v) => `prestation « ${v} » introuvable — le rapprochement se fait sur le code, puis sur le nom`,
      },
    ],
    champs: [
      { cle: "client", libelle: "Client", type: "texte", obligatoire: true, alias: ["client", "nom", "societe", "raison sociale", "tiers", "nom du client"] },
      { cle: "prestation", libelle: "Prestation (code ou nom)", type: "texte", obligatoire: true, alias: ["prestation", "code prestation", "prestation code", "code", "ref", "reference", "designation", "libelle", "service"] },
      { cle: "prix_ht", libelle: "Prix négocié HT", type: "nombre", obligatoire: true, alias: ["prix", "prix ht", "prix negocie", "tarif", "pu ht", "pu", "prix unitaire"] },
    ],
  },

  // ── Lot A4 : la grille au m² ────────────────────────────────────────────────
  {
    cle: "grille_m2",
    libelle: "Grille m²",
    table: "grille_paliers",
    description:
      "Vos paliers de surface et leur prix au m². C'est le barème que le devis applique dès qu'une ligne est chiffrée à la surface.",
    cleUnicite: ["surface_min"],
    temoin: "surface_min",
    voir: "/reglages?onglet=grille",
    ongletReglages: "grille",
    grilleDefaut: true,
    avertissement:
      "Ces paliers s'ajoutent à votre grille standard : ils ne remplacent pas ceux qui existent déjà. Un palier dont la borne de départ est déjà présente est ignoré.",
    champs: [
      { cle: "surface_min", libelle: "À partir de (m²)", type: "nombre", obligatoire: true, alias: ["de", "a partir de", "surface min", "min", "surface mini", "borne min", "de m2"] },
      { cle: "surface_max", libelle: "Jusqu'à (m²)", type: "nombre", alias: ["a", "jusqu a", "surface max", "max", "surface maxi", "borne max", "a m2"], aide: "laissez vide pour le dernier palier, celui qui n'a pas de plafond" },
      { cle: "prix_m2", libelle: "Prix au m² (€ HT)", type: "nombre", obligatoire: true, alias: ["prix", "prix m2", "prix au m2", "tarif", "euros m2", "prix ht"] },
    ],
  },
];

/**
 * Comparaison d'intitulés : la casse, les accents et la ponctuation ne doivent pas faire échouer.
 *
 * Les exposants sont ramenés à leur chiffre AVANT d'écarter la ponctuation. Sans cette ligne,
 * « Prix au m² » devenait « prix au m » et ne rencontrait aucun alias : le tableur d'un atelier
 * de thermolaquage est plein de m², et c'est justement la colonne la plus importante de sa
 * grille tarifaire.
 */
export function normaliser(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Proposition de correspondance colonne du fichier → champ du modèle. */
export function deviner(entetes: string[], modele: Modele): Record<string, number | null> {
  const normalisees = entetes.map(normaliser);
  const pris = new Set<number>();
  const out: Record<string, number | null> = {};
  for (const champ of modele.champs) {
    let trouve: number | null = null;
    for (const alias of [normaliser(champ.libelle), ...champ.alias.map(normaliser), normaliser(champ.cle)]) {
      const i = normalisees.findIndex((e, idx) => e === alias && !pris.has(idx));
      if (i >= 0) { trouve = i; break; }
    }
    if (trouve !== null) pris.add(trouve);
    out[champ.cle] = trouve;
  }
  return out;
}

/**
 * « 12,50 € » ou « 1 234,5 » doivent donner 12.5 et 1234.5. L'atelier exporte depuis Excel en
 * français : refuser la virgule décimale reviendrait à rejeter tout le fichier.
 */
export function nombreDepuisTexte(v: string): number | null {
  const propre = v
    .replace(/\s| | /g, "")
    .replace(/[€%]/g, "")
    .replace(",", ".");
  if (propre === "") return null;
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

/**
 * Une date de tableur, rendue en « AAAA-MM-JJ ».
 *
 * Trois formes à accepter, et une quatrième qui surprend : Excel ne stocke pas ses dates comme
 * du texte mais comme un NOMBRE de jours depuis le 30 décembre 1899 (l'année 1900 y est
 * faussement bissextile, d'où cette origine décalée d'un jour). Un .xlsx exporté par l'atelier
 * arrive donc avec « 45900 » là où il affiche « 03/09/2026 ». Refuser ce nombre reviendrait à
 * rejeter tout fichier Excel comportant une date, c'est-à-dire tout l'encours et tous les lots.
 */
export function dateDepuisTexte(v: string): string | null {
  const t = v.trim();
  if (t === "") return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return valide(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (fr) {
    const an = Number(fr[3]);
    return valide(an < 100 ? 2000 + an : an, Number(fr[2]), Number(fr[1]));
  }

  // Numéro de série Excel. Les bornes évitent de prendre un montant pour une date : 20 000 =
  // octobre 1954, 80 000 = janvier 2119.
  if (/^\d+(\.\d+)?$/.test(t)) {
    const serie = Math.trunc(Number(t));
    if (serie >= 20_000 && serie <= 80_000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serie * 86_400_000);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;

  function valide(a: number, m: number, j: number): string | null {
    if (m < 1 || m > 12 || j < 1 || j > 31 || a < 1900 || a > 2200) return null;
    const d = new Date(Date.UTC(a, m - 1, j));
    if (d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Clé de doublon d'une ligne, côté fichier comme côté base.
 *
 * `String(Number(v))` sur les nombres : PostgREST rend les `numeric` en chaîne (« 0.00 »), et une
 * comparaison textuelle ferait passer deux fois le palier qui commence à 0.
 */
export function cleDoublon(modele: Modele, enr: Record<string, unknown>): string {
  return modele.cleUnicite
    .map((c) => {
      const v = enr[c];
      if (v == null || v === "") return "";
      const champ = modele.champs.find((x) => x.cle === c);
      if (champ?.type === "nombre" || typeof v === "number") {
        const n = typeof v === "number" ? v : nombreDepuisTexte(String(v));
        return n == null ? "" : String(n);
      }
      return String(v).trim().toLowerCase();
    })
    .join("|");
}

/** Référentiels chargés depuis l'atelier : libellé normalisé → identifiant, `null` si ambigu. */
export type Referentiels = Partial<Record<Referentiel, Map<string, string | null>>>;

export type LigneRejetee = { numero: number; valeur: string; motif: string };
export type Resultat = {
  valides: Record<string, unknown>[];
  rejets: LigneRejetee[];
  /**
   * Numéro de ligne du tableur pour chaque enregistrement valide, dans le même ordre.
   *
   * Les modèles qui écrivent par RPC le font ligne à ligne : quand la base en refuse une, le
   * rapport de rejet doit citer la ligne du FICHIER DE L'ATELIER et non le rang dans la liste des
   * lignes retenues. « Ligne 14 » qui désigne la ligne 19 est pire que pas de numéro du tout.
   */
  sources: number[];
};

/**
 * Conversion des lignes brutes en enregistrements prêts à écrire.
 *
 * `deja` porte les clés de doublon déjà présentes dans l'atelier : un import relancé après
 * correction ne doit pas créer un deuxième « Menuiserie Martin ».
 */
export function preparer(
  modele: Modele,
  lignes: string[][],
  correspondance: Record<string, number | null>,
  deja: Set<string>,
  referentiels: Referentiels = {},
): Resultat {
  const valides: Record<string, unknown>[] = [];
  const rejets: LigneRejetee[] = [];
  const sources: number[] = [];
  const vus = new Set<string>();

  lignes.forEach((ligne, i) => {
    // +2 : l'utilisateur compte la ligne d'en-tête et démarre à 1, comme dans son tableur.
    const numero = i + 2;
    const brut = (cle: string) => {
      const idx = correspondance[cle];
      return idx == null ? "" : (ligne[idx] ?? "").trim();
    };

    const enregistrement: Record<string, unknown> = {};
    let motif: string | null = null;

    for (const champ of modele.champs) {
      const v = brut(champ.cle);
      if (v === "") {
        if (champ.obligatoire) motif ??= `${champ.libelle} est vide`;
        continue;
      }
      if (champ.type === "nombre") {
        const n = nombreDepuisTexte(v);
        if (n === null) { motif ??= `${champ.libelle} : « ${v} » n'est pas un nombre`; continue; }
        if (n < 0) { motif ??= `${champ.libelle} : valeur négative`; continue; }
        enregistrement[champ.cle] = n;
      } else if (champ.type === "date") {
        const d = dateDepuisTexte(v);
        if (d === null) { motif ??= `${champ.libelle} : « ${v} » n'est pas une date (JJ/MM/AAAA)`; continue; }
        enregistrement[champ.cle] = d;
      } else if (champ.type === "email") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { motif ??= `${champ.libelle} : « ${v} » n'est pas une adresse valide`; continue; }
        enregistrement[champ.cle] = v.toLowerCase();
      } else if (champ.type === "choix") {
        const n = normaliser(v).replace(/ /g, "");
        const trouve = champ.choix?.find((c) => normaliser(c).replace(/ /g, "") === n);
        if (!trouve) { motif ??= `${champ.libelle} : « ${v} » n'est pas une valeur acceptée (${champ.choix?.join(", ")})`; continue; }
        enregistrement[champ.cle] = trouve;
      } else {
        enregistrement[champ.cle] = v;
      }
    }

    // Rapprochement sur les fiches existantes, avant le contrôle de doublon : c'est l'identifiant
    // trouvé qui fait la clé d'un tarif négocié.
    for (const r of modele.rapprochements ?? []) {
      if (motif) break;
      const libelle = String(enregistrement[r.champ] ?? "");
      if (libelle === "") continue;
      const table = referentiels[r.referentiel];
      const trouve = table?.get(normaliser(libelle));
      if (trouve === undefined) { motif ??= r.introuvable(libelle); continue; }
      if (trouve === null) {
        motif ??= `« ${libelle} » correspond à plusieurs fiches de votre atelier : renommez-en une avant l'import`;
        continue;
      }
      enregistrement[r.cible] = trouve;
    }

    // Cohérence des montants d'une facture reprise. La base refuse déjà ces trois cas ; l'écran
    // les attrape avant l'écriture pour que l'atelier les corrige dans son fichier, une bonne
    // fois, plutôt que ligne par ligne à coups d'aller-retour avec le serveur.
    if (!motif && modele.cle === "factures_ouvertes") {
      const ht = Number(enregistrement.total_ht ?? 0);
      const ttc = Number(enregistrement.total_ttc ?? 0);
      const tva = enregistrement.total_tva != null
        ? Number(enregistrement.total_tva)
        : Math.round((ttc - ht) * 100) / 100;
      const regle = Number(enregistrement.regle ?? 0);
      // `nombreFr` plutôt qu'un `toFixed().replace()` local (lot E-P1, D6) : au-delà de 999,99 €
      // le remplacement manuel du point perdait le séparateur de milliers (« 12345,67 € » au
      // lieu de « 12 345,67 € »), sur un message d'erreur qui montre justement un montant à
      // l'atelier pour qu'il corrige sa ligne.
      const euros = (n: number) => `${nombreFr(n, 2, 2)} €`;
      if (tva < -0.005) {
        motif = `le TTC (${euros(ttc)}) est inférieur au HT (${euros(ht)})`;
      } else if (Math.abs(ht + tva - ttc) > 0.02) {
        motif = `HT + TVA (${euros(ht + tva)}) ne fait pas le TTC (${euros(ttc)}) — vérifiez la correspondance des colonnes`;
      } else if (regle > ttc + 0.005) {
        motif = `le montant déjà réglé (${euros(regle)}) dépasse le total TTC (${euros(ttc)})`;
      } else if (String(enregistrement.emise_le ?? "") > new Date().toISOString().slice(0, 10)) {
        motif = "la date d'émission est dans le futur";
      } else if (
        enregistrement.due_date != null &&
        String(enregistrement.due_date) < String(enregistrement.emise_le)
      ) {
        motif = "l'échéance précède la date d'émission";
      }
    }

    // Un lot ne peut pas rester plus plein qu'il n'a été reçu, et il n'a pas été reçu demain.
    if (!motif && modele.cle === "lots_poudre") {
      const recu = Number(enregistrement.quantite_kg ?? 0);
      const reste = enregistrement.restant_kg != null ? Number(enregistrement.restant_kg) : recu;
      if (reste > recu + 0.0005) {
        motif = "le reste en stock dépasse la quantité reçue";
      } else if (String(enregistrement.recu_le ?? "") > new Date().toISOString().slice(0, 10)) {
        motif = "la date de réception est dans le futur";
      }
    }

    // Un palier dont la borne haute passe sous la borne basse n'attrape aucune surface : le devis
    // se chiffre alors à zéro sans qu'aucun écran ne l'explique. La base porte la même contrainte.
    if (!motif && modele.cle === "grille_m2" && enregistrement.surface_max != null) {
      if (Number(enregistrement.surface_max) <= Number(enregistrement.surface_min)) {
        motif = "la borne haute doit être supérieure à la borne basse";
      }
    }

    const cle = motif ? "" : cleDoublon(modele, enregistrement);
    if (!motif && cle && deja.has(cle)) motif = "déjà présent dans votre atelier";
    if (!motif && cle && vus.has(cle)) motif = "en double dans le fichier";

    if (motif) {
      rejets.push({ numero, valeur: brut(modele.temoin) || ligne.find((c) => c) || "(ligne vide)", motif });
      return;
    }
    vus.add(cle);

    // Valeurs par défaut métier, appliquées après validation pour qu'elles n'effacent jamais
    // une donnée fournie par l'atelier.
    if (modele.cle === "clients" && !enregistrement.type) {
      enregistrement.type = enregistrement.siren || enregistrement.siret ? "pro" : "particulier";
    }
    if (modele.cle === "prestations") {
      enregistrement.unite ??= "piece";
      enregistrement.tva_rate ??= 20;
    }
    if (modele.cle === "factures_ouvertes") {
      // Colonne TVA absente (franchise en base, ou export qui ne la sort pas) : elle se déduit,
      // plutôt que de rejeter la ligne sur une incohérence HT + TVA ≠ TTC qu'on sait résoudre.
      enregistrement.total_tva ??= Math.round((Number(enregistrement.total_ttc) - Number(enregistrement.total_ht)) * 100) / 100;
      enregistrement.regle ??= 0;
    }
    if (modele.cle === "lots_poudre") {
      enregistrement.restant_kg ??= enregistrement.quantite_kg;
    }
    valides.push(enregistrement);
    sources.push(numero);
  });

  return { valides, rejets, sources };
}
