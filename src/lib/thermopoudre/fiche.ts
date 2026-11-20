/**
 * Lecture d'une fiche produit thermopoudre.fr et traduction en fiche poudre d'atelier.
 *
 * Le webservice PrestaShop n'expose aucune caractéristique structurée sur les poudres : la
 * température de cuisson, le rendement et la finition vivent dans la description HTML, sous
 * forme d'un tableau « Spécifications » et de deux phrases normalisées. On les lit donc au
 * texte — mais jamais en devinant : un champ absent reste `null` et l'atelier le complète.
 * Ce module est volontairement sans réseau, pour être testable seul.
 */

export type FamilleCatalogue = "poudre" | "jante_oem";

export type FicheTp = {
  tp_product_id: number;
  reference: string | null;
  nom: string;
  famille: FamilleCatalogue;
  marque: string | null;
  ral: string | null;
  coloris: string | null;
  /** Constructeur automobile pour une teinte d'origine (jantes) : Aston Martin, Alfa Romeo… */
  constructeur: string | null;
  finition: string | null;
  type: string | null;
  temp_cuisson: number | null;
  duree_cuisson_min: number | null;
  rendement_m2_kg: number | null;
  prix_kg: number | null;
  conditionnement: string | null;
  url: string;
  image: string | null;
};

/** Catégories PrestaShop de la boutique — l'arbre POUDRES et l'arbre PEINTURE JANTE OEM. */
export const CAT_POUDRES = 36;
export const CAT_JANTE_OEM = 451;

/** Finition déduite de la catégorie, quand le tableau de spécifications n'en porte pas. */
const FINITION_PAR_CATEGORIE: Record<number, string> = {
  22: "candy",
  23: "fluo",
  24: "mat",
  25: "texture",
  38: "metallise",
  39: "satine",
  40: "brillant",
};
/** Ces deux catégories ne décrivent pas une finition mais une nature de produit. */
const TYPE_PAR_CATEGORIE: Record<number, string> = { 20: "primaire", 26: "vernis" };

const FINITIONS = ["mat", "satine", "brillant", "texture", "metallise", "candy", "fluo"] as const;

function sansAccent(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function texteBrut(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#10003;/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tableau « Spécifications » de la fiche : des lignes à deux cellules, libellé puis valeur. */
export function specifications(html: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!html) return out;
  const lignes = html.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g);
  for (const l of lignes) {
    const cle = texteBrut(l[1]);
    const valeur = texteBrut(l[2]);
    if (cle && valeur) out[cle] = valeur;
  }
  return out;
}

/**
 * Cycle de cuisson : « Cure standard : 180-200 °C pendant 10-15 min ».
 *
 * On retient la borne **basse** de température avec la borne **haute** de durée : c'est le couple
 * qui polymérise à coup sûr dans un four d'atelier. L'inverse (200 °C / 10 min) est un cycle
 * valable mais moins tolérant, et personne ne se plaint d'avoir cuit assez longtemps.
 */
export function cycleCuisson(texte: string): { temp: number | null; duree: number | null } {
  const m = texte.match(/(\d{2,3})\s*(?:[-–à]\s*(\d{2,3}))?\s*°\s*C[^.;]{0,30}?(\d{1,3})\s*(?:[-–à]\s*(\d{1,3}))?\s*min/i);
  if (!m) return { temp: null, duree: null };
  return { temp: Number(m[1]), duree: Number(m[4] ?? m[3]) };
}

/**
 * Rendement : « Couvrance moyenne : 8-12 m²/kg ». On retient la borne basse — un rendement
 * optimiste ferait sous-commander la poudre et arrêterait la production.
 */
export function rendement(texte: string): number | null {
  const m = texte.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:[-–à]\s*\d{1,2}(?:[.,]\d)?)?\s*m²\s*\/\s*kg/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Code RAL, du tableau de spécifications ou du nom commercial. */
export function codeRal(texte: string): string | null {
  const m = texte.match(/RAL\s*(\d{4})/i);
  return m ? m[1] : null;
}

/** Masse en kg d'un conditionnement (« 1 kg », « 20 kg »). Les litres ne sont pas des kilos. */
export function kgConditionnement(valeur: string | null | undefined): number | null {
  if (!valeur) return null;
  const m = valeur.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function normaliserType(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const v = sansAccent(valeur);
  if (v.includes("epoxy") && v.includes("polyester")) return "epoxy-polyester";
  if (v.includes("polyester")) return "polyester";
  if (v.includes("epoxy")) return "epoxy";
  if (v.includes("vernis")) return "vernis";
  if (v.includes("primaire")) return "primaire";
  if (v.includes("liquide")) return v.includes("aqueu") ? "liquide-aqueux" : "liquide-solvante";
  return valeur.trim().toLowerCase();
}

function normaliserFinition(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const v = sansAccent(valeur);
  if (v.startsWith("satin")) return "satine";
  if (v.startsWith("metallis")) return "metallise";
  if (v.startsWith("textur")) return "texture";
  return FINITIONS.find((f) => v.startsWith(f)) ?? null;
}

/** Un champ multilingue PrestaShop arrive en tableau `[{ id, value }]`. */
export function valeurLangue(champ: unknown): string {
  if (typeof champ === "string") return champ;
  if (Array.isArray(champ) && champ.length && typeof champ[0] === "object" && champ[0] !== null) {
    return String((champ[0] as { value?: string }).value ?? "");
  }
  return "";
}

export type ProduitPs = {
  id: number | string;
  reference?: string;
  price?: string | number;
  manufacturer_name?: string;
  id_default_image?: string | number;
  link_rewrite?: unknown;
  name?: unknown;
  description?: unknown;
  description_short?: unknown;
  associations?: { categories?: { id: string | number }[] };
};

export function categoriesDe(p: ProduitPs): number[] {
  return (p.associations?.categories ?? []).map((c) => Number(c.id));
}

/** Un produit n'entre au catalogue que s'il appartient à l'arbre POUDRES ou à l'arbre jantes OEM. */
export function familleDe(p: ProduitPs): FamilleCatalogue | null {
  const cats = categoriesDe(p);
  if (cats.includes(CAT_POUDRES)) return "poudre";
  if (cats.includes(CAT_JANTE_OEM)) return "jante_oem";
  return null;
}

export function versFiche(p: ProduitPs, urls: { fiche: (id: number) => string; image: (idImage: unknown, slug: string) => string | null }): FicheTp | null {
  const famille = familleDe(p);
  if (!famille) return null;

  const id = Number(p.id);
  const nom = valeurLangue(p.name);
  const descriptionHtml = valeurLangue(p.description) || valeurLangue(p.description_short);
  const specs = specifications(descriptionHtml);
  const plein = `${nom} ${texteBrut(descriptionHtml)}`;
  const cats = categoriesDe(p);

  const cuisson = cycleCuisson(plein);
  const conditionnement = specs["Conditionnement"] ?? null;
  const kg = kgConditionnement(conditionnement);
  const prix = Number(p.price ?? 0);
  // Le prix du webservice est HT et porte sur le conditionnement de la fiche : on ne le convertit
  // en €/kg que si la fiche dit combien de kilos elle contient. Un prix à 0 signifie « défini par
  // la déclinaison » — on préfère alors ne rien afficher qu'un prix faux.
  const prixKg = prix > 0 ? Math.round((prix / (kg && kg > 0 ? kg : 1)) * 100) / 100 : null;

  const finitionCat = cats.map((c) => FINITION_PAR_CATEGORIE[c]).find(Boolean) ?? null;
  const typeCat = cats.map((c) => TYPE_PAR_CATEGORIE[c]).find(Boolean) ?? null;

  return {
    tp_product_id: id,
    reference: p.reference?.trim() || specs["Référence"] || specs["Code RIMCO"] || null,
    nom,
    famille,
    marque: specs["OEM"] ? "RIMCO" : p.manufacturer_name?.trim() || null,
    ral: codeRal(specs["Code couleur"] ?? "") ?? codeRal(nom),
    coloris: specs["Coloris"] ?? null,
    constructeur: specs["OEM"] ?? null,
    finition: normaliserFinition(specs["Finition"]) ?? finitionCat,
    type: normaliserType(specs["Type"]) ?? typeCat,
    temp_cuisson: cuisson.temp,
    duree_cuisson_min: cuisson.duree,
    rendement_m2_kg: rendement(plein),
    prix_kg: prixKg,
    conditionnement,
    url: urls.fiche(id),
    image: urls.image(p.id_default_image, valeurLangue(p.link_rewrite)),
  };
}

/**
 * Réapprovisionnement d'une poudre du stock.
 *
 * Une poudre importée du catalogue renvoie sur SA fiche produit : la recherche par mot-clé ne
 * servait qu'à défaut, et sur « RAL 9005 » elle rend quarante nuances dont l'atelier peut
 * commander la mauvaise. L'URL de la boutique est écrite en clair ici parce que ce lien part dans
 * le navigateur : rien de secret, contrairement à la clé du webservice.
 */
export function lienReappro(p: { tp_product_id?: number | null; ral?: string | null; reference: string }) {
  if (p.tp_product_id) return `https://thermopoudre.fr/index.php?id_product=${p.tp_product_id}&controller=product`;
  return `https://thermopoudre.fr/recherche?controller=search&s=${encodeURIComponent(p.ral ? `RAL ${p.ral}` : p.reference)}`;
}

/**
 * Mise au panier directe sur thermopoudre.fr, pour l'atelier qui préfère payer tout de suite
 * plutôt que d'attendre la facture du bon de commande.
 *
 * PrestaShop n'accepte qu'un produit par requête : il n'existe pas d'URL qui remplisse un panier
 * de plusieurs lignes. C'est pourquoi le lien est proposé **ligne par ligne** et non sur la
 * commande entière — vérifié sur la boutique, une URL multi-produits n'ajoute que la première.
 *
 * Le préfixe de langue `/fr/` est obligatoire : sans lui, la boutique renvoie sur l'accueil.
 */
export function lienPanierBoutique(tpProductId: number, quantite: number) {
  const qte = Math.max(1, Math.ceil(quantite));
  // Pas d'`id_product_attribute` : la boutique choisit alors la déclinaison par défaut du
  // conditionnement, ce qu'on ne saurait pas deviner depuis la fiche poudre de l'atelier.
  return `https://thermopoudre.fr/fr/panier?add=1&id_product=${tpProductId}&qty=${qte}&action=update`;
}

/**
 * Référence proposée dans le stock de l'atelier. La référence fabricant seule
 * (« PE10AT9005100CMX ») ne dit rien à personne devant une cabine : on la préfixe de ce que
 * l'opérateur cherche des yeux, la teinte.
 */
export function referenceAtelier(f: FicheTp): string {
  const morceaux = [
    f.ral ? `RAL ${f.ral}` : f.constructeur ?? null,
    f.coloris ?? null,
    f.finition ?? null,
  ].filter(Boolean);
  return (morceaux.length ? morceaux.join(" ") : f.nom.replace(/^Thermopoudre\s*-\s*/i, "").split("|")[0].trim()).slice(0, 80);
}
