import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ajouterJours, debutDeJourParis, estJour, estMoisEntier, joursEntre, jourParis,
  moisDe, periodePrecedente,
} from "@/lib/assistant/dates";
import {
  agendaDatesPromises, chiffreAffairesPeriode, clientsDormants, devisSansReponse,
  devisSignesNonProduits, facturesEchues, journeeDuMatin, outilsPourRole,
  piecesPretesNonLivrees, rechercheFiche, rentabiliteClient, rentabiliteProjet,
  stockSousSeuil,
} from "@/lib/assistant/outils";
import { choisirModele } from "@/lib/assistant/prompt";
import { MODELE_ANALYSE, MODELE_SIMPLE, coutEnEuros } from "@/lib/assistant/config";

/**
 * Les outils de l'assistant s'éprouvent SANS le modèle et SANS la base.
 *
 * POURQUOI. Ce que ces outils peuvent faire de pire n'est pas de tomber en panne — une panne se
 * voit — mais de rendre un chiffre plausible et faux : un total qui additionne un avoir au lieu de
 * le retrancher, un impayé qui annonce le montant de la facture au lieu du reste dû, une borne de
 * période décalée d'une heure qui fait basculer deux jours de facturation d'un mois sur l'autre.
 * Aucun de ces trois défauts n'a besoin d'un modèle de langage pour exister, et aucun ne se voit
 * dans une réponse en français. Ils se prouvent ici, sur des jeux de lignes écrits à la main.
 *
 * La suite complète du projet (`tests/setup/global.ts`) monte un atelier jetable sur Supabase ;
 * ce fichier-ci ne s'en sert pas : un faux client rend des lignes fixes et enregistre les filtres
 * réellement posés. C'est ce qui permet de vérifier la BORNE d'une requête, et pas seulement son
 * résultat.
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Faux client PostgREST
// ─────────────────────────────────────────────────────────────────────────────────────────────

type Reponse = { data: unknown[] | null; error: { message: string } | null; count?: number | null };
type Appel = { table: string; filtres: [string, unknown[]][] };

/**
 * Rend un client dont chaque `from(table)` consomme la réponse suivante prévue pour cette table,
 * et note les filtres posés. Les appels chaînés sont interceptés par un proxy : on n'a pas à
 * réimplémenter la trentaine de méthodes de PostgREST pour en tester trois.
 */
function fauxClient(
  reponses: Record<string, Reponse | Reponse[]>,
  rpc: Record<string, unknown> = {},
): { sb: SupabaseClient; appels: Appel[] } {
  const file: Record<string, Reponse[]> = {};
  for (const [t, r] of Object.entries(reponses)) file[t] = Array.isArray(r) ? [...r] : [r];
  const appels: Appel[] = [];

  const client = {
    from(table: string) {
      const trace: Appel = { table, filtres: [] };
      appels.push(trace);
      const suite = file[table] ?? [];
      const reponse: Reponse = suite.shift() ?? { data: [], error: null, count: 0 };
      const constructeur: unknown = new Proxy(
        {},
        {
          get(_cible, prop) {
            if (typeof prop !== "string") return undefined;
            if (prop === "then") {
              return (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) =>
                Promise.resolve(reponse).then(ok, ko);
            }
            return (...args: unknown[]) => {
              trace.filtres.push([prop, args]);
              return constructeur;
            };
          },
        },
      );
      return constructeur;
    },
    async rpc(nom: string) {
      return { data: nom in rpc ? rpc[nom] : null, error: null };
    },
  };
  return { sb: client as unknown as SupabaseClient, appels };
}

/** Les arguments passés à un filtre donné, sur le premier appel à la table. */
function filtre(appels: Appel[], table: string, nom: string, rang = 0): unknown[] | undefined {
  const t = appels.filter((a) => a.table === table)[rang];
  return t?.filtres.find(([f]) => f === nom)?.[1];
}

/** Un instant fixe : 3 septembre 2026, 10 h 00 à Paris (heure d'été, UTC+2). */
const MAINTENANT = new Date("2026-09-03T08:00:00.000Z");

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("dates — les bornes sont à Paris, pas à Greenwich", () => {
  it("le 31 juillet à 22 h 30 UTC, il est déjà le 1er août à Paris", () => {
    expect(jourParis(new Date("2026-07-31T22:30:00Z"))).toBe("2026-08-01");
  });

  it("le 1er août commence à 22 h UTC la veille (heure d'été)", () => {
    expect(debutDeJourParis("2026-08-01")).toBe("2026-07-31T22:00:00.000Z");
  });

  it("le 1er janvier commence à 23 h UTC la veille (heure d'hiver)", () => {
    expect(debutDeJourParis("2026-01-01")).toBe("2025-12-31T23:00:00.000Z");
  });

  it("le changement d'heure du 29 mars 2026 ne décale pas la borne d'un jour", () => {
    // La nuit du 28 au 29 mars, Paris passe de +1 à +2. Une seule passe de correction se
    // tromperait d'une heure ici, et personne ne le verrait avant le 29 mars suivant.
    expect(debutDeJourParis("2026-03-29")).toBe("2026-03-28T23:00:00.000Z");
    expect(debutDeJourParis("2026-03-30")).toBe("2026-03-29T22:00:00.000Z");
  });

  it("refuse un 31 février", () => {
    expect(estJour("2026-02-31")).toBe(false);
    expect(estJour("2026-02-28")).toBe(true);
    expect(estJour("03/09/2026")).toBe(false);
  });

  it("compte les jours pleins entre deux dates", () => {
    expect(joursEntre("2026-08-24", "2026-09-03")).toBe(10);
    expect(joursEntre("2026-09-03", "2026-08-24")).toBe(-10);
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("connaît les bornes d'un mois civil", () => {
    expect(moisDe("2026-02-14")).toEqual({ debut: "2026-02-01", fin: "2026-02-28" });
    expect(estMoisEntier("2026-08-01", "2026-08-31")).toBe(true);
    expect(estMoisEntier("2026-08-01", "2026-08-30")).toBe(false);
  });

  it("compare août à juillet, pas à « août moins 31 jours »", () => {
    expect(periodePrecedente("2026-08-01", "2026-08-31")).toEqual({
      debut: "2026-07-01", fin: "2026-07-31",
    });
    // Mars fait 31 jours, février 28 : un décalage de durée fixe comparerait mars à un morceau de
    // deux mois. C'est le mois civil qui prime.
    expect(periodePrecedente("2026-03-01", "2026-03-31")).toEqual({
      debut: "2026-02-01", fin: "2026-02-28",
    });
  });

  it("décale d'une durée exacte quand la période n'est pas un mois", () => {
    expect(periodePrecedente("2026-08-10", "2026-08-16")).toEqual({
      debut: "2026-08-03", fin: "2026-08-09",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « devis sans réponse »", () => {
  const troisDevis = {
    data: [
      { id: "d1", numero: "DV-2026-0011", total_ttc: "1200.00", envoye_at: "2026-08-14T09:00:00Z", relance_count: 2, clients: { nom: "Métallerie du Sud" } },
      { id: "d2", numero: "DV-2026-0019", total_ttc: 480, envoye_at: "2026-08-24T09:00:00Z", relance_count: 0, clients: [{ nom: "Garage Pinto" }] },
    ],
    error: null,
    count: 2,
  };

  it("reprend le seuil de l'atelier quand la question n'en donne pas", async () => {
    const { sb, appels } = fauxClient({ devis: troisDevis }, { mes_reglages_alertes: { devis_sans_reponse_jours: 12 } });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, {});

    expect(r.parametres).toMatchObject({ jours: 12, seuil_venu_des_reglages: true });
    // La borne doit valoir « maintenant moins 12 jours », sinon le décompte annoncé n'est pas
    // celui qui a servi — le pire des écarts, parce qu'il est invisible.
    expect(filtre(appels, "devis", "lte")).toEqual([
      "envoye_at", new Date(MAINTENANT.getTime() - 12 * 86_400_000).toISOString(),
    ]);
    expect(filtre(appels, "devis", "eq")).toEqual(["status", "envoye"]);
  });

  it("le nombre de jours de la question prime sur le réglage", async () => {
    const { sb, appels } = fauxClient({ devis: troisDevis }, { mes_reglages_alertes: { devis_sans_reponse_jours: 12 } });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, { jours: 10 });

    expect(r.parametres).toMatchObject({ jours: 10, seuil_venu_des_reglages: false });
    expect(filtre(appels, "devis", "lte")).toEqual([
      "envoye_at", new Date(MAINTENANT.getTime() - 10 * 86_400_000).toISOString(),
    ]);
  });

  it("cumule les montants et date le plus ancien", async () => {
    const { sb } = fauxClient({ devis: troisDevis });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, { jours: 7 });

    expect(r.donnees.nombre).toBe(2);
    expect(r.donnees.montant_ttc_cumule).toBe(1680);
    expect(r.donnees.montant_porte_sur_toutes_les_lignes).toBe(true);
    expect(r.donnees.plus_ancien_jours).toBe(20); // 14 août → 3 septembre
    expect(r.sources[0]).toMatchObject({
      type: "devis", id: "d1", libelle: "DV-2026-0011 · Métallerie du Sud", montant: 1200,
    });
    expect(r.sources[0].detail).toContain("2 relances");
    // L'embed PostgREST rend tantôt un objet, tantôt un tableau : les deux doivent donner un nom.
    expect(r.sources[1].libelle).toContain("Garage Pinto");
    expect(r.sources[1].detail).toContain("jamais relancé");
  });

  it("annonce la troncature quand la base a plus de lignes que le plafond", async () => {
    const { sb } = fauxClient({ devis: { ...troisDevis, count: 412 } });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, {});

    expect(r.donnees.nombre).toBe(412);
    expect(r.tronque).toBe(true);
    // Le total ne porte que sur ce qui est remonté : le dire est la seule façon d'empêcher le
    // modèle de présenter la somme de 2 lignes comme le total de 412 devis.
    expect(r.donnees.montant_porte_sur_toutes_les_lignes).toBe(false);
  });

  it("refuse un nombre de jours absurde plutôt que de l'ignorer", async () => {
    const { sb } = fauxClient({ devis: troisDevis });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, { jours: -3 });
    expect(r.refus).toBe("parametres_invalides");
    expect(r.message).toMatch(/entier/);
  });

  it("remonte une erreur de base au lieu de rendre une liste vide", async () => {
    const { sb } = fauxClient({ devis: { data: null, error: { message: "timeout" }, count: null } });
    const r = await devisSansReponse.executer({ sb, maintenant: MAINTENANT }, { jours: 7 });
    // Une panne rendue comme « aucun devis en attente » est un mensonge coûteux.
    expect(r.refus).toBe("erreur_base");
    expect(r.donnees).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « factures échues »", () => {
  const lignes = {
    data: [
      // Échue depuis longtemps, réglée pour moitié : elle vaut 700, pas 1400.
      { id: "f1", numero: "FA-2026-0007", total_ttc: 1400, due_date: "2026-07-31", relance_count: 1, clients: { nom: "Charpentes Roux" }, paiements: [{ montant: 700 }] },
      // Soldée : elle n'a rien à faire dans un état des impayés.
      { id: "f2", numero: "FA-2026-0009", total_ttc: 900, due_date: "2026-08-10", relance_count: 0, clients: { nom: "Garage Pinto" }, paiements: [{ montant: "600" }, { montant: 300 }] },
      // Jamais réglée.
      { id: "f3", numero: "FA-2026-0012", total_ttc: "250.50", due_date: "2026-08-20", relance_count: 0, clients: { nom: "SARL Levasseur" }, paiements: [] },
    ],
    error: null,
    count: 3,
  };

  it("compte le RESTE DÛ et écarte les factures soldées", async () => {
    const { sb } = fauxClient({ factures: lignes });
    const r = await facturesEchues.executer({ sb, maintenant: MAINTENANT }, {});

    expect(r.donnees.nombre).toBe(2);
    expect(r.donnees.reste_du_total).toBe(950.5);
    expect(r.sources.map((s) => s.id)).toEqual(["f1", "f3"]);
    expect(r.sources[0].montant).toBe(700);
    expect(r.sources[0].detail).toContain("déjà réglée à hauteur de 700");
    expect(r.donnees.plus_ancienne_jours).toBe(34); // 31 juillet → 3 septembre
  });

  it("ne regarde que les factures émises et échues", async () => {
    const { sb, appels } = fauxClient({ factures: lignes });
    await facturesEchues.executer({ sb, maintenant: MAINTENANT }, {});
    expect(filtre(appels, "factures", "eq")).toEqual(["status", "emise"]);
    // Échue = date d'échéance strictement antérieure à aujourd'hui.
    expect(filtre(appels, "factures", "lt")).toEqual(["due_date", "2026-09-03"]);
  });

  it("décale la borne quand on demande un retard minimal", async () => {
    const { sb, appels } = fauxClient({ factures: lignes });
    await facturesEchues.executer({ sb, maintenant: MAINTENANT }, { jours_de_retard_min: 30 });
    expect(filtre(appels, "factures", "lt")).toEqual(["due_date", "2026-08-05"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « chiffre d'affaires sur une période »", () => {
  it("RETRANCHE les avoirs au lieu de les additionner", async () => {
    // Le piège du produit : `avoir_depuis_facture()` enregistre l'avoir avec des totaux POSITIFS.
    // Une somme naïve annoncerait 11 500 € au lieu de 8 500 € — soit 35 % de trop.
    const { sb } = fauxClient({
      factures: {
        data: [
          { type: "solde", total_ht: 6000, total_ttc: 7200, emise_at: "2026-08-05T10:00:00Z" },
          { type: "libre", total_ht: "4000", total_ttc: 4800, emise_at: "2026-08-19T10:00:00Z" },
          { type: "avoir", total_ht: 1500, total_ttc: 1800, emise_at: "2026-08-22T10:00:00Z" },
        ],
        error: null,
      },
    });
    const r = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31" },
    );

    expect(r.donnees.ventes_ht).toBe(10000);
    expect(r.donnees.avoirs_ht_deduits).toBe(1500);
    expect(r.donnees.ca_ht).toBe(8500);
    expect(r.donnees.ca_ttc).toBe(10200);
    expect(r.donnees.nombre_factures).toBe(2);
    expect(r.donnees.nombre_avoirs).toBe(1);
    expect(r.definition).toContain("FACTURÉ");
  });

  it("F5 — rend aussi le reste dû de la période, avoirs exclus", async () => {
    const { sb } = fauxClient({
      factures: {
        data: [
          // Émise 1000 €, réglée pour 400 : 600 € de reste dû.
          { type: "solde", total_ht: 900, total_ttc: 1000, emise_at: "2026-08-05T10:00:00Z", paiements: [{ montant: 400 }] },
          // Émise et payée intégralement : rien à ajouter.
          { type: "libre", total_ht: 450, total_ttc: 500, emise_at: "2026-08-12T10:00:00Z", paiements: [{ montant: "500" }] },
          // Un avoir : jamais une créance, ne doit jamais apparaître dans le reste dû.
          { type: "avoir", total_ht: 200, total_ttc: 240, emise_at: "2026-08-20T10:00:00Z", paiements: [] },
        ],
        error: null,
      },
    });
    const r = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31" },
    );
    expect(r.donnees.reste_du_periode).toBe(600);
  });

  it("borne la période à l'heure de Paris, bornes incluses", async () => {
    const { sb, appels } = fauxClient({ factures: { data: [], error: null } });
    await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31" },
    );
    expect(filtre(appels, "factures", "gte")).toEqual(["emise_at", "2026-07-31T22:00:00.000Z"]);
    // Borne haute EXCLUE, posée au début du 1er septembre : une facture émise le 31 août à
    // 23 h 59 min 59 s appartient bien à août.
    expect(filtre(appels, "factures", "lt")).toEqual(["emise_at", "2026-08-31T22:00:00.000Z"]);
    expect(filtre(appels, "factures", "in")).toEqual(["status", ["emise", "payee"]]);
  });

  it("compare août à juillet quand on le demande", async () => {
    const { sb, appels } = fauxClient({
      factures: [
        { data: [{ type: "solde", total_ht: 12000, total_ttc: 14400, emise_at: "2026-08-05T10:00:00Z" }], error: null },
        { data: [{ type: "solde", total_ht: 10000, total_ttc: 12000, emise_at: "2026-07-05T10:00:00Z" }], error: null },
      ],
    });
    const r = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31", comparer: true },
    );

    expect(r.donnees.comparaison).toMatchObject({
      periode: { debut: "2026-07-01", fin: "2026-07-31" },
      ca_ht: 10000,
      ecart_eur: 2000,
      ecart_pct: 20,
    });
    expect(filtre(appels, "factures", "gte", 1)).toEqual(["emise_at", "2026-06-30T22:00:00.000Z"]);
  });

  it("ne calcule pas de pourcentage sur une période précédente vide", async () => {
    const { sb } = fauxClient({
      factures: [
        { data: [{ type: "solde", total_ht: 500, total_ttc: 600, emise_at: "2026-08-05T10:00:00Z" }], error: null },
        { data: [], error: null },
      ],
    });
    const r = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31", comparer: true },
    );
    // « +∞ % » ou « +100 % » sur une base nulle n'apprend rien et se lit comme une erreur.
    expect((r.donnees.comparaison as { ecart_pct: number | null }).ecart_pct).toBeNull();
    expect((r.donnees.comparaison as { ecart_eur: number }).ecart_eur).toBe(500);
  });

  it("signale une période en cours, qui n'est pas comparable à un mois complet", async () => {
    const { sb } = fauxClient({ factures: { data: [], error: null } });
    const r = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT },
      { debut: "2026-09-01", fin: "2026-09-30" },
    );
    expect(r.donnees.periode_en_cours).toBe(true);

    const aout = await chiffreAffairesPeriode.executer(
      { sb: fauxClient({ factures: { data: [], error: null } }).sb, maintenant: MAINTENANT },
      { debut: "2026-08-01", fin: "2026-08-31" },
    );
    expect(aout.donnees.periode_en_cours).toBe(false);
  });

  it("refuse une date mal formée et une période à l'envers", async () => {
    const { sb } = fauxClient({ factures: { data: [], error: null } });
    const mauvaise = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT }, { debut: "août 2026", fin: "2026-08-31" },
    );
    expect(mauvaise.refus).toBe("parametres_invalides");

    const inversee = await chiffreAffairesPeriode.executer(
      { sb, maintenant: MAINTENANT }, { debut: "2026-08-31", fin: "2026-08-01" },
    );
    expect(inversee.refus).toBe("parametres_invalides");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("périmètre des rôles et choix du modèle", () => {
  it("un opérateur d'atelier ne se voit proposer aucun outil commercial", () => {
    // Le verrou qui compte est en RLS ; celui-ci existe pour que la réponse soit « cette question
    // relève du bureau » et non « vous n'avez aucune facture échue », qui serait faux.
    const OUTILS_COMMERCIAUX = [
      "devis_sans_reponse", "factures_echues", "chiffre_affaires_periode",
      "devis_signes_non_produits", "clients_dormants", "rentabilite_client", "rentabilite_projet",
    ];
    const pourAtelier = outilsPourRole("atelier").map((o) => o.nom);
    const pourNull = outilsPourRole(null).map((o) => o.nom);
    for (const nom of OUTILS_COMMERCIAUX) {
      expect(pourAtelier).not.toContain(nom);
      expect(pourNull).not.toContain(nom);
    }
    // F1 — les outils de production, eux, sont ouverts à tous les rôles (mêmes tables que leurs
    // écrans, en RLS `tenant_all`). `.sort()` mute en place : on trie une copie pour ne pas fausser
    // la comparaison qui suit.
    expect([...pourAtelier].sort()).toEqual([
      "agenda_dates_promises", "journee_du_matin", "pieces_pretes_non_livrees",
      "recherche_fiche", "stock_sous_seuil",
    ].sort());
    expect([...pourNull].sort()).toEqual([...pourAtelier].sort());

    const pourBureau = outilsPourRole("bureau").map((o) => o.nom);
    for (const nom of OUTILS_COMMERCIAUX) expect(pourBureau).toContain(nom);
    // Le bureau et le patron voient TOUS les outils du catalogue, sans exception.
    expect(outilsPourRole("bureau")).toHaveLength(12);
    expect(outilsPourRole("owner")).toHaveLength(12);
  });

  it("garde le petit modèle pour une question de liste, le grand pour une comparaison", () => {
    expect(choisirModele("qui me doit de l'argent ?")).toBe(MODELE_SIMPLE);
    expect(choisirModele("quels devis sans réponse depuis 10 jours ?")).toBe(MODELE_SIMPLE);
    expect(choisirModele("combien j'ai facturé en août par rapport à juillet ?")).toBe(MODELE_ANALYSE);
    expect(choisirModele("pourquoi ma marge a baissé ?")).toBe(MODELE_ANALYSE);
  });

  it("chiffre le coût d'une question", () => {
    // 6 000 jetons d'entrée et 400 de sortie sur le petit modèle : l'ordre de grandeur d'une
    // question de liste, soit moins d'un centime.
    expect(coutEnEuros(MODELE_SIMPLE, 6000, 400)).toBeCloseTo(0.00736, 5);
    expect(coutEnEuros(MODELE_ANALYSE, 12000, 700)).toBeCloseTo(0.04278, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// F1 — les neuf outils repris après la panne réseau. Même méthode que ci-dessus : faux client,
// aucun modèle, aucune base.
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("outil « le point du jour »", () => {
  const PAYLOAD = {
    vide: false,
    commercial: true,
    production: {
      a_sortir: [{ id: "p1", numero: "PRJ-1", nom: null, client: "Métallerie du Sud" }],
      a_sortir_total: 1,
      en_retard: [{ id: "p2", numero: "PRJ-2", nom: null, client: "Garage Pinto", jours: 3 }],
      en_retard_total: 1,
    },
    risques: {
      poudres: [{ id: "po1", libelle: "Axalta RAL 9010", stock_kg: 2, seuil_kg: 5 }],
      lots: [{ id: "l1", libelle: "Axalta RAL 9010", jours: 4, restant_kg: 3 }],
    },
    argent: {
      devis: { nb: 3, total: 4500, plus_ancien_jours: 12, liste: [{ id: "d1", numero: "DV-1", client: "SARL Levasseur", total_ttc: 1200, jours: 12 }] },
      factures: { nb: 2, total: 800, liste: [{ id: "f1", numero: "FA-1", client: "SARL Levasseur", reste: 300, jours: 5 }] },
    },
    action: { titre: "Prévenir 1 client", detail: "…", url: "/projets" },
  };

  it("reprend tel quel le calcul du courriel du matin, avec des totaux exacts", async () => {
    const { sb } = fauxClient({}, { mon_recap_quotidien: PAYLOAD });
    const r = await journeeDuMatin.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.chantiers_a_sortir).toBe(1);
    expect(r.donnees.chantiers_en_retard).toBe(1);
    expect(r.donnees.poudres_sous_seuil).toBe(1);
    expect(r.donnees.lots_proches_dlu).toBe(1);
    expect(r.donnees.montant_porte_sur_toutes_les_lignes).toBe(true);
    expect(r.tronque).toBe(false);
    // Sources : le retard, l'argent (rôle commercial), les chantiers à sortir, les poudres, les
    // lots — dans cet ordre de priorité.
    expect(r.sources.some((s) => s.type === "projet" && s.id === "p2")).toBe(true);
    expect(r.sources.some((s) => s.type === "facture" && s.id === "f1")).toBe(true);
    expect(r.sources.some((s) => s.type === "poudre" && s.id === "po1")).toBe(true);
    expect(r.sources.some((s) => s.type === "lot" && s.id === "l1")).toBe(true);
  });

  it("cache l'argent à un rôle de production", async () => {
    const payloadProduction = { ...PAYLOAD, commercial: false, argent: { devis: { nb: 0, total: 0, plus_ancien_jours: 0, liste: [] }, factures: { nb: 0, total: 0, liste: [] } } };
    const { sb } = fauxClient({}, { mon_recap_quotidien: payloadProduction });
    const r = await journeeDuMatin.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.devis_sans_reponse).toBeUndefined();
    expect(r.donnees.factures_echues).toBeUndefined();
    expect(r.sources.some((s) => s.type === "facture" || s.type === "devis")).toBe(false);
  });

  it("refuse proprement si la base ne répond pas", async () => {
    const { sb } = fauxClient({}, {});
    const client = { ...sb, rpc: async () => ({ data: null, error: { message: "timeout" } }) } as unknown as typeof sb;
    const r = await journeeDuMatin.executer({ sb: client, maintenant: MAINTENANT }, {});
    expect(r.refus).toBe("erreur_base");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « devis signés non produits »", () => {
  it("garde un devis signé sans chantier, ou dont le chantier est en attente", async () => {
    const { sb, appels } = fauxClient({
      devis: {
        data: [
          { id: "d1", numero: "DV-10", total_ttc: 1000, signed_at: "2026-08-01", clients: { nom: "A" }, projets: null },
          { id: "d2", numero: "DV-11", total_ttc: 500, signed_at: "2026-08-02", clients: { nom: "B" }, projets: { status: "en_attente" } },
          { id: "d3", numero: "DV-12", total_ttc: 700, signed_at: "2026-08-03", clients: { nom: "C" }, projets: { status: "en_cours" } },
          { id: "d4", numero: "DV-13", total_ttc: 300, signed_at: "2026-08-04", clients: { nom: "D" }, projets: [{ status: "en_attente" }] },
        ],
        error: null,
        count: 4,
      },
    });
    const r = await devisSignesNonProduits.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(3);
    expect(r.sources.map((s) => s.id).sort()).toEqual(["d1", "d2", "d4"]);
    expect(filtre(appels, "devis", "eq")).toEqual(["status", "signe"]);
  });

  it("signale la troncature à partir du compte exact rendu par PostgREST", async () => {
    const { sb } = fauxClient({
      devis: { data: [{ id: "d1", numero: "DV-1", total_ttc: 100, signed_at: "2026-08-01", clients: { nom: "A" }, projets: null }], error: null, count: 250 },
    });
    const r = await devisSignesNonProduits.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.tronque).toBe(true);
    expect(r.donnees.montant_porte_sur_toutes_les_lignes).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « chantiers prêts, pas encore livrés »", () => {
  it("écarte un chantier dont un bon de livraison est déjà livré ou facturé", async () => {
    const { sb, appels } = fauxClient({
      projets: {
        data: [
          { id: "p1", numero: "PRJ-1", nom: null, date_promise: "2026-09-01", clients: { nom: "A" }, bons_livraison: null },
          { id: "p2", numero: "PRJ-2", nom: null, date_promise: "2026-09-02", clients: { nom: "B" }, bons_livraison: { status: "livre" } },
          { id: "p3", numero: "PRJ-3", nom: null, date_promise: "2026-09-03", clients: { nom: "C" }, bons_livraison: [{ status: "brouillon" }] },
        ],
        error: null,
        count: 3,
      },
    });
    const r = await piecesPretesNonLivrees.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(2);
    expect(r.sources.map((s) => s.id).sort()).toEqual(["p1", "p3"]);
    expect(filtre(appels, "projets", "eq")).toEqual(["status", "pret"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « agenda des dates promises »", () => {
  const LIGNES = {
    data: [
      { id: "p1", numero: "PRJ-1", nom: null, date_promise: "2026-08-20", clients: { nom: "A" } }, // en retard
      { id: "p2", numero: "PRJ-2", nom: null, date_promise: "2026-09-10", clients: { nom: "B" } }, // à venir
    ],
    error: null,
    count: 2,
  };

  it("distingue les retards des dates à venir, dans l'horizon par défaut", async () => {
    const { sb, appels } = fauxClient({ projets: LIGNES });
    const r = await agendaDatesPromises.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.parametres).toEqual({ horizon_jours: 14 });
    expect(r.donnees.en_retard).toBe(1);
    expect(r.donnees.a_venir).toBe(1);
    expect(filtre(appels, "projets", "lte")).toEqual(["date_promise", "2026-09-17"]);
  });

  it("refuse un horizon hors bornes", async () => {
    const { sb } = fauxClient({ projets: LIGNES });
    const r = await agendaDatesPromises.executer({ sb, maintenant: MAINTENANT }, { horizon_jours: 400 });
    expect(r.refus).toBe("parametres_invalides");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « clients dormants »", () => {
  it("ne garde que les clients sans devis NI facture depuis le seuil, en prenant la plus récente des deux activités", async () => {
    const { sb } = fauxClient({
      devis: {
        data: [
          // Client A : devis vieux de plus de 60 jours...
          { client_id: "c1", created_at: "2026-06-01T00:00:00Z", clients: { nom: "Client A" } },
          // Client B : un devis récent — n'est pas dormant.
          { client_id: "c2", created_at: "2026-08-30T00:00:00Z", clients: { nom: "Client B" } },
        ],
        error: null,
        count: 2,
      },
      factures: {
        // Client A a une facture plus récente que son devis, mais toujours au-delà du seuil.
        data: [{ client_id: "c1", created_at: "2026-06-15T00:00:00Z", clients: { nom: "Client A" } }],
        error: null,
        count: 1,
      },
    });
    const r = await clientsDormants.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(1);
    expect(r.sources[0]).toMatchObject({ type: "client", id: "c1", libelle: "Client A" });
  });

  it("un client jamais devisé n'apparaît jamais (prospect, pas client dormant)", async () => {
    const { sb } = fauxClient({
      devis: { data: [], error: null, count: 0 },
      factures: { data: [], error: null, count: 0 },
    });
    const r = await clientsDormants.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(0);
  });

  it("refuse un nombre de jours hors bornes", async () => {
    const { sb } = fauxClient({ devis: { data: [], error: null }, factures: { data: [], error: null } });
    const r = await clientsDormants.executer({ sb, maintenant: MAINTENANT }, { jours: 5 });
    expect(r.refus).toBe("parametres_invalides");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « poudres sous leur seuil »", () => {
  it("compare stock et seuil colonne à colonne, côté application", async () => {
    const { sb, appels } = fauxClient({
      poudres: {
        data: [
          { id: "po1", marque: "Axalta", reference: "ALP", ral: "9010", stock_kg: 2, seuil_alerte_kg: 5 },
          { id: "po2", marque: "Axalta", reference: "BLEU", ral: "5010", stock_kg: 20, seuil_alerte_kg: 5 },
          { id: "po3", marque: "Tiger", reference: "GRIS", ral: null, stock_kg: 1, seuil_alerte_kg: 1 },
        ],
        error: null,
        count: 3,
      },
    });
    const r = await stockSousSeuil.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(2);
    expect(r.sources.map((s) => s.id).sort()).toEqual(["po1", "po3"]);
    expect(filtre(appels, "poudres", "eq")).toEqual(["actif", true]);
    expect(filtre(appels, "poudres", "gt")).toEqual(["seuil_alerte_kg", 0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outils de rentabilité — verrouillés à la formule", () => {
  it("rentabilite_client refuse poliment quand ma_capacite('rentabilite') est fausse", async () => {
    const { sb, appels } = fauxClient({}, { ma_capacite: false });
    const r = await rentabiliteClient.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.refus).toBe("hors_perimetre");
    expect(r.message).toMatch(/formule/);
    // La vue n'est même pas interrogée : le refus est rendu AVANT toute lecture.
    expect(appels.some((a) => a.table === "client_rentabilite")).toBe(false);
  });

  it("rentabilite_client rend la liste triée par marge quand la capacité est ouverte", async () => {
    const { sb } = fauxClient(
      { client_rentabilite: { data: [
        { client_id: "c1", nom: "Perdant", facture_ht: 1000, revient_total: 1500, marge_eur: -500, marge_pct: -50, perte_reelle: true },
        { client_id: "c2", nom: "Gagnant", facture_ht: 2000, revient_total: 1000, marge_eur: 1000, marge_pct: 50, perte_reelle: false },
      ], error: null } },
      { ma_capacite: true },
    );
    const r = await rentabiliteClient.executer({ sb, maintenant: MAINTENANT }, {});
    expect(r.donnees.nombre).toBe(2);
    expect(r.donnees.clients_en_perte_reelle).toBe(1);
    expect(r.sources[0]).toMatchObject({ id: "c1", montant: -500, detail: "en perte réelle" });
  });

  it("rentabilite_projet refuse aussi sans capacité, avant même de chercher le chantier", async () => {
    const { sb, appels } = fauxClient({}, { ma_capacite: false });
    const r = await rentabiliteProjet.executer({ sb, maintenant: MAINTENANT }, { projet: "PRJ-42" });
    expect(r.refus).toBe("hors_perimetre");
    expect(appels.some((a) => a.table === "projets")).toBe(false);
  });

  it("rentabilite_projet cherche par numéro ou nom et rend le prix de revient", async () => {
    const { sb } = fauxClient(
      {
        projets: { data: [{ id: "p1", numero: "PRJ-42", nom: "Golf de Durand", client_id: "c1", clients: { nom: "Durand" } }], error: null },
        projet_revient: { data: [{ projet_id: "p1", cout_poudre: 40, cout_main_oeuvre: 120, cout_energie: 15, revient_total: 175 }], error: null },
        projet_temps_cout: { data: [{ projet_id: "p1", minutes_totales: 90 }], error: null },
      },
      { ma_capacite: true },
    );
    const r = await rentabiliteProjet.executer({ sb, maintenant: MAINTENANT }, { projet: "PRJ-42" });
    expect(r.sources[0]).toMatchObject({ id: "p1", montant: 175 });
    expect(r.donnees.resultats).toMatchObject([{ id: "p1", revient_total: 175, minutes_pointees: 90 }]);
  });

  it("rentabilite_projet refuse une recherche trop courte, et une recherche sans résultat", async () => {
    const { sb: sb1 } = fauxClient({}, { ma_capacite: true });
    expect((await rentabiliteProjet.executer({ sb: sb1, maintenant: MAINTENANT }, { projet: "a" })).refus)
      .toBe("parametres_invalides");

    const { sb: sb2 } = fauxClient({ projets: { data: [], error: null } }, { ma_capacite: true });
    const r = await rentabiliteProjet.executer({ sb: sb2, maintenant: MAINTENANT }, { projet: "INTROUVABLE" });
    expect(r.refus).toBe("parametres_invalides");
    expect(r.message).toContain("INTROUVABLE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("outil « recherche dans les fiches »", () => {
  it("traduit les résultats de recherche_globale en sources cliquables", async () => {
    const { sb } = fauxClient({}, {
      recherche_globale: [
        { type: "client", id: "c1", titre: "Métallerie du Sud", sous_titre: "Nîmes · 06…", date: null, montant: null },
        { type: "devis", id: "d1", titre: "DV-2026-0031", sous_titre: "Métallerie du Sud · envoye", date: null, montant: 1200 },
      ],
    });
    const r = await rechercheFiche.executer({ sb, maintenant: MAINTENANT }, { q: "métallerie" });
    expect(r.sources).toHaveLength(2);
    expect(r.sources[1]).toMatchObject({ type: "devis", id: "d1", montant: 1200, detail: "Métallerie du Sud · envoye" });
  });

  it("refuse un motif trop court sans appeler la base", async () => {
    const { sb } = fauxClient({}, { recherche_globale: [{ type: "client", id: "x", titre: "x", sous_titre: null, date: null, montant: null }] });
    const r = await rechercheFiche.executer({ sb, maintenant: MAINTENANT }, { q: "a" });
    expect(r.refus).toBe("parametres_invalides");
  });
});
