import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { LOOKUP_KEYS, OFFRES, estCleSiege, type PlanCode } from "@/lib/abonnement";

const PLANS: PlanCode[] = OFFRES.map((o) => o.code);

/**
 * Un seul point d'entrée pour deux flux distincts :
 *  - l'encaissement des factures des ateliers (Stripe Connect, compte connecté) ;
 *  - les abonnements à Thermogestion lui-même (compte principal).
 * On les distingue par le type d'événement.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig ?? "", STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Facture d'un atelier payée par son client (Connect) ────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as unknown as { id: string; amount_received: number; metadata?: { facture_token?: string } };
    const token = pi.metadata?.facture_token;
    if (token) {
      await supabase.rpc("marquer_facture_payee", {
        p_token: token,
        p_montant: pi.amount_received / 100,
        p_stripe_payment_intent_id: pi.id,
      });
    }
    return NextResponse.json({ received: true });
  }

  // ── Abonnement à Thermogestion ─────────────────────────────────────────────
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const s = event.data.object as unknown as {
      id: string;
      customer: string;
      status: string;
      cancel_at_period_end: boolean;
      trial_end: number | null;
      current_period_start: number | null;
      current_period_end: number | null;
      metadata?: { atelier_id?: string; plan?: string };
      items?: {
        data: Array<{ quantity?: number | null; price?: { metadata?: { plan?: string }; lookup_key?: string | null } }>;
      };
    };

    // L'atelier est identifié par les métadonnées ; à défaut on retombe sur le client Stripe.
    const atelierId = s.metadata?.atelier_id ?? null;

    // Un abonnement porte désormais **deux** lignes : la formule et le siège supplémentaire.
    // Lire `items.data[0]` revenait à tirer au sort : Stripe ne garantit pas l'ordre, et un
    // abonnement Atelier + sièges pouvait se retrouver classé « formule illisible ». On désigne
    // chaque ligne par sa clé, et le siège est écarté avant toute déduction de formule.
    const lignes = s.items?.data ?? [];
    const ligneFormule =
      lignes.find((l) => LOOKUP_KEYS.some((k) => k.cle === l.price?.lookup_key && k.plan !== "siege")) ??
      lignes.find((l) => !estCleSiege(l.price?.lookup_key));
    const ligneSiege = lignes.find((l) => estCleSiege(l.price?.lookup_key));

    const lookup = ligneFormule?.price?.lookup_key ?? "";
    // La formule est lue dans les métadonnées, puis déduite de la `lookup_key`. Le repli est la
    // formule d'entrée et non la plus haute : si la clé est illisible, on ouvre le minimum plutôt
    // que d'offrir la qualité tracée à un atelier qui ne l'a pas payée. Une valeur inconnue
    // violerait de toute façon la contrainte de la colonne, ce qui est le comportement voulu.
    const planLu = s.metadata?.plan
      ?? ligneFormule?.price?.metadata?.plan
      ?? PLANS.find((p) => lookup.includes(p));
    const plan = PLANS.includes(planLu as PlanCode) ? planLu : "atelier";

    // Les sièges facturés font foi côté Stripe : pas de ligne siège, pas de siège payé. Sur un
    // abonnement résilié on remet à zéro — il n'y a plus rien à facturer, et laisser un compteur
    // à 3 rouvrirait trois places à la prochaine souscription sans qu'elles soient payées.
    const siegesSupp =
      event.type === "customer.subscription.deleted" ? 0 : Math.max(0, ligneSiege?.quantity ?? 0);

    // La périodicité n'était stockée nulle part : l'écran d'abonnement affichait un total mensuel
    // à un abonné annuel, c'est-à-dire un chiffre que sa banque ne verra jamais. On la déduit de
    // la clé de la ligne de formule, seule source qui ne peut pas mentir, et on la laisse à null
    // plutôt que de deviner « mensuel » quand la clé est illisible.
    const periode = LOOKUP_KEYS.find((k) => k.cle === lookup)?.periode ?? null;

    const secondes = (v: number | null) => (v ? new Date(v * 1000).toISOString() : null);
    const patch = {
      plan,
      // « deleted » = l'abonnement est arrivé à son terme après résiliation : l'accès se ferme.
      status: event.type === "customer.subscription.deleted" ? "canceled" : s.status,
      stripe_subscription_id: s.id,
      stripe_customer_id: typeof s.customer === "string" ? s.customer : null,
      trial_end: secondes(s.trial_end),
      current_period_start: secondes(s.current_period_start),
      current_period_end: secondes(s.current_period_end),
      cancel_at_period_end: !!s.cancel_at_period_end,
      sieges_supp: siegesSupp,
      periode,
      updated_at: new Date().toISOString(),
    };

    if (atelierId) {
      await supabase.from("subscriptions").update(patch).eq("atelier_id", atelierId);
    } else if (typeof s.customer === "string") {
      await supabase.from("subscriptions").update(patch).eq("stripe_customer_id", s.customer);
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignore: event.type });
}
