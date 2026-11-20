import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Export total des données d'un atelier — engagement pris dans les CGU.
 *
 * « Vous pouvez récupérer l'intégralité de vos données à tout moment, dans un format ouvert. » Tant
 * que ce bouton n'existe pas, la phrase est un engagement contractuel non tenu, et la seule façon
 * pour un atelier de partir est de nous le demander. C'est aussi le premier argument qui désamorce
 * l'objection « et si je veux changer de logiciel ? » en démonstration.
 *
 * Deux formats dans la même archive, parce qu'ils ne servent pas à la même chose :
 *  - un CSV par table, ouvrable dans Excel ou LibreOffice sans rien installer ;
 *  - un JSON complet, sans perte, seul capable de rendre les colonnes `jsonb` (lignes de devis,
 *    étapes de projet, valeurs de contrôle) telles qu'elles sont enregistrées.
 *
 * L'archive est construite avec un client PostgREST porteur de la session de l'utilisateur : les
 * RLS s'appliquent, un atelier ne peut donc exporter que ses propres lignes. Ce n'est pas une
 * commodité, c'est le garde-fou — et il est attaqué depuis un second atelier dans les tests.
 */

export type TableExport = { nom: string; libelle: string };

/** Une relation écartée de l'archive, et la raison — jamais un silence. */
export type RelationEcartee = { nom: string; motif: string };

/**
 * Toutes les tables métier d'un atelier.
 *
 * La liste n'est pas déclarative : elle est confrontée à l'inventaire réel du schéma par
 * `tests/export-donnees.test.ts`, qui interroge `tables_du_schema_public()`. Toute table qui
 * apparaît en base doit être ici ou dans `TABLES_HORS_EXPORT` avec un motif écrit ; sinon la suite
 * tombe. Ce garde-fou n'est pas décoratif : dix tables — dont l'IBAN et les deux prix d'achat au
 * kilo — sont sorties de l'archive au fil de migrations sans que rien ne s'en aperçoive, parce que
 * l'ancien test se comparait à cette constante au lieu de la comparer à la base.
 *
 * Les quatre tables « satellites » créées pour cloisonner les rôles (`ateliers_bancaire`,
 * `ateliers_couts`, `poudre_couts`, `poudre_lot_couts`) sont ici au même titre que leurs mères :
 * l'IBAN et le prix d'achat au kilo n'ont pas cessé d'être des données de l'atelier en changeant
 * de table. Elles figurent volontairement juste à côté de la table dont elles ont été détachées,
 * pour qu'une prochaine extraction de colonnes se voie au premier coup d'œil.
 */
export const TABLES_EXPORT: TableExport[] = [
  { nom: "ateliers", libelle: "Atelier — identité, réglages, four" },
  { nom: "ateliers_bancaire", libelle: "Coordonnées bancaires de l'atelier (IBAN, BIC)" },
  { nom: "ateliers_couts", libelle: "Taux horaire et frais généraux" },
  { nom: "users", libelle: "Membres de l'équipe" },
  { nom: "users_couts", libelle: "Taux horaire propre à chaque membre de l'équipe (migration 57)" },
  { nom: "certifications", libelle: "Certifications et agréments" },
  { nom: "referentiels_qualite", libelle: "Référentiels de contrôle (seuils)" },
  { nom: "clients", libelle: "Clients" },
  { nom: "client_tarifs", libelle: "Tarifs négociés par client" },
  { nom: "client_portail", libelle: "Portails clients ouverts (sans le jeton d'accès)" },
  { nom: "grilles_tarifaires", libelle: "Grilles tarifaires" },
  { nom: "grille_paliers", libelle: "Paliers de surface" },
  { nom: "grille_coefs", libelle: "Coefficients de grille" },
  { nom: "tarifs_ml", libelle: "Tarifs au mètre linéaire" },
  { nom: "pieces_types", libelle: "Bibliothèque de pièces types" },
  { nom: "prestations", libelle: "Prestations" },
  { nom: "jante_paliers", libelle: "Barème de prix des jantes (au pouce)" },
  { nom: "vehicules", libelle: "Véhicules et teintes d'origine" },
  { nom: "jeux_jantes", libelle: "Dossiers de jeux de jantes" },
  { nom: "jantes", libelle: "Jantes — état constaté et opérations" },
  { nom: "devis", libelle: "Devis" },
  { nom: "projets", libelle: "Projets / dossiers de production" },
  { nom: "receptions", libelle: "Bons de réception" },
  { nom: "bons_livraison", libelle: "Bons de livraison" },
  { nom: "factures", libelle: "Factures et avoirs" },
  // Factures reçues des fournisseurs (migration 66). Elles sortent de l'archive au même titre que
  // les factures émises : ce sont les pièces comptables de l'atelier, et le jour où il change de
  // logiciel, il doit repartir avec ce qu'il a reçu autant qu'avec ce qu'il a facturé. Le PDF
  // d'origine vit dans le bucket `documents` et suit le même chemin que les autres pièces jointes ;
  // `xml_brut` part avec la ligne, c'est lui qui porte la valeur probante du Factur-X.
  { nom: "factures_recues", libelle: "Factures fournisseurs reçues (dépôt manuel ou plateforme agréée)" },
  { nom: "paiements", libelle: "Paiements encaissés" },
  { nom: "relances", libelle: "Relances envoyées" },
  { nom: "poudres", libelle: "Catalogue de poudres" },
  { nom: "poudre_couts", libelle: "Prix d'achat au kilo, par poudre" },
  { nom: "poudre_lots", libelle: "Lots de poudre" },
  { nom: "poudre_lot_couts", libelle: "Prix d'achat au kilo, par lot reçu" },
  { nom: "stock_mouvements", libelle: "Mouvements de stock" },
  { nom: "commandes_poudre", libelle: "Commandes de poudre" },
  { nom: "commande_poudre_lignes", libelle: "Lignes de commande de poudre" },
  { nom: "fournees", libelle: "Fournées" },
  { nom: "fournee_projets", libelle: "Composition des fournées" },
  { nom: "controles", libelle: "Contrôles qualité (registre)" },
  { nom: "controles_bains", libelle: "Registre des bains" },
  { nom: "non_conformites", libelle: "Non-conformités et retouches" },
  { nom: "instruments", libelle: "Instruments de mesure et étalonnages" },
  { nom: "dechets", libelle: "Registre des déchets sortants (ICPE)" },
  { nom: "fds", libelle: "Classeur des fiches de données de sécurité" },
  { nom: "temps_etapes", libelle: "Pointages par étape" },
  { nom: "photos", libelle: "Photos (chemins de stockage)" },
  { nom: "pieces_jointes", libelle: "Pièces jointes — nom, type, taille, chemin de stockage" },
  { nom: "notifications", libelle: "Notifications envoyées" },
  { nom: "reglages_alertes", libelle: "Réglages des alertes et du récapitulatif du matin" },
  { nom: "recap_destinataires", libelle: "Destinataires du récapitulatif (sans le jeton de désinscription)" },
  { nom: "exports_comptables", libelle: "Remises comptables tracées (période, format, volume)" },
  { nom: "reglages_comptable", libelle: "Réglage de la remise au cabinet comptable" },
  { nom: "invitations", libelle: "Invitations d'équipe (sans le jeton d'adhésion)" },
  { nom: "audit_logs", libelle: "Journal d'audit" },
  { nom: "subscriptions", libelle: "Abonnement" },
  // Le journal de l'assistant ne contient QUE la question posée et les outils appelés — jamais la
  // réponse rédigée par le modèle (voir le commentaire de la table, migration 60) : elle se
  // redéduit des mêmes outils, et la conserver ferait de cette table un second entrepôt de
  // données commerciales à protéger pour rien. C'est donc une archive incomplète par construction,
  // et volontairement : ce que l'atelier récupère ici est déjà tout ce que la base a gardé.
  { nom: "assistant_journal", libelle: "Journal de l'assistant IA — la question posée et les outils appelés, jamais la réponse" },
];

/**
 * Ce que l'archive ne contient pas, et pourquoi. Chaque entrée est une décision, pas un oubli :
 * le test de couverture refuse toute table de la base qui ne serait ni dans `TABLES_EXPORT` ni
 * ici. Le motif est destiné à être relu par quelqu'un qui découvre le sujet dans deux ans.
 */
export const TABLES_HORS_EXPORT: RelationEcartee[] = [
  {
    nom: "compteurs",
    motif:
      "Mécanisme interne de numérotation (dernier numéro attribué par type et par année). Aucune " +
      "policy ne l'ouvre à un compte atelier, la table sortirait donc vide de toute façon ; et le " +
      "dernier numéro se relit directement dans les devis, factures et BL exportés.",
  },
  {
    nom: "reglages_app",
    motif:
      "Configuration de la plateforme Thermogestion elle-même (clés/valeurs globales, communes à " +
      "tous les ateliers). Ce ne sont pas les données de l'atelier et elles n'ont aucun sens hors " +
      "de notre hébergement.",
  },
  {
    nom: "leads",
    motif:
      "Demandes de contact reçues sur notre site vitrine. Prospects de Thermogestion, pas clients " +
      "de l'atelier — les livrer serait une fuite dans l'autre sens.",
  },
  {
    nom: "analytics_events",
    motif:
      "Mesure d'audience de la vitrine et de l'application (pages vues, UTM, visiteurs anonymes). " +
      "Donnée de la plateforme, sans utilité de reprise pour un atelier.",
  },
];

/**
 * Les vues ne sont pas exportées : elles se recalculent intégralement à partir des tables
 * ci-dessus, les inclure n'ajouterait aucune information — seulement des chiffres qui divergeront
 * le jour où le repreneur recalculera.
 *
 * Elles sont tout de même énumérées une par une, et le test exige que chaque vue de la base y
 * figure. Une vue *matérialisée* créée demain porterait, elle, de la donnée que rien d'autre ne
 * contient : la faire tomber sur ce test est le seul moyen de forcer l'arbitrage plutôt que de la
 * laisser passer sous une règle générale « les vues, on ignore ».
 */
export const VUES_HORS_EXPORT: RelationEcartee[] = [
  { nom: "projet_revient", motif: "Prix de revient recalculé depuis projets, temps_etapes, fournees et les coûts poudre." },
  { nom: "projet_temps_cout", motif: "Coût de main-d'œuvre recalculé depuis temps_etapes et ateliers_couts." },
  { nom: "client_rentabilite", motif: "Agrégat par client, recalculé depuis factures, projets et coûts." },
  { nom: "poudre_rendement", motif: "Rendement au kilo recalculé depuis stock_mouvements et fournees." },
  { nom: "atelier_conformite", motif: "Tableau de conformité recalculé depuis controles, instruments et certifications." },
  { nom: "relances_envoyees", motif: "Lecture filtrée de notifications, déjà exportée intégralement." },
  { nom: "envois_documents", motif: "Lecture filtrée de notifications (devis/facture/BL envoyés), déjà exportée intégralement." },
  { nom: "projet_non_qualite", motif: "Agrégat par projet recalculé depuis non_conformites, fournee_projets et projets, tous déjà exportés intégralement." },
];

export type TableCollectee = { nom: string; libelle: string; lignes: Record<string, unknown>[]; erreur?: string };

/**
 * Lit toutes les tables, page par page. La pagination n'est pas une précaution de principe :
 * PostgREST plafonne les réponses (1 000 lignes par défaut), et un atelier de trois ans dépasse
 * ce seuil sur `stock_mouvements` et `temps_etapes`. Sans boucle, l'export serait silencieusement
 * tronqué — le pire défaut possible pour une sauvegarde.
 */
export async function collecterDonnees(sb: SupabaseClient, tables: TableExport[] = TABLES_EXPORT): Promise<TableCollectee[]> {
  const PAGE = 1000;
  const resultat: TableCollectee[] = [];
  for (const table of tables) {
    const lignes: Record<string, unknown>[] = [];
    let debut = 0;
    let erreur: string | undefined;
    for (;;) {
      const { data, error } = await sb.from(table.nom).select("*").range(debut, debut + PAGE - 1);
      if (error) { erreur = error.message; break; }
      const page = (data ?? []) as Record<string, unknown>[];
      // Les colonnes techniques et les jetons vivants sont retirés ici plutôt qu'à l'écriture du
      // CSV, pour que le fichier JSON — celui qui fait foi en cas de reprise — n'en porte pas non
      // plus.
      const secretes = COLONNES_SECRETES[table.nom] ?? [];
      lignes.push(
        ...page.map((l) =>
          Object.fromEntries(
            Object.entries(l).filter(([c]) => !COLONNES_TECHNIQUES.has(c) && !secretes.includes(c)),
          ),
        ),
      );
      if (page.length < PAGE) break;
      debut += PAGE;
    }
    resultat.push({ nom: table.nom, libelle: table.libelle, lignes, erreur });
  }
  return resultat;
}

/**
 * Colonnes techniques écartées de l'archive.
 *
 * `recherche` est le texte cherchable calculé par la base (minuscules, accents retirés, chiffres
 * isolés) : c'est une redondance interne des colonnes qui l'entourent, pas une donnée de
 * l'atelier. La livrer dans le CSV ajouterait une colonne illisible à quinze fichiers et
 * laisserait croire à une saisie parasite.
 */
export const COLONNES_TECHNIQUES = new Set(["recherche"]);

/**
 * Jetons vivants retirés de l'archive, table par table.
 *
 * Distinguer deux familles de jetons, parce qu'elles n'ont pas le même statut :
 *
 *  - **Les liens de document** (`devis.public_token`, `factures.public_token`, `projets.qr_token`,
 *    `receptions.public_token`, `bons_livraison.public_token`, `jeux_jantes.public_token`) **sont
 *    exportés.** L'atelier les a lui-même envoyés à ses clients et imprimés sur ses papiers ; sans
 *    eux, impossible de rapprocher une archive d'un QR collé sur une palette. Ils n'ouvrent qu'un
 *    document déjà communiqué à son destinataire.
 *
 *  - **Les jetons d'accès** ci-dessous **ne le sont pas.** Ils ne racontent rien du métier et
 *    ouvrent un accès : le portail d'un client, l'adhésion à l'atelier avec un rôle, la
 *    désinscription d'un tiers. Une archive traîne dans une boîte mail ou sur une clé USB pendant
 *    des années ; y recopier des identifiants encore valides transformerait une sauvegarde en
 *    fuite. Les lignes, elles, restent exportées : on saura toujours quel portail a été ouvert,
 *    quand, et combien de fois il a été consulté.
 *
 * Le filtrage est nommé par table, jamais par nom de colonne global : `token` sur `invitations` est
 * un secret, mais un `token` ailleurs pourrait être une référence métier. Une règle globale
 * finirait par amputer une colonne utile sans que personne ne s'en aperçoive.
 */
export const COLONNES_SECRETES: Record<string, string[]> = {
  client_portail: ["jeton"],
  invitations: ["token"],
  recap_destinataires: ["token"],
};

/** Colonnes rencontrées, dans l'ordre de première apparition : une table vide n'a pas d'en-tête. */
export function colonnes(lignes: Record<string, unknown>[]): string[] {
  const vues: string[] = [];
  for (const l of lignes) for (const c of Object.keys(l)) if (!vues.includes(c) && !COLONNES_TECHNIQUES.has(c)) vues.push(c);
  return vues;
}

function cellule(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Les colonnes jsonb sont rendues en JSON compact dans le CSV : illisible mais fidèle, et le
  // fichier JSON de l'archive donne la même donnée sous une forme exploitable.
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * CSV point-virgule avec BOM : c'est ce qu'Excel en français ouvre sans passer par l'assistant
 * d'importation. Toutes les valeurs présentes sont entre guillemets — un point-virgule dans une
 * adresse ou un retour à la ligne dans une note décalerait sinon toutes les colonnes. Une valeur
 * nulle, elle, laisse la cellule vide sans guillemets : c'est ce qui la distingue d'une chaîne
 * vide réellement enregistrée, écrite `""`.
 */
export function versCsvTable(lignes: Record<string, unknown>[]): string {
  const cols = colonnes(lignes);
  if (cols.length === 0) return "﻿";
  const entete = cols.map(cellule).join(";");
  const corps = lignes.map((l) => cols.map((c) => cellule(l[c])).join(";"));
  return `﻿${[entete, ...corps].join("\r\n")}\r\n`;
}

/**
 * Le rôle du compte qui a produit l'archive. Il est écrit dans le LISEZ-MOI, et ce n'est pas une
 * politesse : l'export lit avec la session de l'utilisateur, donc **à travers ses RLS**. Un
 * opérateur d'atelier obtient une archive amputée de l'IBAN et des prix d'achat. C'est le
 * comportement correct — l'alternative serait un bouton qui contourne les rôles — mais une archive
 * incomplète remise à un client qui part, sans que rien ne le signale, serait pire qu'un refus.
 */
export type RoleExport = "owner" | "bureau" | "atelier" | "comptable" | null;

const PHRASE_ROLE: Record<Exclude<RoleExport, null>, string> = {
  owner: "Responsable — archive complète : tout ce que l'atelier détient y figure.",
  bureau:
    "Bureau — archive quasi complète. Les coordonnées bancaires de l'atelier (IBAN, BIC) sont " +
    "réservées au responsable et ne peuvent pas sortir depuis ce compte.",
  atelier:
    "Atelier — archive PARTIELLE. Un compte de production ne lit ni les coordonnées bancaires, ni " +
    "le taux horaire et les frais généraux, ni les prix d'achat au kilo (poudres et lots), ni les " +
    "portails clients. Pour une archive complète, refaites l'export depuis un compte responsable.",
  comptable:
    "Expert-comptable — archive PARTIELLE par construction. Votre accès porte sur les pièces " +
    "comptables de la période, pas sur les données de l'atelier. L'archive complète s'obtient " +
    "depuis un compte responsable de l'atelier.",
};

export function lisezMoi(tables: TableCollectee[], nomAtelier: string, le: Date, role: RoleExport = null): string {
  const total = tables.reduce((s, t) => s + t.lignes.length, 0);
  // Liste déduite du contenu réel, jamais d'une constante : une table vide parce que l'atelier ne
  // s'en sert pas et une table vide parce que le rôle ne la lit pas se ressemblent dans le ZIP.
  // Les nommer ici, c'est laisser au lecteur les moyens de faire la différence.
  const vides = tables.filter((t) => t.lignes.length === 0).map((t) => t.nom);
  return [
    `Export des données — ${nomAtelier}`,
    `Généré le ${le.toLocaleString("fr-FR")} par Thermogestion.`,
    ...(role ? [`Compte à l'origine de l'export : ${PHRASE_ROLE[role]}`] : []),
    "",
    `${total} enregistrements, ${tables.length} tables.`,
    "",
    "Cette archive contient l'intégralité des données de votre atelier, dans deux formats :",
    "",
    "  - csv/<table>.csv : un fichier par table, séparateur point-virgule, encodage UTF-8 avec",
    "    BOM. S'ouvre directement dans Excel ou LibreOffice. Les colonnes structurées (lignes de",
    "    devis, étapes de projet, valeurs de contrôle) y figurent sous forme de texte JSON.",
    "",
    "  - donnees.json : la même chose sans perte, exploitable par un développeur ou par un autre",
    "    logiciel. C'est ce fichier qui fait foi en cas de reprise.",
    "",
    "Ne figurent pas dans cette archive :",
    "  - les fichiers binaires (photos, logo, pièces jointes, documents de certification), stockés",
    "    séparément ; le nom et le chemin de stockage de chaque fichier sont exportés, les fichiers",
    "    eux-mêmes se récupèrent sur demande ;",
    "  - les jetons d'accès encore valides (portail client, invitation d'équipe, désinscription du",
    "    récapitulatif) : ce sont des clés, pas des données. Les lignes qui les portent sont bien",
    "    exportées, seule la clé est retirée. Les liens publics de vos devis, factures, bons de",
    "    livraison et QR de suivi, eux, sont exportés : vous les avez déjà communiqués ;",
    "  - le texte de recherche calculé par la base (colonne « recherche »), qui n'est qu'une copie",
    "    normalisée des colonnes voisines ;",
    ...TABLES_HORS_EXPORT.map((t) => `  - ${t.nom} : ${t.motif}`),
    "",
    ...(vides.length > 0
      ? [
          `${vides.length} table(s) sont vides dans cette archive :`,
          `  ${vides.join(", ")}`,
          "Une table vide signifie soit que vous ne l'utilisez pas, soit que le compte qui a lancé",
          "l'export n'a pas le droit de la lire. En cas de doute, refaites l'export depuis le compte",
          "responsable de l'atelier.",
          "",
        ]
      : []),
    "Tables incluses :",
    ...tables.map((t) => `  - ${t.nom.padEnd(26)} ${String(t.lignes.length).padStart(6)} ligne(s)  — ${t.libelle}${t.erreur ? `  [ERREUR : ${t.erreur}]` : ""}`),
    "",
  ].join("\n");
}

// ── Archive ZIP ──────────────────────────────────────────────────────────────
// Écrite à la main plutôt qu'avec une bibliothèque : l'export doit tenir dans une fonction
// serverless sans dépendance supplémentaire, et une archive « stockée » (sans compression) est un
// format de quelques dizaines de lignes, lisible par tous les systèmes d'exploitation.

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date MS-DOS (deux mots de 16 bits) attendue par l'en-tête ZIP. */
function dateDos(d: Date): { heure: number; jour: number } {
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    jour: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export type FichierArchive = { nom: string; contenu: string | Uint8Array };

export function construireZip(fichiers: FichierArchive[], le = new Date()): Uint8Array {
  const encodeur = new TextEncoder();
  const { heure, jour } = dateDos(le);
  const morceaux: Uint8Array[] = [];
  const entrees: { nom: Uint8Array; crc: number; taille: number; offset: number }[] = [];
  let offset = 0;

  for (const f of fichiers) {
    const nom = encodeur.encode(f.nom);
    const contenu = typeof f.contenu === "string" ? encodeur.encode(f.contenu) : f.contenu;
    const crc = crc32(contenu);
    const entete = new DataView(new ArrayBuffer(30));
    entete.setUint32(0, 0x04034b50, true); // signature d'en-tête local
    entete.setUint16(4, 20, true); // version minimale
    entete.setUint16(6, 0x0800, true); // drapeau : nom de fichier en UTF-8
    entete.setUint16(8, 0, true); // méthode 0 = stocké, sans compression
    entete.setUint16(10, heure, true);
    entete.setUint16(12, jour, true);
    entete.setUint32(14, crc, true);
    entete.setUint32(18, contenu.length, true);
    entete.setUint32(22, contenu.length, true);
    entete.setUint16(26, nom.length, true);
    entete.setUint16(28, 0, true);
    morceaux.push(new Uint8Array(entete.buffer), nom, contenu);
    entrees.push({ nom, crc, taille: contenu.length, offset });
    offset += 30 + nom.length + contenu.length;
  }

  const debutCentral = offset;
  for (const e of entrees) {
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, heure, true);
    central.setUint16(14, jour, true);
    central.setUint32(16, e.crc, true);
    central.setUint32(20, e.taille, true);
    central.setUint32(24, e.taille, true);
    central.setUint16(28, e.nom.length, true);
    central.setUint32(42, e.offset, true);
    morceaux.push(new Uint8Array(central.buffer), e.nom);
    offset += 46 + e.nom.length;
  }

  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, entrees.length, true);
  fin.setUint16(10, entrees.length, true);
  fin.setUint32(12, offset - debutCentral, true);
  fin.setUint32(16, debutCentral, true);
  morceaux.push(new Uint8Array(fin.buffer));

  const total = morceaux.reduce((s, m) => s + m.length, 0);
  const archive = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) { archive.set(m, pos); pos += m.length; }
  return archive;
}

/** Nom de fichier daté : un atelier qui exporte tous les mois doit pouvoir classer ses archives. */
export function nomArchive(nomAtelier: string, le = new Date()): string {
  const slug = nomAtelier.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "atelier";
  return `thermogestion-${slug}-${le.toISOString().slice(0, 10)}.zip`;
}

export function fichiersArchive(
  tables: TableCollectee[],
  nomAtelier: string,
  le = new Date(),
  role: RoleExport = null,
): FichierArchive[] {
  return [
    { nom: "LISEZ-MOI.txt", contenu: lisezMoi(tables, nomAtelier, le, role) },
    {
      nom: "donnees.json",
      contenu: JSON.stringify(
        {
          atelier: nomAtelier,
          exporte_le: le.toISOString(),
          source: "Thermogestion",
          // Le rôle est repris dans le JSON : c'est le fichier qui fait foi en cas de reprise, et
          // savoir avec quels droits l'archive a été produite conditionne sa complétude.
          role_exportateur: role,
          tables: Object.fromEntries(tables.map((t) => [t.nom, t.lignes])),
        },
        null,
        2,
      ),
    },
    ...tables.map((t) => ({ nom: `csv/${t.nom}.csv`, contenu: versCsvTable(t.lignes) })),
  ];
}
