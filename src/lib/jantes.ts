import type { TonBadge } from "@/lib/tons";
import { coefGrille, prixNegocie } from "@/lib/calculs";
import { nombreFr, round2 } from "@/lib/utils";
import type { ClientTarif, DevisItem, GrilleCoef, JantePalier, OperationJante, PositionJante, Prestation, StatutJante } from "@/lib/types";

/**
 * Rénovation de jantes — vocabulaire, chiffrage au jeu et libellés de documents.
 *
 * Le module ne crée pas un second moteur de prix. Il réutilise la grille tarifaire du client
 * (donc la grille dédiée d'un garage sous contrat s'applique d'office) et la table
 * `grille_coefs` (deux catégories de plus). Seule la grandeur du palier change : au m² pour une
 * pièce d'atelier, au pouce pour une jante — parce qu'un garage ne mesure jamais une jante en m²,
 * il l'annonce en pouces.
 */

// ── Vocabulaire ──────────────────────────────────────────────────────────────

export const POSITIONS_JANTE: { code: PositionJante; libelle: string; court: string }[] = [
  { code: "avg", libelle: "Avant gauche", court: "AVG" },
  { code: "avd", libelle: "Avant droite", court: "AVD" },
  { code: "arg", libelle: "Arrière gauche", court: "ARG" },
  { code: "ard", libelle: "Arrière droite", court: "ARD" },
  { code: "secours", libelle: "Roue de secours", court: "SEC" },
];

/** États constatés à la prise en charge. Cumulables : une jante peut être rayée ET voilée. */
export const ETATS_JANTE: Record<string, string> = {
  sain: "Bon état",
  rayures: "Rayures",
  choc_trottoir: "Choc de trottoir",
  corrosion: "Corrosion / oxydation",
  voile: "Voile",
  fissure: "Fissure",
  peinture_ecaillee: "Peinture écaillée",
  diamantage_pique: "Diamantage piqué (vernis percé)",
  autre: "Autre (voir réserves)",
};

export const OPERATIONS_JANTE: Record<OperationJante, string> = {
  devoilage: "Dévoilage",
  redressage: "Redressage",
  soudure: "Soudure de fissure",
  depose_pneu: "Dépose du pneu",
  repose_pneu: "Repose du pneu",
  equilibrage: "Équilibrage",
  valve_tpms: "Valve TPMS",
  diamantage: "Diamantage CNC",
};

/**
 * Code de la prestation facturable derrière chaque opération.
 *
 * Le rattachement se fait par `prestations.code` et jamais par le nom : un atelier renomme
 * « Dévoilage » en « Redressage voile » le jour où son client le lui demande, et la ligne
 * cesserait d'être reconnue.
 */
export const CODES_PRESTATION_JANTE: Record<OperationJante, string> = {
  devoilage: "JT-DEVOILAGE",
  redressage: "JT-REDRESSAGE",
  soudure: "JT-SOUDURE",
  depose_pneu: "JT-DEPOSE-PNEU",
  repose_pneu: "JT-REPOSE-PNEU",
  equilibrage: "JT-EQUILIBRAGE",
  valve_tpms: "JT-VALVE-TPMS",
  diamantage: "JT-DIAMANTAGE",
};

/** Barème livré par défaut : ce qu'un atelier voit s'il n'a rien réglé. Prix HT à la jante. */
export const PALIERS_JANTE_DEFAUT: { diametre_min: number; diametre_max: number | null; prix_jante_ht: number }[] = [
  { diametre_min: 0, diametre_max: 17, prix_jante_ht: 70 },
  { diametre_min: 17, diametre_max: 19, prix_jante_ht: 85 },
  { diametre_min: 19, diametre_max: 21, prix_jante_ht: 100 },
  { diametre_min: 21, diametre_max: null, prix_jante_ht: 130 },
];

export const DESSINS_JANTE_DEFAUT = [
  { code: "pleine", libelle: "Pleine / 5 branches larges", coef: 1 },
  { code: "standard", libelle: "Standard (5 à 10 branches)", coef: 1.15 },
  { code: "multibranches", libelle: "Multibranches fines / rayons", coef: 1.4 },
];

/**
 * `libelle` explique le réglage à l'atelier, `court` va sur le document du client. Les deux
 * existent parce qu'« usinage CNC de la face » aide l'atelier à choisir, et alourdit une facture.
 */
export const FINITIONS_JANTE_DEFAUT = [
  { code: "unie", libelle: "Teinte unie", court: "teinte unie", coef: 1 },
  { code: "vernis", libelle: "Teinte + vernis de protection", court: "vernis de protection", coef: 1.2 },
  { code: "bicolore", libelle: "Bicolore (corps + face)", court: "bicolore", coef: 1.35 },
  { code: "diamantee", libelle: "Diamantée (usinage CNC de la face)", court: "diamantée", coef: 1.6 },
  { code: "chrome_effet", libelle: "Chrome-effet", court: "chrome-effet", coef: 1.8 },
];

export const STATUTS_JANTE: Record<StatutJante, { label: string; ton: TonBadge }> = {
  a_faire: { label: "À faire", ton: "neutral" },
  en_cours: { label: "En cours", ton: "info" },
  prete: { label: "Prête", ton: "success" },
  retouche: { label: "Retouche", ton: "warning" },
  rebut: { label: "Rebut", ton: "danger" },
};

export const STATUTS_JEU: Record<string, { label: string; ton: TonBadge }> = {
  recu: { label: "Reçu", ton: "neutral" },
  en_cours: { label: "En cours", ton: "info" },
  pret: { label: "Prêt", ton: "success" },
  livre: { label: "Livré", ton: "neutral" },
  annule: { label: "Annulé", ton: "danger" },
};

// ── Surface ──────────────────────────────────────────────────────────────────

/**
 * Surface développée d'une jante, en m², déduite de son diamètre.
 *
 * Calage volontaire sur les valeurs que le produit annonce déjà dans sa bibliothèque de pièces
 * types (17" = 0,9 m², 19" = 1,1 m²) : deux écrans du même logiciel ne peuvent pas donner deux
 * surfaces différentes pour la même jante. C'est cette surface qui alimente la consommation de
 * poudre, le coût énergétique et la charge du four — pas le prix, qui dépend en plus du dessin.
 *
 * Le dessin n'entre pas ici : une multibranches a bien plus de surface développée qu'une jante
 * pleine, mais aucune règle simple ne la donne. La surface reste corrigeable à la main sur le
 * dossier plutôt que devinée par un coefficient inventé.
 */
export function surfaceJante(diametrePouces: number): number {
  const d = Number(diametrePouces) || 0;
  return round2(Math.max(0.3, 0.1 * d - 0.8));
}

// ── Prix ─────────────────────────────────────────────────────────────────────

/**
 * Palier applicable à un diamètre : borne basse incluse, borne haute exclue, dernière tranche à
 * `diametre_max` nul. Même convention que `grille_paliers` — une jante de 19 pouces pile tombe
 * dans la tranche 19–21, pas dans 17–19.
 */
export function palierJante(paliers: JantePalier[], grilleId: string | null | undefined, diametre: number): JantePalier | undefined {
  return paliers.find(
    (p) =>
      p.grille_id === grilleId &&
      diametre >= Number(p.diametre_min) &&
      (p.diametre_max == null || diametre < Number(p.diametre_max)),
  );
}

/**
 * Prix HT d'UNE jante : palier au pouce × coefficient de dessin × coefficient de finition.
 *
 * Les deux coefficients se multiplient parce qu'ils portent sur des temps distincts : le dessin
 * majore la préparation (masquer et poudrer une multibranches fine prend beaucoup plus de temps
 * qu'une 5 branches pleines), la finition majore le nombre de passages (vernis, bicolore,
 * diamantage). Un code absent vaut 1 : un barème incomplet ne doit jamais faire tomber un prix
 * à zéro.
 */
export function prixJante(args: {
  diametre: number;
  dessin?: string | null;
  finition?: string | null;
  grilleId: string | null | undefined;
  paliers: JantePalier[];
  coefs: GrilleCoef[];
}): number {
  const palier = palierJante(args.paliers, args.grilleId, Number(args.diametre) || 0);
  const base = palier ? Number(palier.prix_jante_ht) : 0;
  const cD = coefGrille(args.coefs, args.grilleId, "jante_dessin", args.dessin);
  const cF = coefGrille(args.coefs, args.grilleId, "jante_finition", args.finition);
  return round2(base * cD * cF);
}

// ── Libellés ─────────────────────────────────────────────────────────────────

/** Diamètre à la française, sans zéro inutile : 19″ et 18,5″, jamais « 19.0 pouces » ni « 19&quot; ». */
export function pouces(d: number): string {
  return `${nombreFr(d, 1)}″`;
}

export type VehiculeLibelle = { marque?: string | null; modele?: string | null; annee?: number | null };

/**
 * Libellé du jeu, tel qu'un garage le lit.
 *
 * Un devis, un bon de livraison et une facture qui annoncent « Projet PR-2026-0042 » sont
 * illisibles pour un concessionnaire qui suit quinze jeux par mois. Il classe par voiture et par
 * teinte, pas par numéro interne.
 */
export function libelleJeu(args: {
  nbJantes: number;
  diametre: number;
  dessin?: string | null;
  finition?: string | null;
  teinte?: string | null;
  teinteReference?: string | null;
  /**
   * Vrai quand la teinte est celle d'origine du véhicule, faux quand le client en a choisi une
   * autre. Non renseigné, c'est la présence d'une référence constructeur qui tranche : sans code
   * d'origine, l'atelier n'a rien qui lui permette d'écrire « teinte d'origine » sur un document
   * remis à un concessionnaire.
   */
  teinteOrigine?: boolean;
  vehicule?: VehiculeLibelle | null;
  finitionsLibelles?: Record<string, string>;
}): string {
  const nb = Math.max(1, Math.round(Number(args.nbJantes) || 1));
  const morceaux: string[] = [];

  const tete = nb === 1 ? `Jante ${pouces(args.diametre)}` : `Jeu de ${nb} jantes ${pouces(args.diametre)}`;
  morceaux.push(nb === 5 ? `${tete} (dont roue de secours)` : tete);

  const v = args.vehicule;
  if (v?.marque) {
    morceaux.push([v.marque, v.modele].filter(Boolean).join(" ") + (v.annee ? ` (${v.annee})` : ""));
  }

  if (args.teinte) {
    const origine = args.teinteOrigine ?? Boolean(args.teinteReference);
    // La référence constructeur n'est imprimée que si la teinte EST celle d'origine. Un client
    // qui demande du noir mat sur une voiture livrée en Gris Argent lisait « Noir mat (LY7W) » :
    // le code d'une autre teinte, sur son devis. Le garde-fou est ici, et pas dans l'appelant —
    // trois écrans construisent ce libellé.
    const ref = origine && args.teinteReference ? ` (${args.teinteReference})` : "";
    morceaux.push(`${origine ? "teinte d'origine" : "teinte"} ${args.teinte}${ref}`);
  }

  // La finition « unie » n'est pas une information : ne l'écrire que si elle apporte quelque chose.
  // La parenthèse explicative du réglage est retirée : « Diamantée (usinage CNC de la face) » aide
  // l'atelier à choisir dans une liste, et alourdit une facture. Le nettoyage vaut aussi pour le
  // libellé propre à l'atelier, qui suit la même habitude de rédaction.
  const finition = args.finition && args.finition !== "unie"
    ? (args.finitionsLibelles?.[args.finition] ?? FINITIONS_JANTE_DEFAUT.find((f) => f.code === args.finition)?.court ?? args.finition)
        .replace(/\s*\([^()]*\)\s*$/, "")
        .trim()
    : null;
  if (finition) morceaux.push(finition.toLowerCase());

  return morceaux.join(" — ");
}

// ── Lignes de devis ──────────────────────────────────────────────────────────

/**
 * Ligne de devis d'un jeu de jantes.
 *
 * Elle est de type `libre` marquée dans son `meta`, sur le modèle exact de la ligne au mètre
 * linéaire : le devis, la facture, le bon de livraison, le PDF, le Factur-X et le FEC la
 * consomment alors sans une seule ligne de code supplémentaire. La marque est dans `meta` et
 * jamais dans le libellé, que l'atelier peut retoucher.
 *
 * `qte` est le nombre de jantes et `pu_ht` le prix d'une jante : le client lit « 4 × 224 € » et
 * peut recalculer son devis. `meta.surface_m2` porte la surface d'UNE jante, celle que
 * `trg_devis_signe` multiplie par la quantité pour ouvrir le projet avec la bonne surface.
 */
export function ligneJeuJantes(args: {
  nbJantes: number;
  diametre: number;
  dessin?: string | null;
  finition?: string | null;
  teinte?: string | null;
  teinteReference?: string | null;
  teinteOrigine?: boolean;
  vehicule?: VehiculeLibelle | null;
  vehiculeId?: string | null;
  jeuId?: string | null;
  surfaceM2?: number | null;
  tva?: number;
  grilleId: string | null | undefined;
  paliers: JantePalier[];
  coefs: GrilleCoef[];
  finitionsLibelles?: Record<string, string>;
}): DevisItem {
  const nb = Math.max(1, Math.round(Number(args.nbJantes) || 1));
  const pu = prixJante({
    diametre: args.diametre,
    dessin: args.dessin,
    finition: args.finition,
    grilleId: args.grilleId,
    paliers: args.paliers,
    coefs: args.coefs,
  });
  const surface = args.surfaceM2 != null && Number(args.surfaceM2) > 0 ? round2(Number(args.surfaceM2)) : surfaceJante(args.diametre);
  return {
    type: "libre",
    libelle: libelleJeu(args),
    qte: nb,
    // Unité propre au métier : sur le devis, le bon de livraison et la facture, le garage lit
    // « 4 jantes » et non « 4 pièces ». C'est la seule ligne du produit qui se compte en jantes.
    unite: "jante",
    pu_ht: pu,
    tva: args.tva ?? 20,
    total_ht: round2(nb * pu),
    meta: {
      jante: true,
      jeu_jantes_id: args.jeuId ?? null,
      vehicule_id: args.vehiculeId ?? null,
      diametre_pouces: Number(args.diametre) || 0,
      dessin: args.dessin ?? null,
      finition: args.finition ?? null,
      teinte: args.teinte ?? null,
      teinte_reference: args.teinteReference ?? null,
      surface_m2: surface,
      grille_id: args.grilleId ?? null,
    },
  };
}

/**
 * Lignes des opérations mécaniques, une par opération, quantifiée au nombre de jantes concernées.
 *
 * Elles ne sont **pas** fondues dans le prix à la jante : sur un jeu de quatre, une seule est
 * souvent voilée, et le garage doit lire « Dévoilage × 1 » et non un prix de jeu majoré sans
 * explication. C'est aussi la seule façon de tracer les valves TPMS, litige classique du métier.
 *
 * Une opération dont la prestation n'existe pas dans le catalogue de l'atelier est ignorée
 * plutôt que facturée à zéro : une ligne à 0 € ferait croire à l'atelier qu'il l'a vendue.
 */
export function lignesOperationsJantes(args: {
  operations: Partial<Record<OperationJante, number>>;
  prestations: Prestation[];
  clientId: string | null | undefined;
  clientTarifs: ClientTarif[];
}): DevisItem[] {
  const lignes: DevisItem[] = [];
  for (const code of Object.keys(OPERATIONS_JANTE) as OperationJante[]) {
    const nb = Math.max(0, Math.round(Number(args.operations?.[code] ?? 0)));
    if (!nb) continue;
    const prestation = args.prestations.find((p) => p.code === CODES_PRESTATION_JANTE[code] && p.actif !== false);
    if (!prestation) continue;
    const { pu, negocie } = prixNegocie(prestation, args.clientId, args.clientTarifs);
    lignes.push({
      type: "prestation",
      libelle: prestation.nom,
      qte: nb,
      unite: "piece",
      pu_ht: pu,
      tva: Number(prestation.tva_rate ?? 20),
      total_ht: round2(nb * pu),
      meta: { jante: true, operation_jante: code, prestation_id: prestation.id, tarif_negocie: negocie },
    });
  }
  return lignes;
}

/** Une ligne de devis, de facture ou de bon de livraison issue du module jantes (jeu ou opération). */
export function estLigneJante(ligne: { meta?: Record<string, unknown> | null }): boolean {
  return ligne?.meta?.jante === true;
}

/**
 * Une ligne « jeu de jantes » précisément — à distinguer d'une ligne d'opération mécanique
 * (dévoilage, valve TPMS…), qui porte elle aussi `meta.jante === true` mais aucune caractéristique
 * de jante. `ligneJeuJantes` pose toujours `diametre_pouces` (même à 0) ; `lignesOperationsJantes`
 * ne le pose jamais : c'est ce qui les distingue de façon fiable, sans dépendre du `type` de la
 * ligne (les deux sont des lignes `libre`/`prestation` ordinaires par ailleurs).
 */
export function estLigneJeuJantes(ligne: { meta?: Record<string, unknown> | null }): boolean {
  return estLigneJante(ligne) && ligne.meta?.diametre_pouces !== undefined;
}

// ── Préchargement de la fiche jante depuis le devis (amélioration n°8, 07/09/2026) ─────────────

/** Une ligne « jeu de jantes » d'un devis, repérée pour être reprise sur `/jantes/new`. */
export type LigneJanteDevis = {
  devisId: string;
  devisNumero: string | null;
  /** Index dans `devis.items`, pour pouvoir reposer `meta.jeu_jantes_id` au bon endroit ensuite. */
  itemIndex: number;
  libelle: string;
  qte: number;
  meta: Record<string, unknown>;
};

/**
 * Lignes de jantes d'un devis qui n'ont pas encore de dossier physique ouvert.
 *
 * POURQUOI exclure celles qui portent déjà un `meta.jeu_jantes_id` : `jeux_jantes.devis_id` n'a
 * pas de contrainte d'unicité en base (un devis peut légitimement porter plusieurs jeux). Sans ce
 * filtre, reproposer une ligne déjà ouverte créerait un second dossier physique — donc un second
 * bon de prise en charge — pour des jantes déjà réceptionnées une fois.
 */
export function lignesJantesOuvrables(devis: {
  id: string;
  numero: string | null;
  items: DevisItem[] | null | undefined;
}): LigneJanteDevis[] {
  return (devis.items ?? [])
    .map((it, itemIndex) => ({ it, itemIndex }))
    .filter(({ it }) => estLigneJeuJantes(it) && !it.meta?.jeu_jantes_id)
    .map(({ it, itemIndex }) => ({
      devisId: devis.id,
      devisNumero: devis.numero,
      itemIndex,
      libelle: it.libelle,
      qte: it.qte,
      meta: (it.meta ?? {}) as Record<string, unknown>,
    }));
}

/** Ce que `/jantes/new` reprend d'une ligne de devis — jamais plus que ce qui a le même sens. */
export type PrefillJante = {
  nbJantes: number;
  diametrePouces: number | null;
  dessin: string | null;
  finition: string | null;
  teinte: string | null;
  /** Référence constructeur : vit sur `vehicules.teinte_reference`, pas sur `jeux_jantes` (colonne inexistante). */
  teinteReference: string | null;
  vehiculeId: string | null;
};

/**
 * Traduit une ligne de devis en valeurs de préremplissage pour l'ouverture d'un dossier jantes.
 *
 * POURQUOI seulement ces champs : nombre, diamètre, dessin et finition ont exactement le même
 * sens des deux côtés (chiffrage et réception). Le prix, la grille et la surface du devis sont
 * des artefacts de tarification qui se recalculent à l'ouverture du dossier selon le barème du
 * jour — les figer romprait le principe déjà en place sur `/jantes/new` (le prix affiché y est
 * « indicatif », jamais stocké). La teinte du devis est reprise comme teinte *demandée*
 * (`jeux_jantes.teinte`), jamais comme teinte d'origine du véhicule : ce sont deux informations
 * différentes (amélioration n°8, constat du 07/09/2026) que seule la présence d'une référence
 * constructeur permet de rapprocher.
 */
export function prefillJanteDepuisDevis(ligne: { qte: number; meta: Record<string, unknown> }): PrefillJante {
  const m = ligne.meta ?? {};
  const diametre = Number(m.diametre_pouces);
  const chaine = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  return {
    // Même convention que `ligneJeuJantes` (`|| 1`, pas `|| 4`) : un `qte` à 0 ou absent doit
    // retomber sur un jeu d'une jante, pas sur un jeu de quatre inventé.
    nbJantes: Math.min(5, Math.max(1, Math.round(Number(ligne.qte) || 1))),
    diametrePouces: Number.isFinite(diametre) && diametre > 0 ? Math.min(Math.max(diametre, 12), 26) : null,
    dessin: chaine(m.dessin),
    finition: chaine(m.finition),
    teinte: chaine(m.teinte),
    teinteReference: chaine(m.teinte_reference),
    vehiculeId: chaine(m.vehicule_id),
  };
}

// ── Suivi ────────────────────────────────────────────────────────────────────

export function positionsParDefaut(nbJantes: number): PositionJante[] {
  const nb = Math.min(POSITIONS_JANTE.length, Math.max(1, Math.round(Number(nbJantes) || 1)));
  return POSITIONS_JANTE.slice(0, nb).map((p) => p.code);
}

/**
 * Statut du jeu déduit de ses jantes — réplique exacte du trigger `jeu_statut_depuis_jantes`.
 *
 * La règle qui compte : un jeu dont trois jantes sont prêtes et la quatrième en retouche n'est
 * pas prêt. Annoncer « prêt » ferait venir le garage pour rien, et c'est ce qui fait cesser de
 * croire un tableau de bord. Une jante mise au rebut compte comme traitée : elle ne reviendra pas.
 *
 * `livre` et `annule` ne sont pas produits ici : ce sont des décisions humaines, que la base
 * n'écrase jamais.
 */
export function statutJeuDepuisJantes(statuts: StatutJante[] | string[]): "recu" | "en_cours" | "pret" {
  const total = statuts.length;
  if (total === 0) return "recu";
  const aFaire = statuts.filter((s) => s === "a_faire").length;
  const finies = statuts.filter((s) => s === "prete" || s === "rebut").length;
  if (aFaire === total) return "recu";
  if (finies === total) return "pret";
  return "en_cours";
}

/** Compte de jantes prêtes sur le total, pour la carte de suivi : « 3 jantes sur 4 prêtes ». */
export function avancementJeu(statuts: StatutJante[] | string[]): { pretes: number; total: number; retouches: number } {
  return {
    pretes: statuts.filter((s) => s === "prete").length,
    total: statuts.length,
    retouches: statuts.filter((s) => s === "retouche").length,
  };
}
