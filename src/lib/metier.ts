import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CODES_PRESTATION_JANTE,
  DESSINS_JANTE_DEFAUT,
  FINITIONS_JANTE_DEFAUT,
  OPERATIONS_JANTE,
  PALIERS_JANTE_DEFAUT,
} from "@/lib/jantes";

export type Metier = "jantes" | "industrie" | "mixte";

export const METIERS: { code: Metier; titre: string; phrase: string; exemples: string }[] = [
  {
    code: "jantes",
    titre: "Rénovation de jantes",
    phrase:
      "Vous recevez des jeux de roues, vous décapez, redressez, laquez et rendez la voiture roulante.",
    exemples: "Chiffrage au pouce, dossier véhicule, suivi roue par roue, bon de prise en charge.",
  },
  {
    code: "industrie",
    titre: "Thermolaquage industriel",
    phrase:
      "Vous laquez des pièces pour des menuisiers, des serruriers, des industriels ou des particuliers.",
    exemples: "Chiffrage au m² et au mètre linéaire, fournées, traçabilité du lot de poudre.",
  },
  {
    code: "mixte",
    titre: "Les deux",
    phrase: "Vous faites du laquage de pièces et de la jante, souvent dans le même four.",
    exemples: "Les deux jeux de réglages sont posés, vous n'utilisez que ce qui vous sert.",
  },
];

const WORKFLOW_INDUSTRIE = [
  { code: "reception", libelle: "Réception" },
  { code: "preparation", libelle: "Préparation / sablage" },
  { code: "poudrage", libelle: "Poudrage" },
  { code: "cuisson", libelle: "Cuisson" },
  { code: "controle", libelle: "Contrôle" },
  { code: "pret", libelle: "Prêt" },
  { code: "livre", libelle: "Livré" },
];

const WORKFLOW_JANTES = [
  { code: "reception", libelle: "Réception et état des jantes" },
  { code: "depose_pneu", libelle: "Dépose des pneus" },
  { code: "decapage", libelle: "Décapage / dévernissage" },
  { code: "redressage", libelle: "Dévoilage / redressage" },
  { code: "sablage", libelle: "Sablage" },
  { code: "poudrage", libelle: "Apprêt et laquage" },
  { code: "cuisson", libelle: "Cuisson" },
  { code: "diamantage", libelle: "Diamantage CNC" },
  { code: "vernis", libelle: "Vernis de protection" },
  { code: "repose_pneu", libelle: "Repose des pneus et équilibrage" },
  { code: "controle", libelle: "Contrôle" },
  { code: "pret", libelle: "Prêt" },
  { code: "livre", libelle: "Livré" },
];

/**
 * Prix indicatifs des opérations mécaniques de jante, alignés sur ceux que propose déjà l'écran
 * Réglages : deux endroits du produit ne peuvent pas suggérer deux tarifs différents pour le
 * même geste.
 */
const PRIX_OPERATION_JANTE: Record<string, number> = {
  devoilage: 25,
  redressage: 35,
  soudure: 45,
  depose_pneu: 8,
  repose_pneu: 8,
  equilibrage: 10,
  valve_tpms: 45,
  diamantage: 60,
};

/** Prestations d'un atelier de laquage de pièces. Unités choisies pour qu'un devis tienne debout. */
const PRESTATIONS_INDUSTRIE: { code: string; nom: string; unite: string; prix: number }[] = [
  { code: "SABLAGE", nom: "Sablage / grenaillage", unite: "m2", prix: 22 },
  { code: "DECAPAGE", nom: "Décapage thermique ou chimique", unite: "m2", prix: 28 },
  { code: "MASQUAGE", nom: "Masquage (caches, bouchons, adhésif)", unite: "piece", prix: 4 },
  { code: "DEGRAISSAGE", nom: "Dégraissage et traitement de surface", unite: "m2", prix: 9 },
  { code: "MANUTENTION", nom: "Manutention / accrochage spécifique", unite: "heure", prix: 45 },
  { code: "RETOUCHE", nom: "Retouche après montage", unite: "piece", prix: 15 },
  { code: "TRANSPORT", nom: "Enlèvement et livraison", unite: "forfait", prix: 60 },
];

export type ResultatPreremplissage = { faits: string[]; erreurs: string[] };

/**
 * Pré-remplissage réel des réglages, à partir du métier déclaré à l'inscription.
 *
 * L'audit était clair : un atelier qui s'inscrit tombait sur des écrans de réglages vides et un
 * tableau de bord sans rien. Poser une question au moment de l'inscription **et ne rien en
 * faire** aurait été pire que de ne pas la poser. On écrit donc vraiment : une grille avec ses
 * paliers et ses coefficients, le barème au pouce, les prestations du métier, le parcours de
 * production, et le référentiel qualité qui correspond.
 *
 * Les prix posés sont des ordres de grandeur du marché français, **destinés à être corrigés** :
 * un atelier corrige un chiffre qu'il voit, il ne remplit pas un champ vide. C'est aussi pour ça
 * que le premier écran de la checklist envoie vers la grille.
 *
 * Chaque écriture est isolée : si la table des prestations refuse, la grille reste posée et
 * l'atelier apprend précisément ce qui a manqué. Une écriture muette ici recréerait le problème
 * qu'on essaie de fermer.
 */
export async function preremplirMetier(
  supabase: SupabaseClient,
  atelierId: string,
  metier: Metier,
): Promise<ResultatPreremplissage> {
  const faits: string[] = [];
  const erreurs: string[] = [];
  const jantes = metier === "jantes" || metier === "mixte";
  const industrie = metier === "industrie" || metier === "mixte";

  async function ecrire(quoi: string, requete: PromiseLike<{ error: { message?: string } | null }>) {
    const { error } = await requete;
    if (error) erreurs.push(`${quoi} : ${error.message ?? "refus de la base"}`);
    else faits.push(quoi);
  }

  // ── Grille tarifaire ────────────────────────────────────────────────────────
  const { data: grille, error: errGrille } = await supabase
    .from("grilles_tarifaires")
    .insert({ atelier_id: atelierId, nom: "Grille standard", is_default: true, actif: true, forfait_minimum: 50 })
    .select("id")
    .single();

  if (errGrille || !grille) {
    erreurs.push(`Grille tarifaire : ${errGrille?.message ?? "création impossible"}`);
    return { faits, erreurs };
  }
  faits.push("Grille tarifaire par défaut");
  const grilleId = (grille as { id: string }).id;

  if (industrie) {
    await ecrire(
      "Paliers de prix au m²",
      supabase.from("grille_paliers").insert([
        { atelier_id: atelierId, grille_id: grilleId, surface_min: 0, surface_max: 1, prix_m2: 90 },
        { atelier_id: atelierId, grille_id: grilleId, surface_min: 1, surface_max: 5, prix_m2: 60 },
        { atelier_id: atelierId, grille_id: grilleId, surface_min: 5, surface_max: 20, prix_m2: 45 },
        { atelier_id: atelierId, grille_id: grilleId, surface_min: 20, surface_max: null, prix_m2: 35 },
      ]),
    );
    await ecrire(
      "Coefficients de finition, de complexité et de couches",
      supabase.from("grille_coefs").insert([
        { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "mat", libelle: "Mat / satiné", coef: 1 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "brillant", libelle: "Brillant", coef: 1.05 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "texture", libelle: "Texturé", coef: 1.1 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "metallise", libelle: "Métallisé / candy", coef: 1.25 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "complexite", code: "simple", libelle: "Simple", coef: 1 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "complexite", code: "moyenne", libelle: "Moyenne", coef: 1.15 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "complexite", code: "complexe", libelle: "Complexe", coef: 1.35 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "couche", code: "une", libelle: "1 couche", coef: 1 },
        { atelier_id: atelierId, grille_id: grilleId, categorie: "couche", code: "deux", libelle: "2 couches (primaire + finition)", coef: 1.7 },
      ]),
    );
    await ecrire(
      "Familles de prix au mètre linéaire",
      supabase.from("tarifs_ml").insert([
        { atelier_id: atelierId, famille: "Garde-corps à barreaux", prix_ml: 45, perimetre_developpe_m: 0.6, ordre: 1, actif: true },
        { atelier_id: atelierId, famille: "Portail à barreaux", prix_ml: 55, perimetre_developpe_m: 0.75, ordre: 2, actif: true },
        { atelier_id: atelierId, famille: "Tube / profilé", prix_ml: 18, perimetre_developpe_m: 0.25, ordre: 3, actif: true },
      ]),
    );
    await ecrire(
      "Prestations de l'atelier",
      supabase.from("prestations").insert(
        PRESTATIONS_INDUSTRIE.map((p, i) => ({
          atelier_id: atelierId,
          code: p.code,
          nom: p.nom,
          unite: p.unite,
          prix_unitaire_ht: p.prix,
          tva_rate: 20,
          ordre: i,
          actif: true,
        })),
      ),
    );
  }

  if (jantes) {
    await ecrire(
      "Barème au pouce",
      supabase.from("jante_paliers").insert(
        PALIERS_JANTE_DEFAUT.map((p) => ({ atelier_id: atelierId, grille_id: grilleId, ...p })),
      ),
    );
    await ecrire(
      "Coefficients de dessin et de finition de jante",
      supabase.from("grille_coefs").insert([
        ...DESSINS_JANTE_DEFAUT.map((d) => ({
          atelier_id: atelierId, grille_id: grilleId, categorie: "jante_dessin",
          code: d.code, libelle: d.libelle, coef: d.coef,
        })),
        ...FINITIONS_JANTE_DEFAUT.map((f) => ({
          atelier_id: atelierId, grille_id: grilleId, categorie: "jante_finition",
          code: f.code, libelle: f.libelle, coef: f.coef,
        })),
      ]),
    );
    // Un atelier de jantes seul n'a pas de palier au m², et son forfait minimum n'a pas de sens :
    // sans une ligne au m², il ne se déclenche jamais. On pose quand même une tranche unique,
    // faute de quoi une pièce hors jante chiffrerait à zéro sans le dire.
    if (!industrie) {
      await ecrire(
        "Prix au m² pour les pièces hors jantes",
        supabase.from("grille_paliers").insert([
          { atelier_id: atelierId, grille_id: grilleId, surface_min: 0, surface_max: null, prix_m2: 60 },
        ]),
      );
      await ecrire(
        "Coefficients de finition et de complexité",
        supabase.from("grille_coefs").insert([
          { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "mat", libelle: "Mat / satiné", coef: 1 },
          { atelier_id: atelierId, grille_id: grilleId, categorie: "finition", code: "brillant", libelle: "Brillant", coef: 1.05 },
          { atelier_id: atelierId, grille_id: grilleId, categorie: "complexite", code: "simple", libelle: "Simple", coef: 1 },
          { atelier_id: atelierId, grille_id: grilleId, categorie: "complexite", code: "moyenne", libelle: "Moyenne", coef: 1.15 },
          { atelier_id: atelierId, grille_id: grilleId, categorie: "couche", code: "une", libelle: "1 couche", coef: 1 },
        ]),
      );
    }
    const codes = Object.keys(OPERATIONS_JANTE) as (keyof typeof OPERATIONS_JANTE)[];
    await ecrire(
      "Opérations de jante facturables",
      supabase.from("prestations").insert(
        codes.map((c, i) => ({
          atelier_id: atelierId,
          code: CODES_PRESTATION_JANTE[c],
          nom: OPERATIONS_JANTE[c],
          unite: "piece",
          prix_unitaire_ht: PRIX_OPERATION_JANTE[c] ?? 0,
          tva_rate: 20,
          categorie: "jantes",
          ordre: 100 + i,
          actif: true,
        })),
      ),
    );
  }

  // ── Parcours de production ─────────────────────────────────────────────────
  const settings: Record<string, unknown> = { metier };
  if (industrie) settings.workflow_defaut = WORKFLOW_INDUSTRIE;
  if (jantes) settings.workflow_jantes = WORKFLOW_JANTES;
  await ecrire(
    "Parcours de production",
    supabase.from("ateliers").update({ settings }).eq("id", atelierId),
  );

  // ── Référentiel qualité ────────────────────────────────────────────────────
  // `create_atelier` sème un Qualicoat classe 1, qui est le bon défaut d'un sous-traitant
  // industriel et un contresens pour un rénovateur de jantes : personne ne certifie Qualicoat une
  // jante, et revendiquer un label qu'on n'a pas est le pire départ possible.
  if (metier === "jantes") {
    await ecrire(
      "Référentiel de contrôle interne",
      supabase
        .from("referentiels_qualite")
        .update({
          nom: "Contrôle interne — jantes",
          label: null,
          types_controle: ["epaisseur", "adherence", "aspect"],
          note:
            "Contrôle interne d'atelier : épaisseur du film, adhérence au quadrillage et aspect. Aucun label revendiqué — un certificat n'affirmera que ce que vous avez mesuré.",
        })
        .eq("atelier_id", atelierId)
        .eq("par_defaut", true),
    );
  }

  return { faits, erreurs };
}
