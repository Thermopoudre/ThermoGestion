import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  LOOKUP_KEYS,
  OFFRES,
  PRIX_SIEGE_MENSUEL,
  SIEGES_INCLUS,
  estCleSiege,
  lookupKeySiege,
  nomPlan,
  type Periode,
  type PlanCode,
} from "@/lib/abonnement";

/** Même plafond que la contrainte de `subscriptions.sieges_supp` : la base refuserait au-delà,
 *  autant le dire ici plutôt que de laisser Stripe facturer une quantité que la base rejettera. */
const MAX_SIEGES = 500;

/** Statuts sous lesquels Stripe accepte encore de modifier les lignes de l'abonnement. */
const STATUTS_VIVANTS = ["active", "trialing", "past_due"];

/**
 * Ajuste le nombre de sièges supplémentaires facturés à l'atelier.
 *
 * Le corps porte le nombre **total** voulu, pas un delta : un écran qui envoie « +1 » deux fois
 * à cause d'un double-clic achèterait deux sièges. Une valeur absolue est idempotente.
 */
export async function POST(req: NextRequest) {
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
  if (!membre) return NextResponse.json({ error: "Aucun atelier." }, { status: 400 });
  if (membre.role !== "owner") {
    return NextResponse.json(
      { error: "Seul le responsable de l'atelier peut acheter ou rendre un siège." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const sieges = Number(body?.sieges);
  if (!Number.isInteger(sieges) || sieges < 0) {
    return NextResponse.json(
      { error: "Le nombre de sièges supplémentaires doit être un entier positif ou nul." },
      { status: 400 }
    );
  }
  if (sieges > MAX_SIEGES) {
    return NextResponse.json(
      { error: `Au-delà de ${MAX_SIEGES} sièges supplémentaires, contactez-nous : c'est un tarif qui se discute.` },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: sub } = await service
    .from("subscriptions")
    .select("plan, status, stripe_subscription_id, sieges_supp")
    .eq("atelier_id", membre.atelier_id)
    .maybeSingle();

  // Pendant l'essai il n'y a pas d'abonnement Stripe : la formule effective est `certifie`, donc
  // dix sièges, et personne n'a besoin d'en acheter. Vendre un siège à ce moment-là reviendrait à
  // facturer une place déjà offerte.
  if (!sub?.stripe_subscription_id || !STATUTS_VIVANTS.includes(sub.status)) {
    return NextResponse.json(
      {
        error:
          "Aucun abonnement en cours : choisissez d'abord une formule. Pendant l'essai, les 10 utilisateurs " +
          "de la formule Certifié sont déjà ouverts, il n'y a pas de siège à acheter.",
      },
      { status: 409 }
    );
  }

  const plan = (OFFRES.some((o) => o.code === sub.plan) ? sub.plan : "atelier") as PlanCode;
  const inclus = SIEGES_INCLUS[plan];

  // On ne descend jamais en dessous du nombre de places réellement prises. Le trigger de la base
  // refuserait ensuite la moindre réactivation, et surtout : désactiver un utilisateur est une
  // décision de l'atelier, pas un effet de bord d'un bouton « − ».
  const { data: occupesBrut, error: errOccupes } = await service.rpc("sieges_occupes", {
    p_atelier: membre.atelier_id,
  });
  if (errOccupes) {
    return NextResponse.json(
      { error: `Impossible de compter les utilisateurs de l'atelier : ${errOccupes.message}` },
      { status: 500 }
    );
  }
  const occupes = Number(occupesBrut ?? 0);
  if (inclus + sieges < occupes) {
    const aDesactiver = occupes - inclus - sieges;
    return NextResponse.json(
      {
        error:
          `Votre atelier occupe ${occupes} places (utilisateurs actifs et invitations en attente) et la formule ` +
          `${nomPlan(plan)} en comprend ${inclus}. Avec ${sieges} siège(s) supplémentaire(s) vous n'en couvririez ` +
          `que ${inclus + sieges} : désactivez d'abord ${aDesactiver} utilisateur(s) depuis Réglages → Équipe.`,
      },
      { status: 409 }
    );
  }

  try {
    const stripe = getStripe();
    const abonnement = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const lignes = abonnement.items.data;

    // Avec deux lignes, l'ordre n'est pas garanti : on désigne la formule par sa clé, jamais par
    // sa position. `estCleSiege` écarte le siège avant toute autre déduction.
    const ligneFormule =
      lignes.find((l) => LOOKUP_KEYS.some((k) => k.cle === l.price?.lookup_key && k.plan !== "siege")) ??
      lignes.find((l) => !estCleSiege(l.price?.lookup_key));
    const ligneSiege = lignes.find((l) => estCleSiege(l.price?.lookup_key));

    // La périodicité en vigueur est celle de la formule déjà payée : acheter un siège ne doit
    // jamais faire cohabiter un annuel et un mensuel sur le même abonnement.
    const periode: Periode =
      LOOKUP_KEYS.find((k) => k.cle === ligneFormule?.price?.lookup_key)?.periode ??
      (ligneFormule?.price?.recurring?.interval === "year" ? "an" : "mois");

    let ligne: Stripe.SubscriptionItem | null = null;

    if (sieges > 0) {
      const cleSiege = lookupKeySiege(periode);
      // `always_invoice` : l'atelier voit tout de suite ce qu'il paie au prorata, plutôt que de
      // découvrir un montant inexpliqué à l'échéance suivante.
      if (ligneSiege) {
        ligne = await stripe.subscriptionItems.update(ligneSiege.id, {
          quantity: sieges,
          proration_behavior: "always_invoice",
        });
      } else {
        const prices = await stripe.prices.list({ lookup_keys: [cleSiege], active: true, limit: 1 });
        const price = prices.data[0];
        if (!price) {
          return NextResponse.json(
            {
              error:
                `Tarif du siège supplémentaire introuvable dans Stripe (lookup_key « ${cleSiege} »). ` +
                "Créez-le avant d'ouvrir la vente de sièges.",
            },
            { status: 500 }
          );
        }
        ligne = await stripe.subscriptionItems.create({
          subscription: sub.stripe_subscription_id,
          price: price.id,
          quantity: sieges,
          proration_behavior: "always_invoice",
        });
      }
    } else if (ligneSiege) {
      // Zéro siège n'est pas « une ligne à zéro » : Stripe refuse `quantity: 0` sur bien des
      // tarifs et la facture porterait une ligne fantôme. On retire la ligne.
      await stripe.subscriptionItems.del(ligneSiege.id, { proration_behavior: "always_invoice" });
    }

    // `customer.subscription.updated` va suivre et réécrire la même valeur ; on l'écrit tout de
    // suite pour que l'écran soit juste au retour, sans attendre le webhook. La source est la
    // réponse de Stripe et non le corps de la requête : c'est Stripe qui facture, pas le client.
    const quantite = Math.max(0, ligne?.quantity ?? 0);
    await service
      .from("subscriptions")
      .update({ sieges_supp: quantite, updated_at: new Date().toISOString() })
      .eq("atelier_id", membre.atelier_id);

    return NextResponse.json({
      sieges: quantite,
      inclus,
      autorises: inclus + quantite,
      occupes,
      cout_mensuel: quantite * PRIX_SIEGE_MENSUEL,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Stripe." }, { status: 500 });
  }
}
