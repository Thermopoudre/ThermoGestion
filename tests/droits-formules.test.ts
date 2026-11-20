import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import {
  CAPACITES,
  NIVEAU_PLAN,
  NIVEAU_REQUIS,
  OFFRES,
  SIEGES_INCLUS,
  capaciteOuverte,
  lookupKey,
  siegesAutorises,
  planEffectif,
  type Capacite,
  type PlanCode,
} from "@/lib/abonnement";

/**
 * Droits par formule — le test de sécurité du lot 10.
 *
 * Le principe de ce fichier est celui de `verdict-qualite-serveur` et de `seuils-qualite` : on
 * n'interroge pas l'écran, on attaque la base depuis un client PostgREST ordinaire, celui dont
 * dispose n'importe quel atelier avec la clé publiable, et depuis un client anonyme. Un verrou
 * qui ne vit que dans React n'est pas un verrou — ce projet en a pris cinq en défaut.
 *
 * L'atelier jetable est en essai, donc **tout est ouvert** : c'est la règle du produit. Pour
 * pouvoir attaquer les verrous, on pose un **aperçu de formule** (`apercu_formule`), qui n'existe
 * que pendant l'essai et ne peut jamais ouvrir quoi que ce soit — seulement restreindre.
 *
 * `afterEach` rétablit l'essai complet : les fichiers de test partagent le même atelier et
 * s'exécutent en série, un aperçu oublié ferait tomber toute la suite derrière celui-ci.
 */

const sb = () => clientConnecte();
const anon = () => clientAnonyme();

async function apercu(plan: PlanCode | null) {
  const { error } = await sb().rpc("apercu_formule", { p_plan: plan });
  if (error) throw new Error(`apercu_formule(${plan}) : ${error.message}`);
}

describe("Barème des formules — la base et le code disent la même chose", () => {
  it("les trois formules et leurs six clés Stripe sont celles annoncées", () => {
    expect(OFFRES.map((o) => o.code)).toEqual(["atelier", "equipe", "certifie"]);
    expect(OFFRES.map((o) => o.prixMensuel)).toEqual([79, 129, 249]);
    // Deux mois offerts : le prix annuel vaut exactement dix mois.
    for (const o of OFFRES) expect(o.prixAnnuel).toBe(o.prixMensuel * 10);
    expect(OFFRES.flatMap((o) => [lookupKey(o.code, "mois"), lookupKey(o.code, "an")])).toEqual([
      "thermogestion_atelier_mensuel", "thermogestion_atelier_annuel",
      "thermogestion_equipe_mensuel", "thermogestion_equipe_annuel",
      "thermogestion_certifie_mensuel", "thermogestion_certifie_annuel",
    ]);
  });

  it("le module jantes est bien dans la formule d'entrée", () => {
    // La règle commerciale d'Alexis : ce qui fait payer plus n'est jamais le métier. Si un jour
    // quelqu'un déplace la jante vers Équipe, ce test tombe avant la mise en ligne.
    const entree = OFFRES[0].inclus.join(" ").toLowerCase();
    expect(entree).toContain("jantes");
    expect(entree).toContain("pouce");
    expect(CAPACITES).not.toContain("jantes" as Capacite);
  });

  it("la table des droits du code est identique à celle de la base, capacité par capacité", async () => {
    const plans = Object.keys(NIVEAU_PLAN) as PlanCode[];
    for (const plan of plans) {
      for (const capacite of CAPACITES) {
        const { data, error } = await sb().rpc("capacite_du_plan", { p_plan: plan, p_capacite: capacite });
        expect(error, `capacite_du_plan(${plan}, ${capacite})`).toBeNull();
        expect(data, `${plan} / ${capacite}`).toBe(NIVEAU_PLAN[plan] >= NIVEAU_REQUIS[capacite]);
      }
    }
  });

  it("une capacité inventée est refusée par la base plutôt qu'accordée en silence", async () => {
    // Le piège classique du `case … else true` : une faute de frappe dans un trigger ouvrirait
    // la porte sans que personne ne s'en aperçoive.
    const { error } = await sb().rpc("capacite_du_plan", { p_plan: "atelier", p_capacite: "capacite_inventee" });
    expect(error?.message ?? "").toContain("CAPACITE_INCONNUE");
  });

  it("une formule inventée est refusée", async () => {
    const { error } = await sb().rpc("capacite_du_plan", { p_plan: "premium", p_capacite: "qualite" });
    expect(error?.message ?? "").toContain("PLAN_INCONNU");
  });
});

describe("Pendant l'essai, tout est ouvert", () => {
  afterEach(() => apercu(null));

  it("sans aperçu, l'atelier en essai a la formule la plus haute", async () => {
    const { data, error } = await sb().rpc("mon_plan");
    expect(error).toBeNull();
    expect(data).toBe("certifie");
    for (const c of CAPACITES) {
      const { data: ok } = await sb().rpc("ma_capacite", { p_capacite: c });
      expect(ok, c).toBe(true);
    }
  });

  it("le calcul du navigateur dit la même chose que celui de la base", () => {
    const essai = { plan: "atelier", status: "trialing", trial_end: null, apercu_plan: null };
    expect(planEffectif(essai)).toBe("certifie");
    for (const c of CAPACITES) expect(capaciteOuverte(essai, c), c).toBe(true);
    // L'essai n'ouvre plus « les utilisateurs sans limite » : il ouvre les dix sièges de la
    // formule la plus haute. Le détail du compteur de sièges est éprouvé dans sieges.test.ts.
    expect(siegesAutorises(essai)).toBe(SIEGES_INCLUS.certifie);
  });
});

describe("Formule Atelier — ce qui se ferme, et où", () => {
  beforeAll(() => apercu("atelier"));
  afterAll(() => apercu(null));

  it("la formule en vigueur est bien redescendue, côté base", async () => {
    const { data } = await sb().rpc("mon_plan");
    expect(data).toBe("atelier");
  });

  const refus: { table: string; ligne: (atelier: string) => Record<string, unknown>; capacite: Capacite }[] = [
    { table: "instruments", capacite: "qualite", ligne: (a) => ({ atelier_id: a, nom: "Jauge d'épaisseur", type: "epaisseur" }) },
    { table: "controles_bains", capacite: "qualite", ligne: (a) => ({ atelier_id: a, bain: "Dégraissage", ph: 9.2 }) },
    { table: "certifications", capacite: "qualite", ligne: (a) => ({ atelier_id: a, label: "Qualicoat" }) },
    { table: "dechets", capacite: "registre_dechets", ligne: (a) => ({ atelier_id: a, nature: "Poudre non utilisée", quantite_kg: 12 }) },
    { table: "fds", capacite: "fds", ligne: (a) => ({ atelier_id: a, produit: "RAL 7016 texturé" }) },
    { table: "fournees", capacite: "fournees", ligne: (a) => ({ atelier_id: a, numero: "F-TEST-PLAN", date_prevue: "2026-09-01" }) },
    { table: "commandes_poudre", capacite: "commande_poudre", ligne: (a) => ({ atelier_id: a, status: "panier" }) },
  ];

  for (const { table, ligne, capacite } of refus) {
    it(`la base refuse une écriture dans ${table} (${capacite})`, async () => {
      const { atelierId } = contexte().seed;
      const { error } = await sb().from(table).insert(ligne(atelierId));
      expect(error, `${table} aurait dû être refusée`).not.toBeNull();
      expect(error?.message ?? "").toContain("PLAN_INSUFFISANT");
    });
  }

  it("un tarif négocié par client est refusé", async () => {
    const { atelierId, clientRemiseId, prestationMlId } = contexte().seed;
    const { error } = await sb()
      .from("client_tarifs")
      .insert({ atelier_id: atelierId, client_id: clientRemiseId, prestation_id: prestationMlId, prix_ht: 3 });
    expect(error?.message ?? "").toContain("PLAN_INSUFFISANT");
  });

  it("la facture récapitulative est refusée par la RPC, pas seulement masquée à l'écran", async () => {
    const { clientRemiseId } = contexte().seed;
    const { error } = await sb().rpc("facture_recapitulative", {
      p_client: clientRemiseId, p_debut: "2026-01-01", p_fin: "2026-12-31",
    });
    expect(error?.message ?? "").toContain("PLAN_INSUFFISANT");
  });

  it("les vues de rentabilité ne rendent aucune ligne — l'écran ne peut donc rien afficher", async () => {
    // C'est l'écran /pilotage, interrogé directement en REST : masquer l'entrée du menu ne
    // masquerait rien du tout.
    const { data: clients, error: e1 } = await sb().from("client_rentabilite").select("client_id");
    expect(e1).toBeNull();
    expect(clients ?? []).toHaveLength(0);
    const { data: projets, error: e2 } = await sb().from("projet_revient").select("projet_id");
    expect(e2).toBeNull();
    expect(projets ?? []).toHaveLength(0);
  });

  it("la lecture des données déjà saisies reste ouverte", async () => {
    // Une formule qui emprisonne les données serait un piège commercial, et un manquement à
    // l'engagement d'export des CGU. Seule la création est fermée.
    const { error } = await sb().from("instruments").select("id").limit(1);
    expect(error).toBeNull();
    const { error: e2 } = await sb().from("fournees").select("id").limit(1);
    expect(e2).toBeNull();
  });

  it("les capacités de la formule d'entrée restent ouvertes", async () => {
    const { atelierId } = contexte().seed;
    // Le métier reste entier : un devis, un projet et un client se créent toujours.
    const { data, error } = await sb()
      .from("clients")
      .insert({ atelier_id: atelierId, type: "particulier", nom: "Client formule entrée" })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) await sb().from("clients").delete().eq("id", (data as { id: string }).id);
  });

  it("les deux sièges de la formule d'entrée sont posés en base", async () => {
    const { data } = await sb().rpc("ma_limite_utilisateurs");
    expect(data).toBe(SIEGES_INCLUS.atelier);
  });

  it("la troisième place d'utilisateur est refusée, invitations en attente comprises", async () => {
    const { atelierId } = contexte().seed;
    // L'atelier jetable compte un utilisateur : la première invitation passe, la seconde non.
    const { data: inv1, error: e1 } = await sb()
      .from("invitations")
      .insert({ atelier_id: atelierId, email: "operateur1@test.invalid" })
      .select("id")
      .single();
    expect(e1).toBeNull();

    const { error: e2 } = await sb()
      .from("invitations")
      .insert({ atelier_id: atelierId, email: "operateur2@test.invalid" });
    expect(e2?.message ?? "").toContain("SIEGES_INSUFFISANTS");

    if (inv1) await sb().from("invitations").delete().eq("id", (inv1 as { id: string }).id);
  });
});

describe("Formule Équipe — la marche intermédiaire porte bien ce qu'elle vend", () => {
  beforeAll(() => apercu("equipe"));
  afterAll(() => apercu(null));

  it("les fournées s'ouvrent", async () => {
    const { atelierId } = contexte().seed;
    const { data, error } = await sb()
      .from("fournees")
      .insert({ atelier_id: atelierId, numero: "F-TEST-EQUIPE", date_prevue: "2026-09-01" })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) await sb().from("fournees").delete().eq("id", (data as { id: string }).id);
  });

  it("la formule ouvre cinq sièges, et non des utilisateurs sans limite", async () => {
    // C'est le point qui a changé : la marche Atelier → Équipe ne vend plus l'infini, elle vend
    // trois sièges de plus. Ce qui la justifie, ce sont les fonctions d'organisation ci-dessous.
    const { data } = await sb().rpc("ma_limite_utilisateurs");
    expect(data).toBe(SIEGES_INCLUS.equipe);
  });

  it("la qualité reste fermée", async () => {
    const { atelierId } = contexte().seed;
    const { error } = await sb().from("instruments").insert({ atelier_id: atelierId, nom: "Brillancemètre" });
    expect(error?.message ?? "").toContain("PLAN_INSUFFISANT");
  });

  it("la rentabilité s'ouvre", async () => {
    const { error } = await sb().from("client_rentabilite").select("client_id").limit(1);
    expect(error).toBeNull();
    const { data } = await sb().rpc("ma_capacite", { p_capacite: "rentabilite" });
    expect(data).toBe(true);
  });
});

describe("L'aperçu de formule ne peut rien ouvrir", () => {
  afterEach(() => apercu(null));

  it("il refuse une formule inventée", async () => {
    const { error } = await sb().rpc("apercu_formule", { p_plan: "illimite" });
    expect(error?.message ?? "").toContain("PLAN_INCONNU");
  });

  it("il est inaccessible à un client anonyme", async () => {
    const { error } = await anon().rpc("apercu_formule", { p_plan: "certifie" });
    expect(error).not.toBeNull();
  });

  it("le retour à l'essai complet rouvre tout", async () => {
    await apercu("atelier");
    const { data: ferme } = await sb().rpc("ma_capacite", { p_capacite: "qualite" });
    expect(ferme).toBe(false);
    await apercu(null);
    const { data: ouvert } = await sb().rpc("ma_capacite", { p_capacite: "qualite" });
    expect(ouvert).toBe(true);
  });

  it("un atelier ne peut pas se hisser tout seul dans une formule payante", async () => {
    // La seule écriture possible sur `subscriptions` est celle du webhook Stripe, en service_role.
    // Sans ce refus, `apercu_formule` deviendrait un abonnement gratuit à vie.
    //
    // Le test ne cherche pas une erreur : sans policy d'UPDATE, PostgREST répond 204 en ayant
    // modifié zéro ligne. C'est exactement le piège des « garde-fous qui ont l'air corrects » —
    // on vérifie donc l'état après coup, pas le code de retour.
    const { atelierId } = contexte().seed;
    await sb()
      .from("subscriptions")
      .update({ plan: "certifie", status: "active", trial_end: null })
      .eq("atelier_id", atelierId);
    const { data } = await sb().from("subscriptions").select("plan, status").maybeSingle();
    expect(data?.plan).toBe("atelier");
    expect(data?.status).toBe("trialing");
  });
});

describe("Client anonyme — la clé publiable n'ouvre aucun droit", () => {
  it("il ne lit ni la rentabilité, ni le prix de revient", async () => {
    const { data: c } = await anon().from("client_rentabilite").select("client_id");
    expect(c ?? []).toHaveLength(0);
    const { data: p } = await anon().from("projet_revient").select("projet_id");
    expect(p ?? []).toHaveLength(0);
  });

  it("il n'a aucune capacité", async () => {
    for (const c of CAPACITES) {
      const { data } = await anon().rpc("ma_capacite", { p_capacite: c });
      expect(data ?? false, c).toBe(false);
    }
  });

  it("il ne peut écrire dans aucune table verrouillée par la formule", async () => {
    const { atelierId } = contexte().seed;
    // Charges utiles valides colonne par colonne : un payload approximatif serait refusé pour
    // « colonne inconnue » et le test passerait sans jamais avoir éprouvé la RLS.
    const cibles: [string, Record<string, unknown>][] = [
      ["instruments", { atelier_id: atelierId, nom: "Jauge pirate" }],
      ["fournees", { atelier_id: atelierId, numero: "F-ANON", date_prevue: "2026-09-01" }],
      ["dechets", { atelier_id: atelierId, nature: "Poudre", quantite_kg: 1 }],
      ["fds", { atelier_id: atelierId, produit: "RAL 9005" }],
      ["commandes_poudre", { atelier_id: atelierId, status: "panier" }],
      ["certifications", { atelier_id: atelierId, label: "Qualicoat" }],
    ];
    for (const [table, ligne] of cibles) {
      const { error } = await anon().from(table).insert(ligne);
      expect(error, `${table} ouverte à anon`).not.toBeNull();
    }
  });

  it("il ne connaît pas la formule des autres ateliers", async () => {
    // `plan_effectif` et `capacite_ouverte` prennent un atelier en argument : en SECURITY DEFINER
    // elles auraient répondu pour n'importe quel identifiant connu. En INVOKER, la RLS de
    // `subscriptions` les ramène à la formule d'entrée, qui n'ouvre aucune des capacités listées.
    const { atelierId } = contexte().seed;
    const { data, error } = await anon().rpc("capacite_ouverte", { p_atelier: atelierId, p_capacite: "qualite" });
    expect(error !== null || data === false).toBe(true);
  });
});
