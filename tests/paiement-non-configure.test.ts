import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

/**
 * Lot D — D3 : « Paiement non configuré sur le serveur. » est du jargon d'administrateur, lu par
 * un prospect qui clique « Choisir » ou « Ajouter un siège » avant que Stripe soit branché.
 *
 * `STRIPE_SECRET_KEY` n'est pas posée dans `.env.test` (voir `.env.test.example`) : dans cet
 * environnement, `stripeConfigured` (lib/stripe.ts) est donc bien `false`, exactement comme sur un
 * atelier fraîchement installé avant le branchement de Stripe. Les trois routes de facturation
 * court-circuitent sur ce drapeau **avant** toute authentification ou tout appel à Supabase : on
 * peut donc les appeler directement, sans session, et vérifier qu'elles rendent un `code` distinct
 * du message brut. C'est ce `code` que `/abonnement` et `/reglages` traduisent en
 * « Le paiement en ligne n'est pas encore ouvert. Écrivez-nous à contact@thermopoudre.fr. » plutôt
 * que d'afficher le texte technique tel quel.
 */
describe("D3 — les routes Stripe distinguent le cas « non configuré » par un code, pas seulement un texte", () => {
  it("POST /api/billing/checkout répond STRIPE_NON_CONFIGURE sans authentification", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const req = new NextRequest("http://localhost/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "atelier", periode: "mois" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("STRIPE_NON_CONFIGURE");
    // Le texte brut reste du jargon d'administrateur : c'est au `code` que l'écran doit se fier,
    // jamais à ce texte, pour choisir le message métier.
    expect(body.error).toMatch(/non configuré/i);
  });

  it("POST /api/billing/portal répond STRIPE_NON_CONFIGURE sans authentification", async () => {
    const { POST } = await import("@/app/api/billing/portal/route");
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("STRIPE_NON_CONFIGURE");
  });

  it("POST /api/billing/sieges répond STRIPE_NON_CONFIGURE sans authentification", async () => {
    const { POST } = await import("@/app/api/billing/sieges/route");
    const req = new NextRequest("http://localhost/api/billing/sieges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sieges: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("STRIPE_NON_CONFIGURE");
  });

  it("stripeConfigured vaut false dans cet environnement de test (sinon les trois tests ci-dessus ne prouvent rien)", async () => {
    const { stripeConfigured } = await import("@/lib/stripe");
    expect(stripeConfigured).toBe(false);
  });
});
