import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";

/** Portail Stripe : changer de carte, télécharger ses factures, résilier.
 *  Tout est géré par Stripe — on n'héberge jamais de données de carte. */
export async function POST() {
  if (!stripeConfigured) {
    // D3 — code distinct du message : voir la même remarque dans /api/billing/checkout.
    return NextResponse.json(
      { error: "Paiement non configuré sur le serveur.", code: "STRIPE_NON_CONFIGURE" },
      { status: 500 },
    );
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: membre } = await supabase.from("users").select("atelier_id, role").maybeSingle();
  if (!membre || membre.role !== "owner") {
    return NextResponse.json({ error: "Seul le responsable de l'atelier peut gérer l'abonnement." }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: sub } = await service
    .from("subscriptions").select("stripe_customer_id").eq("atelier_id", membre.atelier_id).maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun abonnement à gérer pour le moment." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${SITE_URL}/abonnement`,
      locale: "fr",
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Stripe." }, { status: 500 });
  }
}
