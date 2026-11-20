/**
 * Registre des déchets et classeur FDS — la partie ICPE / ATEX de la vie d'un atelier, à côté du
 * volet Qualicoat déjà couvert.
 *
 * Un atelier de thermolaquage relève de la rubrique ICPE 2940 (application de revêtement). Deux
 * obligations reviennent à chaque inspection : le **registre chronologique des déchets sortants**
 * (art. R.541-43 du code de l'environnement, arrêté du 31 mai 2021) conservé cinq ans, et la mise
 * à disposition des **fiches de données de sécurité** des produits chimiques employés
 * (art. R.4411-73 du code du travail).
 */

/**
 * Déchets réellement produits par un atelier de thermolaquage, avec leur code de la nomenclature
 * européenne (annexe II de l'article R.541-8). L'astérisque marque un déchet dangereux : c'est lui
 * qui déclenche le bordereau de suivi et la traçabilité Trackdéchets.
 *
 * Les codes sont proposés à la saisie, jamais imposés : le code exact dépend de la chimie réelle
 * du prétraitement, et c'est le prestataire d'enlèvement qui le tranche sur le bordereau.
 */
export const NATURES_DECHET = [
  { nature: "Boues de cabine / poudre de récupération", code: "08 02 01", dangereux: false },
  { nature: "Poudre périmée ou non conforme", code: "08 02 01", dangereux: false },
  { nature: "Bain de dégraissage usé", code: "11 01 13*", dangereux: true },
  { nature: "Bain de décapage / déoxydation usé", code: "11 01 05*", dangereux: true },
  { nature: "Boues de traitement de surface", code: "11 01 09*", dangereux: true },
  { nature: "Rinçage / eaux de process", code: "11 01 11*", dangereux: true },
  { nature: "Emballages souillés (fûts, sacs de poudre)", code: "15 01 10*", dangereux: true },
  { nature: "Chiffons et absorbants souillés", code: "15 02 02*", dangereux: true },
  { nature: "Solvants usés (nettoyage pistolet)", code: "14 06 03*", dangereux: true },
  { nature: "Abrasif de sablage usagé", code: "12 01 17", dangereux: false },
  { nature: "Ferraille et chutes métalliques", code: "17 04 05", dangereux: false },
  { nature: "Autre", code: "", dangereux: false },
] as const;

/**
 * Code de traitement porté sur le bordereau. D = élimination, R = valorisation. L'inspection
 * regarde la répartition entre les deux : un atelier qui élimine tout ce qu'il pourrait valoriser
 * se le voit reprocher.
 */
export const TRAITEMENTS_DECHET = [
  { code: "R3", libelle: "R3 — Recyclage de substances organiques" },
  { code: "R4", libelle: "R4 — Recyclage des métaux" },
  { code: "R5", libelle: "R5 — Recyclage d'autres matières inorganiques" },
  { code: "R1", libelle: "R1 — Valorisation énergétique" },
  { code: "R13", libelle: "R13 — Stockage avant valorisation" },
  { code: "D9", libelle: "D9 — Traitement physico-chimique" },
  { code: "D10", libelle: "D10 — Incinération à terre" },
  { code: "D5", libelle: "D5 — Mise en décharge aménagée" },
  { code: "D15", libelle: "D15 — Stockage avant élimination" },
] as const;

/** Un déchet dangereux sans bordereau est la non-conformité la plus simple à relever en inspection. */
export function bordereauManquant(d: { dangereux: boolean; bordereau: string | null }): boolean {
  return d.dangereux && !d.bordereau?.trim();
}

/** Durée de conservation réglementaire du registre : cinq ans (art. R.541-43). */
export const CONSERVATION_REGISTRE_ANNEES = 5;

export type LigneDechet = {
  id: string;
  date_sortie: string;
  nature: string;
  code_dechet: string | null;
  dangereux: boolean;
  quantite_kg: number | string;
  bordereau: string | null;
  transporteur: string | null;
  destination: string | null;
  traitement: string | null;
  note: string | null;
};

/** Totaux du registre sur la période affichée, tels qu'on les reporte dans la déclaration annuelle. */
export function totauxDechets(lignes: LigneDechet[]) {
  let dangereux = 0;
  let nonDangereux = 0;
  let sansBordereau = 0;
  for (const l of lignes) {
    const kg = Number(l.quantite_kg) || 0;
    if (l.dangereux) dangereux += kg;
    else nonDangereux += kg;
    if (bordereauManquant(l)) sansBordereau += 1;
  }
  const arrondi = (n: number) => Math.round(n * 100) / 100;
  return { dangereux: arrondi(dangereux), nonDangereux: arrondi(nonDangereux), total: arrondi(dangereux + nonDangereux), sansBordereau };
}

// ── Fiches de données de sécurité ────────────────────────────────────────────

export type FicheFds = {
  id: string;
  poudre_id: string | null;
  produit: string;
  fournisseur: string | null;
  version: string | null;
  date_fds: string | null;
  url: string | null;
  document_url: string | null;
  mentions_danger: string | null;
  note: string | null;
  actif: boolean;
};

/**
 * Une FDS de plus de trois ans doit être vérifiée auprès du fournisseur : le règlement REACH
 * impose au fournisseur de rediffuser une version mise à jour, mais personne ne vient la chercher.
 * Trois ans est le repère retenu par les organismes de prévention.
 */
export const FDS_PERIME_ANNEES = 3;

export function fdsAVerifier(dateFds: string | null, aujourdHui = new Date()): boolean {
  if (!dateFds) return true;
  const d = new Date(`${dateFds.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const limite = new Date(aujourdHui);
  limite.setFullYear(limite.getFullYear() - FDS_PERIME_ANNEES);
  return d < limite;
}

/** Recherche plein texte tolérante : à l'atelier, on tape « ral 9010 » ou « degraissant », sans accent. */
export function normaliser(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrerFds(fiches: FicheFds[], recherche: string): FicheFds[] {
  const q = normaliser(recherche);
  if (!q) return fiches;
  const mots = q.split(/\s+/);
  return fiches.filter((f) => {
    const foin = normaliser([f.produit, f.fournisseur, f.mentions_danger, f.note].filter(Boolean).join(" "));
    return mots.every((m) => foin.includes(m));
  });
}
