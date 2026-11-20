import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error_description");
  if (err) return NextResponse.redirect(new URL(`/reglages?stripe=error&msg=${encodeURIComponent(err)}`, SITE_URL));
  if (!code) return NextResponse.redirect(new URL("/reglages?stripe=error", SITE_URL));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", SITE_URL));

  const { data: membre } = await supabase.from("users").select("atelier_id, role").maybeSingle();
  if (!membre || membre.atelier_id !== state || membre.role !== "owner") {
    return NextResponse.redirect(new URL("/reglages?stripe=forbidden", SITE_URL));
  }

  try {
    const stripe = getStripe();
    const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
    await supabase.from("ateliers").update({ stripe_account_id: response.stripe_user_id }).eq("id", membre.atelier_id);
    return NextResponse.redirect(new URL("/reglages?stripe=connected", SITE_URL));
  } catch {
    return NextResponse.redirect(new URL("/reglages?stripe=error", SITE_URL));
  }
}
