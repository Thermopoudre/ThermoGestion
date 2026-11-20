import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotaux, round2 } from "@/lib/utils";
import { appliquerForfaitMinimum, echeanceIso, joursPaiement, prixM2, prixPieceType } from "@/lib/calculs";
import type { DevisItem, GrilleCoef, GrillePalier, PieceType } from "@/lib/types";

export type Remise = { type: "pct" | "montant"; valeur: number } | null;

/** Grille chargée depuis la base, comme le fait l'éditeur de devis à l'ouverture. */
export async function chargerGrille(sb: SupabaseClient, grilleId: string) {
  const [{ data: paliers, error: e1 }, { data: coefs, error: e2 }] = await Promise.all([
    sb.from("grille_paliers").select("*").eq("grille_id", grilleId).order("surface_min"),
    sb.from("grille_coefs").select("*").eq("grille_id", grilleId),
  ]);
  if (e1 || e2) throw new Error(`chargement grille : ${e1?.message ?? e2?.message}`);
  return { paliers: (paliers ?? []) as GrillePalier[], coefs: (coefs ?? []) as GrilleCoef[] };
}

/** Ligne au m² chiffrée par la grille — même forme de `meta` que celle produite par DevisEditor. */
export function ligneM2(args: {
  surface: number; finition: string; complexite: string; couche?: string | null; grilleId: string;
  paliers: GrillePalier[]; coefs: GrilleCoef[]; libelle?: string; tva?: number;
}): DevisItem {
  const pu = prixM2({ ...args, grilleId: args.grilleId });
  return {
    type: "m2",
    libelle: args.libelle ?? "Thermolaquage",
    qte: args.surface,
    unite: "m2",
    pu_ht: pu,
    tva: args.tva ?? 20,
    total_ht: round2(args.surface * pu),
    meta: {
      surface: args.surface, finition: args.finition, complexite: args.complexite,
      couche: args.couche ?? null, grille_id: args.grilleId,
    },
  };
}

/**
 * Pièce type sans prix catalogue : chiffrée sur la grille au m² et majorée de son coefficient de
 * complexité, exactement comme le fait `DevisEditor.ajouterPieceType`.
 */
export function lignePieceTypeGrille(args: {
  piece: PieceType; grilleId: string; paliers: GrillePalier[]; coefs: GrilleCoef[]; couche?: string | null; qte?: number;
}): DevisItem {
  const surface = Number(args.piece.surface_m2 ?? 0);
  const pu = prixPieceType(
    args.piece,
    prixM2({ surface, finition: "mat", complexite: "simple", couche: args.couche ?? null, grilleId: args.grilleId, paliers: args.paliers, coefs: args.coefs }),
  );
  return {
    type: "m2",
    libelle: args.piece.nom,
    qte: surface,
    unite: "m2",
    pu_ht: pu,
    tva: 20,
    total_ht: round2(surface * pu),
    meta: {
      piece_type_id: args.piece.id, temps_minutes: args.piece.temps_minutes, surface,
      finition: "mat", complexite: "simple", couche: args.couche ?? null,
      coef_complexite: args.piece.coef_complexite, grille_id: args.grilleId,
    },
  };
}

/** Ligne au mètre linéaire : ligne libre marquée `meta.ml`, avec sa surface développée. */
export function ligneMl(args: { famille: string; tarifMlId: string; metrage: number; prixMl: number; perimetreDeveloppeM: number | null; tva?: number }): DevisItem {
  const per = args.perimetreDeveloppeM;
  return {
    type: "libre",
    libelle: args.famille,
    qte: args.metrage,
    unite: "ml",
    pu_ht: args.prixMl,
    tva: args.tva ?? 20,
    total_ht: round2(args.metrage * args.prixMl),
    meta: {
      ml: true,
      tarif_ml_id: args.tarifMlId,
      perimetre_developpe_m: per,
      surface_equivalente_m2: per != null ? round2(args.metrage * per) : null,
    },
  };
}

export function lignePrestation(args: { prestationId: string; nom: string; unite: string; qte: number; pu: number; negocie: boolean; tva?: number }): DevisItem {
  return {
    type: "prestation",
    libelle: args.nom,
    qte: args.qte,
    unite: args.unite,
    pu_ht: args.pu,
    tva: args.tva ?? 20,
    total_ht: round2(args.qte * args.pu),
    meta: { prestation_id: args.prestationId, tarif_negocie: args.negocie },
  };
}

/** Pièce type au prix catalogue : ligne libre qui garde la surface unitaire de la pièce. */
export function lignePieceType(args: { pieceTypeId: string; nom: string; prix: number; surfaceM2: number | null; qte?: number; tva?: number }): DevisItem {
  const qte = args.qte ?? 1;
  return {
    type: "libre",
    libelle: args.nom,
    qte,
    unite: "piece",
    pu_ht: args.prix,
    tva: args.tva ?? 20,
    total_ht: round2(qte * args.prix),
    meta: { piece_type_id: args.pieceTypeId, surface_m2: args.surfaceM2 },
  };
}

export function ligneLibre(args: { libelle: string; qte: number; pu: number; tva?: number; unite?: string }): DevisItem {
  return {
    type: "libre",
    libelle: args.libelle,
    qte: args.qte,
    unite: args.unite ?? "piece",
    pu_ht: args.pu,
    tva: args.tva ?? 20,
    total_ht: round2(args.qte * args.pu),
  };
}

/**
 * Forfait minimum applicable à un client, tel que le résout l'éditeur de devis : la grille
 * négociée du client si elle existe, sinon la grille par défaut de l'atelier.
 */
export async function forfaitMinimumClient(sb: SupabaseClient, clientId: string): Promise<number> {
  const { data: cli } = await sb.from("clients").select("grille_id").eq("id", clientId).maybeSingle();
  const { data: grilles } = await sb.from("grilles_tarifaires").select("id, forfait_minimum, is_default").eq("actif", true);
  const liste = (grilles ?? []) as { id: string; forfait_minimum: number | string; is_default: boolean }[];
  const grille = liste.find((g) => g.id === cli?.grille_id) ?? liste.find((g) => g.is_default);
  return Number(grille?.forfait_minimum ?? 0);
}

/**
 * Enregistre un devis exactement comme le fait `DevisEditor.save()` : plancher de facturation
 * matérialisé en ligne puis totaux calculés sur les lignes définitives.
 */
export async function creerDevis(sb: SupabaseClient, args: { atelierId: string; clientId: string; items: DevisItem[]; remise?: Remise; notes?: string }) {
  const forfaitMinimum = await forfaitMinimumClient(sb, args.clientId);
  const { items } = appliquerForfaitMinimum({ items: args.items, remise: args.remise ?? null, forfaitMinimum });
  const totaux = calcTotaux(items, args.remise ?? null);
  const { data, error } = await sb
    .from("devis")
    .insert({
      atelier_id: args.atelierId, client_id: args.clientId, items,
      remise: args.remise ?? null, notes: args.notes ?? null, ...totaux,
    })
    .select("*")
    .single();
  if (error) throw new Error(`création devis : ${error.message}`);
  return data;
}

/** Finalisation : attribution du numéro séquentiel puis passage en « envoyé ». */
export async function finaliserDevis(sb: SupabaseClient, devisId: string) {
  const { data: numero, error: errNum } = await sb.rpc("next_numero", { p_type: "devis" });
  if (errNum) throw new Error(`next_numero : ${errNum.message}`);
  const { data, error } = await sb
    .from("devis")
    .update({ status: "envoye", numero, envoye_at: new Date().toISOString() })
    .eq("id", devisId)
    .select("*")
    .single();
  if (error) throw new Error(`finalisation devis : ${error.message}`);
  return data;
}

/**
 * Création de facture depuis un devis signé — réplique fidèle du bouton « Créer la facture »
 * de la fiche devis : lignes, remise et totaux repris tels quels, échéance au délai du client.
 */
export async function creerFactureDepuisDevis(
  sb: SupabaseClient,
  devis: { id: string; atelier_id: string; client_id: string; items: DevisItem[]; remise: Remise; total_ht: number; total_tva: number; total_ttc: number },
) {
  const [{ data: cli }, { data: at }, { data: proj }] = await Promise.all([
    sb.from("clients").select("delai_paiement_jours").eq("id", devis.client_id).maybeSingle(),
    sb.from("ateliers").select("delai_paiement_jours").maybeSingle(),
    sb.from("projets").select("id").eq("devis_id", devis.id).maybeSingle(),
  ]);
  const jours = joursPaiement(cli?.delai_paiement_jours, at?.delai_paiement_jours);
  const { data, error } = await sb
    .from("factures")
    .insert({
      atelier_id: devis.atelier_id, client_id: devis.client_id, devis_id: devis.id,
      projet_id: proj?.id ?? null, type: "solde",
      items: devis.items, remise: devis.remise,
      total_ht: devis.total_ht, total_tva: devis.total_tva, total_ttc: devis.total_ttc,
      due_date: echeanceIso(jours),
    })
    .select("*")
    .single();
  if (error) throw new Error(`création facture : ${error.message}`);
  return data;
}

/** Workflow de production par défaut, tel que le pose `_workflow_defaut` côté base. */
export const WORKFLOW_DEFAUT = [
  { code: "reception", libelle: "Réception" },
  { code: "preparation", libelle: "Préparation / sablage" },
  { code: "poudrage", libelle: "Poudrage" },
  { code: "cuisson", libelle: "Cuisson" },
  { code: "controle", libelle: "Contrôle" },
  { code: "pret", libelle: "Prêt" },
  { code: "livre", libelle: "Livré" },
];
