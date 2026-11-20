import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * Une migration avait laissé `marquer_facture_payee` et `relancer_devis_et_factures` ouvertes à
 * PUBLIC : n'importe qui pouvait solder une facture ou déclencher une campagne de relance avec la
 * seule clé publique du front. Ces fonctions ne doivent être appelables que par le `service_role`
 * (webhook Stripe, tâches planifiées), jamais par `anon` ni par `authenticated`.
 */
const ctx = contexte();
let anon: SupabaseClient;
let sb: SupabaseClient;

/** PostgREST rend 42501 (droit refusé) ou PGRST202 (fonction masquée pour ce rôle). */
function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42501", "PGRST202", "PGRST203"].includes(error.code ?? "") || /permission denied|not find the function/i.test(error.message ?? "");
}

const FONCTIONS_SENSIBLES: { nom: string; args: Record<string, unknown> }[] = [
  { nom: "marquer_facture_payee", args: { p_token: "peu-importe", p_montant: 1, p_stripe_payment_intent_id: "pi_test" } },
  { nom: "relancer_devis_et_factures", args: {} },
  { nom: "process_notifications", args: {} },
  { nom: "verifier_notifications", args: {} },
  { nom: "reconcilier_stock_lots", args: {} },
  { nom: "consommer_lots", args: { p_poudre_id: "00000000-0000-0000-0000-000000000000", p_qte: 1, p_lot_prefere: null } },
  // Aides de trigger du module jantes : `_workflow_jantes` est née exposée à `anon`.
  { nom: "_workflow_jantes", args: { p_atelier: "00000000-0000-0000-0000-000000000000" } },
  { nom: "_workflow_defaut", args: { p_atelier: "00000000-0000-0000-0000-000000000000" } },
  // Courriel du matin : `envoyer_recap_quotidien` écrit dans la file d'envoi, et
  // `recap_quotidien_payload` prend un `atelier_id` en paramètre — ouverte, elle rendrait le
  // carnet de commandes et les impayés de n'importe quel atelier.
  { nom: "envoyer_recap_quotidien", args: {} },
  { nom: "recap_quotidien_payload", args: { p_atelier: "00000000-0000-0000-0000-000000000000", p_commercial: true } },
  { nom: "reglages_alertes_de", args: { p_atelier: "00000000-0000-0000-0000-000000000000" } },
];

beforeAll(() => {
  anon = clientAnonyme(ctx);
  sb = clientConnecte(ctx);
});

describe("verrouillage des fonctions de paiement et de relance", () => {
  it.each(FONCTIONS_SENSIBLES)("$nom est refusée à anon", async ({ nom, args }) => {
    const { error } = await anon.rpc(nom, args);
    expect(estRefus(error), `anon a pu appeler ${nom} : ${JSON.stringify(error)}`).toBe(true);
  });

  it.each(FONCTIONS_SENSIBLES)("$nom est refusée à un utilisateur connecté", async ({ nom, args }) => {
    const { error } = await sb.rpc(nom, args);
    expect(estRefus(error), `un compte atelier a pu appeler ${nom} : ${JSON.stringify(error)}`).toBe(true);
  });

  it("receptionner_lot n'est plus ouverte à anon mais reste utilisable par l'atelier", async () => {
    const refus = await anon.rpc("receptionner_lot", {
      p_poudre_id: ctx.seed.poudreId, p_numero: "PIRATE", p_fournisseur: null, p_quantite_kg: 99, p_prix_kg: null, p_dlu: null,
    });
    expect(estRefus(refus.error)).toBe(true);

    const { data: lots } = await sb.from("poudre_lots").select("id").eq("numero", "PIRATE");
    expect(lots).toHaveLength(0);
  });

  it("contrôle positif : les RPC publiques restent bien accessibles à anon", async () => {
    for (const nom of ["devis_public", "facture_public", "bl_public", "projet_public", "reception_public", "jeu_jantes_public"]) {
      const { error } = await anon.rpc(nom, { p_token: "jeton-inexistant" });
      expect(error, `${nom} devrait rester public`).toBeNull();
    }
  });
});

describe("constat 1 (audit du 07/09/2026) : métadonnées d'atelier fermées à anon", () => {
  // Preuve reproduite de l'audit : `set local role anon` + `select public.sieges_occupes(<uuid>)`
  // rendait le plan payé, les sièges et les capacités de n'importe quel atelier. Les cinq fonctions
  // (plus `limite_utilisateurs`, alias non security definer de `sieges_autorises` trouvé pendant la
  // correction) sont désormais fermées à anon, mais un compte connecté doit continuer à lire les
  // chiffres de SON PROPRE atelier — sinon le correctif aurait aussi cassé /reglages et /abonnement.
  const FONCTIONS_METADONNEES = [
    { nom: "plan_effectif", args: (atelierId: string) => ({ p_atelier: atelierId }) },
    { nom: "sieges_occupes", args: (atelierId: string) => ({ p_atelier: atelierId }) },
    { nom: "sieges_autorises", args: (atelierId: string) => ({ p_atelier: atelierId }) },
    { nom: "acces_comptables_occupes", args: (atelierId: string) => ({ p_atelier: atelierId }) },
    { nom: "limite_utilisateurs", args: (atelierId: string) => ({ p_atelier: atelierId }) },
    { nom: "capacite_ouverte", args: (atelierId: string) => ({ p_atelier: atelierId, p_capacite: "qualite" }) },
  ];

  it.each(FONCTIONS_METADONNEES)("$nom est refusée à anon, même avec l'UUID exact de l'atelier", async ({ nom, args }) => {
    const { error } = await anon.rpc(nom, args(ctx.seed.atelierId));
    expect(estRefus(error), `anon a pu lire ${nom} de l'atelier ${ctx.seed.atelierId} : ${JSON.stringify(error)}`).toBe(true);
  });

  it.each(FONCTIONS_METADONNEES)("$nom reste utilisable par un compte connecté pour SON PROPRE atelier", async ({ nom, args }) => {
    const { error } = await sb.rpc(nom, args(ctx.seed.atelierId));
    expect(error, `${nom} devrait rester accessible à authenticated : ${error?.message}`).toBeNull();
  });

  it("anon ne devine rien non plus avec l'atelier d'un autre test (défense en profondeur, pas juste l'UUID du seed)", async () => {
    const { error } = await anon.rpc("plan_effectif", { p_atelier: "00000000-0000-0000-0000-000000000000" });
    expect(estRefus(error)).toBe(true);
  });
});

describe("cloisonnement par atelier", () => {
  it("un visiteur anonyme ne lit aucune donnée commerciale", async () => {
    for (const table of ["devis", "factures", "clients", "projets", "poudres", "ateliers"]) {
      attendreLectureFermee(await anon.from(table).select("id"), `${table} lue par un visiteur anonyme`);
    }
  });

  it("le compte de test ne voit que les clients de son propre atelier", async () => {
    const { data: clients } = await sb.from("clients").select("id, atelier_id");
    // Les deux clients du semis au minimum ; d'autres fichiers de la suite en créent, mais
    // aucun ne doit appartenir à un autre atelier — c'est ça, la propriété de cloisonnement.
    // (Le comptage en dur qui figurait ici rendait la suite dépendante de l'ordre des fichiers.)
    expect(clients!.length).toBeGreaterThanOrEqual(2);
    expect(clients!.some((c) => c.id === ctx.seed.clientRemiseId)).toBe(true);
    expect(clients!.some((c) => c.id === ctx.seed.clientSimpleId)).toBe(true);
    expect(clients!.every((c) => c.atelier_id === ctx.seed.atelierId)).toBe(true);
  });

  it("il ne peut pas écrire dans un autre atelier", async () => {
    const { error } = await sb.from("clients").insert({
      atelier_id: "00000000-0000-0000-0000-000000000000", type: "particulier", nom: "Intrus",
    });
    expect(error).not.toBeNull();
  });
});
