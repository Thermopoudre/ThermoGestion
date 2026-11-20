import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis } from "./helpers/devis";
import { ligneJeuJantes, lignesOperationsJantes, prixJante, surfaceJante } from "@/lib/jantes";
import { lignesDepuisDevis } from "@/lib/calculs";
import { calcTotaux } from "@/lib/utils";
import type { DevisItem, GrilleCoef, JantePalier, Prestation } from "@/lib/types";

/**
 * Le dossier jantes, attaqué depuis un client PostgREST ordinaire et depuis un client anonyme.
 *
 * Trois choses sont vérifiées ici, et aucune n'est vérifiable depuis un test de fonction pure :
 *
 *  1. **Le cloisonnement.** Quatre tables neuves, quatre RLS, deux verrous transversaux
 *     (abonnement, démo). Un module qui oublierait l'un des deux serait le seul écran encore
 *     modifiable après la fin d'essai — six garde-fous de ce projet ont déjà eu l'air corrects
 *     sans rien protéger.
 *  2. **La règle de statut.** Le jeu ne peut pas être « prêt » tant qu'une jante est en retouche,
 *     et la règle est en base — pas dans un écran, qui ne serait vrai que si on l'ouvre.
 *  3. **La chaîne devis → projet.** Une ligne de jantes doit ouvrir un projet sur le parcours
 *     jantes, avec la bonne surface, et raccrocher le dossier. C'est la couture, et c'est
 *     toujours là que ce projet a perdu de l'argent.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliersJante: JantePalier[];
let coefs: GrilleCoef[];
let prestations: Prestation[];

let vehiculeId = "";
let jeuId = "";
let jeuToken = "";
const jantesIds: Record<string, string> = {};

async function statutJeu(id = jeuId): Promise<string> {
  const { data } = await sb.from("jeux_jantes").select("statut").eq("id", id).single();
  return (data as { statut: string }).statut;
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const [{ data: pj }, { coefs: cf }, { data: pr }] = await Promise.all([
    sb.from("jante_paliers").select("*"),
    chargerGrille(sb, ctx.seed.grilleStandardId),
    sb.from("prestations").select("*").eq("actif", true),
  ]);
  paliersJante = (pj ?? []) as JantePalier[];
  coefs = cf;
  prestations = (pr ?? []) as Prestation[];

  const { data: v, error: errV } = await sb
    .from("vehicules")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId,
      marque: "BMW", modele: "Série 3", annee: 2021,
      immatriculation: "ab-123-cd",
      teinte_origine: "Frozen Grey", teinte_reference: "C3Z",
    })
    .select("*")
    .single();
  if (errV) throw new Error(`véhicule : ${errV.message}`);
  vehiculeId = v!.id as string;

  const { data: numero } = await sb.rpc("next_numero", { p_type: "jantes" });
  const { data: jeu, error: errJ } = await sb
    .from("jeux_jantes")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, vehicule_id: vehiculeId,
      numero, nb_jantes: 4, diametre_pouces: 19, largeur_pouces: 8,
      dessin: "multibranches", finition: "diamantee", teinte: "Frozen Grey",
      pneus_montes: true, tpms: true, depose_par: "Patrick Testard",
      reserves: "Jante ARD voilée, choc de trottoir sur AVG.",
    })
    .select("*")
    .single();
  if (errJ) throw new Error(`jeu : ${errJ.message}`);
  jeuId = jeu!.id as string;
  jeuToken = jeu!.public_token as string;

  const positions = ["avg", "avd", "arg", "ard"];
  const { data: js, error: errR } = await sb
    .from("jantes")
    .insert(positions.map((p) => ({
      atelier_id: ctx.seed.atelierId, jeu_id: jeuId, position: p,
      etat_constate: p === "avg" ? ["choc_trottoir", "rayures"] : p === "ard" ? ["voile"] : ["rayures"],
      voile_mm: p === "ard" ? 2.5 : null,
      operations: p === "ard" ? ["devoilage", "depose_pneu", "repose_pneu", "equilibrage"] : ["depose_pneu", "repose_pneu", "equilibrage"],
    })))
    .select("id, position");
  if (errR) throw new Error(`jantes : ${errR.message}`);
  for (const r of js as { id: string; position: string }[]) jantesIds[r.position] = r.id;
});

describe("Numérotation et véhicule", () => {
  it("donne au dossier jantes sa propre série JJ-", async () => {
    const { data } = await sb.from("jeux_jantes").select("numero").eq("id", jeuId).single();
    expect((data as { numero: string }).numero).toMatch(/^JJ-\d{4}-\d{4}$/);
  });

  it("normalise l'immatriculation en base, pas dans l'écran", async () => {
    const { data } = await sb.from("vehicules").select("immatriculation").eq("id", vehiculeId).single();
    expect((data as { immatriculation: string }).immatriculation).toBe("AB123CD");
  });

  it("refuse deux véhicules pour la même plaque, quelle que soit la saisie", async () => {
    // Sans ce verrou, la même voiture aurait deux teintes d'origine et deux historiques.
    const { error } = await sb.from("vehicules").insert({
      atelier_id: ctx.seed.atelierId, marque: "BMW", immatriculation: "AB 123 CD",
    });
    expect(error).not.toBeNull();
  });

  it("accepte plusieurs véhicules sans plaque : un garage ne la donne pas toujours", async () => {
    const { error } = await sb.from("vehicules").insert([
      { atelier_id: ctx.seed.atelierId, marque: "Peugeot", modele: "208 GTi" },
      { atelier_id: ctx.seed.atelierId, marque: "Renault", modele: "Clio RS" },
    ]);
    expect(error).toBeNull();
  });
});

describe("Cloisonnement", () => {
  it("un client anonyme ne lit aucune des quatre tables", async () => {
    for (const table of ["vehicules", "jeux_jantes", "jantes", "jante_paliers"]) {
      const { data } = await anon.from(table).select("id");
      expect(data ?? [], `${table} lisible par anon`).toHaveLength(0);
    }
  });

  it("un client anonyme n'écrit dans aucune des quatre tables", async () => {
    const { error: e1 } = await anon.from("vehicules").insert({ atelier_id: ctx.seed.atelierId, marque: "Pirate" });
    const { error: e2 } = await anon.from("jantes").insert({ atelier_id: ctx.seed.atelierId, jeu_id: jeuId, position: "secours" });
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
  });

  it("ne laisse pas écrire dans l'atelier d'à côté, même en forçant l'`atelier_id`", async () => {
    // La RLS est en `with check` : c'est elle, et non l'écran, qui refuse un `atelier_id` étranger.
    const etranger = "00000000-0000-0000-0000-0000000000ff";
    const { error } = await sb.from("jeux_jantes").insert({
      atelier_id: etranger, client_id: ctx.seed.clientSimpleId, diametre_pouces: 18,
    });
    expect(error).not.toBeNull();
  });

  it("n'expose pas ses fonctions de trigger en RPC PostgREST", async () => {
    // Règle du projet, prise en défaut une fois de plus sur ce module : `_workflow_jantes` est née
    // appelable par `anon`. Une aide de trigger n'a rien à faire dans l'API publique.
    const refus = (e: { code?: string; message?: string } | null) =>
      !!e && (["42501", "PGRST202", "PGRST203"].includes(e.code ?? "") || /permission denied|not find the function/i.test(e.message ?? ""));
    for (const client of [anon, sb]) {
      expect(refus((await client.rpc("_workflow_jantes", { p_atelier: ctx.seed.atelierId })).error)).toBe(true);
      expect(refus((await client.rpc("_workflow_defaut", { p_atelier: ctx.seed.atelierId })).error)).toBe(true);
      expect(refus((await client.rpc("trg_jeu_statut_depuis_jantes", {})).error)).toBe(true);
      expect(refus((await client.rpc("trg_normaliser_immatriculation", {})).error)).toBe(true);
    }
  });
});

describe("Statut du jeu déduit de ses jantes", () => {
  it("part de « reçu » quand aucune jante n'a démarré", async () => {
    expect(await statutJeu()).toBe("recu");
  });

  it("passe « en cours » dès la première jante travaillée", async () => {
    await sb.from("jantes").update({ statut: "en_cours" }).eq("id", jantesIds.avg);
    expect(await statutJeu()).toBe("en_cours");
  });

  it("n'annonce pas « prêt » quand une jante repart en retouche", async () => {
    // Le cas qui fait venir un garage pour rien, et cesser de croire l'écran.
    await sb.from("jantes").update({ statut: "prete" }).in("id", [jantesIds.avg, jantesIds.avd, jantesIds.arg]);
    await sb.from("jantes").update({ statut: "retouche" }).eq("id", jantesIds.ard);
    expect(await statutJeu()).toBe("en_cours");
  });

  it("bascule « prêt » à la dernière jante", async () => {
    await sb.from("jantes").update({ statut: "prete" }).eq("id", jantesIds.ard);
    expect(await statutJeu()).toBe("pret");
  });

  it("n'écrase jamais une décision humaine (« livré », « annulé »)", async () => {
    await sb.from("jeux_jantes").update({ statut: "livre" }).eq("id", jeuId);
    await sb.from("jantes").update({ statut: "retouche" }).eq("id", jantesIds.ard);
    expect(await statutJeu()).toBe("livre");
    // On remet le dossier dans un état de travail pour la suite.
    await sb.from("jeux_jantes").update({ statut: "en_cours" }).eq("id", jeuId);
    await sb.from("jantes").update({ statut: "prete" }).eq("id", jantesIds.ard);
  });

  it("refuse un état ou une opération hors vocabulaire", async () => {
    const { error: e1 } = await sb.from("jantes").update({ etat_constate: ["rayé au cutter"] }).eq("id", jantesIds.avg);
    const { error: e2 } = await sb.from("jantes").update({ operations: ["repeindre"] }).eq("id", jantesIds.avg);
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
  });

  it("refuse deux jantes sur la même position", async () => {
    const { error } = await sb.from("jantes").insert({ atelier_id: ctx.seed.atelierId, jeu_id: jeuId, position: "avg" });
    expect(error).not.toBeNull();
  });
});

describe("Bon de prise en charge public", () => {
  it("sert le dossier complet, jante par jante, à un porteur de lien sans compte", async () => {
    const { data } = await anon.rpc("jeu_jantes_public", { p_token: jeuToken });
    expect(data).toBeTruthy();
    expect(data.numero).toMatch(/^JJ-/);
    expect(data.nb_jantes).toBe(4);
    expect(nb(data.diametre_pouces)).toBe(19);
    expect(data.vehicule.marque).toBe("BMW");
    expect(data.vehicule.teinte_reference).toBe("C3Z");
    expect(data.jantes).toHaveLength(4);
    expect(data.client.nom).toBe("Menuiserie Testale");
    expect(data.atelier.nom).toContain("TEST-AUTO-");
  });

  it("rend les jantes dans l'ordre de la voiture, pas dans l'ordre d'insertion", async () => {
    const { data } = await anon.rpc("jeu_jantes_public", { p_token: jeuToken });
    expect(data.jantes.map((r: { position: string }) => r.position)).toEqual(["avg", "avd", "arg", "ard"]);
  });

  it("porte l'état constaté et les réserves — c'est toute la valeur du document", async () => {
    const { data } = await anon.rpc("jeu_jantes_public", { p_token: jeuToken });
    const ard = data.jantes.find((r: { position: string }) => r.position === "ard");
    expect(ard.etat_constate).toContain("voile");
    expect(nb(ard.voile_mm)).toBe(2.5);
    expect(ard.operations).toContain("devoilage");
    expect(data.reserves).toContain("choc de trottoir");
  });

  it("ne rend rien sur un jeton inconnu", async () => {
    const { data } = await anon.rpc("jeu_jantes_public", { p_token: "jeton-inexistant" });
    expect(data).toBeNull();
  });

  it("ne se laisse signer qu'une fois", async () => {
    const { data: premier } = await anon.rpc("signer_jeu_jantes", {
      p_token: jeuToken, p_nom: "Patrick Testard",
      p_signature: { image: "data:,", at: new Date().toISOString() }, p_ip: "127.0.0.1",
    });
    expect(premier.ok).toBe(true);
    const { data: second } = await anon.rpc("signer_jeu_jantes", {
      p_token: jeuToken, p_nom: "Quelqu'un d'autre", p_signature: { image: "data:," }, p_ip: "10.0.0.1",
    });
    expect(second.ok).toBe(false);
    expect(second.motif).toBe("deja_signe");
  });

  it("refuse une signature sans nom", async () => {
    const { data: jeu } = await sb.from("jeux_jantes").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, diametre_pouces: 17, nb_jantes: 1,
    }).select("public_token").single();
    const { data } = await anon.rpc("signer_jeu_jantes", { p_token: jeu!.public_token, p_nom: "   ", p_signature: {} });
    expect(data.ok).toBe(false);
    expect(data.motif).toBe("nom_requis");
  });
});

describe("Chiffrage : la base et le navigateur disent le même prix", () => {
  it("le barème lu en base donne le prix attendu à la jante", async () => {
    // 100 € (palier 19–21) × 1,4 (multibranches) × 1,6 (diamantée) = 224 €
    expect(prixJante({
      diametre: 19, dessin: "multibranches", finition: "diamantee",
      grilleId: ctx.seed.grilleStandardId, paliers: paliersJante, coefs,
    })).toBe(224);
  });

  it("le garage sous contrat hérite de sa grille dédiée, sans réglage de plus", async () => {
    const { coefs: coefsContrat } = await chargerGrille(sb, ctx.seed.grilleContratId);
    expect(prixJante({
      diametre: 19, dessin: "pleine", finition: "unie",
      grilleId: ctx.seed.grilleContratId, paliers: paliersJante, coefs: coefsContrat,
    })).toBe(75);
  });

  it("les opérations mécaniques reprennent le tarif négocié du client", async () => {
    const lignes = lignesOperationsJantes({
      operations: { devoilage: 1, valve_tpms: 4 },
      prestations, clientId: ctx.seed.clientRemiseId,
      clientTarifs: ((await sb.from("client_tarifs").select("*")).data ?? []) as never,
    });
    const devoilage = lignes.find((l) => l.meta?.operation_jante === "devoilage");
    expect(devoilage?.pu_ht).toBe(20);
    expect(devoilage?.total_ht).toBe(20);
    expect(lignes.find((l) => l.meta?.operation_jante === "valve_tpms")?.total_ht).toBe(180);
  });
});

describe("Chaîne devis → projet", () => {
  let devisId = "";
  let projetId = "";

  beforeAll(async () => {
    const ligne = ligneJeuJantes({
      nbJantes: 4, diametre: 19, dessin: "multibranches", finition: "diamantee",
      teinte: "Frozen Grey", teinteReference: "C3Z",
      vehicule: { marque: "BMW", modele: "Série 3", annee: 2021 },
      vehiculeId, jeuId,
      grilleId: ctx.seed.grilleStandardId, paliers: paliersJante, coefs,
    });
    const operations = lignesOperationsJantes({
      operations: { devoilage: 1 }, prestations,
      clientId: ctx.seed.clientRemiseId,
      clientTarifs: ((await sb.from("client_tarifs").select("*")).data ?? []) as never,
    });
    const devis = await creerDevis(sb, {
      atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId,
      items: [ligne, ...operations], remise: { type: "pct", valeur: 12 },
    });
    devisId = devis.id;
    await sb.from("jeux_jantes").update({ devis_id: devisId }).eq("id", jeuId);
    const envoye = await finaliserDevis(sb, devisId);
    const { data: signe } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Patrick Testard",
      p_signature: { image: "data:," }, p_ip: "127.0.0.1",
    });
    expect(signe).toBe(true);
    const { data: p } = await sb.from("projets").select("*").eq("devis_id", devisId).single();
    projetId = p!.id as string;
  });

  it("ouvre le projet sur le parcours jantes, pas sur celui d'un portail", async () => {
    const { data } = await sb.from("projets").select("etapes, etape_courante").eq("id", projetId).single();
    const codes = (data!.etapes as { code: string }[]).map((e) => e.code);
    expect(codes).toContain("depose_pneu");
    expect(codes).toContain("repose_pneu");
    expect(codes).toContain("diamantage");
    expect(codes).not.toContain("preparation");
    expect(data!.etape_courante).toBe("reception");
  });

  it("conserve les codes que le reste du produit sait reconnaître", async () => {
    // `avancer_etape` décompte la poudre sur `cuisson` et bascule le projet en « prêt » sur
    // `controle` : un workflow jantes qui les renommerait casserait silencieusement la
    // traçabilité de lot et le prix de revient.
    const { data } = await sb.from("projets").select("etapes").eq("id", projetId).single();
    const codes = (data!.etapes as { code: string }[]).map((e) => e.code);
    for (const attendu of ["cuisson", "controle", "pret", "livre"]) expect(codes).toContain(attendu);
  });

  it("ouvre le projet avec la surface des quatre jantes, pas d'une seule", async () => {
    const { data } = await sb.from("projets").select("surface_m2").eq("id", projetId).single();
    expect(nb(data!.surface_m2)).toBeCloseTo(surfaceJante(19) * 4, 2);
  });

  it("raccroche le dossier jantes au projet de production", async () => {
    const { data } = await sb.from("jeux_jantes").select("projet_id").eq("id", jeuId).single();
    expect(data!.projet_id).toBe(projetId);
  });

  it("garde la remise contractuelle du garage sur le total du devis", async () => {
    // Cinquième vérification de la même famille de bug. 224 × 4 = 896, + 20 € de dévoilage,
    // moins 12 % : 806,08 €.
    const { data } = await sb.from("devis").select("total_ht").eq("id", devisId).single();
    expect(nb(data!.total_ht)).toBe(806.08);
  });

  it("le libellé et la remise survivent au bon de livraison puis à la facture", async () => {
    // Cinquième vérification de la même famille : quatre disparitions de remise sur ce projet,
    // toutes à la couture entre deux documents. Et le libellé doit rester lisible par le garage
    // jusqu'à la facture — « jeu de 4 jantes 19″ », pas « projet PR-2026-00xx ».
    const { data: devis } = await sb.from("devis").select("items, remise, total_ht").eq("id", devisId).single();
    const items = devis!.items as DevisItem[];

    const lignesBL = lignesDepuisDevis(items).map((it) => ({
      libelle: it.libelle, qte: it.qte, unite: it.unite, pu_ht: it.pu_ht, tva: it.tva,
      total_ht: it.total_ht, ...(it.meta ? { meta: it.meta } : {}),
    }));
    const { data: bl } = await sb.from("bons_livraison").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, projet_id: projetId,
      lignes: lignesBL, remise: devis!.remise, nb_colis: 1, poids_kg: 44,
    }).select("lignes, remise").single();

    const ligneJante = (bl!.lignes as DevisItem[]).find((l) => l.meta?.jante === true);
    expect(ligneJante, "le bon de livraison a perdu la marque de la ligne de jantes").toBeTruthy();
    expect(ligneJante!.libelle).toContain("Jeu de 4 jantes 19″");
    expect(ligneJante!.libelle).toContain("teinte d'origine Frozen Grey");
    expect(ligneJante!.unite).toBe("jante");
    // Les totaux du BL se recalculent à l'affichage : ils doivent tomber sur ceux du devis.
    expect(calcTotaux(bl!.lignes as DevisItem[], bl!.remise as never).total_ht).toBe(nb(devis!.total_ht));

    const totaux = calcTotaux(items, devis!.remise as never);
    const { data: facture } = await sb.from("factures").insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, devis_id: devisId,
      projet_id: projetId, type: "solde", items, remise: devis!.remise, ...totaux,
    }).select("items, total_ht").single();
    expect(nb(facture!.total_ht)).toBe(806.08);
    expect((facture!.items as DevisItem[]).find((l) => l.meta?.jante === true)!.libelle).toContain("Jeu de 4 jantes");
  });

  it("un devis sans jantes garde le parcours général", async () => {
    const temoin = await creerDevis(sb, {
      atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId,
      items: [{ type: "libre", libelle: "Portail", qte: 1, unite: "piece", pu_ht: 300, tva: 20, total_ht: 300 }],
    });
    const envoye = await finaliserDevis(sb, temoin.id);
    const { data: signe } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Jean Testard", p_signature: { image: "data:," }, p_ip: "127.0.0.1",
    });
    expect(signe).toBe(true);
    const { data } = await sb.from("projets").select("etapes").eq("devis_id", temoin.id).single();
    const codes = (data!.etapes as { code: string }[]).map((e) => e.code);
    expect(codes).toContain("preparation");
    expect(codes).not.toContain("depose_pneu");
  });
});
