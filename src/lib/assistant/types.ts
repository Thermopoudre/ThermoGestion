/**
 * Le contrat de l'assistant — partagé par les outils, la route serveur et l'écran.
 *
 * POURQUOI un fichier de types séparé : le composant React ne doit jamais importer `outils.ts`,
 * qui parle à Supabase et qui embarque le SDK Anthropic. S'il le faisait, la clé d'API et les
 * requêtes de l'atelier finiraient dans le paquet envoyé au navigateur. Un fichier de types pur
 * est le seul lien autorisé entre les deux côtés.
 */

/** Les rôles tels que l'assistant a besoin de les connaître. Miroir de `src/lib/roles.ts`. */
export type PerimetreOutil = "production" | "commercial";

/**
 * Une fiche que l'exploitant doit pouvoir ouvrir d'un doigt depuis la réponse.
 *
 * C'est la contrepartie de la règle « aucune réponse sans source » : un chiffre qu'on ne peut pas
 * aller vérifier sur la fiche n'est pas une réponse, c'est une affirmation. Le `type` décide du
 * chemin, exactement comme dans la recherche globale (`src/lib/recherche.ts`) — on ne réinvente
 * pas une seconde table de routes qui finirait par diverger, et les neuf types couverts ici sont
 * VOLONTAIREMENT les mêmes neuf familles que `TypeResultat` dans `src/lib/recherche.ts` : c'est ce
 * qui permet à `recherche_fiche` (F1) de rendre directement les résultats de `recherche_globale()`
 * en sources cliquables, et à `stock_sous_seuil` de pointer vers la fiche poudre.
 */
export type SourceAssistant = {
  type:
    | "devis" | "facture" | "projet" | "client"
    | "bl" | "reception" | "jantes" | "poudre" | "lot";
  id: string;
  /** Ce que l'exploitant lit sur le bouton : « DV-2026-0031 · Métallerie du Sud ». */
  libelle: string;
  /** Le chiffre porté par cette ligne, déjà arrondi. Affiché à droite du libellé. */
  montant?: number | null;
  /** Précision d'une ligne : « envoyé il y a 12 jours », « échue depuis 8 jours ». */
  detail?: string | null;
};

/**
 * Une action proposée sous la réponse.
 *
 * `chemin` mène TOUJOURS vers un écran existant de Thermogestion. L'assistant ne fait rien
 * lui-même : il amène l'exploitant devant le bouton, et c'est l'exploitant qui appuie. C'est la
 * règle qui rend l'assistant inoffensif — il ne peut ni relancer, ni facturer, ni annuler.
 */
export type ActionProposee = {
  libelle: string;
  chemin: string;
};

/** Motif d'un outil qui n'a rien pu rendre. Jamais d'exception avalée en silence. */
export type RefusOutil = "hors_perimetre" | "parametres_invalides" | "erreur_base";

/**
 * Ce qu'un outil rend au modèle. C'est ce JSON — et lui seul — qui remonte dans la conversation :
 * le modèle ne voit jamais une ligne de la base autrement que par ici.
 */
export type ResultatOutil = {
  outil: string;
  /**
   * Les paramètres RÉELLEMENT appliqués, valeurs par défaut résolues comprises.
   *
   * Sans ça, un modèle à qui l'on demande « les devis sans réponse depuis dix jours » et dont
   * l'outil a retenu sept jours (le réglage de l'atelier) répondrait « depuis dix jours » sur un
   * décompte à sept. L'écart est petit, la phrase est fausse, et l'exploitant ne peut pas le voir.
   */
  parametres: Record<string, unknown>;
  /** Une phrase qui dit ce que l'outil compte, pour que le modèle la reprenne au lieu de l'inventer. */
  definition: string;
  /** Les agrégats. Toujours des nombres bruts : le formatage en euros appartient à l'écran. */
  donnees: Record<string, unknown>;
  sources: SourceAssistant[];
  /** Vrai quand la base a plus de lignes que le plafond de l'outil : le total est alors partiel. */
  tronque: boolean;
  refus?: RefusOutil;
  /** Le motif en français, destiné au modèle ET repris tel quel à l'écran en cas d'échec total. */
  message?: string;
};

/** Ce que la route rend au navigateur. */
export type ReponseAssistant = {
  texte: string;
  sources: SourceAssistant[];
  actions: ActionProposee[];
  /**
   * La trace, affichée sous la réponse et rangée dans le journal.
   *
   * L'exigence est explicite : l'atelier doit pouvoir voir ce qui a été envoyé au modèle. On ne
   * lui montre pas le prompt système (il est identique pour tout le monde et il n'a aucune donnée),
   * on lui montre les **outils appelés et leurs paramètres** — c'est-à-dire exactement le
   * périmètre des données sorties de sa base.
   */
  trace: { outil: string; parametres: Record<string, unknown>; lignes: number }[];
  modele: string;
  /** Coût de la question en euros, arrondi au centième de centime. */
  cout_eur: number;
};

/**
 * Chemin d'ouverture d'une source. Même convention que la recherche globale
 * (`src/lib/recherche.ts`) : l'écran n'a aucune route en dur.
 *
 * POURQUOI ici et pas dans `orchestration.ts` : ce module est le SEUL que le composant client a le
 * droit d'importer. `orchestration.ts` tire le SDK Anthropic et le client Supabase serveur ; les
 * importer depuis un fichier « use client » ferait partir tout cela dans le paquet du navigateur.
 */
const CHEMIN_SOURCE: Record<SourceAssistant["type"], (id: string) => string> = {
  client: (id) => `/clients/${id}`,
  devis: (id) => `/devis/${id}`,
  facture: (id) => `/factures/${id}`,
  projet: (id) => `/projets/${id}`,
  jantes: (id) => `/jantes/${id}`,
  reception: (id) => `/receptions/${id}`,
  bl: (id) => `/bl/fiche/${id}`,
  poudre: (id) => `/stock/${id}`,
  lot: (id) => `/lots/${id}`,
};

export function cheminSource(s: Pick<SourceAssistant, "type" | "id">): string {
  return CHEMIN_SOURCE[s.type](s.id);
}

/**
 * Les questions proposées à l'écran quand le champ est vide.
 *
 * Elles ne sont pas décoratives : elles sont le mode d'emploi. Un champ libre sans exemple fait
 * poser des questions auxquelles aucun outil ne répond, et l'exploitant en conclut que « ça ne
 * marche pas » après deux essais. Chacune est couverte par un outil.
 */
export const QUESTIONS_SUGGEREES = [
  "Qu'est-ce que je dois faire aujourd'hui ?",
  "Quels devis n'ont pas de réponse depuis dix jours ?",
  "Qui me doit de l'argent ?",
  "Combien j'ai facturé en août par rapport à juillet ?",
  "Quels chantiers sont prêts mais pas encore livrés ?",
  "Quelles poudres sont sous leur seuil de commande ?",
];

/** Les outils, en français d'atelier. Personne ne doit lire « devis_sans_reponse » à l'écran. */
export const LIBELLE_OUTIL: Record<string, string> = {
  journee_du_matin: "Le point du jour",
  devis_sans_reponse: "Vos devis envoyés sans réponse",
  factures_echues: "Vos factures échues non réglées",
  chiffre_affaires_periode: "Votre chiffre d'affaires facturé",
  devis_signes_non_produits: "Vos devis signés pas encore lancés en production",
  pieces_pretes_non_livrees: "Vos chantiers prêts, pas encore livrés",
  agenda_dates_promises: "Vos dates promises",
  clients_dormants: "Vos clients sans nouvelle",
  stock_sous_seuil: "Vos poudres sous leur seuil",
  rentabilite_client: "La rentabilité de vos clients",
  rentabilite_projet: "Le prix de revient d'un chantier",
  recherche_fiche: "Recherche dans vos fiches",
};

/** Erreur rendue par la route. Le code sert à l'écran, le message est lu par l'exploitant. */
export type ErreurAssistant = {
  code:
    | "non_authentifie"
    | "assistant_non_configure"
    | "question_invalide"
    | "quota_atteint"
    | "hors_perimetre"
    | "erreur_modele";
  message: string;
};

/**
 * F4 — les événements du flux SSE, un par ligne `data: …` envoyée par la route.
 *
 * Le contrat est volontairement pauvre : du texte qui s'accumule, un signal « un outil vient
 * d'être consulté » pour l'attente, et un événement final qui porte tout ce que rendait l'ancienne
 * réponse JSON (sources, actions, trace, coût, quota). Rien de plus n'est nécessaire pour afficher
 * une réponse qui s'écrit au fur et à mesure plutôt que d'un bloc après une longue attente.
 */
export type EvenementAssistant =
  | { type: "texte"; delta: string }
  | { type: "outil"; outil: string }
  | { type: "fin"; reponse: ReponseAssistant & { quota: { pose: number; plafond: number } | null } }
  | { type: "erreur"; erreur: ErreurAssistant };
