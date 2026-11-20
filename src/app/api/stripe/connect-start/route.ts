import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STRIPE_CONNECT_CLIENT_ID, SITE_URL } from "@/lib/env";

export async function GET() {
  if (!STRIPE_CONNECT_CLIENT_ID) {
    return NextResponse.json({ error: "Stripe Connect non configuré (STRIPE_CONNECT_CLIENT_ID manquant)." }, { status: 500 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", SITE_URL));

  const { data: membre } = await supabase.from("users").select("atelier_id, role").maybeSingle();
  if (!membre || membre.role !== "owner") {
    return NextResponse.redirect(new URL("/reglages?stripe=forbidden", SITE_URL));
  }

  const url = new URL("https://connect.stripe.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", STRIPE_CONNECT_CLIENT_ID);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("redirect_uri", `${SITE_URL}/api/stripe/connect-callback`);
  url.searchParams.set("state", membre.atelier_id);
  return NextResponse.redirect(url);
}
