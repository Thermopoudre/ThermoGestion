import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";
import { OFFRES, SIEGES_INCLUS, lookupKey, lookupKeySiege, nomPlan, type PlanCode, type Periode } from "@/lib/abonnement";

export async function POST(req: NextRequest) {
  if (!stripeConfigured) {
    // D3 — code distinct du message : l'écran doit pouvoir remplacer ce jargon d'administrateur
    // par une phrase métier sans avoir à parser le texte français.
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
    return NextResponse.json({ error: "Seul le responsable de l'atelier peut souscrire." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = (body.plan ?? "atelier") as PlanCode;
  const periode = (body.periode ?? "mois") as Periode;
  // La liste des formules vient de `lib/abonnement.ts` : ajouter une formule ne doit pas demander
  // de retoucher cette route, sous peine d'un tarif proposé à l'écran et refusé au paiement.
  if (!OFFRES.some((o) => o.code === plan) || !["mois", "an"].includes(periode)) {
    return NextResponse.json({ error: "Offre inconnue." }, { status: 400 });
  }

  const { data: atelier } = await supabase
    .from("ateliers").select("nom, email, siren, tva_intra, adresse, code_postal, ville")
    .eq("id", membre.atelier_id).single();

  try {
    const stripe = getStripe();

    // Le tarif est retrouvé par lookup_key : changer un prix dans Stripe ne demande pas
    // de redéploiement, il suffit d'y déplacer la clé.
    const cle = lookupKey(plan, periode);
    const prices = await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) {
      return NextResponse.json(
        { error: `Tarif introuvable dans Stripe (lookup_key « ${cle} »). Créez-le avant d'ouvrir les abonnements.` },
        { status: 500 }
      );
    }

    // Un seul client Stripe par atelier, réutilisé d'une souscription à l'autre.
    const service = createServiceClient();
    const { data: sub } = await service
      .from("subscriptions").select("id, stripe_customer_id, trial_end, status")
      .eq("atelier_id", membre.atelier_id).maybeSingle();

    // L'atelier arrive de l'essai, où la formule effective est `certifie` : il a donc pu monter
    // jusqu'à dix personnes. La formule qu'il choisit aujourd'hui n'en couvre pas forcément
    // autant. Sans ce comptage, on lui vendrait deux sièges alors qu'il en occupe cinq, et la
    // base refuserait la première invitation suivante — après paiement, ce qui est indéfendable.
    // Le compte vient de `sieges_occupes()` et non d'un SELECT recopié ici : deux façons de
    // compter les mêmes personnes finissent toujours par diverger.
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
    const siegesSupp = Math.max(0, occupes - SIEGES_INCLUS[plan]);

    const lineItems: { price: string; quantity: number }[] = [{ price: price.id, quantity: 1 }];
    if (siegesSupp > 0) {
      const cleSiege = lookupKeySiege(periode);
      const prixSieges = await stripe.prices.list({ lookup_keys: [cleSiege], active: true, limit: 1 });
      const priceSiege = prixSieges.data[0];
      if (!priceSiege) {
        // Même exigence que pour la formule : on nomme la clé manquante. Un « erreur Stripe »
        // opaque coûterait une heure de recherche le jour où le tarif n'aura pas été créé.
        return NextResponse.json(
          {
            error:
              `Tarif du siège supplémentaire introuvable dans Stripe (lookup_key « ${cleSiege} »). ` +
              `Cet atelier occupe ${occupes} places pour ${SIEGES_INCLUS[plan]} comprises dans la formule ` +
              `${nomPlan(plan)} : créez ce tarif avant d'ouvrir les abonnements.`,
          },
          { status: 500 }
        );
      }
      lineItems.push({ price: priceSiege.id, quantity: siegesSupp });
    }

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: atelier?.email ?? user.email ?? undefined,
        name: atelier?.nom ?? undefined,
        address: atelier?.adresse
          ? { line1: atelier.adresse, postal_code: atelier.code_postal ?? undefined, city: atelier.ville ?? undefined, country: "FR" }
          : undefined,
        metadata: { atelier_id: membre.atelier_id, siren: atelier?.siren ?? "" },
      });
      customerId = customer.id;
      await service.from("subscriptions").update({ stripe_customer_id: customerId }).eq("atelier_id", membre.atelier_id);
    }

    // Si l'essai n'est pas terminé, on le laisse courir jusqu'à son terme : l'atelier
    // qui souscrit tôt ne doit pas être pénalisé en perdant ses jours restants.
    const finEssai = sub?.status === "trialing" && sub.trial_end ? new Date(sub.trial_end).getTime() : 0;
    const trialEndTimestamp = finEssai > Date.now() ? Math.floor(finEssai / 1000) : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      locale: "fr",
      allow_promotion_codes: true,
      client_reference_id: membre.atelier_id,
      subscription_data: {
        trial_end: trialEndTimestamp,
        metadata: { atelier_id: membre.atelier_id, plan },
      },
      metadata: { atelier_id: membre.atelier_id, plan },
      success_url: `${SITE_URL}/abonnement?ok=1`,
      cancel_url: `${SITE_URL}/abonnement?annule=1`,
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      billing_address_collection: "required",
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur Stripe." }, { status: 500 });
  }
}
