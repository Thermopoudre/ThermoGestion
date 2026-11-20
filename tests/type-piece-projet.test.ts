import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneLibre, ligneM2, lignePieceType } from "./helpers/devis";

/**
 * Amélioration n°9 (07/09/2026) — `projets.type_piece`, migration 69.
 *
 * Constat : la fiche projet affichait, même sur un chantier de menuiserie (PR-2026-0021), le bloc
 * « Teinte d'origine constructeur (rénovation de jantes) ». Vérifié en base avant d'écrire une
 * ligne de code : ni `projets.type_piece` ni aucune colonne équivalente n'existaient, et
 * `jeux_jantes.projet_id` — la seule piste de rattachement jantes → projet — n'était renseigné sur
 * AUCUNE ligne (les deux circuits sont disjoints, cf. amélioration n°10). La seule source fiable
 * est celle que `trg_devis_signe()` calcule déjà pour choisir le workflow de production : une
 * ligne de devis marquée `meta.jante = true`, complétée ici par un second signal déjà en base et
 * jusque-là inexploité, `meta.piece_type_id` → `pieces_types.categorie = 'jante'`.
 *
 * Ce fichier prouve le câblage base : que `trg_devis_signe()` pose bien `type_piece` à la création
 * du projet, sur les deux signaux, et seulement quand elle est sûre (jamais par supposition sur un
 * libellé). La condition d'affichage elle-même (`type_piece !== "autre" || !!teinte_origine` dans
 * `src/app/(app)/projets/[id]/page.tsx`) est un rendu JSX sans harnais React dans ce projet — comme
 * pour `mentions-b2c-c6.test.ts`, c'est à vérifier au navigateur (voir le rapport de fin de tâche).
 */
const ctx = contexte();
let sb: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
let pieceTypeJanteId: string;

beforeAll(async () => {
  sb = clientConnecte(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));

  // Fiche de bibliothèque dédiée à ce fichier (categorie = 'jante'), distincte de
  // `ctx.seed.pieceTypeId` qui, lui, s'appelle « Jante alu 17" » mais porte `categorie: 'auto'` —
  // exactement le genre de nom trompeur que la règle ne doit PAS suivre : seule la catégorie compte.
  const { data: pt, error } = await sb
    .from("pieces_types")
    .insert({ atelier_id: ctx.seed.atelierId, nom: "TEST type_piece — Jante 18 pouces", categorie: "jante", surface_m2: 0.9, prix_ht: 60, temps_minutes: 20, coef_complexite: 1, actif: true })
    .select("id")
    .single();
  expect(error).toBeNull();
  pieceTypeJanteId = pt!.id as string;
});

/** Signe un devis avec ces lignes et renvoie le projet créé par `trg_devis_signe()`. */
async function projetDepuisLignes(items: DevisItem[]) {
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
  const envoye = await finaliserDevis(sb, devis.id);
  const anon = clientAnonyme(ctx);
  const { error } = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Signataire type_piece", p_signature: {}, p_ip: null });
  expect(error).toBeNull();
  const { data: projet, error: errProjet } = await sb.from("projets").select("type_piece, etape_courante").eq("devis_id", devis.id).single();
  expect(errProjet).toBeNull();
  return projet!;
}

describe("trg_devis_signe() pose type_piece", () => {
  it("'jante' — ligne marquée meta.jante = true (générateur dédié « Jeu de jantes »)", async () => {
    const ligneJante: DevisItem = {
      type: "libre", libelle: "Jeu de 4 jantes 19\" — TEST", qte: 4, unite: "piece",
      pu_ht: 56, tva: 20, total_ht: 224, meta: { jante: true, diametre_pouces: 19 },
    };
    const projet = await projetDepuisLignes([ligneJante]);
    expect(projet.type_piece).toBe("jante");
  });

  it("'jante' — ligne posée depuis la bibliothèque, catégorie 'jante' mais SANS meta.jante", async () => {
    const ligne = lignePieceType({ pieceTypeId: pieceTypeJanteId, nom: "TEST type_piece — Jante 18 pouces", prix: 60, surfaceM2: 0.9 });
    expect(ligne.meta?.jante).toBeUndefined();
    const projet = await projetDepuisLignes([ligne]);
    expect(projet.type_piece).toBe("jante");
  });

  it("'autre' — lignes de production classiques (m², libre), aucun signal jantes", async () => {
    const ligne = ligneM2({ surface: 3.2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs, libelle: "TEST type_piece — Profilé fenêtre" });
    const projet = await projetDepuisLignes([ligne]);
    expect(projet.type_piece).toBe("autre");
  });

  it("'autre' — un libellé qui PARLE de jante sans aucun des deux signaux ne suffit pas : pas de devinette sur le texte", async () => {
    // Reproduit exactement le cas réel trouvé en base (PR-2026-0022, « Jantes BMW 19 pouces ») :
    // une ligne texte libre, ni meta.jante, ni piece_type_id de catégorie jante.
    const ligne = ligneLibre({ libelle: "Rénovation jante 17 à 20 pouces — TEST", qte: 4, pu: 78 });
    const projet = await projetDepuisLignes([ligne]);
    expect(projet.type_piece).toBe("autre");
  });
});

describe("projets.type_piece — contrainte et défaut", () => {
  it("reste NULL par défaut sur un projet posé hors du déclencheur (comportement historique préservé)", async () => {
    const { data: projet, error } = await sb
      .from("projets")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "TEST type_piece — sans devis", status: "en_attente", etapes: [], etape_courante: null })
      .select("type_piece")
      .single();
    expect(error).toBeNull();
    expect(projet!.type_piece).toBeNull();
  });

  it("refuse toute valeur hors 'jante'/'autre'/NULL — la règle vit en base, pas seulement dans le front", async () => {
    const { error } = await sb
      .from("projets")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "TEST type_piece — valeur invalide", status: "en_attente", etapes: [], etape_courante: null, type_piece: "jantes" })
      .select("id")
      .single();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/projets_type_piece_check/i);
  });
});
