import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";
import { blocageLancement } from "@/lib/fournees";

/**
 * Amélioration n°2 (07/09/2026) — bloquer une fournée au-delà de la capacité du four.
 *
 * Avant ce correctif : `/fournees/<id>` affichait une barre rouge « 42,5 m² / 30,0 m² · 142 % »
 * à côté d'un bouton « Lancer la fournée » parfaitement actif (F-2026-0045, constaté en démo).
 * Le contrôle n'existait qu'en React (`confirmSurcharge`) — contournable depuis la console.
 *
 * Ce que ce fichier prouve, EN BASE (migration 71, trigger `trg_fournee_capacite`), jamais côté
 * écran :
 *  1. le lancement est refusé quand la surface embarquée dépasse `ateliers.four_capacite_m2`,
 *     sans dérogation cochée ;
 *  2. la dérogation explicite (`derogation_capacite = true`) fait passer le lancement, et la base
 *     trace elle-même qui (auth.uid()), quand et de combien — jamais ce que le client prétend ;
 *  3. la trace ne se réécrit pas après coup par une mise à jour sans rapport (clôture, note) ;
 *  4. une capacité non renseignée ne bloque jamais rien ;
 *  5. une fournée déjà lancée (donc déjà « en_cours ») reste clôturable même au-delà de 100 %,
 *     parce que la démo contient réellement ce cas (F-2026-0045) et que le corpus l'exige.
 *
 * Tout se passe dans un atelier JETABLE, jamais sur les deux ateliers réels — `ouvrirAtelierJetable`
 * en pose un neuf avec un essai actif, exactement comme `coherence-numerotation-fournee.test.ts`.
 */

let jetable: AtelierJetable;
let sb: SupabaseClient;
let clientId: string;

/** Un projet minimal, juste assez pour porter une surface dans `fournee_projets`. */
async function creerProjet(surfaceM2: number, nom: string): Promise<string> {
  const { data, error } = await sb
    .from("projets")
    .insert({ atelier_id: jetable.atelierId, client_id: clientId, nom, surface_m2: surfaceM2 })
    .select("id")
    .single();
  if (error) throw new Error(`création projet ${nom} : ${error.message}`);
  return data!.id as string;
}

async function creerFourneePlanifiee(): Promise<string> {
  const { data, error } = await sb
    .from("fournees")
    .insert({ atelier_id: jetable.atelierId, statut: "planifiee" })
    .select("id")
    .single();
  if (error) throw new Error(`création fournée : ${error.message}`);
  return data!.id as string;
}

async function embarquer(fourneeId: string, projetId: string, surfaceM2: number) {
  const { error } = await sb
    .from("fournee_projets")
    .insert({ atelier_id: jetable.atelierId, fournee_id: fourneeId, projet_id: projetId, surface_m2: surfaceM2, position: 0 });
  if (error) throw new Error(`embarquement : ${error.message}`);
}

async function fixerCapacite(m2: number | null) {
  const { error } = await sb.from("ateliers").update({ four_capacite_m2: m2 }).eq("id", jetable.atelierId);
  if (error) throw new Error(`réglage capacité : ${error.message}`);
}

type FourneeEtat = {
  statut: string;
  derogation_capacite: boolean;
  derogation_par: string | null;
  derogation_le: string | null;
  derogation_ecart_m2: number | null;
};

async function relireFournee(id: string): Promise<FourneeEtat> {
  const { data, error } = await sb
    .from("fournees")
    .select("statut, derogation_capacite, derogation_par, derogation_le, derogation_ecart_m2")
    .eq("id", id)
    .single();
  if (error) throw new Error(`relecture fournée : ${error.message}`);
  return data as FourneeEtat;
}

beforeAll(async () => {
  jetable = await ouvrirAtelierJetable("lot-amel-fournee-capacite");
  sb = jetable.sb;
  const { data: client, error } = await sb
    .from("clients")
    .insert({ atelier_id: jetable.atelierId, nom: "Client capacité four", type: "particulier" })
    .select("id")
    .single();
  if (error) throw new Error(`création client : ${error.message}`);
  clientId = client!.id as string;
}, 120_000);

afterAll(async () => {
  if (jetable) await jetable.fermer();
});

describe("blocageLancement() — le même calcul rejoué côté écran (pur, sans base)", () => {
  it("capacité non renseignée : jamais de blocage, mais un message pour le dire", () => {
    const r = blocageLancement(42.5, null);
    expect(r.bloquant).toBe(false);
    expect(r.capaciteConnue).toBe(false);
    expect(r.message).toMatch(/non renseignée/i);
  });

  it("dans la capacité : jamais de blocage, aucun message", () => {
    const r = blocageLancement(25, 30);
    expect(r).toEqual({ bloquant: false, capaciteConnue: true, message: null });
  });
});

describe("blocageLancement() — cas limites", () => {
  it("pile à la capacité : pas de blocage (comparaison stricte)", () => {
    const r = blocageLancement(30, 30);
    expect(r.bloquant).toBe(false);
  });

  it("au-delà : bloquant, avec le pourcentage dans le message", () => {
    const r = blocageLancement(42.5, 30);
    expect(r.bloquant).toBe(true);
    expect(r.capaciteConnue).toBe(true);
    expect(r.message).toMatch(/142 %/);
    expect(r.message).toMatch(/dérogation/i);
  });
});

describe("le blocage en base (trg_fournee_capacite, migration 71)", () => {
  it("refuse le lancement au-delà de la capacité, sans dérogation", async () => {
    await fixerCapacite(10);
    const projetId = await creerProjet(15, "Pièce trop grande");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 15);

    const { error } = await sb.from("fournees").update({ statut: "en_cours" }).eq("id", fourneeId);
    expect(error, "le lancement aurait dû être refusé").not.toBeNull();
    expect(error?.message ?? "").toMatch(/FOURNEE_CAPACITE_DEPASSEE/i);

    // L'état après coup, pas le code de retour : c'est lui qui prouve le verrou.
    const etat = await relireFournee(fourneeId);
    expect(etat.statut).toBe("planifiee");
    expect(etat.derogation_capacite).toBe(false);
    expect(etat.derogation_par).toBeNull();
  });

  it("la dérogation cochée fait passer le lancement, et la base trace qui, quand, de combien", async () => {
    await fixerCapacite(10);
    const projetId = await creerProjet(15, "Pièce dérogée");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 15);

    const { data: moi } = await sb.auth.getUser();
    const { error } = await sb.from("fournees").update({ statut: "en_cours", derogation_capacite: true }).eq("id", fourneeId);
    expect(error).toBeNull();

    const etat = await relireFournee(fourneeId);
    expect(etat.statut).toBe("en_cours");
    expect(etat.derogation_capacite).toBe(true);
    // Posé par la base (auth.uid()), jamais recopié depuis ce que le client aurait pu envoyer.
    expect(etat.derogation_par).toBe(moi.user?.id);
    expect(etat.derogation_le).not.toBeNull();
    expect(Number(etat.derogation_ecart_m2)).toBeCloseTo(5, 2); // 15 m² pour 10 m² de capacité
  });

  it("une mise à jour sans rapport (note, date) ne réécrit pas la trace de dérogation", async () => {
    await fixerCapacite(10);
    const projetId = await creerProjet(15, "Pièce dérogée bis");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 15);
    await sb.from("fournees").update({ statut: "en_cours", derogation_capacite: true }).eq("id", fourneeId);

    // Un client qui tenterait de forger la trace (se faire passer pour quelqu'un d'autre, ou
    // effacer la dérogation) se la voit restaurée par le trigger — même sur une écriture qui
    // touche par ailleurs des colonnes légitimes comme `note`.
    await sb.from("fournees").update({
      note: "Rien à voir avec la capacité",
      derogation_capacite: false,
      derogation_ecart_m2: 0,
    }).eq("id", fourneeId);

    const etat = await relireFournee(fourneeId);
    expect(etat.derogation_capacite).toBe(true);
    expect(Number(etat.derogation_ecart_m2)).toBeCloseTo(5, 2);
  });

  it("capacité non renseignée : le lancement n'est jamais bloqué", async () => {
    await fixerCapacite(null);
    const projetId = await creerProjet(999, "Pièce énorme, capacité inconnue");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 999);

    const { error } = await sb.from("fournees").update({ statut: "en_cours" }).eq("id", fourneeId);
    expect(error, "une capacité non renseignée ne doit jamais bloquer un lancement").toBeNull();

    const etat = await relireFournee(fourneeId);
    expect(etat.statut).toBe("en_cours");
    // Rien à tracer : on ne sait pas s'il y a réellement dépassement.
    expect(etat.derogation_capacite).toBe(false);
  });

  it("dans la capacité : le lancement ne demande aucune dérogation et n'en trace aucune", async () => {
    await fixerCapacite(10);
    const projetId = await creerProjet(4, "Petite pièce");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 4);

    const { error } = await sb.from("fournees").update({ statut: "en_cours" }).eq("id", fourneeId);
    expect(error).toBeNull();
    const etat = await relireFournee(fourneeId);
    expect(etat.derogation_capacite).toBe(false);
    expect(etat.derogation_ecart_m2).toBeNull();
  });

  it("une fournée déjà lancée au-delà de la capacité reste clôturable (cas F-2026-0045)", async () => {
    // Lancée AVANT que la capacité ne soit resserrée en dessous de sa surface — exactement le cas
    // d'une fiche four corrigée après coup, ou d'une fournée historique antérieure au correctif.
    await fixerCapacite(20);
    const projetId = await creerProjet(15, "Pièce clôturable");
    const fourneeId = await creerFourneePlanifiee();
    await embarquer(fourneeId, projetId, 15);
    const { error: errLancer } = await sb.from("fournees").update({ statut: "en_cours" }).eq("id", fourneeId);
    expect(errLancer).toBeNull();

    // La fiche four est resserrée après coup : la fournée en cours dépasse maintenant la capacité.
    await fixerCapacite(10);

    const { error: errCloture } = await sb
      .from("fournees")
      .update({ statut: "terminee", temp_relevee: 200, conso_kwh: 12 })
      .eq("id", fourneeId);
    expect(errCloture, "la clôture d'une fournée déjà lancée ne doit jamais être bloquée").toBeNull();

    const etat = await relireFournee(fourneeId);
    expect(etat.statut).toBe("terminee");
  });
});
