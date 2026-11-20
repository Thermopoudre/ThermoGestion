import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!stripeConfigured) {
    return NextResponse.json({ error: "Paiement en ligne non configuré sur le serveur." }, { status: 500 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  // RLS garantit que la facture n'est lisible que si elle appartient à l'atelier de l'utilisateur.
  const { data: facture } = await supabase.from("factures").select("id, atelier_id, numero, total_ttc, public_token, status").eq("id", id).single();
  if (!facture) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  if (facture.status !== "emise") return NextResponse.json({ error: "La facture doit être émise avant de créer un lien de paiement." }, { status: 400 });

  const { data: atelier } = await supabase.from("ateliers").select("stripe_account_id").eq("id", facture.atelier_id).single();
  if (!atelier?.stripe_account_id) {
    return NextResponse.json({ error: "Connectez Stripe dans Réglages > Compte avant de générer un lien de paiement." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const opts = { stripeAccount: atelier.stripe_account_id };
    // L'API Payment Links exige un Price existant (pas de price_data inline comme pour Checkout) —
    // on crée un prix à la volée avec un produit ad-hoc, scopé au compte connecté de l'atelier.
    const price = await stripe.prices.create(
      {
        currency: "eur",
        unit_amount: Math.round(Number(facture.total_ttc) * 100),
        product_data: { name: `Facture ${facture.numero ?? ""}` },
      },
      opts
    );
    const link = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        payment_intent_data: { metadata: { facture_token: facture.public_token } },
        after_completion: { type: "redirect", redirect: { url: `${SITE_URL}/f/${facture.public_token}` } },
      },
      opts
    );
    await supabase.from("factures").update({ stripe_payment_link: link.url }).eq("id", id);
    return NextResponse.json({ url: link.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Stripe." }, { status: 500 });
  }
}
