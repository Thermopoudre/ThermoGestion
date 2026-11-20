import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "@/lib/env";

/** true si les variables STRIPE_* sont configurées côté serveur (voir env.ts et le récap de déploiement). */
export const stripeConfigured = !!STRIPE_SECRET_KEY;

export function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY manquant — paiement en ligne non configuré côté serveur.");
  }
  return new Stripe(STRIPE_SECRET_KEY);
}
